/**
 * Traducción de los datos del formulario de deudas a las columnas reales de
 * la tabla `deudas`.
 *
 * El formulario usa `tipo_deuda`, pero la columna en la base se llama `tipo`.
 * PostgREST rechaza con 400 (PGRST204) cualquier columna que no exista, así
 * que ese campo nunca debe llegar tal cual a un update.
 *
 * Módulo puro (sin Supabase) para poder probarlo de forma aislada.
 */

type ConTipoDeuda = { tipo_deuda?: string | null };

/**
 * Prepara un update parcial de una deuda: renombra `tipo_deuda` a `tipo` y lo
 * elimina del objeto. Si no viene `tipo_deuda`, no agrega `tipo`, para no
 * sobrescribir la clasificación en actualizaciones parciales (p. ej. marcar
 * como pagada).
 */
export function aColumnasDeActualizacion<T extends object>(
  datos: T,
): Omit<T, 'tipo_deuda'> & { tipo?: string } {
  // Se acepta cualquier objeto: con `T extends ConTipoDeuda` TypeScript lo
  // trata como tipo débil y rechaza updates que no traen `tipo_deuda`.
  const { tipo_deuda, ...resto } = datos as T & ConTipoDeuda;
  return tipo_deuda ? { ...resto, tipo: tipo_deuda } : resto;
}
