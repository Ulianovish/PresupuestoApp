import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A dónde mandar a alguien que acaba de iniciar sesión o de confirmar su
 * correo: '/bienvenida' si nunca terminó el onboarding, '/dashboard' si ya lo
 * terminó o si la consulta falla (p. ej. antes de que exista la columna
 * `profiles.onboarding_completed_at`, que crea S09).
 */
export async function getPostLoginPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<'/bienvenida' | '/dashboard'> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return '/dashboard';
    return data.onboarding_completed_at == null ? '/bienvenida' : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
