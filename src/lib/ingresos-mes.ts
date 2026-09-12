/**
 * Filtro de ingresos por mes.
 *
 * Define en un solo lugar qué ingresos pertenecen a un mes, para que la
 * pantalla de Ingresos y los indicadores de endeudamiento no puedan
 * desalinearse al contar el ingreso del mes.
 */

/** Ingreso reducido a lo que hace falta para ubicarlo en un mes. */
export interface IngresoConFecha {
  /** Fecha en formato ISO (YYYY-MM-DD). */
  fecha?: string | null;
  monto?: number | null;
}

/**
 * Devuelve los ingresos que caen dentro de un mes.
 *
 * @param mes Mes en formato YYYY-MM. Si viene vacío, no devuelve nada.
 */
export function ingresosDelMes<T extends IngresoConFecha>(
  ingresos: T[],
  mes: string,
): T[] {
  if (!mes) return [];
  return ingresos.filter(i => (i.fecha ?? '').slice(0, 7) === mes);
}

/** Suma el monto de los ingresos de un mes. */
export function totalIngresosDelMes(
  ingresos: IngresoConFecha[],
  mes: string,
): number {
  return ingresosDelMes(ingresos, mes).reduce(
    (sum, i) => sum + (i.monto ?? 0),
    0,
  );
}

/**
 * Fecha por defecto al registrar un ingreso en un mes.
 *
 * Si el mes elegido es el actual usa el día de hoy; si es otro mes usa su
 * primer día, para que el ingreso no se guarde fuera del mes que se está
 * viendo.
 */
export function fechaPorDefectoDelMes(mes: string, hoy = new Date()): string {
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  if (!mes) return hoyISO;
  return hoyISO.slice(0, 7) === mes ? hoyISO : `${mes}-01`;
}
