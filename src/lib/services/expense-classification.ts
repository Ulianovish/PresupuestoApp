// Clasificación server-side de gastos a ítems del presupuesto. Es el camino
// único que usan WhatsApp/facturas (`classifyApprovedExpenses`) y la ruta
// POST /api/expenses/classify (botón "Clasificar con IA" y alta desde el
// formulario web). NUNCA debe correr en el navegador: ahí no existen
// AI_GATEWAY_API_KEY / MINIMAX_API_KEY y el clasificador devolvía null para
// todo mientras la UI reportaba cada fila como "hecha".

import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';
import {
  cargarHistorialManual,
  indexarHistorial,
  itemDesdeHistorial,
  type EntradaHistorial,
  type IndiceHistorial,
} from '@/lib/dian/historial-clasificacion';
import {
  normalizarNombre,
  resolveItemNameToId,
  type BudgetItemRef,
  type BudgetItemSource,
} from '@/lib/services/expenses-rollup';
import type { Database } from '@/types/database';

import type { SupabaseClient } from '@supabase/supabase-js';

type DBClient = SupabaseClient<Database>;

export interface GastoAClasificar {
  id: string;
  description: string;
  categoryName: string;
  monthYear: string;
  /**
   * La categoría la ADIVINÓ el sistema (IA de WhatsApp/visión/facturas,
   * palabras clave de la importación) y no el usuario: el historial puede
   * reemplazarla. Sin la marca, solo se reemplaza una categoría vacía — una
   * elegida a mano (OTROS incluido) se respeta.
   */
  categoriaAdivinada?: boolean;
}

export interface AsignacionHecha {
  expenseId: string;
  budgetItemId: string;
  source: Exclude<BudgetItemSource, 'manual'>;
}

export interface ResultadoClasificacion {
  /** Cuántos gastos se intentaron clasificar. */
  total: number;
  /** Solo los que el RPC de asignación CONFIRMÓ (sin error). */
  asignados: AsignacionHecha[];
  /** Gastos de un mes sin presupuesto (sin ítems): quedan sin asignar. */
  sinPresupuesto: number;
  /** Gastos con presupuesto pero sin ítem que encaje (o cuya asignación falló). */
  sinCoincidencia: number;
  /** Gastos a los que el historial les CAMBIÓ la categoría (la UI lo avisa). */
  categoriasCambiadas: number;
}

type Clasificador = typeof classifyExpensesToItems;

/** Ítems del presupuesto de un mes (mismo RPC que el panel y WhatsApp). */
export async function cargarItemsDelMes(
  supabase: DBClient,
  userId: string,
  monthYear: string,
): Promise<BudgetItemRef[]> {
  const { data } = await supabase.rpc('get_budget_items_for_month', {
    p_user_id: userId,
    p_month_year: monthYear,
  });
  return ((data as unknown[]) || []).map(row => {
    const r = row as {
      item_id: string;
      item_name: string;
      category_name: string;
    };
    return { id: r.item_id, name: r.item_name, category_name: r.category_name };
  });
}

function agruparPor<T>(lista: T[], clave: (t: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const el of lista) {
    const k = clave(el);
    const arr = grupos.get(k) ?? [];
    arr.push(el);
    grupos.set(k, arr);
  }
  return grupos;
}

/**
 * Clasifica y asigna gastos a ítems del presupuesto de SU mes. Best-effort:
 * nunca relanza; si algo falla a mitad de camino devuelve lo que sí quedó
 * asignado. Un gasto solo cuenta como asignado si el RPC lo confirmó.
 *
 * Meses sin presupuesto: los gastos quedan sin asignar (no hay a dónde) y se
 * cuentan en `sinPresupuesto` para que la UI pueda decirlo.
 */
export async function clasificarGastos(
  supabase: DBClient,
  userId: string,
  gastos: GastoAClasificar[],
  deps: {
    clasificar?: Clasificador;
    /** Historial ya cargado (si no viene, se carga UNA vez para todo el lote). */
    historial?: EntradaHistorial[];
  } = {},
): Promise<ResultadoClasificacion> {
  const clasificar = deps.clasificar ?? classifyExpensesToItems;
  let indice: IndiceHistorial | null = deps.historial
    ? indexarHistorial(deps.historial)
    : null;
  const obtenerIndice = async () => {
    indice ??= indexarHistorial(await cargarHistorialManual(supabase, userId));
    return indice;
  };
  const asignados: AsignacionHecha[] = [];
  let sinPresupuesto = 0;
  let categoriasCambiadas = 0;

  const asignar = async (
    gasto: GastoAClasificar,
    itemId: string,
    source: AsignacionHecha['source'],
  ) => {
    const { error } = await supabase.rpc('assign_expense_budget_item', {
      p_user_id: userId,
      p_transaction_id: gasto.id,
      p_budget_item_id: itemId,
      p_source: source,
    });
    // Solo cuenta si el RPC confirmó: reportar un rubro que no quedó escrito
    // dispararía alertas (y conteos) sobre un gasto que no está ahí.
    if (!error) {
      asignados.push({ expenseId: gasto.id, budgetItemId: itemId, source });
    }
  };

  try {
    for (const [monthYear, delMes] of agruparPor(gastos, g => g.monthYear)) {
      const items = await cargarItemsDelMes(supabase, userId, monthYear);
      if (items.length === 0) {
        sinPresupuesto += delMes.length;
        continue;
      }

      // 1. Historial del usuario: lo que ya asignó a mano a un gasto con la
      //    misma descripción. Gana sobre la IA.
      const idx = await obtenerIndice();
      const paraIA: GastoAClasificar[] = [];
      for (const gasto of delMes) {
        const hit = itemDesdeHistorial(
          gasto.description,
          gasto.categoryName,
          idx,
          items,
          { categoriaAdivinada: gasto.categoriaAdivinada },
        );
        if (!hit) {
          paraIA.push(gasto);
          continue;
        }
        if (hit.cambiaCategoria) {
          // La categoría estaba vacía o era adivinada: se le pone la del
          // historial para que no quede un ítem de VIVIENDA en un gasto OTROS.
          // Si no se pudo, mejor no asignar por historial y dejar que siga la IA.
          // Cast: `transactions` en database.ts no tiene category_name.
          const { error } = await (supabase as unknown as SupabaseClient)
            .from('transactions')
            .update({ category_name: hit.categoria })
            .eq('id', gasto.id)
            .eq('user_id', userId);
          if (error) {
            paraIA.push(gasto);
            continue;
          }
          categoriasCambiadas++;
        }
        const antes = asignados.length;
        await asignar(gasto, hit.itemId, 'historial');
        if (asignados.length === antes) paraIA.push(gasto);
      }

      // 2. IA para el resto: agrupar por categoría y clasificar cada grupo en
      //    un lote, acotado a los ítems de esa categoría.
      const porCategoria = agruparPor(paraIA, g =>
        normalizarNombre(g.categoryName),
      );
      for (const [categoria, grupo] of porCategoria) {
        const enCategoria = items.filter(
          i => normalizarNombre(i.category_name) === categoria,
        );
        if (enCategoria.length === 0) continue;

        const nombres = await clasificar(
          grupo.map(g => ({ description: g.description })),
          enCategoria.map(i => i.name),
        );
        for (let i = 0; i < grupo.length; i++) {
          const itemId = resolveItemNameToId(nombres[i] ?? null, enCategoria);
          if (itemId) await asignar(grupo[i], itemId, 'ai');
        }
      }
    }
  } catch (error) {
    console.error('Error clasificando gastos a ítems del presupuesto:', error);
    // best-effort: se devuelve lo que sí quedó asignado
  }

  return {
    total: gastos.length,
    asignados,
    sinPresupuesto,
    sinCoincidencia: gastos.length - asignados.length - sinPresupuesto,
    categoriasCambiadas,
  };
}

/**
 * Sugerencias para el panel "sin clasificar" (NO asigna nada): el ítem que el
 * historial manual del usuario propone para cada gasto. Solo cuando la
 * categoría del gasto coincide con la del historial — cambiar la categoría es
 * cosa de "Clasificar con IA", no de un desplegable acotado a la categoría.
 */
export async function sugerirDesdeHistorial(
  supabase: DBClient,
  userId: string,
  gastos: GastoAClasificar[],
  deps: { historial?: EntradaHistorial[] } = {},
): Promise<Record<string, { budgetItemId: string; source: 'historial' }>> {
  const out: Record<string, { budgetItemId: string; source: 'historial' }> = {};
  if (gastos.length === 0) return out;
  try {
    const indice = indexarHistorial(
      deps.historial ?? (await cargarHistorialManual(supabase, userId)),
    );
    if (indice.size === 0) return out;
    for (const [monthYear, delMes] of agruparPor(gastos, g => g.monthYear)) {
      const items = await cargarItemsDelMes(supabase, userId, monthYear);
      for (const gasto of delMes) {
        const hit = itemDesdeHistorial(
          gasto.description,
          gasto.categoryName,
          indice,
          items,
        );
        if (hit && !hit.cambiaCategoria) {
          out[gasto.id] = { budgetItemId: hit.itemId, source: 'historial' };
        }
      }
    }
  } catch (error) {
    console.warn('[historial] no se pudieron calcular sugerencias:', error);
  }
  return out;
}
