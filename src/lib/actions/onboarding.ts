'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { todayBogota } from '@/lib/whatsapp/format';

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

type OnboardingResult = { ok: boolean; error?: string };

const DESCRIPCION_INGRESO = 'Ingreso mensual';
const MAX_FUENTE = 255;

/**
 * Paso 1 de la bienvenida: guarda el ingreso mensual en `ingresos` con la
 * fecha de hoy (Bogotá). `monto` en pesos enteros > 0.
 */
export async function saveOnboardingIncomeAction(input: {
  monto: number;
  fuente: string;
}): Promise<OnboardingResult> {
  const monto = input?.monto;
  if (typeof monto !== 'number' || !Number.isSafeInteger(monto) || monto <= 0) {
    return { ok: false, error: 'Escribe tu ingreso en pesos, mayor a cero.' };
  }
  const fuente = typeof input.fuente === 'string' ? input.fuente.trim() : '';
  if (!fuente) {
    return { ok: false, error: 'Cuéntanos de dónde viene el ingreso.' };
  }
  if (fuente.length > MAX_FUENTE) {
    return { ok: false, error: 'La fuente del ingreso es demasiado larga.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase.from('ingresos').insert({
    user_id: user.id,
    descripcion: DESCRIPCION_INGRESO,
    fuente,
    monto,
    fecha: todayBogota(),
    tipo: 'ingreso',
  });
  if (error) {
    // Solo el código: el detalle de un CHECK fallido trae la fila (el monto).
    console.error(
      'saveOnboardingIncomeAction: error guardando el ingreso:',
      error.code,
    );
    return {
      ok: false,
      error: 'No pudimos guardar tu ingreso. Intenta de nuevo.',
    };
  }

  revalidatePath('/ingresos');
  return { ok: true };
}
