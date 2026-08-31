/**
 * Alertas de presupuesto por rubro.
 * Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md
 */

import { formatCOP } from '@/lib/whatsapp/format';

import { highestThreshold, diasRestantesDelMes } from './thresholds';

export interface RubroEstado {
  budgetItemId: string;
  itemName: string;
  categoryName: string;
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

export function formatearAlerta(a: Alerta, hoy: Date): string {
  const pct = Math.floor(a.pct);
  if (a.threshold >= 100) {
    const exceso = a.spent - a.budgeted;
    return `🔴 ${a.itemName}: ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} (${pct}%). Te pasaste por ${formatCOP(exceso)}.`;
  }
  const queda = a.budgeted - a.spent;
  const dias = diasRestantesDelMes(hoy);
  return `⚠️ Vas en ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} en ${a.itemName} (${pct}%).\n   Te quedan ${formatCOP(queda)} para los ${dias} días que faltan del mes.`;
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
