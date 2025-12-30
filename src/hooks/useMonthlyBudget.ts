/**
 * Hook personalizado para manejar presupuestos mensuales
 * Maneja el estado, carga de datos y operaciones CRUD
 */

import { useState, useEffect, useCallback } from 'react';

import {
  getBudgetByMonth,
  createMonthlyBudget,
  createBudgetItem,
  updateBudgetItem,
  deleteBudgetItem,
  BudgetCategory,
  BudgetItem,
  MonthlyBudgetData,
} from '@/lib/services/budget';

import { useCategories } from './useCategories';

export interface UseMonthlyBudgetReturn {
  // Estado
  budgetData: MonthlyBudgetData | null;
  categories: BudgetCategory[];
  isLoading: boolean;
  error: string | null;
  selectedMonth: string;

  // Funciones
  setSelectedMonth: (month: string) => void;
  refreshBudget: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  toggleCategory: (categoryId: string) => void;
  addBudgetItem: (
    categoryId: string,
    item: Omit<BudgetItem, 'id'>,
  ) => Promise<boolean>;
  editBudgetItem: (
    itemId: string,
    updates: Partial<Omit<BudgetItem, 'id'>>,
  ) => Promise<boolean>;
  deleteBudgetItem: (itemId: string) => Promise<boolean>;
  initializeMonth: (monthYear: string) => Promise<boolean>;
}

/**
 * Hook para manejar presupuestos mensuales
 */
export function useMonthlyBudget(
  initialMonth: string = '2025-07',
): UseMonthlyBudgetReturn {
  // Estado del hook
  const [budgetData, setBudgetData] = useState<MonthlyBudgetData | null>(null);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);

  // Hook para manejar categorías disponibles
  const { refreshCategories: refreshAvailableCategories } = useCategories();

  /**
   * Carga los datos del presupuesto para el mes seleccionado
   */
  const loadBudgetData = useCallback(async (monthYear: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getBudgetByMonth(monthYear);

      if (data) {
        setBudgetData(data);
        setCategories(data.categories);
      } else {
        // Si no hay datos, inicializar un presupuesto vacío
        setBudgetData(null);
        setCategories([]);
      }
    } catch (err) {
      console.error('Error cargando presupuesto:', err);
      setError('Error al cargar los datos del presupuesto');
      setBudgetData(null);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Inicializa un nuevo mes de presupuesto
   */
  const initializeMonth = useCallback(
    async (monthYear: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const templateId = await createMonthlyBudget(monthYear);

        if (templateId) {
          await loadBudgetData(monthYear);
          return true;
        } else {
          setError('Error al crear el presupuesto mensual');
          return false;
        }
      } catch (err) {
        console.error('Error inicializando mes:', err);
        setError('Error al inicializar el presupuesto mensual');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [loadBudgetData],
  );

  /**
   * Refresca los datos del presupuesto
   */
  const refreshBudget = useCallback(async () => {
    await loadBudgetData(selectedMonth);
  }, [selectedMonth, loadBudgetData]);

  /**
   * Refresca las categorías disponibles
   */
  const refreshCategories = useCallback(async () => {
    await refreshAvailableCategories();
  }, [refreshAvailableCategories]);

  /**
   * Cambia el mes seleccionado y carga sus datos
   */
  const handleSetSelectedMonth = useCallback((month: string) => {
    setSelectedMonth(month);
  }, []);

  /**
   * Expande o contrae una categoría
   */
  const toggleCategory = useCallback((categoryId: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === categoryId ? { ...cat, expanded: !cat.expanded } : cat,
      ),
    );
  }, []);

  /**
   * Agrega un nuevo item a una categoría
   */
  const addBudgetItem = useCallback(
    async (
      categoryId: string,
      item: Omit<BudgetItem, 'id'>,
    ): Promise<boolean> => {
      if (!budgetData?.template_id) {
        setError('No hay un template de presupuesto activo');
        return false;
      }

      setError(null);

      try {
        const newItem = await createBudgetItem(
          budgetData.template_id,
          categoryId,
          item,
        );

        if (newItem) {
          // Actualizar el estado local
          setCategories(prev =>
            prev.map(cat => {
              if (cat.id === categoryId) {
                const updatedItems = [...cat.items, newItem];
                return {
                  ...cat,
                  items: updatedItems,
                  totalPresupuestado:
                    cat.totalPresupuestado + newItem.presupuestado,
                  totalReal: cat.totalReal + newItem.real,
                };
              }
              return cat;
            }),
          );

          // Actualizar totales del presupuesto
          setBudgetData(prev =>
            prev
              ? {
                  ...prev,
                  total_presupuestado:
                    prev.total_presupuestado + newItem.presupuestado,
                  total_real: prev.total_real + newItem.real,
                }
              : null,
          );

          return true;
        } else {
          setError('Error al crear el item del presupuesto');
          return false;
        }
      } catch (err) {
        console.error('Error agregando item:', err);
        setError('Error al agregar el item del presupuesto');
        return false;
      }
    },
    [budgetData?.template_id],
  );

  /**
   * Edita un item existente
   */
  const editBudgetItem = useCallback(
    async (
      itemId: string,
      updates: Partial<Omit<BudgetItem, 'id'>>,
    ): Promise<boolean> => {
      setError(null);

      try {
        const updatedItem = await updateBudgetItem(itemId, updates);

        if (updatedItem) {
          // Actualizar el estado local
          let oldItem: BudgetItem | null = null;

          setCategories(prev =>
            prev.map(cat => {
              const itemIndex = cat.items.findIndex(item => item.id === itemId);
              if (itemIndex !== -1) {
                oldItem = cat.items[itemIndex];
                const newItems = [...cat.items];
                newItems[itemIndex] = updatedItem;

                // Recalcular totales de la categoría
                const totalPresupuestado =
                  cat.totalPresupuestado -
                  oldItem.presupuestado +
                  updatedItem.presupuestado;
                const totalReal =
                  cat.totalReal - oldItem.real + updatedItem.real;

                return {
                  ...cat,
                  items: newItems,
                  totalPresupuestado,
                  totalReal,
                  // Mantener la categoría expandida después de editar
                  expanded: true,
                };
              }
              return cat;
            }),
          );

          // Actualizar totales del presupuesto
          if (oldItem) {
            setBudgetData(prev =>
              prev
                ? {
                    ...prev,
                    total_presupuestado:
                      prev.total_presupuestado -
                      oldItem!.presupuestado +
                      updatedItem.presupuestado,
                    total_real:
                      prev.total_real - oldItem!.real + updatedItem.real,
                  }
                : null,
            );
          }

          // Los datos ya están actualizados en el estado local
          return true;
        } else {
          setError('Error al actualizar el item del presupuesto');
          return false;
        }
      } catch (err) {
        console.error('Error editando item:', err);
        setError('Error al editar el item del presupuesto');
        return false;
      }
    },
    [refreshBudget],
  );

  /**
   * Elimina un item del presupuesto
   */
  const deleteBudgetItemHandler = useCallback(
    async (itemId: string): Promise<boolean> => {
      setError(null);

      try {
        const success = await deleteBudgetItem(itemId);

        if (success) {
          // Actualizar el estado local removiendo el item
          setCategories(prev =>
            prev.map(cat => {
              const itemToDelete = cat.items.find(item => item.id === itemId);
              if (itemToDelete) {
                const updatedItems = cat.items.filter(
                  item => item.id !== itemId,
                );
                return {
                  ...cat,
                  items: updatedItems,
                  totalPresupuestado:
                    cat.totalPresupuestado - itemToDelete.presupuestado,
                  totalReal: cat.totalReal - itemToDelete.real,
                };
              }
              return cat;
            }),
          );

          // Actualizar totales del presupuesto
          setBudgetData(prev => {
            if (!prev) return null;

            // Encontrar el item eliminado para actualizar totales
            let deletedItem: BudgetItem | null = null;
            for (const category of categories) {
              const item = category.items.find(item => item.id === itemId);
              if (item) {
                deletedItem = item;
                break;
              }
            }

            if (deletedItem) {
              return {
                ...prev,
                total_presupuestado:
                  prev.total_presupuestado - deletedItem.presupuestado,
                total_real: prev.total_real - deletedItem.real,
              };
            }

            return prev;
          });

          return true;
        } else {
          setError('Error al eliminar el item del presupuesto');
          return false;
        }
      } catch (err) {
        console.error('Error eliminando item:', err);
        setError('Error al eliminar el item del presupuesto');
        return false;
      }
    },
    [categories],
  );

  // Efecto para cargar datos cuando cambia el mes seleccionado
  useEffect(() => {
    loadBudgetData(selectedMonth);
  }, [selectedMonth, loadBudgetData]);

  return {
    // Estado
    budgetData,
    categories,
    isLoading,
    error,
    selectedMonth,

    // Funciones
    setSelectedMonth: handleSetSelectedMonth,
    refreshBudget,
    refreshCategories,
    toggleCategory,
    addBudgetItem,
    editBudgetItem,
    deleteBudgetItem: deleteBudgetItemHandler,
    initializeMonth,
  };
}
