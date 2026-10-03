/**
 * Reúne, desde sus cinco fuentes, los datos que alimentan los 12 índices.
 *
 * El cálculo vive en `@/lib/indices-financieros` (módulo puro); aquí solo se
 * consultan los totales. Se consultan en paralelo porque son independientes.
 */

import { edadDesde, type DatosFinancieros } from '@/lib/indices-financieros';
import { createClient } from '@/lib/supabase/client';

import { getPerfilFinanciero } from './activos';

const supabase = createClient();

function suma(filas: Array<Record<string, unknown>>, campo: string): number {
  return filas.reduce((t, f) => t + (Number(f[campo]) || 0), 0);
}

/**
 * @param monthYear Mes en formato YYYY-MM para los datos mensuales (ingresos y
 *   gastos). Activos y deudas son saldos, no dependen del mes.
 */
export async function getDatosFinancieros(
  monthYear: string,
): Promise<DatosFinancieros> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ingresosMes: 0,
      ingresoResidualMes: 0,
      gastosMes: 0,
      cuotasMensuales: 0,
      totalActivos: 0,
      totalDeudas: 0,
    };
  }

  const [ingresos, gastos, deudas, activos, perfil] = await Promise.all([
    supabase
      .from('ingresos')
      .select('monto, es_residual, fecha')
      .eq('user_id', user.id)
      .eq('es_activo', true),
    supabase.rpc('get_expenses_summary_by_month', {
      p_user_id: user.id,
      p_month_year: monthYear,
    }),
    supabase
      .from('deudas')
      .select('valor_cuota, saldo_pendiente, pagada, es_activo')
      .eq('user_id', user.id),
    supabase
      .from('activos')
      .select('valor')
      .eq('user_id', user.id)
      .eq('es_activo', true),
    getPerfilFinanciero(),
  ]);

  const delMes = (ingresos.data ?? []).filter(
    (i: { fecha?: string | null }) => (i.fecha ?? '').slice(0, 7) === monthYear,
  );
  const residuales = delMes.filter(
    (i: { es_residual?: boolean }) => i.es_residual === true,
  );

  const deudasVigentes = (deudas.data ?? []).filter(
    (d: { pagada?: boolean; es_activo?: boolean }) =>
      d.es_activo !== false && d.pagada !== true,
  );

  return {
    ingresosMes: suma(delMes, 'monto'),
    ingresoResidualMes: suma(residuales, 'monto'),
    gastosMes: suma(gastos.data ?? [], 'total_amount'),
    cuotasMensuales: suma(deudasVigentes, 'valor_cuota'),
    totalActivos: suma(activos.data ?? [], 'valor'),
    totalDeudas: suma(deudasVigentes, 'saldo_pendiente'),
    edad: edadDesde(perfil.fecha_nacimiento),
    horasTrabajadasMes: perfil.horas_trabajadas_mes,
    scoreCrediticio: perfil.score_crediticio,
    ingresoAnualPromedio10a: perfil.ingreso_anual_promedio_10a,
    termostatoFinanciero: perfil.termostato_financiero,
    horasVidaDia: perfil.horas_vida_dia,
  };
}
