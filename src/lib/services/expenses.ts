/**
 * Servicio para manejo de gastos mensuales
 * Proporciona funciones CRUD para transacciones de gastos organizadas por mes
 */

import { createClient } from '@/lib/supabase/client';
import { toTitleCase } from '@/lib/text-case';

import type {
  BudgetItemRef,
  BudgetItemSource,
  UnclassifiedExpense,
} from './expenses-rollup';

// Interfaces para gastos mensuales
export interface ExpenseTransaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string; // Formato: YYYY-MM-DD
  category_name: string;
  account_name: string;
  place?: string;
  created_at: string;
  budget_item_id?: string | null;
  purchase_total?: number | null;
  installments?: number | null;
}

export interface ExpenseFormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place?: string;
  /** Compras a cuotas con tarjeta: valor total de la compra. */
  purchase_total?: number | null;
  /** Compras a cuotas con tarjeta: en cuántas cuotas se difirió. */
  installments?: number | null;
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

// Categorías y tipos de cuenta: definidos en un módulo puro (sin side-effects)
// y re-exportados aquí para conservar la API pública de este servicio.
export {
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
} from '@/lib/constants/expense-categories';
export type {
  ExpenseCategory,
  AccountType,
} from '@/lib/constants/expense-categories';

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
  opts: {
    /**
     * false = no clasificar ahora (p. ej. una importación masiva, que conviene
     * clasificar al final en un solo lote con `classifyExpensesOnServer`).
     */
    clasificar?: boolean;
  } = {},
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Usuario no autenticado');
  }

  const { data, error } = await supabase.rpc('upsert_monthly_expense', {
    p_user_id: user.id,
    p_description: toTitleCase(expenseData.description),
    p_amount: expenseData.amount,
    p_transaction_date: expenseData.transaction_date,
    p_category_name: expenseData.category_name,
    p_account_name: expenseData.account_name,
    p_place: expenseData.place ? toTitleCase(expenseData.place) : null,
    p_purchase_total: expenseData.purchase_total ?? null,
    p_installments: expenseData.installments ?? null,
  });

  if (error) {
    console.error('Error creando gasto:', error);
    throw new Error(`Error creando gasto: ${error.message}`);
  }

  // Clasificación best-effort EN EL SERVIDOR: asigna el gasto a un ítem del
  // presupuesto (historial del usuario o IA). Si falla, el gasto ya está
  // guardado y queda en el panel "sin clasificar".
  if (opts.clasificar !== false && typeof data === 'string') {
    try {
      await classifyExpensesOnServer({ expenseIds: [data] });
    } catch (error) {
      console.error('No se pudo clasificar el gasto nuevo:', error);
    }
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

    console.log('Gasto actualizado exitosamente:', result.message);
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

    console.log('Gasto eliminado exitosamente:', result.message);
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

/** Ítems del presupuesto de un mes (para dropdown y clasificador). */
export async function getBudgetItemsForMonth(
  monthYear: string,
): Promise<BudgetItemRef[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.rpc('get_budget_items_for_month', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });
  if (error) {
    console.error('Error obteniendo ítems del mes:', error);
    return [];
  }
  return (data || []).map(
    (r: { item_id: string; item_name: string; category_name: string }) => ({
      id: r.item_id,
      name: r.item_name,
      category_name: r.category_name,
    }),
  );
}

/** Gastos del mes sin ítem asignado. */
export async function getUnclassifiedExpenses(
  monthYear: string,
): Promise<UnclassifiedExpense[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.rpc('get_unclassified_expenses', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });
  if (error) {
    console.error('Error obteniendo gastos sin clasificar:', error);
    return [];
  }
  return data || [];
}

/** Asigna (o desasigna con null) un gasto a un ítem. source: 'ai' | 'manual' | 'historial'. */
export async function assignExpenseToBudgetItem(
  expenseId: string,
  budgetItemId: string | null,
  source: BudgetItemSource,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase.rpc('assign_expense_budget_item', {
    p_user_id: user.id,
    p_transaction_id: expenseId,
    p_budget_item_id: budgetItemId,
    p_source: source,
  });
  if (error) {
    console.error('Error asignando gasto a ítem:', error);
    throw new Error(`Error asignando gasto: ${error.message}`);
  }
}

/** Conteos que devuelve POST /api/expenses/classify (ver la ruta). */
export interface ClassificationSummary {
  total: number;
  assigned: number;
  byHistory: number;
  byAi: number;
  skippedNoBudget: number;
  unmatched: number;
}

/**
 * Pide al SERVIDOR que clasifique gastos sin ítem (por mes o por ids). La IA
 * no puede correr acá: en el navegador no existen las API keys y antes se
 * devolvía null para todo sin avisar.
 */
export async function classifyExpensesOnServer(
  body: { monthYear: string } | { expenseIds: string[] },
): Promise<ClassificationSummary> {
  const res = await fetch('/api/expenses/classify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `Error clasificando gastos (${res.status})`);
  }
  return (await res.json()) as ClassificationSummary;
}

/** Clasifica en lote los gastos sin asignar de un mes (botón "Clasificar con IA"). */
export async function classifyUnassignedForMonth(
  monthYear: string,
): Promise<ClassificationSummary> {
  return classifyExpensesOnServer({ monthYear });
}

export {
  resolveItemNameToId,
  type BudgetItemRef,
  type BudgetItemSource,
  type UnclassifiedExpense,
} from './expenses-rollup';
