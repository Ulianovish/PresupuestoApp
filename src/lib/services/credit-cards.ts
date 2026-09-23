/**
 * Resumen mensual de tarjetas de crédito.
 *
 * Por cada tarjeta, cuánto se gastó con ella y cuánto se le abonó en el mes:
 *
 *   gastado → gastos cargados A la tarjeta (la tarjeta es la cuenta del gasto)
 *   pagado  → abonos A la tarjeta, identificados por el ítem de deuda enlazado
 *             a ella, porque el pago guarda la cuenta de ORIGEN (Efectivo,
 *             Nequi…) y no la tarjeta destino.
 */

import { supabase } from '@/lib/supabase/client';

export { conMovimiento, type CreditCardSummary } from './credit-cards-filter';

import type { CreditCardSummary } from './credit-cards-filter';

/** Trae el resumen de todas las tarjetas activas del mes. */
export async function getCreditCardsSummary(
  monthYear: string,
): Promise<CreditCardSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.rpc('get_credit_cards_summary', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });
  if (error) {
    console.error('Error obteniendo resumen de tarjetas:', error);
    return [];
  }

  return (data || []).map(
    (r: {
      account_id: string;
      account_name: string;
      gastado: number | string;
      pagado: number | string;
    }) => ({
      accountId: r.account_id,
      accountName: r.account_name,
      gastado: Number(r.gastado) || 0,
      pagado: Number(r.pagado) || 0,
    }),
  );
}
