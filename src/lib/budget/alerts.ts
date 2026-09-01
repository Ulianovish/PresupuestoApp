/**
 * Alertas de presupuesto por rubro.
 * Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md
 */

import { formatCOP } from '@/lib/whatsapp/format';

import { highestThreshold, diasRestantesDelMes } from './thresholds';

export interface RubroEstado {
  budgetItemId: string;
  itemName: string;
  budgeted: number;
  spent: number;
}

export interface Alerta {
  budgetItemId: string;
  itemName: string;
  threshold: number;
  pct: number;
  spent: number;
  budgeted: number;
}

/**
 * Fila cruda del RPC get_budget_alert_status (ver migración
 * supabase/migrations/20260831000000_budget_alerts.sql, redefinida en
 * supabase/migrations/20260831000002_alert_rpc_privileges.sql).
 * El RPC todavía devuelve `category_name` además de estos campos, pero nada
 * lo lee: no vale la pena declararlo acá solo para ignorarlo. (Sacarlo del
 * RPC mismo queda pendiente: requiere DROP + CREATE FUNCTION porque cambia
 * RETURNS TABLE, y esta pasada no tocó la base de datos.)
 */
interface RubroEstadoRow {
  budget_item_id: string;
  item_name: string;
  budgeted: number | string;
  spent: number | string;
}

/**
 * Mapea una fila del RPC a RubroEstado. Antes vivía duplicada (comentario
 * incluido) en alerts-supabase.ts y en page.tsx: NUMERIC de Postgres llega
 * como string en los dos casos, así que el Number() tiene que vivir en un
 * solo lugar para no arriesgarse a que uno de los dos se quede corregido y el
 * otro no.
 */
export function mapRubroEstado(row: RubroEstadoRow): RubroEstado {
  return {
    budgetItemId: row.budget_item_id,
    itemName: row.item_name,
    budgeted: Number(row.budgeted),
    spent: Number(row.spent),
  };
}

/** null = no hay nada que decir de este rubro. */
export function evaluarRubro(r: RubroEstado): Alerta | null {
  if (r.budgeted <= 0) return null;
  const pct = (r.spent / r.budgeted) * 100;
  const threshold = highestThreshold(pct);
  if (threshold === 0) return null;
  return {
    budgetItemId: r.budgetItemId,
    itemName: r.itemName,
    threshold,
    pct,
    spent: r.spent,
    budgeted: r.budgeted,
  };
}

export interface AlertaPintable {
  /** Ya redondeado con Math.floor: nunca puede leerse "100%" antes de llegar. */
  pct: number;
  /** true a partir de threshold >= 100, NO de spent > budgeted (ver detalle abajo). */
  excedido: boolean;
  /**
   * Frase completa para el chat: "Te pasaste por $X", "Llegaste al límite" o
   * "Te quedan $X para los N días que faltan del mes" (redacción fijada en
   * el spec, docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md:196).
   */
  detalleLargo: string;
  /**
   * Misma frase, comprimida para la columna angosta del panel del
   * dashboard: "Te quedan $X para N días" en vez de la versión larga. En el
   * caso "excedido" es idéntica a detalleLargo — ahí no hay presión de
   * espacio que justifique una segunda redacción.
   */
  detalleCorto: string;
}

/**
 * Decide las tres cosas que antes se reimplementaban por separado en el
 * mensaje de chat (`formatearAlerta`) y en el panel del dashboard
 * (`BudgetAlertsPanel`): el redondeo del porcentaje, el corte de "excedido" y
 * los datos de cuánto queda o por cuánto se pasó. Al vivir en un solo lugar,
 * las dos superficies quedan obligadas a decidir lo mismo del mismo dato —
 * lo único que se bifurca a propósito es la REDACCIÓN de la frase de días
 * (`detalleLargo` vs `detalleCorto`): el chat necesita el contexto completo
 * ("que faltan del mes"), el panel necesita que quepa en una columna. Antes
 * de esta separación, unificar las dos superficies en una sola frase le
 * había recortado sin querer el texto al chat (ver spec, línea 196).
 *
 * El corte de "excedido" es `threshold >= 100`, no `spent > budgeted`: con
 * `spent === budgeted` exacto no se "pasó" de nada, llegó justo — por eso ese
 * caso dice "Llegaste al límite" en vez de "Te pasaste por $ 0".
 */
export function pintarAlerta(a: Alerta, hoy: Date): AlertaPintable {
  const pct = Math.floor(a.pct);
  const excedido = a.threshold >= 100;

  if (excedido) {
    const exceso = a.spent - a.budgeted;
    const detalle =
      exceso > 0 ? `Te pasaste por ${formatCOP(exceso)}` : 'Llegaste al límite';
    return { pct, excedido, detalleLargo: detalle, detalleCorto: detalle };
  }

  const queda = a.budgeted - a.spent;
  const dias = diasRestantesDelMes(hoy);
  return {
    pct,
    excedido,
    detalleLargo: `Te quedan ${formatCOP(queda)} para los ${dias} días que faltan del mes`,
    detalleCorto: `Te quedan ${formatCOP(queda)} para ${dias} días`,
  };
}

export function formatearAlerta(a: Alerta, hoy: Date): string {
  const { pct, excedido, detalleLargo } = pintarAlerta(a, hoy);
  if (excedido) {
    return `🔴 ${a.itemName}: ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} (${pct}%). ${detalleLargo}.`;
  }
  return `⚠️ Vas en ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} en ${a.itemName} (${pct}%).\n   ${detalleLargo}.`;
}

export interface AlertDeps {
  /** Rubros vigilados del mes, con gasto y presupuesto. */
  cargarEstado(userId: string, monthYear: string): Promise<RubroEstado[]>;
  /**
   * Registra el umbral. Devuelve true SOLO si subió respecto al ya avisado:
   * la escritura ES la decisión, así dos gastos simultáneos no pueden mandar
   * el mismo aviso dos veces.
   */
  marcarEnviado(
    userId: string,
    monthYear: string,
    budgetItemId: string,
    threshold: number,
  ): Promise<boolean>;
}

/**
 * Devuelve los mensajes a pegar a la respuesta del bot. Vacío = nada que decir.
 * Solo evalúa los rubros que tocó este gasto: si otro rubro está al 200% pero
 * no se le gastó nada ahora, avisarlo sería ruido fuera de contexto (el panel
 * del dashboard sí lo muestra).
 */
export async function dispararAlertas(
  deps: AlertDeps,
  args: {
    userId: string;
    monthYear: string;
    budgetItemIds: string[];
    hoy: Date;
  },
): Promise<string[]> {
  const tocados = new Set(args.budgetItemIds.filter(Boolean));
  if (tocados.size === 0) return [];

  const estado = await deps.cargarEstado(args.userId, args.monthYear);
  const mensajes: string[] = [];

  for (const r of estado) {
    if (!tocados.has(r.budgetItemId)) continue;
    const alerta = evaluarRubro(r);
    if (!alerta) continue;
    // Un rubro que falla no puede tirar los avisos que los otros ya ganaron:
    // marcarEnviado del anterior YA persistió su umbral, así que ese aviso no
    // volvería a salir nunca. Mismo criterio que executeTool con el gasto ya
    // guardado.
    try {
      const esNueva = await deps.marcarEnviado(
        args.userId,
        args.monthYear,
        alerta.budgetItemId,
        alerta.threshold,
      );
      if (esNueva) mensajes.push(formatearAlerta(alerta, args.hoy));
    } catch (err) {
      console.error(
        'dispararAlertas: marcarEnviado falló para',
        alerta.budgetItemId,
        err,
      );
    }
  }

  return mensajes;
}

/**
 * Rubros que hoy merecen un renglón en el dashboard (>=80%), de peor a mejor.
 *
 * NO consulta budget_alerts_sent a propósito: aunque el bot ya haya avisado por
 * chat, si seguís al 82% eso sigue siendo verdad y el panel debe mostrarlo.
 */
export function rubrosEnRiesgo(estado: RubroEstado[]): Alerta[] {
  return estado
    .map(evaluarRubro)
    .filter((a): a is Alerta => a !== null)
    .sort((x, y) => y.pct - x.pct);
}
