/**
 * Tipos y helpers puros del roll-up de gastos a presupuesto.
 * Sin dependencias de Supabase para poder testear sin entorno.
 */

export interface BudgetItemRef {
  id: string;
  name: string;
  category_name: string;
}

/**
 * Origen del vínculo gasto → ítem (columna `transactions.budget_item_source`,
 * VARCHAR(10) sin CHECK):
 * - 'manual': el usuario lo eligió (desplegable, corrección por WhatsApp).
 * - 'ai': lo eligió el clasificador por IA.
 * - 'historial': se reutilizó lo que el usuario asignó antes a un gasto con la
 *   misma descripción (ver `historial-clasificacion.ts`).
 */
export type BudgetItemSource = 'ai' | 'manual' | 'historial';

export interface UnclassifiedExpense {
  id: string;
  description: string;
  amount: number;
  category_name: string;
  transaction_date: string;
}

/**
 * Resuelve un nombre de ítem al id dentro de una lista (helper puro y
 * testeable). Primero exacto; si no, sin distinguir mayúsculas, tildes ni
 * espacios sobrantes (el modelo o el usuario rara vez copian el nombre
 * exacto: "VERDURAS Y FRUTAS" vs "Verduras y frutas").
 */
export function resolveItemNameToId(
  name: string | null,
  items: BudgetItemRef[],
): string | null {
  if (!name) return null;
  const exacto = items.find(i => i.name === name);
  if (exacto) return exacto.id;
  const buscado = normalizarNombre(name);
  if (!buscado) return null;
  const found = items.find(i => normalizarNombre(i.name) === buscado);
  return found ? found.id : null;
}

/**
 * Normaliza un nombre de categoría/ítem para compararlo: sin tildes, en
 * minúsculas y con los espacios colapsados ("Vivienda " ≡ "VIVIENDA").
 */
export function normalizarNombre(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
