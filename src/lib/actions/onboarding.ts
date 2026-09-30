'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Siembra el kit inicial (contratos §1.3 y §5.1) para el usuario de la sesión.
 * Idempotente en la base: si el usuario ya tiene alguna categoría activa, la
 * RPC no hace nada y devuelve false.
 *
 * Contrato v2 (§5.2): NUNCA lanza y no llama revalidatePath ni redirect,
 * porque /bienvenida y el dashboard la llaman durante el render. Los fallos
 * vuelven en `error`: 'no_session', el code de la RPC (p. ej. 23503 sin
 * perfil, o la función inexistente antes de H8) o 'unexpected'. Los
 * llamadores no necesitan try/catch.
 */
export async function ensureStarterKitAction(): Promise<{
  seeded: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { seeded: false, error: 'no_session' };
    }

    const { data, error } = await supabase.rpc('ensure_starter_kit');
    if (error) {
      const code = error.code || 'rpc_error';
      // Solo el code: el mensaje de Postgres puede traer datos del usuario.
      console.warn('ensureStarterKitAction: no se pudo sembrar el kit:', code);
      return { seeded: false, error: code };
    }

    return { seeded: data === true };
  } catch {
    // Sin el detalle: puede traer datos del usuario.
    console.warn('ensureStarterKitAction: error inesperado');
    return { seeded: false, error: 'unexpected' };
  }
}
