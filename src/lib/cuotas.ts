/**
 * Compras diferidas a cuotas con tarjeta de crédito.
 *
 * El gasto del mes guarda la CUOTA (es lo que suma en el presupuesto del mes),
 * mientras que el valor total de la compra es lo que se le carga a la deuda de
 * la tarjeta.
 */

/**
 * Cuota que sugiere el formulario al escribir el total y el número de cuotas.
 *
 * Es solo una sugerencia editable: el banco casi siempre cobra una cuota mayor
 * por los intereses (una compra de $215.076 a 2 cuotas se divide en $107.538,
 * pero el extracto cobra $110.788,45), así que el valor definitivo lo pone
 * quien registra el gasto.
 *
 * Devuelve null cuando no hay con qué calcular.
 */
export function cuotaSugerida(
  total: number | null | undefined,
  cuotas: number | null | undefined,
): number | null {
  if (!total || !cuotas) return null;
  if (total <= 0 || cuotas < 1) return null;
  return Math.round((total / cuotas) * 100) / 100;
}

/** ¿La cuenta elegida es una tarjeta de crédito? */
export function esTarjetaDeCredito(
  accountName: string,
  tarjetas: string[],
): boolean {
  return tarjetas.includes(accountName);
}
