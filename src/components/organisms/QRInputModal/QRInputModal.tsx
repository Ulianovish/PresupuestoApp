/**
 * QRInputModal - Modal híbrido para escanear QR o ingresar CUFE manualmente
 * Versión práctica que funciona tanto en móvil como desktop
 */

'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import {
  extractCufeFromQR,
  validateCufeCode,
  normalizeCufeCode,
} from '@/lib/validations/cufe-validator';

interface QRInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCufeDetected: (cufeCode: string) => void;
  title?: string;
}

type InputMode = 'choice' | 'input' | 'scan';

export default function QRInputModal({
  isOpen,
  onClose,
  onCufeDetected,
  title = 'Agregar Factura Electrónica',
}: QRInputModalProps) {
  const [mode, setMode] = useState<InputMode>('choice');
  const [input, setInput] = useState('');
  const [validation, setValidation] = useState<{
    isValid: boolean;
    error?: string;
    cufe?: string;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Resetear estados al abrir/cerrar
  const resetStates = useCallback(() => {
    setMode('choice');
    setInput('');
    setValidation(null);
    setIsValidating(false);
  }, []);

  const handleClose = useCallback(() => {
    resetStates();
    onClose();
  }, [resetStates, onClose]);

  // Validar contenido ingresado (CUFE directo o contenido QR)
  const validateInput = useCallback(async (input: string) => {
    if (!input.trim()) {
      setValidation({
        isValid: false,
        error: 'Ingresa un código CUFE o contenido QR',
      });
      return;
    }

    setIsValidating(true);

    try {
      const cleanInput = input.trim();
      let cufeToValidate = cleanInput;

      // Estrategia inteligente: intentar extraer CUFE primero
      const extractedCufe = extractCufeFromQR(cleanInput);
      if (extractedCufe) {
        // Se pudo extraer CUFE desde el contenido (URL, JSON, etc.)
        cufeToValidate = extractedCufe;
      } else {
        // No se pudo extraer, asumir que es CUFE directo
        cufeToValidate = cleanInput;
      }

      // Normalizar y validar formato
      const normalizedCufe = normalizeCufeCode(cufeToValidate);
      const result = await validateCufeCode(normalizedCufe);

      if (result.is_valid) {
        setValidation({
          isValid: true,
          cufe: normalizedCufe,
        });
      } else {
        setValidation({
          isValid: false,
          error: result.error_message || 'Código CUFE inválido',
        });
      }
    } catch (error) {
      setValidation({
        isValid: false,
        error:
          error instanceof Error ? error.message : 'Error validando código',
      });
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Manejar envío de formulario
  const handleSubmit = useCallback(() => {
    console.log('🚀 QRInputModal: handleSubmit llamado');
    console.log('🔍 Validation:', validation);

    if (validation?.isValid && validation.cufe) {
      console.log('✅ Validación exitosa, CUFE:', validation.cufe);
      console.log('📞 Llamando onCufeDetected...');
      onCufeDetected(validation.cufe);
      console.log('✅ onCufeDetected completado - NO cerrando modal todavía');
      // NO cerrar el modal aquí - dejar que el workflow lo maneje
      // handleClose();
    } else {
      console.warn('❌ Validación falló o CUFE no disponible:', {
        isValid: validation?.isValid,
        cufe: validation?.cufe,
      });
    }
  }, [validation, onCufeDetected]);

  // Manejar entrada de contenido (CUFE o QR)
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setValidation(null);
  }, []);

  // Ejemplos de contenido válido para ayuda
  const exampleInputs = [
    {
      label: 'CUFE directo (96 caracteres)',
      value:
        'fe8b0ece665f054b2949685fc3b3f0fd681888381b5169f661f60ad2d88b3710e9a1f8200d51827c58e8011265d1e0b4',
    },
    {
      label: 'URL del QR DIAN',
      value:
        'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=fe8b0ece665f054b...',
    },
    {
      label: 'UUID estándar',
      value: '12345678-1234-1234-1234-123456789012',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card variant="glass" className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            {title}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-white hover:bg-white/10"
            >
              ✕
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Selección de modo */}
          {mode === 'choice' && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                ¿Cómo quieres agregar la factura?
              </p>

              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="gradient"
                  onClick={() => setMode('input')}
                  className="w-full p-4 h-auto"
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">📝</div>
                    <div className="font-medium">Ingresar CUFE / QR</div>
                    <div className="text-xs opacity-80">
                      Código directo o contenido QR
                    </div>
                  </div>
                </Button>

                {/* Botón de escaneo real (futuro) */}
                <Button
                  variant="glass"
                  onClick={() => setMode('scan')}
                  className="w-full p-4 h-auto"
                  disabled
                >
                  <div className="text-center">
                    <div className="text-lg mb-1">📸</div>
                    <div className="font-medium">Escanear QR</div>
                    <div className="text-xs opacity-60">
                      Próximamente disponible
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Entrada unificada de CUFE / QR */}
          {mode === 'input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-white font-medium mb-2">
                  Código CUFE o Contenido QR
                </label>
                <textarea
                  value={input}
                  onChange={e => handleInputChange(e.target.value)}
                  placeholder="Pega aquí el código CUFE directo, URL del QR, o cualquier contenido QR..."
                  className="w-full h-32 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white placeholder-gray-400 text-sm resize-none focus:border-blue-500 focus:ring-blue-500/20"
                />
              </div>

              {/* Ejemplos inteligentes */}
              <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                <div className="text-blue-400 font-medium text-sm mb-2">
                  💡 Ejemplos de contenido válido:
                </div>
                <div className="space-y-1">
                  {exampleInputs.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleInputChange(example.value)}
                      className="block w-full text-left text-xs hover:text-white hover:bg-white/5 p-1 rounded transition-colors"
                    >
                      <div className="text-gray-400 font-mono">
                        {example.value.length > 45
                          ? `${example.value.substring(0, 45)}...`
                          : example.value}
                      </div>
                      <div className="text-blue-300 text-xs mt-1">
                        {example.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Información de detección automática */}
              <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                <div className="text-green-400 font-medium text-sm mb-1">
                  🤖 Detección Automática:
                </div>
                <ul className="text-green-300 text-xs space-y-1">
                  <li>• Detecta automáticamente URLs de QR DIAN</li>
                  <li>• Extrae CUFE de JSON estructurado</li>
                  <li>• Reconoce códigos CUFE directos</li>
                  <li>
                    • Solo pega el contenido y el sistema se encarga del resto
                  </li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setMode('choice')}
                  className="flex-1 text-white border-gray-600"
                >
                  Atrás
                </Button>
                <Button
                  variant="gradient"
                  onClick={() => validateInput(input)}
                  disabled={!input.trim() || isValidating}
                  className="flex-1"
                >
                  {isValidating ? 'Validando...' : 'Procesar QR'}
                </Button>
              </div>
            </div>
          )}

          {/* Escaneo con cámara (placeholder) */}
          {mode === 'scan' && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  📸 Función de escaneo con cámara
                </div>
                <p className="text-gray-500 text-sm">
                  Esta funcionalidad estará disponible próximamente. Por ahora,
                  usa la opción de ingreso manual.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => setMode('choice')}
                className="w-full text-white border-gray-600"
              >
                Volver a opciones
              </Button>
            </div>
          )}

          {/* Resultado de validación */}
          {validation && (
            <div
              className={`p-3 rounded-lg border ${
                validation.isValid
                  ? 'bg-green-500/10 border-green-500/20 text-green-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              <div className="font-medium mb-1">
                {validation.isValid
                  ? '✅ CUFE válido'
                  : '❌ Error de validación'}
              </div>
              {validation.error && (
                <div className="text-sm">{validation.error}</div>
              )}
              {validation.cufe && (
                <div className="text-xs font-mono mt-2 break-all">
                  {validation.cufe}
                </div>
              )}
            </div>
          )}

          {/* Botón de continuar */}
          {validation?.isValid && (
            <Button
              variant="gradient"
              onClick={() => {
                console.log('🔘 Click en botón "Procesar Factura"');
                handleSubmit();
              }}
              className="w-full"
            >
              Procesar Factura
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
