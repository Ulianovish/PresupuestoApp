/**
 * Color según lo que el dato significa, no según el gusto.
 *
 *   Azul   → el plan: lo que presupuestaste.
 *   Verde  → a favor: vas holgado, te sobra, está cumplido.
 *   Ámbar  → atención: te estás acercando al límite.
 *   Rojo   → te pasaste, o es deuda.
 *   Pizarra→ texto neutro, sin juicio.
 *
 * Cada color trae su par para tema claro y oscuro. En claro se usan tonos 600
 * y 700, que contrastan sobre blanco; en oscuro los 300 y 400, que contrastan
 * sobre pizarra. Los tonos claros (300) sobre fondo blanco no se leen, y ese
 * era el problema.
 */

export type EstadoGasto = 'sin-gasto' | 'holgado' | 'cerca' | 'excedido';

/** Umbral a partir del cual se considera que el gasto se acerca al límite. */
export const UMBRAL_CERCA = 80;

/**
 * Cómo va un ítem frente a lo que tenía presupuestado.
 *
 * Gastar sin haber presupuestado cuenta como 'cerca': no es un exceso
 * demostrable, pero tampoco es un gasto bajo control.
 */
export function estadoDeGasto(
  presupuestado: number,
  gastado: number,
): EstadoGasto {
  if (!gastado) return 'sin-gasto';
  if (presupuestado <= 0) return 'cerca';
  const porcentaje = (gastado / presupuestado) * 100;
  if (porcentaje > 100) return 'excedido';
  if (porcentaje >= UMBRAL_CERCA) return 'cerca';
  return 'holgado';
}

/** Color del valor gastado, según cómo va contra su presupuesto. */
export const COLOR_GASTO: Record<EstadoGasto, string> = {
  'sin-gasto': 'text-slate-500 dark:text-gray-400',
  holgado: 'text-emerald-700 dark:text-emerald-300',
  cerca: 'text-amber-700 dark:text-amber-300',
  excedido: 'text-red-700 dark:text-red-400',
};

/** Lo presupuestado es el plan: azul, sin juicio de valor. */
export const COLOR_PRESUPUESTADO = 'text-blue-700 dark:text-blue-300';

/** Dinero a favor (disponible, sobrante, ingreso). */
export const COLOR_A_FAVOR = 'text-emerald-700 dark:text-emerald-400';

/** Dinero en contra (deuda, exceso). */
export const COLOR_EN_CONTRA = 'text-red-700 dark:text-red-400';

/** Texto neutro sobre cualquiera de los dos fondos. */
export const COLOR_NEUTRO = 'text-slate-700 dark:text-gray-300';

/** Etiqueta (chip) legible en ambos temas, por familia de color. */
export function chip(familia: string): string {
  const mapa: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    emerald:
      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    purple:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    pink: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
    amber:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    slate:
      'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  };
  return mapa[familia] ?? mapa.slate;
}
