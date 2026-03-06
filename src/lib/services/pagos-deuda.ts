/**
 * Servicios para gestionar pagos de deuda con Supabase
 *
 * CRUD operations para la tabla pagos_deuda que rastrea
 * pagos mensuales por cada deuda.
 */

import { supabase } from '@/lib/supabase/client';

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface PagoDeuda {
  id: string;
  user_id: string;
  deuda_id: string;
  mes: string; // YYYY-MM
  valor_cuota: number;
  valor_pagado: number;
  fecha_pago: string | null;
  pagado: boolean;
  notas: string;
  created_at: string;
  updated_at: string;
}

export interface NuevoPagoDeuda {
  deuda_id: string;
  mes: string;
  valor_cuota: number;
  valor_pagado?: number;
  fecha_pago?: string;
  pagado?: boolean;
  notas?: string;
}

// ============================================
// FUNCIONES CRUD
// ============================================

/**
 * Obtener todos los pagos de una deuda específica
 */
export async function obtenerPagosDeuda(deudaId: string): Promise<PagoDeuda[]> {
  try {
    const { data, error } = await supabase
      .from('pagos_deuda')
      .select('*')
      .eq('deuda_id', deudaId)
      .order('mes', { ascending: false });

    if (error) {
      console.error('Error al obtener pagos de deuda:', error);
      throw new Error('No se pudieron cargar los pagos');
    }

    return data || [];
  } catch (error) {
    console.error('Error en obtenerPagosDeuda:', error);
    throw error;
  }
}

/**
 * Obtener todos los pagos de un mes específico
 */
export async function obtenerPagosPorMes(mes: string): Promise<PagoDeuda[]> {
  try {
    const { data, error } = await supabase
      .from('pagos_deuda')
      .select('*')
      .eq('mes', mes)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al obtener pagos por mes:', error);
      throw new Error('No se pudieron cargar los pagos del mes');
    }

    return data || [];
  } catch (error) {
    console.error('Error en obtenerPagosPorMes:', error);
    throw error;
  }
}

/**
 * Crear un nuevo pago de deuda
 */
export async function crearPagoDeuda(
  nuevoPago: NuevoPagoDeuda,
): Promise<PagoDeuda> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase
      .from('pagos_deuda')
      .insert([
        {
          user_id: user.id,
          deuda_id: nuevoPago.deuda_id,
          mes: nuevoPago.mes,
          valor_cuota: nuevoPago.valor_cuota,
          valor_pagado: nuevoPago.valor_pagado ?? 0,
          fecha_pago: nuevoPago.fecha_pago ?? null,
          pagado: nuevoPago.pagado ?? false,
          notas: nuevoPago.notas ?? '',
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error al crear pago de deuda:', error);
      throw new Error('No se pudo crear el pago');
    }

    return data;
  } catch (error) {
    console.error('Error en crearPagoDeuda:', error);
    throw error;
  }
}

/**
 * Actualizar un pago de deuda existente
 */
export async function actualizarPagoDeuda(
  id: string,
  datosActualizados: Partial<NuevoPagoDeuda>,
): Promise<PagoDeuda> {
  try {
    const { data, error } = await supabase
      .from('pagos_deuda')
      .update(datosActualizados)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar pago de deuda:', error);
      throw new Error('No se pudo actualizar el pago');
    }

    return data;
  } catch (error) {
    console.error('Error en actualizarPagoDeuda:', error);
    throw error;
  }
}

/**
 * Eliminar un pago de deuda
 */
export async function eliminarPagoDeuda(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('pagos_deuda').delete().eq('id', id);

    if (error) {
      console.error('Error al eliminar pago de deuda:', error);
      throw new Error('No se pudo eliminar el pago');
    }
  } catch (error) {
    console.error('Error en eliminarPagoDeuda:', error);
    throw error;
  }
}

/**
 * Marcar un pago como pagado
 */
export async function marcarPagoComoPagado(
  id: string,
  valorPagado: number,
): Promise<PagoDeuda> {
  return actualizarPagoDeuda(id, {
    pagado: true,
    valor_pagado: valorPagado,
    fecha_pago: new Date().toISOString().split('T')[0],
  });
}
