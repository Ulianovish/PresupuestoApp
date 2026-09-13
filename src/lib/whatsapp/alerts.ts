// Punto único donde el flujo de WhatsApp dispara las alertas de presupuesto
// tras un gasto (texto o foto). Antes esta construcción —`dispararAlertas` +
// `alertDepsSupabase` + el mes/fecha de Bogotá— vivía copiada en `turn.ts` y
// en el webhook que arma las deps de `handle-image.ts`; mismo criterio que ya
// forzó la única definición de `todayBogota`/`hoyBogotaDate` en `format.ts`:
// una sola implementación para que las dos no puedan divergir.

import { dispararAlertas } from '@/lib/budget/alerts';
import { alertDepsSupabase } from '@/lib/budget/alerts-supabase';

import { hoyBogotaDate } from './format';

/**
 * Devuelve los mensajes de alerta para los rubros tocados por un gasto (o
 * factura). Vacío = nada que decir, incluido el caso sin rubros (corta antes
 * de tocar Supabase).
 *
 * `monthYear` TIENE que ser el mes del gasto (o de la factura) que se acaba
 * de registrar, nunca el de hoy por default: los `budget_item_id` son por mes
 * (`get_budget_alert_status` filtra `bt.month_year = p_month_year`), así que
 * una factura de otro mes (un recibo viejo, un CUFE de la DIAN que llega los
 * primeros días del mes siguiente) comparada contra el mes de hoy nunca
 * matchea sus propios ids — `dispararAlertas` devuelve `[]` en silencio y la
 * feature no avisa nada, sin que se note el error. Cada llamador es
 * responsable de resolver ese mes con la fecha real que ya conoce.
 */
export async function dispararAlertasWhatsapp(
  userId: string,
  budgetItemIds: string[],
  monthYear: string,
): Promise<string[]> {
  if (budgetItemIds.length === 0) return []; // sin rubro no hay qué comparar
  return dispararAlertas(alertDepsSupabase(), {
    userId,
    monthYear,
    budgetItemIds,
    hoy: hoyBogotaDate(),
  });
}

/**
 * Pega las alertas (si hay) al texto base de confirmación, con el separador
 * estándar (`\n\n`). Único lugar donde vive esa decisión: antes estaba
 * copiada en `handle-image.ts` (x2), `handle-agent.ts` y `turn.ts` (x2), con
 * el riesgo de que una copia divergiera del resto (p. ej. un `\n` simple que
 * pegara la alerta sin separación visual).
 */
export function pegarAlertas(base: string, alertas: string[]): string {
  return alertas.length > 0 ? `${base}\n\n${alertas.join('\n\n')}` : base;
}
