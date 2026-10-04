/**
 * Estado de las deudas en un mes concreto.
 *
 * La deuda es una sola (nombre, acreedor, tipo, tasa); lo que cambia mes a mes
 * es su estado: saldo, cuota y cuotas pagadas. Editar octubre no toca
 * noviembre.
 *
 * Un mes sin foto propia hereda la del mes anterior más cercano, y si no hay
 * ninguna, los valores base de la deuda. Así un mes nuevo arranca con lo
 * último conocido en vez de en ceros.
 */

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface DeudaMes {
  deudaId: string;
  descripcion: string;
  acreedor: string;
  tipo: string;
  tasaInteres: number;
  fechaVencimiento: string | null;
  saldoPendiente: number;
  valorCuota: number;
  cuotasPagas: number;
  cuotasFaltantes: number;
  /** false cuando los valores vienen heredados y no de este mes. */
  tieneFoto: boolean;
}

export async function getDeudasMes(monthYear: string): Promise<DeudaMes[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc('get_deudas_mes', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });

  if (error) {
    console.error('Error obteniendo las deudas del mes:', error);
    return [];
  }

  return ((data as unknown[]) ?? []).map(fila => {
    const f = fila as Record<string, unknown>;
    return {
      deudaId: String(f.deuda_id),
      descripcion: String(f.descripcion ?? ''),
      acreedor: String(f.acreedor ?? ''),
      tipo: String(f.tipo ?? ''),
      tasaInteres: Number(f.tasa_interes) || 0,
      fechaVencimiento: (f.fecha_vencimiento as string) ?? null,
      saldoPendiente: Number(f.saldo_pendiente) || 0,
      valorCuota: Number(f.valor_cuota) || 0,
      cuotasPagas: Number(f.cuotas_pagas) || 0,
      cuotasFaltantes: Number(f.cuotas_faltantes) || 0,
      tieneFoto: f.tiene_foto === true,
    };
  });
}

/** Guarda el estado de una deuda en un mes. Solo afecta a ese mes. */
export async function saveDeudaMes(
  deudaId: string,
  monthYear: string,
  valores: {
    saldoPendiente: number;
    valorCuota: number;
    cuotasPagas: number;
    cuotasFaltantes: number;
  },
): Promise<{ success: boolean; error?: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Usuario no autenticado' };

  const { error } = await supabase.rpc('upsert_deuda_mes', {
    p_user_id: user.id,
    p_deuda_id: deudaId,
    p_month_year: monthYear,
    p_saldo_pendiente: valores.saldoPendiente,
    p_valor_cuota: valores.valorCuota,
    p_cuotas_pagas: valores.cuotasPagas,
    p_cuotas_faltantes: valores.cuotasFaltantes,
  });

  if (error) {
    console.error('Error guardando la deuda del mes:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
