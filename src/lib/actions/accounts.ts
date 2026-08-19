'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

export interface AccountWithUsage {
  id: string;
  name: string;
  type: string;
  /** Cuántos gastos registrados usan esta cuenta. */
  usage: number;
}

const accountSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre es demasiado largo'),
  type: z.enum(['bank', 'cash', 'credit']),
});

/** Lista las cuentas activas del usuario con cuántos gastos usan cada una. */
export async function listAccounts(): Promise<AccountWithUsage[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const [{ data: accounts }, { data: txs }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, type')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name'),
    supabase.from('transactions').select('account_id').eq('user_id', user.id),
  ]);

  const usage = new Map<string, number>();
  (txs || []).forEach(t => {
    const id = t.account_id as string | null;
    if (id) usage.set(id, (usage.get(id) ?? 0) + 1);
  });

  return (accounts || []).map(a => ({
    id: a.id as string,
    name: a.name as string,
    type: (a.type as string) || 'bank',
    usage: usage.get(a.id as string) ?? 0,
  }));
}

/** Crea una cuenta nueva (nombre único por usuario). */
export async function createAccount(input: { name: string; type: string }) {
  try {
    const data = accountSchema.parse({ ...input, type: input.type || 'bank' });
    const name = data.name.trim();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Ya tienes una cuenta con ese nombre' };
    }

    const { error } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, name, type: data.type, is_active: true });

    if (error) {
      console.error('Error creando cuenta:', error);
      return { success: false, error: 'No se pudo crear la cuenta' };
    }

    revalidatePath('/settings');
    revalidatePath('/gastos');
    return { success: true };
  } catch (error) {
    console.error('Error en createAccount:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos' };
    }
    return { success: false, error: 'Error interno del servidor' };
  }
}

/**
 * Renombra o cambia el tipo de una cuenta. Renombrar es seguro: los gastos
 * apuntan a la cuenta por id, así que conservan su vínculo.
 */
export async function updateAccount(
  id: string,
  input: { name: string; type: string },
) {
  try {
    const data = accountSchema.parse({ ...input, type: input.type || 'bank' });
    const name = data.name.trim();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .eq('is_active', true)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Ya tienes otra cuenta con ese nombre' };
    }

    const { error } = await supabase
      .from('accounts')
      .update({ name, type: data.type })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error actualizando cuenta:', error);
      return { success: false, error: 'No se pudo actualizar la cuenta' };
    }

    revalidatePath('/settings');
    revalidatePath('/gastos');
    return { success: true };
  } catch (error) {
    console.error('Error en updateAccount:', error);
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Datos inválidos' };
    }
    return { success: false, error: 'Error interno del servidor' };
  }
}

/**
 * Desactiva una cuenta (borrado suave): deja de aparecer en los selectores
 * pero los gastos ya registrados conservan su vínculo y su historial.
 */
export async function deactivateAccount(id: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error desactivando cuenta:', error);
      return { success: false, error: 'No se pudo desactivar la cuenta' };
    }

    revalidatePath('/settings');
    revalidatePath('/gastos');
    return { success: true };
  } catch (error) {
    console.error('Error en deactivateAccount:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}

/**
 * Nombre de cuenta para una tarjeta de crédito registrada en Deudas.
 * Usa el acreedor con el prefijo "TC", evitando repetirlo si el acreedor ya
 * empieza por "Tarjeta"/"TC" (ej. "Tarjeta Nu Bank Milo" -> "TC Nu Bank Milo").
 */
export async function accountNameForCard(acreedor: string): Promise<string> {
  const base = (acreedor || '')
    .trim()
    .replace(/^(tarjeta de credito|tarjeta de crédito|tarjeta|tc)\s+/i, '')
    .trim();
  return base ? `TC ${base}` : 'TC';
}

/**
 * Crea (o reactiva) la cuenta correspondiente a una tarjeta de crédito de
 * Deudas, porque con esas tarjetas se pagan gastos y deben poder elegirse como
 * cuenta al registrarlos. Idempotente y best-effort.
 */
export async function ensureAccountForCreditCard(acreedor: string) {
  try {
    const name = await accountNameForCard(acreedor);
    if (name === 'TC') return { success: false, error: 'Acreedor vacío' };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    const { data: existing } = await supabase
      .from('accounts')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      // Si existía desactivada, se reactiva para que vuelva a los selectores.
      if (!existing.is_active) {
        await supabase
          .from('accounts')
          .update({ is_active: true, type: 'credit' })
          .eq('id', existing.id);
      }
      return { success: true, name };
    }

    const { error } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, name, type: 'credit', is_active: true });

    if (error) {
      console.error('Error creando cuenta de tarjeta:', error);
      return { success: false, error: 'No se pudo crear la cuenta' };
    }

    revalidatePath('/settings');
    revalidatePath('/gastos');
    return { success: true, name };
  } catch (error) {
    console.error('Error en ensureAccountForCreditCard:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
