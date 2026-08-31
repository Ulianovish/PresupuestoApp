/**
 * Umbrales de alerta de presupuesto.
 *
 * La escalera sigue DESPUÉS del 100% a propósito: con avisos solo en 80 y 100,
 * un rubro que se dispara avisa dos veces a principio de mes y después se calla.
 * En agosto 2026, Dulces llegó al 938% de su presupuesto.
 */

/** 0 si va por debajo del 80%. Si no: 80, 100, 150, 200, 250... */
export function highestThreshold(pct: number): number {
  if (!Number.isFinite(pct) || pct < 80) return 0;
  if (pct < 100) return 80;
  return Math.floor(pct / 50) * 50;
}

/** Días de calendario que faltan del mes, contando hoy. */
export function diasRestantesDelMes(hoy: Date): number {
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return ultimo - hoy.getDate() + 1;
}
