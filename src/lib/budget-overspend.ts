/**
 * Alerta histórica de sobregasto.
 *
 * Informa que un ítem se pasó del presupuesto el MES ANTERIOR. Es solo
 * informativa: no suma, no resta y no toca ningún valor del mes que se está
 * viendo. El gasto del mes nuevo arranca en $0 aunque el anterior se haya
 * excedido.
 *
 * Módulo puro (sin Supabase) para poder probarlo de forma aislada.
 */

export interface Sobregasto {
  /** Ítem del mes actual al que se le muestra la alerta. */
  itemId: string;
  /** Mes anterior en formato YYYY-MM. */
  previousMonth: string;
  budgeted: number;
  spent: number;
  /** Cuánto se pasó: gastado - presupuestado (siempre > 0). */
  excess: number;
}

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Mensaje que se ve al pasar el mouse sobre el icono de alerta. */
export function mensajeSobregasto(
  nombreMesAnterior: string,
  excess: number,
): string {
  return `En ${nombreMesAnterior} excediste el presupuesto en ${COP.format(excess)}.`;
}

/** Indexa los sobregastos por ítem, que es como los consulta la tabla. */
export function porItem(sobregastos: Sobregasto[]): Record<string, Sobregasto> {
  const mapa: Record<string, Sobregasto> = {};
  for (const s of sobregastos) {
    if (s.excess > 0) mapa[s.itemId] = s;
  }
  return mapa;
}
