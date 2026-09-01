/**
 * AlertDeps contra Supabase con service-role.
 * Vive aparte de alerts.ts para que la lógica se pueda testear sin base de datos.
 */

import { createAdminClient } from '@/lib/supabase/server';

import { mapRubroEstado, type AlertDeps, type RubroEstado } from './alerts';

export function alertDepsSupabase(): AlertDeps {
  const supabase = createAdminClient();

  return {
    async cargarEstado(userId, monthYear): Promise<RubroEstado[]> {
      const { data, error } = await supabase.rpc('get_budget_alert_status', {
        p_user_id: userId,
        p_month_year: monthYear,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRubroEstado);
    },

    async marcarEnviado(userId, monthYear, budgetItemId, threshold) {
      // La escritura ES la decisión: el WHERE del ON CONFLICT deja pasar solo
      // si el umbral sube. Sin fila devuelta = ya se había avisado.
      const { data, error } = await supabase.rpc('mark_budget_alert_sent', {
        p_user_id: userId,
        p_month_year: monthYear,
        p_budget_item_id: budgetItemId,
        p_threshold: threshold,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}
