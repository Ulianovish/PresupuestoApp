/**
 * Parte pura del resumen de tarjetas (sin Supabase, para poder probarla).
 */

export interface CreditCardSummary {
  accountId: string;
  accountName: string;
  /** Gastos cargados A la tarjeta en el mes. */
  gastado: number;
  /** Abonos A la tarjeta en el mes. */
  pagado: number;
}

/**
 * Tarjetas con movimiento en el mes.
 *
 * Una tarjeta sin gasto ni pago no aporta nada al dashboard y solo alarga la
 * sección, así que no se muestra.
 */
export function conMovimiento(
  tarjetas: CreditCardSummary[],
): CreditCardSummary[] {
  return tarjetas.filter(t => t.gastado !== 0 || t.pagado !== 0);
}
