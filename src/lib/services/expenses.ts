/**
 * Servicio para manejo de gastos mensuales
 * Proporciona funciones CRUD para transacciones de gastos organizadas por mes
 */

import { createClient } from '@/lib/supabase/client';

// Interfaces para gastos mensuales
export interface ExpenseTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string; // Formato: YYYY-MM-DD
  category_name: string;
  account_name: string;
  place?: string;
  electronic_invoice_id?: string; // Nueva columna para relación con facturas electrónicas
  created_at: string;
}

export interface ExpenseFormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place?: string;
  electronic_invoice_id?: string; // Para gastos creados desde facturas electrónicas
}

export interface ExpenseSummary {
  category_name: string;
  total_amount: number;
  transaction_count: number;
}

export interface MonthlyExpenseData {
  month_year: string;
  transactions: ExpenseTransaction[];
  summary: ExpenseSummary[];
  total_amount: number;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

// Categorías predefinidas para gastos
export const EXPENSE_CATEGORIES = [
  'VIVIENDA',
  'DEUDAS',
  'TRANSPORTE',
  'MERCADO',
  'OTROS',
] as const;

// Tipos de cuenta predefinidos
export const ACCOUNT_TYPES = [
  'Nequi',
  'TC Falabella',
  'Efectivo',
  'Banco Santander',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// Cliente de Supabase
const supabase = createClient();

/**
 * Obtiene los gastos de un mes específico para el usuario actual
 */
export async function getExpensesByMonth(
  monthYear: string,
): Promise<ExpenseTransaction[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('get_expenses_by_month', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('Error obteniendo gastos por mes:', error);
    throw new Error(`Error obteniendo gastos: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtiene el resumen de gastos por categoría para un mes específico
 */
export async function getExpensesSummaryByMonth(
  monthYear: string,
): Promise<ExpenseSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('get_expenses_summary_by_month', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('Error obteniendo resumen de gastos:', error);
    throw new Error(`Error obteniendo resumen: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtiene los datos completos de gastos para un mes (transacciones + resumen)
 */
export async function getMonthlyExpenseData(
  monthYear: string,
): Promise<MonthlyExpenseData> {
  try {
    const [transactions, summary] = await Promise.all([
      getExpensesByMonth(monthYear),
      getExpensesSummaryByMonth(monthYear),
    ]);

    const totalAmount = summary.reduce(
      (total, item) => total + item.total_amount,
      0,
    );

    return {
      month_year: monthYear,
      transactions,
      summary,
      total_amount: totalAmount,
    };
  } catch (error) {
    console.error('Error obteniendo datos mensuales de gastos:', error);
    throw error;
  }
}

/**
 * Crea un nuevo gasto
 */
export async function createExpenseTransaction(
  expenseData: ExpenseFormData,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('upsert_monthly_expense', {
    p_user_id: user.id,
    p_description: expenseData.description,
    p_amount: expenseData.amount,
    p_transaction_date: expenseData.transaction_date,
    p_category_name: expenseData.category_name,
    p_account_name: expenseData.account_name,
    p_place: expenseData.place || null,
  });

  if (error) {
    console.error('Error creando gasto:', error);
    throw new Error(`Error creando gasto: ${error.message}`);
  }

  return data; // Retorna el ID de la transacción creada
}

/**
 * Actualiza un gasto existente usando la API proxy
 */
export async function updateExpenseTransaction(
  transactionId: string,
  expenseData: Partial<ExpenseFormData>,
): Promise<void> {
  try {
    // Usar la API proxy para evitar problemas de CORS
    const response = await fetch(`/api/expenses/${transactionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(expenseData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error actualizando gasto');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error actualizando gasto');
    }

    console.warn('Gasto actualizado exitosamente:', result.message);
  } catch (error) {
    console.error('Error actualizando gasto:', error);
    throw new Error(
      `Error actualizando gasto: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    );
  }
}

/**
 * Elimina un gasto usando la API proxy
 */
export async function deleteExpenseTransaction(
  transactionId: string,
): Promise<void> {
  try {
    // Usar la API proxy para evitar problemas de CORS
    const response = await fetch(`/api/expenses/${transactionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error eliminando gasto');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Error eliminando gasto');
    }

    console.warn('Gasto eliminado exitosamente:', result.message);
  } catch (error) {
    console.error('Error eliminando gasto:', error);
    throw new Error(
      `Error eliminando gasto: ${error instanceof Error ? error.message : 'Error desconocido'}`,
    );
  }
}

/**
 * Obtiene las cuentas del usuario
 */
export async function getUserAccounts(): Promise<Account[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error obteniendo cuentas:', error);
    throw new Error(`Error obteniendo cuentas: ${error.message}`);
  }

  return data || [];
}

/**
 * Obtiene los meses disponibles con gastos
 */
export async function getAvailableExpenseMonths(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('get_available_expense_months', {
    p_user_id: user.id,
  });

  if (error) {
    console.error('Error obteniendo meses disponibles:', error);
    throw new Error(`Error obteniendo meses: ${error.message}`);
  }

  return data?.map((item: { month_year: string }) => item.month_year) || [];
}

/**
 * Obtiene todos los meses disponibles (2025-01 a 2025-12)
 */
export function getAllAvailableMonths(): string[] {
  const months = [];
  for (let i = 1; i <= 12; i++) {
    const month = i.toString().padStart(2, '0');
    months.push(`2025-${month}`);
  }
  return months;
}

/**
 * Formatea un monto como moneda colombiana
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formatea el nombre del mes para mostrar
 */
export function formatMonthName(monthYear: string): string {
  const [year, month] = monthYear.split('-');
  const monthNames = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

/**
 * Verifica si un mes tiene datos de gastos
 */
export async function hasExpenseDataForMonth(
  monthYear: string,
): Promise<boolean> {
  try {
    const transactions = await getExpensesByMonth(monthYear);
    return transactions.length > 0;
  } catch (error) {
    console.error('Error verificando datos del mes:', error);
    return false;
  }
}
