/**
 * InvoiceProcessingModal - Modal para mostrar progreso de procesamiento de facturas
 * Muestra progreso en tiempo real, información de captchas y resultados
 */

'use client';

import { useEffect } from 'react';
import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import { useElectronicInvoices } from '@/hooks/useElectronicInvoices';
import type { SuggestedExpense } from '@/types/electronic-invoices';

interface InvoiceProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  cufeCode?: string;
  onCompleted?: (expenses: SuggestedExpense[]) => void;
  onSaveExpenses?: (expenses: SuggestedExpense[]) => void;
  autoProcess?: boolean;
}

export default function InvoiceProcessingModal({
  isOpen,
  onClose,
  cufeCode,
  onCompleted,
  onSaveExpenses,
  autoProcess = true,
}: InvoiceProcessingModalProps) {
  const {
    processing_status,
    progress,
    status_message,
    status_details,
    current_invoice,
    suggested_expenses,
    error: processingError,
    processing_info,
    processFromQR,
    processAndSave,
    resetProcessing,
    cancelProcessing,
  } = useElectronicInvoices();

  // Debug: Mostrar props y estado
  useEffect(() => {
    console.error('🔍 InvoiceProcessingModal props:', {
      isOpen,
      cufeCode,
      autoProcess,
      processing_status,
    });
  }, [isOpen, cufeCode, autoProcess, processing_status]);

  // Auto-procesar cuando se abre el modal
  useEffect(() => {
    console.error('🚀 InvoiceProcessingModal: Evaluando auto-proceso:', {
      isOpen,
      cufeCode,
      autoProcess,
      processing_status,
    });

    if (isOpen && cufeCode && autoProcess && processing_status === 'idle') {
      console.error('✅ Iniciando procesamiento automático...');
      handleStartProcessing();
    }
  }, [isOpen, cufeCode, autoProcess, processing_status]);

  // Notificar cuando el procesamiento se complete
  useEffect(() => {
    if (
      processing_status === 'success' &&
      current_invoice &&
      suggested_expenses.length > 0
    ) {
      onCompleted?.(suggested_expenses);
    }
  }, [processing_status, current_invoice, suggested_expenses, onCompleted]);

  const handleStartProcessing = async () => {
    if (!cufeCode) return;

    try {
      resetProcessing();
      await processFromQR(cufeCode, {
        maxRetries: 3,
      });
    } catch (error) {
      console.error('Error procesando factura:', error);
    }
  };

  const handleSaveExpenses = () => {
    if (suggested_expenses.length > 0) {
      onSaveExpenses?.(suggested_expenses);
    }
  };

  const handleSaveAndProcess = async () => {
    if (!cufeCode) return;

    try {
      await processAndSave(cufeCode, suggested_expenses);
      onClose();
    } catch (error) {
      console.error('Error guardando factura:', error);
    }
  };

  const handleCancel = () => {
    if (
      processing_status === 'downloading' ||
      processing_status === 'extracting'
    ) {
      cancelProcessing();
    }
    resetProcessing();
    onClose();
  };

  const handleRetry = () => {
    if (cufeCode) {
      handleStartProcessing();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card
        variant="glass"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            🧾 Procesando Factura Electrónica
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-white hover:bg-white/10"
            >
              ✕
            </Button>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Información del CUFE */}
          {cufeCode && (
            <div className="bg-slate-800/50 p-3 rounded-lg">
              <div className="text-white font-medium mb-1">Código CUFE:</div>
              <div className="text-xs font-mono text-gray-400 break-all">
                {cufeCode}
              </div>
            </div>
          )}

          {/* Estado Idle - Esperando inicio */}
          {processing_status === 'idle' && !processingError && (
            <div className="text-center py-8">
              <div className="text-blue-400 mb-4 text-lg">
                🚀 Listo para procesar
              </div>
              <Button
                variant="gradient"
                onClick={handleStartProcessing}
                disabled={!cufeCode}
                className="w-full"
              >
                Iniciar Procesamiento
              </Button>
            </div>
          )}

          {/* Progreso en tiempo real */}
          {(processing_status === 'validating' ||
            processing_status === 'downloading' ||
            processing_status === 'extracting' ||
            processing_status === 'saving') && (
            <div className="space-y-4">
              {/* Barra de progreso */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Progreso</span>
                  <span className="text-blue-400 font-mono text-sm">
                    {progress}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Estado actual */}
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <div className="text-white font-medium mb-2">
                  {status_message}
                </div>
                {status_details && (
                  <div className="text-gray-400 text-sm">{status_details}</div>
                )}

                {/* Información específica de captcha */}
                {processing_info.captcha_info && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-amber-400">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">
                        🔐 Captcha {processing_info.captcha_info.number}
                      </span>
                      <span className="text-xs bg-amber-500/20 px-2 py-1 rounded">
                        {processing_info.captcha_info.status}
                      </span>
                    </div>

                    {processing_info.captcha_info.taskId && (
                      <div className="text-xs">
                        <strong>Task ID:</strong>{' '}
                        {processing_info.captcha_info.taskId}
                      </div>
                    )}

                    {processing_info.captcha_info.attempt &&
                      processing_info.captcha_info.maxAttempts && (
                        <div className="text-xs">
                          <strong>Intento:</strong>{' '}
                          {processing_info.captcha_info.attempt}/
                          {processing_info.captcha_info.maxAttempts}
                        </div>
                      )}

                    {processing_info.captcha_info.solveTime && (
                      <div className="text-xs">
                        <strong>Tiempo de resolución:</strong>{' '}
                        {processing_info.captcha_info.solveTime}s
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Botón de cancelar durante procesamiento */}
              {(processing_status === 'downloading' ||
                processing_status === 'extracting') && (
                <Button
                  variant="outline"
                  onClick={cancelProcessing}
                  className="w-full text-white border-gray-600 hover:bg-gray-700"
                >
                  Cancelar Procesamiento
                </Button>
              )}
            </div>
          )}

          {/* Procesamiento completado exitosamente */}
          {processing_status === 'success' && current_invoice && (
            <div className="space-y-4">
              {/* Información de la factura */}
              <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                <div className="text-green-400 font-medium mb-3">
                  ✅ Factura procesada exitosamente
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong className="text-green-400">Proveedor:</strong>
                    <div className="text-white">
                      {current_invoice.supplier_name}
                    </div>
                  </div>
                  <div>
                    <strong className="text-green-400">NIT:</strong>
                    <div className="text-white">
                      {current_invoice.supplier_nit}
                    </div>
                  </div>
                  <div>
                    <strong className="text-green-400">Fecha:</strong>
                    <div className="text-white">
                      {current_invoice.invoice_date}
                    </div>
                  </div>
                  <div>
                    <strong className="text-green-400">Total:</strong>
                    <div className="text-white font-mono">
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        minimumFractionDigits: 0,
                      }).format(current_invoice.total_amount)}
                    </div>
                  </div>
                </div>

                {processing_info.items_found && (
                  <div className="mt-3 text-sm text-gray-400">
                    <strong>Items encontrados:</strong>{' '}
                    {processing_info.items_found}
                  </div>
                )}
              </div>

              {/* Gastos sugeridos */}
              {suggested_expenses.length > 0 && (
                <div className="space-y-3">
                  <div className="text-white font-medium">
                    💰 Gastos Sugeridos ({suggested_expenses.length})
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {suggested_expenses.map((expense, index) => (
                      <div
                        key={expense.id}
                        className="bg-slate-800/50 p-3 rounded-lg border border-slate-700"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-white font-medium text-sm">
                              {expense.description}
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                              Categoría sugerida: {expense.suggested_category}
                            </div>
                            {expense.place && (
                              <div className="text-gray-500 text-xs">
                                Lugar: {expense.place}
                              </div>
                            )}
                          </div>
                          <div className="text-blue-400 font-mono text-sm">
                            {new Intl.NumberFormat('es-CO', {
                              style: 'currency',
                              currency: 'COP',
                              minimumFractionDigits: 0,
                            }).format(expense.amount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-3">
                <Button
                  variant="gradient"
                  onClick={handleSaveAndProcess}
                  className="flex-1"
                >
                  Guardar en Supabase
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSaveExpenses}
                  className="flex-1 text-white border-gray-600 hover:bg-gray-700"
                >
                  Solo Gastos
                </Button>
              </div>
            </div>
          )}

          {/* Error en el procesamiento */}
          {processingError && (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                <div className="text-red-400 font-medium mb-2">
                  ❌ Error en el procesamiento
                </div>
                <div className="text-red-300 text-sm">{processingError}</div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="gradient"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  Reintentar
                </Button>
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 text-white border-gray-600 hover:bg-gray-700"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          )}

          {/* Información adicional */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-blue-300 text-xs">
            <div className="font-medium mb-1">
              ℹ️ Proceso de Facturación DIAN:
            </div>
            <ul className="space-y-1">
              <li>• Conecta con el portal oficial de DIAN</li>
              <li>• Resuelve captchas automáticamente con 2captcha</li>
              <li>• Extrae datos usando IA (pdfplumber + camelot)</li>
              <li>• Categoriza gastos automáticamente</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
