/**
 * Tipos y helpers puros del roll-up de gastos a presupuesto.
 * Sin dependencias de Supabase para poder testear sin entorno.
 */

export interface BudgetItemRef {
  id: string;
  name: string;
  category_name: string;
}

export interface UnclassifiedExpense {
  id: string;
  description: string;
  amount: number;
  category_name: string;
  transaction_date: string;
}

/** Resuelve un nombre de ítem al id dentro de una lista (helper puro y testeable). */
export function resolveItemNameToId(
  name: string | null,
  items: BudgetItemRef[],
): string | null {
  if (!name) return null;
  const found = items.find(i => i.name === name);
  return found ? found.id : null;
}
