/**
 * Coherencia entre la categoría de un gasto y el ítem de presupuesto asignado.
 *
 * Un gasto solo puede sumar en un ítem de su misma categoría. Si al gasto le
 * cambian la categoría, el ítem que tenía deja de corresponder y hay que
 * soltarlo: si no, el gasto sigue sumando en una categoría a la que ya no
 * pertenece, sin que nada lo delate en pantalla.
 *
 * Módulo puro (sin Supabase) para poder probarlo de forma aislada.
 */

/** Normaliza para comparar sin acentos, mayúsculas ni espacios de sobra. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/**
 * ¿El ítem asignado sigue siendo válido para la categoría del gasto?
 *
 * Sin categoría de ítem (gasto sin asignar) se considera válido: no hay nada
 * que soltar.
 */
export function itemSigueEnCategoria(
  categoriaDelGasto: string | null | undefined,
  categoriaDelItem: string | null | undefined,
): boolean {
  if (!categoriaDelItem) return true;
  if (!categoriaDelGasto) return false;
  return normalizar(categoriaDelGasto) === normalizar(categoriaDelItem);
}
