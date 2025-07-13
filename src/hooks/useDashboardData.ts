/**
 * useDashboardData Hook
 *
 * Hook personalizado para integrar datos del dashboard mensual
 * Combina datos de presupuesto, gastos e ingresos para mostrar una vista completa
 * de las finanzas del usuario
 */

import { useState, useEffect, useCallback } from 'react';

import {
  getAvailableMonths,
  type MonthlyBudgetData,
} from '@/lib/services/budget';
import { type MonthlyExpenseData } from '@/lib/services/expenses';
import { type Ingreso, type Deuda } from '@/lib/services/ingresos-deudas';

import { useIngresosDeudas } from './useIngresosDeudas';
import { useMonthlyBudget } from './useMonthlyBudget';
import { useMonthlyExpenses } from './useMonthlyExpenses';

export interface DashboardSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  totalIncome: number;
  totalDebt: number;
  spentPercentage: number;
  overBudgetCount: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  budgetData: MonthlyBudgetData | null;
  expenseData: MonthlyExpenseData | null;
  incomeData: Ingreso[];
  debtData: Deuda[];
  isLoading: boolean;
  error: string | null;
  selectedMonth: string;
  availableMonths: Array<{ value: string; label: string }>;
  setSelectedMonth: (month: string) => void;
  refreshData: () => Promise<void>;
}

/**
 * Hook para obtener datos integrados del dashboard
 */
export const useDashboardData = (
  initialMonth: string = '2025-07'
): DashboardData => {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
  const [error, setError] = useState<string | null>(null);

  // Hooks para cada tipo de datos
  const budgetHook = useMonthlyBudget(selectedMonth);
  const expenseHook = useMonthlyExpenses();
  const incomeHook = useIngresosDeudas();

  // Sincronizar mes seleccionado con el hook de gastos
  useEffect(() => {
    expenseHook.setSelectedMonth(selectedMonth);
  }, [selectedMonth, expenseHook]);

  // Obtener meses disponibles
  const availableMonths = getAvailableMonths();

  // Estado de carga combinado
  const isLoading =
    budgetHook.isLoading || expenseHook.loading || incomeHook.loading;

  // Calcular resumen del dashboard
  const calculateSummary = useCallback((): DashboardSummary => {
    // Datos de presupuesto
    const totalBudget = budgetHook.budgetData?.total_presupuestado || 0;

    // Datos de gastos
    const totalSpent = expenseHook.expenseData?.total_amount || 0;

    // Datos de ingresos
    const totalIncome =
      incomeHook.ingresos?.reduce((sum, ingreso) => sum + ingreso.monto, 0) ||
      0;

    // Datos de deudas
    const totalDebt =
      incomeHook.deudas?.reduce((sum, deuda) => sum + deuda.monto, 0) || 0;

    // Usar gastos reales en lugar de presupuesto real para mayor precisión
    const totalRemaining = totalBudget - totalSpent;

    // Calcular porcentaje gastado
    const spentPercentage =
      totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Contar categorías que exceden el presupuesto
    const overBudgetCount =
      budgetHook.categories?.filter(category => {
        // Obtener gastos reales para esta categoría
        const categoryExpenses =
          expenseHook.expenseData?.summary?.find(
            s => s.category_name === category.nombre
          )?.total_amount || 0;

        return categoryExpenses > category.totalPresupuestado;
      }).length || 0;

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      totalIncome,
      totalDebt,
      spentPercentage,
      overBudgetCount,
    };
  }, [
    budgetHook.budgetData,
    budgetHook.categories,
    expenseHook.expenseData,
    incomeHook.ingresos,
    incomeHook.deudas,
  ]);

  // Función para refrescar todos los datos
  const refreshData = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([
        budgetHook.refreshBudget(),
        expenseHook.refreshExpenses(),
        incomeHook.recargarDatos(),
      ]);
    } catch (err) {
      console.error('Error refrescando datos del dashboard:', err);
      setError('Error al actualizar los datos del dashboard');
    }
  }, [budgetHook, expenseHook, incomeHook]);

  // Función para cambiar mes
  const handleSetSelectedMonth = useCallback(
    (month: string) => {
      setSelectedMonth(month);
      budgetHook.setSelectedMonth(month);
    },
    [budgetHook]
  );

  // Calcular resumen
  const summary = calculateSummary();

  return {
    summary,
    budgetData: budgetHook.budgetData,
    expenseData: expenseHook.expenseData,
    incomeData: incomeHook.ingresos,
    debtData: incomeHook.deudas,
    isLoading,
    error: error || budgetHook.error || expenseHook.error || incomeHook.error,
    selectedMonth,
    availableMonths,
    setSelectedMonth: handleSetSelectedMonth,
    refreshData,
  };
};
