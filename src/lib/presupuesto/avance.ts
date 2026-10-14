/**
 * Cuánto se lleva gastado de lo presupuestado, para dibujarlo como anillo.
 *
 * El anillo completo es el 100% del presupuesto, no del gasto: así una
 * categoría con mucho dinero y otra con poco se leen igual de rápido, que es
 * justo lo que una lista de montos no deja hacer.
 */

import { estadoDeGasto, type EstadoGasto } from '@/lib/colores-dato';

export interface Avance {
  /** Gastado sobre presupuestado. null cuando no hay presupuesto. */
  porcentaje: number | null;
  /** Lo que se pinta del anillo, 0-100 (un exceso llena el anillo, no más). */
  relleno: number;
  estado: EstadoGasto;
  /** Lo que se escribe en el centro. */
  etiqueta: string;
}

export function avanceDeCategoria(
  presupuestado: number,
  gastado: number,
): Avance {
  const estado = estadoDeGasto(presupuestado, gastado);

  if (!presupuestado || presupuestado <= 0) {
    // Sin presupuesto el porcentaje no significa nada; inventarlo (0%, 100%)
    // haría ver bajo control algo que nadie planeó.
    return { porcentaje: null, relleno: 0, estado, etiqueta: '—' };
  }

  const porcentaje = (gastado / presupuestado) * 100;
  return {
    porcentaje,
    relleno: Math.max(0, Math.min(porcentaje, 100)),
    estado,
    etiqueta: `${Math.round(porcentaje)}%`,
  };
}
