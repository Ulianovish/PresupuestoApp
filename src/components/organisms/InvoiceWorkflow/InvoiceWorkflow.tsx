/**
 * InvoiceWorkflow - Componente completo para el flujo de facturas electrónicas
 * Combina QRInputModal + InvoiceProcessingModal en un flujo unificado
 */

'use client';

import React from 'react';

import QRInputModal from '@/components/organisms/QRInputModal/QRInputModal';
import InvoiceProcessingModal from '@/components/organisms/InvoiceProcessingModal/InvoiceProcessingModal';
import { useInvoiceWorkflow } from '@/hooks/useInvoiceWorkflow';

import type { SuggestedExpense } from '@/types/electronic-invoices';

interface InvoiceWorkflowProps {
  // Callbacks para integración con el sistema padre
  onExpensesAdded?: (expenses: SuggestedExpense[]) => void;
  onInvoiceSaved?: (invoiceId: string, expensesCount: number) => void;
  onError?: (error: string) => void;

  // Control externo
  isOpen?: boolean;
  onClose?: () => void;

  // Configuración
  title?: string;
  allowDirectSave?: boolean; // Permitir guardar directamente en Supabase
}

export default function InvoiceWorkflow({
  onExpensesAdded,
  onInvoiceSaved: _onInvoiceSaved,
  onError,
  isOpen = false,
  onClose,
  title = 'Nueva Factura Electrónica',
  allowDirectSave = true,
}: InvoiceWorkflowProps) {
  const {
    showQRModal,
    showProcessingModal,
    currentCufe,
    processedExpenses: _processedExpenses,
    isSaving: _isSaving,
    openQRModal,
    closeQRModal: _closeQRModal,
    closeProcessingModal: _closeProcessingModal,
    handleCufeDetected,
    handleProcessingCompleted,
    handleSaveExpenses,
    resetWorkflow,
  } = useInvoiceWorkflow();

  // Debug: Mostrar estados actuales
  React.useEffect(() => {
    console.error('🔍 InvoiceWorkflow estado:', {
      showQRModal,
      showProcessingModal,
      currentCufe,
      isOpen,
    });
  }, [showQRModal, showProcessingModal, currentCufe, isOpen]);

  // Abrir automáticamente el QR modal cuando se active el componente
  React.useEffect(() => {
    console.error('🔄 InvoiceWorkflow useEffect evaluando:', {
      isOpen,
      showQRModal,
      showProcessingModal,
    });

    if (isOpen && !showQRModal && !showProcessingModal) {
      console.error('✅ Abriendo QR modal...');
      openQRModal();
    } else if (!isOpen && (showQRModal || showProcessingModal)) {
      console.error('🚨 isOpen=false pero modales activos - RESETEANDO WORKFLOW');
      console.trace('🔍 Stack trace del reset automático:');
      resetWorkflow();
    }
  }, [isOpen, showQRModal, showProcessingModal, openQRModal, resetWorkflow]);

  // Manejar cierre del workflow
  const handleClose = () => {
    console.error('🚨 InvoiceWorkflow: handleClose llamado');
    console.trace('🔍 Stack trace del cierre del workflow:');
    resetWorkflow();
    onClose?.();
  };

  // Manejar guardado de gastos con callback
  const handleSaveExpensesWithCallback = async (
    expenses: SuggestedExpense[],
  ) => {
    try {
      await handleSaveExpenses(expenses);
      onExpensesAdded?.(expenses);
      handleClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error guardando gastos';
      onError?.(errorMessage);
    }
  };

  // Manejar guardado directo en Supabase (opcional)
  const _handleSaveToSupabase = async (expenses: SuggestedExpense[]) => {
    if (!allowDirectSave || !currentCufe) return;

    try {
      // Aquí se llamaría a processAndSave desde el hook de facturas
      // const result = await processAndSave(currentCufe, expenses);
      // onInvoiceSaved?.(result.invoiceId, result.expensesCreated);

      console.error('Guardando en Supabase:', { cufe: currentCufe, expenses });
      handleClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Error guardando en Supabase';
      onError?.(errorMessage);
    }
  };

  return (
    <>
      {/* Modal de entrada QR/CUFE */}
      <QRInputModal
        isOpen={showQRModal}
        onClose={handleClose}
        onCufeDetected={handleCufeDetected}
        title={title}
      />

      {/* Modal de procesamiento */}
      <InvoiceProcessingModal
        isOpen={showProcessingModal}
        onClose={handleClose}
        cufeCode={currentCufe || undefined}
        onCompleted={handleProcessingCompleted}
        onSaveExpenses={handleSaveExpensesWithCallback}
        autoProcess={true}
      />
    </>
  );
}

/**
 * Hook para usar el workflow de forma programática
 */
export function useInvoiceWorkflowTrigger() {
  const {
    showQRModal,
    showProcessingModal,
    openQRModal,
    startWithCufe,
    resetWorkflow,
  } = useInvoiceWorkflow();

  return {
    isActive: showQRModal || showProcessingModal,
    startWithQR: openQRModal,
    startWithCufe,
    reset: resetWorkflow,
  };
}
