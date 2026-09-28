/**
 * Lógica pura del panel "Gastos sin clasificar": qué muestra el desplegable de
 * cada gasto y qué se guarda al presionar "Asignar".
 *
 * Regla: solo se preselecciona una sugerencia REAL (historial del usuario o
 * IA), nunca "el primer ítem de la categoría". Antes una cena salía con "Cine"
 * y un arriendo con "Imprevistos" solo por orden alfabético, y "Asignar"
 * guardaba esos defaults como 'manual', ensuciando el registro de lo que el
 * usuario realmente eligió.
 */

import type { ClassificationSummary } from '@/lib/services/expenses';
import type {
  BudgetItemRef,
  BudgetItemSource,
} from '@/lib/services/expenses-rollup';

/** Sugerencia real para un gasto (viene del servidor). */
export interface SugerenciaItem {
  budgetItemId: string;
  source: Exclude<BudgetItemSource, 'manual'>;
}

export type SugerenciasPorGasto = Record<string, SugerenciaItem>;

/** Lo que el usuario tocó en el desplegable, por id de gasto ('' = Sin asignar). */
export type SeleccionUsuario = Record<string, string>;

interface GastoPanel {
  id: string;
}

export interface AsignacionPanel {
  expenseId: string;
  budgetItemId: string;
  source: BudgetItemSource;
}

/** La sugerencia del gasto, solo si apunta a un ítem del mes que se muestra. */
function sugerenciaValida(
  gasto: GastoPanel,
  sugerencias: SugerenciasPorGasto,
  items: BudgetItemRef[],
): SugerenciaItem | null {
  const sug = sugerencias[gasto.id];
  if (!sug) return null;
  return items.some(i => i.id === sug.budgetItemId) ? sug : null;
}

/** Valor efectivo del desplegable: lo elegido por el usuario, o la sugerencia real, o ''. */
export function valorDelSelect(
  gasto: GastoPanel,
  seleccion: SeleccionUsuario,
  sugerencias: SugerenciasPorGasto,
  items: BudgetItemRef[],
): string {
  if (gasto.id in seleccion) return seleccion[gasto.id];
  return sugerenciaValida(gasto, sugerencias, items)?.budgetItemId ?? '';
}

/**
 * Sugerencia a marcar visualmente ("Sugerido: historial/IA"): solo mientras el
 * usuario no haya tocado el desplegable de ese gasto.
 */
export function sugerenciaVisible(
  gasto: GastoPanel,
  seleccion: SeleccionUsuario,
  sugerencias: SugerenciasPorGasto,
  items: BudgetItemRef[],
): SugerenciaItem | null {
  if (gasto.id in seleccion) return null;
  return sugerenciaValida(gasto, sugerencias, items);
}

/**
 * Qué guarda "Asignar": solo filas con valor. Una sugerencia aceptada sin
 * tocar conserva su origen ('historial' / 'ai'); 'manual' queda reservado a
 * cuando el usuario efectivamente cambió el desplegable.
 */
export function asignacionesAGuardar(
  gastos: GastoPanel[],
  seleccion: SeleccionUsuario,
  sugerencias: SugerenciasPorGasto,
  items: BudgetItemRef[],
): AsignacionPanel[] {
  const out: AsignacionPanel[] = [];
  for (const gasto of gastos) {
    if (gasto.id in seleccion) {
      const itemId = seleccion[gasto.id];
      if (itemId) {
        out.push({
          expenseId: gasto.id,
          budgetItemId: itemId,
          source: 'manual',
        });
      }
      continue;
    }
    const sug = sugerenciaValida(gasto, sugerencias, items);
    if (sug) {
      out.push({
        expenseId: gasto.id,
        budgetItemId: sug.budgetItemId,
        source: sug.source,
      });
    }
  }
  return out;
}

/**
 * Mensaje para el usuario tras "Clasificar con IA", con el número REAL que
 * quedó asignado (antes se reportaba cada fila como hecha aunque la IA no
 * hubiera asignado nada).
 */
export function mensajeClasificacion(r: ClassificationSummary): string {
  const partes: string[] = [];
  if (r.assigned > 0) {
    const desglose: string[] = [];
    if (r.byHistory > 0) desglose.push(`${r.byHistory} por tu historial`);
    if (r.byAi > 0) desglose.push(`${r.byAi} por IA`);
    partes.push(
      `Se asignaron ${r.assigned} de ${r.total} gastos${desglose.length ? ` (${desglose.join(', ')})` : ''}.`,
    );
  } else {
    partes.push('No se asignó ningún gasto.');
  }
  if (r.skippedNoBudget > 0) {
    partes.push(
      `${r.skippedNoBudget} son de un mes sin presupuesto (créalo primero).`,
    );
  }
  if (r.recategorized > 0) {
    partes.push(
      r.recategorized === 1
        ? '1 cambió de categoría según tu historial.'
        : `${r.recategorized} cambiaron de categoría según tu historial.`,
    );
  }
  if (r.unmatched > 0) {
    partes.push(`${r.unmatched} quedan para asignar a mano.`);
  }
  return partes.join(' ');
}
