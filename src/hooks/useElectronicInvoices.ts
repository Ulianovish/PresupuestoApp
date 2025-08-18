/**
 * Hook personalizado para manejo de facturas electrónicas
 * Proporciona estado y funciones para procesar facturas desde códigos QR
 */

import { useState, useCallback, useRef } from 'react';
import type {
  ElectronicInvoice,
  InvoiceProcessingResult,
  SuggestedExpense,
  InvoiceProcessingStatus,
  CreateElectronicInvoiceData,
  UpdateElectronicInvoiceData,
} from '@/types/electronic-invoices';
import {
  processInvoiceFromQR,
  saveElectronicInvoice,
  createExpensesFromInvoice,
  updateElectronicInvoice,
  deleteElectronicInvoice,
  getElectronicInvoicesByDateRange,
  checkCufeExists,
  InvoiceProcessingError,
} from '@/lib/services/electronic-invoices';
import {
  validateCufeCode,
  normalizeCufeCode,
} from '@/lib/validations/cufe-validator';

interface UseElectronicInvoicesState {
  // Estado del procesamiento
  processing_status: InvoiceProcessingStatus;
  progress: number;
  status_message: string;
  status_details: string;

  // Datos del procesamiento actual
  current_invoice: ElectronicInvoice | null;
  suggested_expenses: SuggestedExpense[];

  // Lista de facturas
  invoices: ElectronicInvoice[];

  // Estados generales
  loading: boolean;
  error: string | null;

  // Información específica de progreso (captchas, etc.)
  processing_info: {
    captcha_info?: Record<string, unknown>;
    total_time?: number;
    items_found?: number;
  };
}

interface UseElectronicInvoicesActions {
  // Procesamiento de facturas
  processFromQR: (
    cufeCode: string,
    options?: ProcessingOptions,
  ) => Promise<InvoiceProcessingResult>;
  processAndSave: (
    cufeCode: string,
    expenses?: SuggestedExpense[],
    options?: ProcessingOptions,
  ) => Promise<{ invoiceId: string; expensesCreated: number }>;

  // Gestión de gastos sugeridos
  updateSuggestedExpense: (
    expenseId: string,
    updates: Partial<SuggestedExpense>,
  ) => void;
  removeSuggestedExpense: (expenseId: string) => void;
  addSuggestedExpense: (expense: Omit<SuggestedExpense, 'id'>) => void;

  // CRUD de facturas
  saveInvoice: (invoiceData: CreateElectronicInvoiceData) => Promise<string>;
  updateInvoice: (
    id: string,
    data: UpdateElectronicInvoiceData,
  ) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  loadInvoices: (startDate?: string, endDate?: string) => Promise<void>;

  // Validaciones
  validateCufe: (
    cufeCode: string,
  ) => Promise<{ isValid: boolean; error?: string }>;
  checkDuplicate: (cufeCode: string) => Promise<boolean>;

  // Control del estado
  resetProcessing: () => void;
  clearError: () => void;
  cancelProcessing: () => void;
}

interface ProcessingOptions {
  maxRetries?: number;
  captchaApiKey?: string;
  autoSave?: boolean;
}

export function useElectronicInvoices(): UseElectronicInvoicesState &
  UseElectronicInvoicesActions {
  // Estado principal
  const [state, setState] = useState<UseElectronicInvoicesState>({
    processing_status: 'idle',
    progress: 0,
    status_message: '',
    status_details: '',
    current_invoice: null,
    suggested_expenses: [],
    invoices: [],
    loading: false,
    error: null,
    processing_info: {},
  });

  // Referencias para control de procesamiento
  const processingRef = useRef<boolean>(false);
  const cancelRef = useRef<boolean>(false);

  // Actualizar estado de forma segura
  const updateState = useCallback(
    (updates: Partial<UseElectronicInvoicesState>) => {
      setState(prev => ({ ...prev, ...updates }));
    },
    [],
  );

  // Procesar factura desde código QR
  const processFromQR = useCallback(
    async (
      cufeCode: string,
      options: ProcessingOptions = {},
    ): Promise<InvoiceProcessingResult> => {
      if (processingRef.current) {
        throw new Error('Ya hay un procesamiento en curso');
      }

      processingRef.current = true;
      cancelRef.current = false;

      updateState({
        processing_status: 'validating',
        progress: 0,
        status_message: 'Validando código CUFE...',
        status_details: '',
        error: null,
        processing_info: {},
      });

      try {
        // Validar CUFE
        const normalizedCufe = normalizeCufeCode(cufeCode);
        const validation = await validateCufeCode(
          normalizedCufe,
          checkCufeExists,
        );

        if (!validation.is_valid) {
          throw new InvoiceProcessingError(
            'INVALID_CUFE',
            validation.error_message || 'CUFE inválido',
          );
        }

        if (cancelRef.current) {
          throw new Error('Procesamiento cancelado');
        }

        updateState({
          processing_status: 'downloading',
          progress: 5,
          status_message: 'Iniciando procesamiento...',
          status_details: 'Conectando con el servidor de procesamiento',
        });

        // Procesar con SSE
        const result = await processInvoiceFromQR(normalizedCufe, {
          maxRetries: options.maxRetries || 3,
          captchaApiKey: options.captchaApiKey,
          onConnect: () => {
            updateState({
              processing_status: 'downloading',
              status_message: 'Conectado al servidor',
              status_details: 'Iniciando descarga de PDF desde DIAN',
            });
          },
          onProgress: data => {
            if (cancelRef.current) return;

            updateState({
              progress: data.progress || 0,
              status_message: data.message || '',
              status_details: data.details || '',
              processing_info: {
                captcha_info: data.captcha,
                total_time: data.processing_time,
              },
            });

            // Actualizar estado según el step
            if (data.step) {
              let newStatus: InvoiceProcessingStatus = 'downloading';

              if (
                data.step.includes('captcha') ||
                data.step.includes('connecting')
              ) {
                newStatus = 'downloading';
              } else if (
                data.step.includes('processing') ||
                data.step.includes('ai')
              ) {
                newStatus = 'extracting';
              } else if (data.step === 'complete') {
                newStatus = 'success';
              }

              updateState({ processing_status: newStatus });
            }
          },
        });

        if (cancelRef.current) {
          throw new Error('Procesamiento cancelado');
        }

        // Actualizar estado con resultado
        updateState({
          processing_status: 'success',
          progress: 100,
          status_message: 'Procesamiento completado exitosamente',
          status_details: `${result.extracted_expenses.length} gastos extraídos`,
          current_invoice: result.invoice,
          suggested_expenses: result.extracted_expenses,
          processing_info: {
            items_found: result.extracted_expenses.length,
          },
        });

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error desconocido';

        updateState({
          processing_status: 'error',
          error: errorMessage,
          status_message: 'Error en el procesamiento',
          status_details: errorMessage,
        });

        throw error;
      } finally {
        processingRef.current = false;
      }
    },
    [updateState],
  );

  // CRUD de facturas (definir antes de processAndSave)
  const loadInvoices = useCallback(
    async (startDate?: string, endDate?: string): Promise<void> => {
      updateState({ loading: true, error: null });

      try {
        const invoices = await getElectronicInvoicesByDateRange(
          startDate,
          endDate,
        );
        updateState({ invoices });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error cargando facturas';
        updateState({ error: errorMessage });
        throw error;
      } finally {
        updateState({ loading: false });
      }
    },
    [updateState],
  );

  // Procesar y guardar automáticamente
  const processAndSave = useCallback(
    async (
      cufeCode: string,
      expenses?: SuggestedExpense[],
      options: ProcessingOptions = {},
    ): Promise<{ invoiceId: string; expensesCreated: number }> => {
      // Si no se proporcionan gastos, primero procesar
      let expensesToSave = expenses;
      let invoice: ElectronicInvoice;

      if (!expensesToSave) {
        updateState({
          processing_status: 'reviewing',
          status_message: 'Procesando factura...',
        });

        const result = await processFromQR(cufeCode, options);
        expensesToSave = result.extracted_expenses;
        invoice = result.invoice;
      } else {
        invoice = state.current_invoice!;
      }

      updateState({
        processing_status: 'saving',
        status_message: 'Guardando factura...',
        status_details: 'Almacenando datos en la base de datos',
      });

      try {
        const invoiceData: CreateElectronicInvoiceData = {
          cufe_code: invoice.cufe_code,
          supplier_name: invoice.supplier_name || undefined,
          supplier_nit: invoice.supplier_nit || undefined,
          invoice_date: invoice.invoice_date,
          total_amount: invoice.total_amount,
          extracted_data: invoice.extracted_data || undefined,
          pdf_url: invoice.pdf_url || undefined,
        };

        const invoiceId = await saveElectronicInvoice(invoiceData);

        updateState({
          status_message: 'Creando gastos...',
          status_details: `Guardando ${expensesToSave.length} gastos`,
        });

        await createExpensesFromInvoice(invoiceId, expensesToSave);

        updateState({
          processing_status: 'success',
          status_message: 'Factura guardada exitosamente',
          status_details: `${expensesToSave.length} gastos creados`,
        });

        // Recargar lista de facturas
        await loadInvoices();

        return {
          invoiceId,
          expensesCreated: expensesToSave.length,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error guardando datos';

        updateState({
          processing_status: 'error',
          error: errorMessage,
          status_message: 'Error guardando factura',
          status_details: errorMessage,
        });

        throw error;
      }
    },
    [state.current_invoice, updateState, processFromQR, loadInvoices],
  );

  // Gestión de gastos sugeridos
  const updateSuggestedExpense = useCallback(
    (expenseId: string, updates: Partial<SuggestedExpense>) => {
      updateState({
        suggested_expenses: state.suggested_expenses.map(expense =>
          expense.id === expenseId ? { ...expense, ...updates } : expense,
        ),
      });
    },
    [state.suggested_expenses, updateState],
  );

  const removeSuggestedExpense = useCallback(
    (expenseId: string) => {
      updateState({
        suggested_expenses: state.suggested_expenses.filter(
          expense => expense.id !== expenseId,
        ),
      });
    },
    [state.suggested_expenses, updateState],
  );

  const addSuggestedExpense = useCallback(
    (expense: Omit<SuggestedExpense, 'id'>) => {
      const newExpense: SuggestedExpense = {
        ...expense,
        id: `expense-${Date.now()}`,
      };

      updateState({
        suggested_expenses: [...state.suggested_expenses, newExpense],
      });
    },
    [state.suggested_expenses, updateState],
  );

  // CRUD de facturas
  const saveInvoice = useCallback(
    async (invoiceData: CreateElectronicInvoiceData): Promise<string> => {
      updateState({ loading: true, error: null });

      try {
        const id = await saveElectronicInvoice(invoiceData);
        await loadInvoices(); // Recargar lista
        return id;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error guardando factura';
        updateState({ error: errorMessage });
        throw error;
      } finally {
        updateState({ loading: false });
      }
    },
    [updateState],
  );

  const updateInvoice = useCallback(
    async (id: string, data: UpdateElectronicInvoiceData): Promise<void> => {
      updateState({ loading: true, error: null });

      try {
        await updateElectronicInvoice(id, data);
        await loadInvoices(); // Recargar lista
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error actualizando factura';
        updateState({ error: errorMessage });
        throw error;
      } finally {
        updateState({ loading: false });
      }
    },
    [updateState],
  );

  const deleteInvoice = useCallback(
    async (id: string): Promise<void> => {
      updateState({ loading: true, error: null });

      try {
        await deleteElectronicInvoice(id);
        await loadInvoices(); // Recargar lista
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Error eliminando factura';
        updateState({ error: errorMessage });
        throw error;
      } finally {
        updateState({ loading: false });
      }
    },
    [updateState],
  );

  // Validaciones
  const validateCufe = useCallback(
    async (cufeCode: string): Promise<{ isValid: boolean; error?: string }> => {
      try {
        const result = await validateCufeCode(cufeCode, checkCufeExists);
        return {
          isValid: result.is_valid,
          error: result.error_message,
        };
      } catch (error) {
        return {
          isValid: false,
          error:
            error instanceof Error ? error.message : 'Error validando CUFE',
        };
      }
    },
    [],
  );

  const checkDuplicate = useCallback(
    async (cufeCode: string): Promise<boolean> => {
      try {
        return await checkCufeExists(cufeCode);
      } catch (error) {
        console.error('Error verificando duplicado:', error);
        return false;
      }
    },
    [],
  );

  // Control del estado
  const resetProcessing = useCallback(() => {
    processingRef.current = false;
    cancelRef.current = false;

    updateState({
      processing_status: 'idle',
      progress: 0,
      status_message: '',
      status_details: '',
      current_invoice: null,
      suggested_expenses: [],
      error: null,
      processing_info: {},
    });
  }, [updateState]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;

    updateState({
      processing_status: 'idle',
      status_message: 'Procesamiento cancelado',
      status_details: '',
    });
  }, [updateState]);

  return {
    // Estado
    ...state,

    // Acciones
    processFromQR,
    processAndSave,
    updateSuggestedExpense,
    removeSuggestedExpense,
    addSuggestedExpense,
    saveInvoice,
    updateInvoice,
    deleteInvoice,
    loadInvoices,
    validateCufe,
    checkDuplicate,
    resetProcessing,
    clearError,
    cancelProcessing,
  };
}
