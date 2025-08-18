/**
 * QRScanner - Organismo para escaneo de códigos QR de facturas DIAN
 * Utiliza la cámara del dispositivo para detectar y procesar códigos QR
 * Extrae automáticamente el CUFE y valida el formato
 */

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import {
  extractCufeFromQR,
  isPotentialDianInvoiceQR,
} from '@/lib/validations/cufe-validator';

// Tipos para el escáner QR
interface QRScannerProps {
  onQRDetected: (cufeCode: string, qrContent: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  isActive?: boolean;
  className?: string;
}

interface QRScanResult {
  cufe: string | null;
  originalContent: string;
  isDianInvoice: boolean;
  confidence: number;
}

export default function QRScanner({
  onQRDetected,
  onError,
  onClose,
  isActive = false,
  className = '',
}: QRScannerProps) {
  // Estados del componente
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastScanResult, setLastScanResult] = useState<QRScanResult | null>(
    null,
  );
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // Referencias
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Solicita permisos de cámara y obtiene lista de dispositivos
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);

      // Solicitar permisos básicos
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // Preferir cámara trasera
      });

      // Limpiar stream temporal
      stream.getTracks().forEach(track => track.stop());

      // Obtener lista de dispositivos de video
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = deviceList.filter(
        device => device.kind === 'videoinput',
      );

      setDevices(videoDevices);
      setHasPermission(true);

      // Seleccionar cámara trasera por defecto si está disponible
      const backCamera = videoDevices.find(
        device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment'),
      );

      setSelectedDeviceId(
        backCamera?.deviceId || videoDevices[0]?.deviceId || '',
      );

      return true;
    } catch (err) {
      console.error('Error solicitando permisos de cámara:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      setError(`Error de permisos: ${errorMessage}`);
      setHasPermission(false);
      onError?.(errorMessage);
      return false;
    }
  }, [onError]);

  /**
   * Inicia el stream de video
   */
  const startVideoStream = useCallback(
    async (deviceId?: string): Promise<boolean> => {
      try {
        if (!videoRef.current) return false;

        setError(null);

        // Configurar constraints de video
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            facingMode: deviceId ? undefined : 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };

        // Obtener stream
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Asignar al elemento video
        videoRef.current.srcObject = stream;

        return new Promise(resolve => {
          if (!videoRef.current) {
            resolve(false);
            return;
          }

          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play();
              resolve(true);
            }
          };
        });
      } catch (err) {
        console.error('Error iniciando stream de video:', err);
        const errorMessage =
          err instanceof Error ? err.message : 'Error iniciando cámara';
        setError(errorMessage);
        onError?.(errorMessage);
        return false;
      }
    },
    [onError],
  );

  /**
   * Detiene el stream de video
   */
  const stopVideoStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Analiza un frame del video en busca de códigos QR
   */
  const analyzeFrame = useCallback((): QRScanResult | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return null;
    }

    const context = canvas.getContext('2d');
    if (!context) return null;

    // Configurar canvas con las dimensiones del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar frame actual
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      // Obtener datos de imagen
              const _imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      // Aquí usaríamos una librería de QR como jsQR o qr-scanner
      // Por ahora, simulamos la detección para desarrollo
      // En producción, reemplazar con librería real:

      // import jsQR from 'jsqr';
      // const qrCode = jsQR(imageData.data, imageData.width, imageData.height);

      // Simulación para desarrollo - remover cuando se integre librería real
      return null;
    } catch (err) {
      console.error('Error analizando frame:', err);
      return null;
    }
  }, []);

  /**
   * Procesa el resultado de un QR detectado
   */
  const processQRResult = useCallback(
    (qrContent: string) => {
      // Verificar si es potencialmente una factura DIAN
      const isDianInvoice = isPotentialDianInvoiceQR(qrContent);
      let confidence = isDianInvoice ? 0.8 : 0.2;

      // Extraer CUFE del contenido
      const extractedCufe = extractCufeFromQR(qrContent);

      if (extractedCufe) {
        confidence = 0.95; // Alta confianza si se extrajo CUFE exitosamente
      }

      const result: QRScanResult = {
        cufe: extractedCufe,
        originalContent: qrContent,
        isDianInvoice,
        confidence,
      };

      setLastScanResult(result);

      // Si se extrajo un CUFE válido, notificar al componente padre
      if (extractedCufe) {
        onQRDetected(extractedCufe, qrContent);
        setIsScanning(false); // Detener escaneo automáticamente
      }

      return result;
    },
    [onQRDetected],
  );

  /**
   * Loop principal de escaneo
   */
  const scanLoop = useCallback(() => {
    if (!isScanning) return;

    const result = analyzeFrame();
    if (result && result.cufe) {
      processQRResult(result.originalContent);
    }

    // Continuar escaneando
    scanIntervalRef.current = setTimeout(scanLoop, 100); // 10 FPS
  }, [isScanning, analyzeFrame, processQRResult]);

  /**
   * Inicia el proceso de escaneo
   */
  const startScanning = useCallback(async () => {
    try {
      setError(null);
      setLastScanResult(null);

      // Verificar permisos
      if (hasPermission === null) {
        const granted = await requestCameraPermission();
        if (!granted) return;
      }

      // Iniciar stream de video
      const streamStarted = await startVideoStream(selectedDeviceId);
      if (!streamStarted) return;

      // Iniciar loop de escaneo
      setIsScanning(true);

      // Pequeño delay para que el video se estabilice
      setTimeout(() => {
        scanLoop();
      }, 500);
    } catch (err) {
      console.error('Error iniciando escaneo:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Error iniciando escaneo';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [
    hasPermission,
    requestCameraPermission,
    startVideoStream,
    selectedDeviceId,
    scanLoop,
    onError,
  ]);

  /**
   * Detiene el proceso de escaneo
   */
  const stopScanning = useCallback(() => {
    setIsScanning(false);

    if (scanIntervalRef.current) {
      clearTimeout(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    stopVideoStream();
  }, [stopVideoStream]);

  /**
   * Cambia la cámara seleccionada
   */
  const switchCamera = useCallback(
    async (deviceId: string) => {
      setSelectedDeviceId(deviceId);

      if (isScanning) {
        stopVideoStream();
        await startVideoStream(deviceId);
      }
    },
    [isScanning, stopVideoStream, startVideoStream],
  );

  // Efecto para activar/desactivar escáner
  useEffect(() => {
    if (isActive && !isScanning) {
      startScanning();
    } else if (!isActive && isScanning) {
      stopScanning();
    }
  }, [isActive, isScanning, startScanning, stopScanning]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <Card variant="glass" className={`qr-scanner ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          📱 Escáner de Códigos QR
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/10"
            >
              ✕
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Estado de permisos */}
        {hasPermission === null && (
          <div className="text-center py-8">
            <div className="text-yellow-400 mb-4">
              📷 Se requieren permisos de cámara
            </div>
            <Button
              variant="gradient"
              onClick={requestCameraPermission}
              className="w-full"
            >
              Solicitar Permisos
            </Button>
          </div>
        )}

        {hasPermission === false && (
          <div className="text-center py-8">
            <div className="text-red-400 mb-4">
              ❌ Permisos de cámara denegados
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Para escanear códigos QR, necesitas permitir el acceso a la
              cámara.
            </p>
            <Button
              variant="outline"
              onClick={requestCameraPermission}
              className="w-full text-white border-gray-600"
            >
              Reintentar Permisos
            </Button>
          </div>
        )}

        {/* Interfaz principal de escaneo */}
        {hasPermission === true && (
          <>
            {/* Controles de cámara */}
            <div className="flex gap-2 items-center">
              {devices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={e => switchCamera(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                >
                  {devices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label ||
                        `Cámara ${device.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}

              <Button
                variant={isScanning ? 'destructive' : 'gradient'}
                onClick={isScanning ? stopScanning : startScanning}
                size="sm"
              >
                {isScanning ? 'Detener' : 'Escanear'}
              </Button>
            </div>

            {/* Vista de cámara */}
            <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Overlay de escaneo */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-blue-400 w-64 h-64 rounded-lg opacity-50">
                    <div className="w-full h-full border-4 border-transparent border-t-blue-400 border-l-blue-400 rounded-lg animate-pulse" />
                  </div>
                </div>
              )}

              {/* Indicador de estado */}
              <div className="absolute top-4 left-4 px-3 py-1 bg-black/50 rounded-full text-white text-xs">
                {isScanning ? '🔍 Buscando QR...' : '📷 Cámara lista'}
              </div>
            </div>

            {/* Canvas oculto para procesamiento */}
            <canvas
              ref={canvasRef}
              className="hidden"
              width="640"
              height="480"
            />

            {/* Resultado del último escaneo */}
            {lastScanResult && (
              <div
                className={`p-3 rounded-lg border ${
                  lastScanResult.cufe
                    ? 'bg-green-500/10 border-green-500/20 text-green-400'
                    : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}
              >
                <div className="font-medium mb-1">
                  {lastScanResult.cufe
                    ? '✅ CUFE detectado'
                    : '⚠️ QR detectado'}
                </div>
                <div className="text-sm opacity-80">
                  Confianza: {Math.round(lastScanResult.confidence * 100)}%
                </div>
                {lastScanResult.cufe && (
                  <div className="text-xs font-mono mt-1 break-all">
                    {lastScanResult.cufe}
                  </div>
                )}
              </div>
            )}

            {/* Mensajes de error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg text-red-400">
                <div className="font-medium">❌ Error</div>
                <div className="text-sm">{error}</div>
              </div>
            )}

            {/* Instrucciones */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-300 text-sm">
              <div className="font-medium mb-1">💡 Instrucciones:</div>
              <ul className="space-y-1 text-xs">
                <li>• Apunta la cámara hacia el código QR de la factura</li>
                <li>• Mantén el QR centrado y bien iluminado</li>
                <li>
                  • El escaneo se detendrá automáticamente al detectar un CUFE
                </li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
