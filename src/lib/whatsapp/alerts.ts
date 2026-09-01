// Punto único donde el flujo de WhatsApp dispara las alertas de presupuesto
// tras un gasto (texto o foto). Antes esta construcción —`dispararAlertas` +
// `alertDepsSupabase` + el mes/fecha de Bogotá— vivía copiada en `turn.ts` y
// en el webhook que arma las deps de `handle-image.ts`; mismo criterio que ya
// forzó la única definición de `todayBogota`/`hoyBogotaDate` en `format.ts`:
// una sola implementación para que las dos no puedan divergir.

import { dispararAlertas } from '@/lib/budget/alerts';
import { alertDepsSupabase } from '@/lib/budget/alerts-supabase';

import { hoyBogotaDate, todayBogota } from './format';

/**
 * Devuelve los mensajes de alerta para los rubros tocados por un gasto (o
 * factura). Vacío = nada que decir, incluido el caso sin rubros (corta antes
 * de tocar Supabase).
 */
export async function dispararAlertasWhatsapp(
  userId: string,
  budgetItemIds: string[],
): Promise<string[]> {
  if (budgetItemIds.length === 0) return []; // sin rubro no hay qué comparar
  return dispararAlertas(alertDepsSupabase(), {
    userId,
    monthYear: todayBogota().slice(0, 7),
    budgetItemIds,
    hoy: hoyBogotaDate(),
  });
}
