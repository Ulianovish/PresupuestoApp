/**
 * Hook para manejo completo del flujo de facturas electrónicas
 * Gestiona QR input → Validación → Procesamiento → Guardado
 */

import { useState, useCallback } from 'react';
import { useElectronicInvoices } from './useElectronicInvoices';
import type { SuggestedExpense } from '@/types/electronic-invoices';

interface UseInvoiceWorkflowState {
  // Estados de UI
  showQRModal: boolean;
  showProcessingModal: boolean;

  // Estado del workflow
  currentCufe: string | null;
  processedExpenses: SuggestedExpense[];

  // Estados de loading
  isProcessing: boolean;
  isSaving: boolean;
}

interface UseInvoiceWorkflowActions {
  // Control de modales
  openQRModal: () => void;
  closeQRModal: () => void;
  closeProcessingModal: () => void;

  // Flujo principal
  handleCufeDetected: (cufeCode: string) => void;
  handleProcessingCompleted: (expenses: SuggestedExpense[]) => void;
  handleSaveExpenses: (expenses: SuggestedExpense[]) => Promise<void>;

  // Utilidades
  resetWorkflow: () => void;
  startWithCufe: (cufeCode: string) => void;
}

export function useInvoiceWorkflow(): UseInvoiceWorkflowState &
  UseInvoiceWorkflowActions {
  // Estado local del workflow
  const [state, setState] = useState<UseInvoiceWorkflowState>({
    showQRModal: false,
    showProcessingModal: false,
    currentCufe: null,
    processedExpenses: [],
    isProcessing: false,
    isSaving: false,
  });

  // Hook de facturas electrónicas
  const {
    processing_status,
    progress: _progress,
    status_message: _status_message,
    current_invoice: _current_invoice,
    suggested_expenses: _suggested_expenses,
    error: _processingError,
    processFromQR: _processFromQR,
    processAndSave: _processAndSave,
    resetProcessing,
  } = useElectronicInvoices();

  // Actualizar estado local
  const updateState = useCallback(
    (updates: Partial<UseInvoiceWorkflowState>) => {
      setState(prev => ({ ...prev, ...updates }));
    },
    [],
  );

  // Control de modales
  const openQRModal = useCallback(() => {
    updateState({ showQRModal: true });
  }, [updateState]);

  const closeQRModal = useCallback(() => {
    updateState({ showQRModal: false });
  }, [updateState]);

  const closeProcessingModal = useCallback(() => {
    updateState({
      showProcessingModal: false,
      currentCufe: null,
      processedExpenses: [],
      isProcessing: false,
    });
    resetProcessing();
  }, [updateState, resetProcessing]);

  // Manejar detección de CUFE desde QR
  const handleCufeDetected = useCallback(
    (cufeCode: string) => {
      console.log(
        '🎯 useInvoiceWorkflow: handleCufeDetected llamado con CUFE:',
        cufeCode,
      );
      console.log('📊 Estado actual antes del update:', state);

      const newState = {
        currentCufe: cufeCode,
        showQRModal: false,
        showProcessingModal: true,
        isProcessing: true,
      };

      console.log('📝 Actualizando estado a:', newState);
      updateState(newState);

      console.log('✅ Estado actualizado - debería mostrar processing modal');

      // Verificar después de un pequeño delay si el estado se mantiene
      setTimeout(() => {
        console.log('⏰ Estado después de 100ms:', state);
      }, 100);
    },
    [updateState, state],
  );

  // Manejar finalización de procesamiento
  const handleProcessingCompleted = useCallback(
    (expenses: SuggestedExpense[]) => {
      updateState({
        processedExpenses: expenses,
        isProcessing: false,
      });
    },
    [updateState],
  );

  // Guardar gastos en el sistema local (sin Supabase)
  const handleSaveExpenses = useCallback(
    async (expenses: SuggestedExpense[]): Promise<void> => {
      try {
        updateState({ isSaving: true });

        // Aquí se integraría con el sistema de gastos existente
        // Por ejemplo, agregando los gastos a la lista local o llamando a una función de callback

        // Simular guardado local
        console.log('Guardando gastos localmente:', expenses);

        // En una implementación real, esto podría ser:
        // await onAddExpenses(expenses.map(expense => ({
        //   description: expense.description,
        //   amount: expense.amount,
        //   category: expense.suggested_category,
        //   date: expense.transaction_date,
        //   place: expense.place,
        // })));

        // Cerrar modal después de guardar
        closeProcessingModal();
      } catch (error) {
        console.error('Error guardando gastos:', error);
        throw error;
      } finally {
        updateState({ isSaving: false });
      }
    },
    [updateState, closeProcessingModal],
  );

  // Resetear todo el workflow
  const resetWorkflow = useCallback(() => {
    console.log('🔄 resetWorkflow llamado');
    console.trace('🔍 Stack trace del reset:');
    updateState({
      showQRModal: false,
      showProcessingModal: false,
      currentCufe: null,
      processedExpenses: [],
      isProcessing: false,
      isSaving: false,
    });
    resetProcessing();
  }, [updateState, resetProcessing]);

  // Iniciar directamente con un CUFE (para testing)
  const startWithCufe = useCallback(
    (cufeCode: string) => {
      updateState({
        currentCufe: cufeCode,
        showQRModal: false,
        showProcessingModal: true,
        isProcessing: true,
      });
    },
    [updateState],
  );

  return {
    // Estado
    ...state,

    // Estados derivados del hook de facturas
    isProcessing:
      state.isProcessing ||
      processing_status === 'downloading' ||
      processing_status === 'extracting' ||
      processing_status === 'validating',

    // Acciones
    openQRModal,
    closeQRModal,
    closeProcessingModal,
    handleCufeDetected,
    handleProcessingCompleted,
    handleSaveExpenses,
    resetWorkflow,
    startWithCufe,
  };
}

/**
 * Hook simplificado para casos de uso básicos
 */
export function useSimpleInvoiceWorkflow(
  onExpensesAdded?: (expenses: SuggestedExpense[]) => void,
) {
  const workflow = useInvoiceWorkflow();

  // Override del handleSaveExpenses para casos simples
  const handleSaveExpenses = useCallback(
    async (expenses: SuggestedExpense[]) => {
      try {
        await workflow.handleSaveExpenses(expenses);
        onExpensesAdded?.(expenses);
      } catch (error) {
        console.error('Error en flujo simple:', error);
      }
    },
    [workflow, onExpensesAdded],
  );

  return {
    ...workflow,
    handleSaveExpenses,
  };
}
