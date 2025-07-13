/**
 * Hook personalizado para manejar gastos mensuales
 * Proporciona estado y funciones para gestionar gastos organizados por mes
 */

import { useState, useEffect, useCallback } from 'react';

import {
  getMonthlyExpenseData,
  createExpenseTransaction,
  updateExpenseTransaction,
  deleteExpenseTransaction,
  getUserAccounts,
  getAllAvailableMonths,
  hasExpenseDataForMonth,
  ExpenseTransaction,
  ExpenseFormData,
  MonthlyExpenseData,
  Account,
} from '@/lib/services/expenses';

interface UseMonthlyExpensesState {
  // Estado de datos
  expenseData: MonthlyExpenseData | null;
  accounts: Account[];

  // Estado de UI
  loading: boolean;
  error: string | null;
  selectedMonth: string;
  availableMonths: string[];

  // Estado de modal/formulario
  isModalOpen: boolean;
  isEditing: boolean;
  editingTransaction: ExpenseTransaction | null;

  // Funciones
  setSelectedMonth: (month: string) => void;
  refreshExpenses: () => Promise<void>;
  openModal: () => void;
  closeModal: () => void;

  // CRUD de gastos
  addExpense: (expenseData: ExpenseFormData) => Promise<void>;
  editExpense: (transaction: ExpenseTransaction) => void;
  updateExpense: (
    transactionId: string,
    expenseData: Partial<ExpenseFormData>
  ) => Promise<void>;
  deleteExpense: (transactionId: string) => Promise<void>;

  // Utilidades
  initializeMonth: (month: string) => Promise<void>;
  getTotalByCategory: (categoryName: string) => number;
  getTransactionsByCategory: (categoryName: string) => ExpenseTransaction[];
}

export function useMonthlyExpenses(
  initialMonth?: string
): UseMonthlyExpensesState {
  // Estado principal
  const [expenseData, setExpenseData] = useState<MonthlyExpenseData | null>(
    null
  );
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Estado de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonthState] = useState(
    initialMonth || '2025-07'
  );
  const [availableMonths] = useState<string[]>(getAllAvailableMonths());

  // Estado de modal/formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<ExpenseTransaction | null>(null);

  /**
   * Cargar datos de gastos para el mes seleccionado
   */
  const loadExpenseData = useCallback(async (month: string) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`📊 Cargando gastos para ${month}...`);

      const [monthlyData, userAccounts] = await Promise.all([
        getMonthlyExpenseData(month),
        getUserAccounts(),
      ]);

      setExpenseData(monthlyData);
      setAccounts(userAccounts);

      console.log(
        `✅ Gastos cargados: ${monthlyData.transactions.length} transacciones`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error cargando gastos:', err);
      setError(errorMessage);
      setExpenseData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Cambiar mes seleccionado
   */
  const setSelectedMonth = useCallback(
    async (month: string) => {
      if (month !== selectedMonth) {
        setSelectedMonthState(month);
        await loadExpenseData(month);
      }
    },
    [selectedMonth, loadExpenseData]
  );

  /**
   * Refrescar datos del mes actual
   */
  const refreshExpenses = useCallback(async () => {
    await loadExpenseData(selectedMonth);
  }, [selectedMonth, loadExpenseData]);

  /**
   * Abrir modal para agregar nuevo gasto
   */
  const openModal = useCallback(() => {
    setIsModalOpen(true);
    setIsEditing(false);
    setEditingTransaction(null);
  }, []);

  /**
   * Cerrar modal y limpiar estado
   */
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setIsEditing(false);
    setEditingTransaction(null);
  }, []);

  /**
   * Agregar nuevo gasto
   */
  const addExpense = useCallback(
    async (expenseData: ExpenseFormData) => {
      try {
        setLoading(true);

        console.log('💰 Agregando nuevo gasto:', expenseData.description);

        await createExpenseTransaction(expenseData);

        // Refrescar datos después de agregar
        await loadExpenseData(selectedMonth);

        console.log('✅ Gasto agregado exitosamente');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error agregando gasto';
        console.error('Error agregando gasto:', err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedMonth, loadExpenseData]
  );

  /**
   * Preparar edición de gasto
   */
  const editExpense = useCallback((transaction: ExpenseTransaction) => {
    setEditingTransaction(transaction);
    setIsEditing(true);
    setIsModalOpen(true);
  }, []);

  /**
   * Actualizar gasto existente
   */
  const updateExpense = useCallback(
    async (transactionId: string, expenseData: Partial<ExpenseFormData>) => {
      try {
        setLoading(true);

        console.log('📝 Actualizando gasto:', transactionId);

        await updateExpenseTransaction(transactionId, expenseData);

        // Refrescar datos después de actualizar
        await loadExpenseData(selectedMonth);

        console.log('✅ Gasto actualizado exitosamente');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error actualizando gasto';
        console.error('Error actualizando gasto:', err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedMonth, loadExpenseData]
  );

  /**
   * Eliminar gasto
   */
  const deleteExpense = useCallback(
    async (transactionId: string) => {
      try {
        setLoading(true);

        console.log('🗑️ Eliminando gasto:', transactionId);

        await deleteExpenseTransaction(transactionId);

        // Refrescar datos después de eliminar
        await loadExpenseData(selectedMonth);

        console.log('✅ Gasto eliminado exitosamente');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error eliminando gasto';
        console.error('Error eliminando gasto:', err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [selectedMonth, loadExpenseData]
  );

  /**
   * Inicializar mes si no tiene datos
   */
  const initializeMonth = useCallback(
    async (month: string) => {
      try {
        const hasData = await hasExpenseDataForMonth(month);

        if (!hasData) {
          console.log(`📅 Inicializando mes ${month} sin datos previos`);
          // Para gastos, no necesitamos crear datos iniciales
          // Solo cargamos un mes vacío
          setExpenseData({
            month_year: month,
            transactions: [],
            summary: [],
            total_amount: 0,
          });
        } else {
          await loadExpenseData(month);
        }
      } catch (err) {
        console.error('Error inicializando mes:', err);
        setError(
          err instanceof Error ? err.message : 'Error inicializando mes'
        );
      }
    },
    [loadExpenseData]
  );

  /**
   * Obtener total gastado por categoría
   */
  const getTotalByCategory = useCallback(
    (categoryName: string): number => {
      if (!expenseData) return 0;

      const categoryData = expenseData.summary.find(
        s => s.category_name === categoryName
      );
      return categoryData?.total_amount || 0;
    },
    [expenseData]
  );

  /**
   * Obtener transacciones por categoría
   */
  const getTransactionsByCategory = useCallback(
    (categoryName: string): ExpenseTransaction[] => {
      if (!expenseData) return [];

      return expenseData.transactions.filter(
        t => t.category_name === categoryName
      );
    },
    [expenseData]
  );

  // Efecto para cargar datos iniciales
  useEffect(() => {
    loadExpenseData(selectedMonth);
  }, []); // Solo ejecutar una vez al montar

  return {
    // Estado de datos
    expenseData,
    accounts,

    // Estado de UI
    loading,
    error,
    selectedMonth,
    availableMonths,

    // Estado de modal/formulario
    isModalOpen,
    isEditing,
    editingTransaction,

    // Funciones
    setSelectedMonth,
    refreshExpenses,
    openModal,
    closeModal,

    // CRUD de gastos
    addExpense,
    editExpense,
    updateExpense,
    deleteExpense,

    // Utilidades
    initializeMonth,
    getTotalByCategory,
    getTransactionsByCategory,
  };
}
