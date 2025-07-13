/**
 * useBudgetData Hook
 * 
 * Hook personalizado para manejar los datos del presupuesto
 * Proporciona valores de presupuesto total, gastado y restante
 * de manera consistente en toda la aplicación
 * Incluye integración con datos de ingresos de Supabase
 */
import { useState, useEffect } from 'react';
import { obtenerResumenFinanciero } from '@/lib/services/ingresos-deudas';

export interface BudgetItem {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  status: 'on-track' | 'over-budget' | 'under-budget';
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  overBudgetCount: number;
  totalIncome: number; // Nuevo campo para ingresos totales
}

// Datos mock basados en los datos del dashboard
// En una aplicación real, estos datos vendrían de una API o base de datos
const mockBudgetItems: BudgetItem[] = [
  {
    id: "1",
    category: "Vivienda",
    amount: 7904114,
    spent: 8009845,
    remaining: -105731,
    status: "over-budget",
  },
  {
    id: "2",
    category: "Deudas",
    amount: 6337850,
    spent: 9887850,
    remaining: -3550000,
    status: "over-budget",
  },
  {
    id: "3",
    category: "Transporte",
    amount: 875000,
    spent: 719910,
    remaining: 155090,
    status: "on-track",
  },
  {
    id: "4",
    category: "Mercado",
    amount: 1210000,
    spent: 312507,
    remaining: 897493,
    status: "under-budget",
  },
  {
    id: "5",
    category: "Salud",
    amount: 729000,
    spent: 25735,
    remaining: 703265,
    status: "under-budget",
  },
  {
    id: "6",
    category: "Alice",
    amount: 2305323,
    spent: 0,
    remaining: 2305323,
    status: "under-budget",
  },
  {
    id: "7",
    category: "Gastos Personales",
    amount: 250000,
    spent: 157446,
    remaining: 92554,
    status: "on-track",
  },
  {
    id: "8",
    category: "Comunicaciones",
    amount: 46751,
    spent: 0,
    remaining: 46751,
    status: "under-budget",
  },
  {
    id: "9",
    category: "Educación",
    amount: 379000,
    spent: 0,
    remaining: 379000,
    status: "under-budget",
  },
  {
    id: "10",
    category: "Mascotas",
    amount: 62000,
    spent: 0,
    remaining: 62000,
    status: "under-budget",
  },
  {
    id: "11",
    category: "Ahorros",
    amount: 5000000,
    spent: 0,
    remaining: 5000000,
    status: "under-budget",
  },
  {
    id: "12",
    category: "Impuestos",
    amount: 0,
    spent: 0,
    remaining: 0,
    status: "on-track",
  },
];

// Datos mock de ingresos
// En una aplicación real, estos datos vendrían de la base de datos
const mockIncomeData = {
  salary: 25000000, // Salario principal
  freelance: 3500000, // Trabajos freelance
  investments: 850000, // Inversiones y dividendos
  other: 650000, // Otros ingresos
};

export const useBudgetData = () => {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(mockBudgetItems);
  const [isLoading, setIsLoading] = useState(false);
  const [realIncomeTotal, setRealIncomeTotal] = useState<number | undefined>(undefined);

  // Función para formatear moneda de manera consistente
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Función para cargar ingresos reales de Supabase
  const loadRealIncomeData = async () => {
    try {
      const resumen = await obtenerResumenFinanciero();
      setRealIncomeTotal(resumen.totalIngresos);
    } catch (error) {
      console.log('No se pudieron cargar ingresos de Supabase, usando datos mock');
      setRealIncomeTotal(undefined);
    }
  };

  // Calcular resumen del presupuesto
  const calculateSummary = (realIncomeFromSupabase?: number): BudgetSummary => {
    const totalBudget = budgetItems.reduce((sum, item) => sum + item.amount, 0);
    const totalSpent = budgetItems.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalBudget - totalSpent;
    const overBudgetCount = budgetItems.filter(item => item.status === 'over-budget').length;
    
    // Usar ingresos reales de Supabase si están disponibles, sino usar datos mock
    const totalIncome = realIncomeFromSupabase !== undefined 
      ? realIncomeFromSupabase 
      : Object.values(mockIncomeData).reduce((sum, income) => sum + income, 0);

    return {
      totalBudget,
      totalSpent,
      totalRemaining,
      overBudgetCount,
      totalIncome,
    };
  };

  // Cargar datos del presupuesto e ingresos reales
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Cargar ingresos reales de Supabase en paralelo
      await loadRealIncomeData();
      
      // Simular carga de datos de presupuesto
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    };

    loadData();
  }, []);

  const summary = calculateSummary(realIncomeTotal);

  return {
    budgetItems,
    setBudgetItems,
    summary,
    isLoading,
    formatCurrency,
  };
}; 