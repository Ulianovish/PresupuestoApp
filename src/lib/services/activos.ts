/**
 * Activos del usuario y perfil financiero.
 *
 * Alimentan los 12 índices del test de realidad financiera: sin activos no hay
 * patrimonio líquido ni endeudamiento, y sin perfil no hay índice de riqueza,
 * precio hora de vida ni score.
 */

import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

export interface Activo {
  id: string;
  nombre: string;
  tipo: string;
  valor: number;
  es_liquido: boolean;
  fecha_valoracion: string | null;
  nota: string | null;
  deuda_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NuevoActivo {
  nombre: string;
  tipo: string;
  valor: number;
  es_liquido?: boolean;
  fecha_valoracion?: string | null;
  nota?: string | null;
  deuda_id?: string | null;
}

export interface Valoracion {
  id: string;
  valor: number;
  fecha_valoracion: string | null;
  registrado_en: string;
}

export interface PerfilFinanciero {
  fecha_nacimiento: string | null;
  horas_trabajadas_mes: number | null;
  score_crediticio: number | null;
  ingreso_anual_promedio_10a: number | null;
  termostato_financiero: number | null;
  horas_vida_dia: number | null;
}

const PERFIL_VACIO: PerfilFinanciero = {
  fecha_nacimiento: null,
  horas_trabajadas_mes: null,
  score_crediticio: null,
  ingreso_anual_promedio_10a: null,
  termostato_financiero: null,
  horas_vida_dia: null,
};

async function userId(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listActivos(): Promise<Activo[]> {
  const uid = await userId();
  if (!uid) return [];

  const { data, error } = await supabase
    .from('activos')
    .select('*')
    .eq('user_id', uid)
    .eq('es_activo', true)
    .order('valor', { ascending: false });

  if (error) {
    console.error('Error listando activos:', error);
    return [];
  }
  return (data ?? []) as Activo[];
}

export async function createActivo(
  nuevo: NuevoActivo,
): Promise<{ success: boolean; error?: string }> {
  const uid = await userId();
  if (!uid) return { success: false, error: 'Usuario no autenticado' };

  const { error } = await supabase.from('activos').insert({
    user_id: uid,
    nombre: nuevo.nombre,
    tipo: nuevo.tipo,
    valor: nuevo.valor,
    es_liquido: nuevo.es_liquido ?? false,
    fecha_valoracion: nuevo.fecha_valoracion || null,
    nota: nuevo.nota || null,
    deuda_id: nuevo.deuda_id || null,
  });

  if (error) {
    console.error('Error creando activo:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function updateActivo(
  id: string,
  cambios: Partial<NuevoActivo>,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('activos').update(cambios).eq('id', id);
  if (error) {
    console.error('Error actualizando activo:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Borrado suave: el activo sale de la lista pero su histórico se conserva. */
export async function deleteActivo(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('activos')
    .update({ es_activo: false })
    .eq('id', id);
  if (error) {
    console.error('Error eliminando activo:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/** Cómo se ha valorizado un activo, de lo más reciente a lo más viejo. */
export async function getValoraciones(activoId: string): Promise<Valoracion[]> {
  const { data, error } = await supabase
    .from('activo_valoraciones')
    .select('id, valor, fecha_valoracion, registrado_en')
    .eq('activo_id', activoId)
    .order('registrado_en', { ascending: false });

  if (error) {
    console.error('Error obteniendo valoraciones:', error);
    return [];
  }
  return (data ?? []) as Valoracion[];
}

export async function getPerfilFinanciero(): Promise<PerfilFinanciero> {
  const uid = await userId();
  if (!uid) return PERFIL_VACIO;

  const { data, error } = await supabase
    .from('perfil_financiero')
    .select('*')
    .eq('user_id', uid)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo el perfil financiero:', error);
    return PERFIL_VACIO;
  }
  return { ...PERFIL_VACIO, ...(data ?? {}) } as PerfilFinanciero;
}

export async function savePerfilFinanciero(
  perfil: Partial<PerfilFinanciero>,
): Promise<{ success: boolean; error?: string }> {
  const uid = await userId();
  if (!uid) return { success: false, error: 'Usuario no autenticado' };

  const { error } = await supabase
    .from('perfil_financiero')
    .upsert(
      { user_id: uid, ...perfil, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('Error guardando el perfil financiero:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}
