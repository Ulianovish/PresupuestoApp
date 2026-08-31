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
