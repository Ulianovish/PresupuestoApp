'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

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

const itemIdSchema = z.string().uuid();
const MAX_RUBROS = 200;

/**
 * Paso 2 de la bienvenida: guarda el monto presupuestado de cada rubro.
 * Solo toca `budgeted_amount` y solo de rubros del usuario (filtro explícito
 * por `user_id` además de RLS). Montos en pesos enteros >= 0.
 */
export async function saveOnboardingBudgetAction(
  amounts: Record<string, number>,
): Promise<OnboardingResult> {
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) {
    return { ok: false, error: 'No entendimos los montos del presupuesto.' };
  }
  const entradas = Object.entries(amounts);
  if (entradas.length > MAX_RUBROS) {
    return {
      ok: false,
      error: 'Son demasiados rubros para guardar de una vez.',
    };
  }
  for (const [id, monto] of entradas) {
    if (!itemIdSchema.safeParse(id).success) {
      return { ok: false, error: 'Hay un rubro que no reconocemos.' };
    }
    if (
      typeof monto !== 'number' ||
      !Number.isSafeInteger(monto) ||
      monto < 0
    ) {
      return {
        ok: false,
        error: 'Los montos deben ser pesos enteros, sin negativos.',
      };
    }
  }
  if (entradas.length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const resultados = await Promise.all(
    entradas.map(([id, monto]) =>
      supabase
        .from('budget_items')
        .update({ budgeted_amount: monto })
        .eq('id', id)
        .eq('user_id', user.id),
    ),
  );
  const fallo = resultados.find(r => r.error);
  if (fallo?.error) {
    console.error(
      'saveOnboardingBudgetAction: error guardando montos:',
      fallo.error.code,
    );
    return {
      ok: false,
      error: 'No pudimos guardar tu presupuesto. Intenta de nuevo.',
    };
  }

  revalidatePath('/presupuesto');
  return { ok: true };
}

/**
 * Fin de la bienvenida (terminar o saltar el último paso): marca
 * `onboarding_completed_at` y lleva al dashboard. Si el UPDATE falla igual
 * redirige: preferimos que vuelva a ver la bienvenida en el próximo ingreso a
 * dejarlo atrapado aquí.
 */
export async function completeOnboardingAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error(
      'completeOnboardingAction: no se pudo marcar la bienvenida:',
      error.code,
    );
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/**
 * "Ocultar" la checklist del dashboard (S12): marca `onboarding_dismissed_at`.
 * Contrato v2 (§5.2): nunca lanza. Sin sesión o con el UPDATE fallido
 * devuelve `{ ok: false }` y hace console.warn solo con el code; el botón
 * restaura la tarjeta con un toast.
 */
export async function dismissChecklistAction(): Promise<{ ok: boolean }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn('dismissChecklistAction: sin sesión:', 'no_session');
      return { ok: false };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_dismissed_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      // Solo el code: el mensaje de Postgres puede traer datos del usuario.
      console.warn(
        'dismissChecklistAction: no se pudo ocultar la checklist:',
        error.code,
      );
      return { ok: false };
    }

    revalidatePath('/dashboard');
    return { ok: true };
  } catch {
    // Sin el detalle: puede traer datos del usuario.
    console.warn('dismissChecklistAction: error inesperado');
    return { ok: false };
  }
}
