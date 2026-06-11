// Servicio de vinculación número↔usuario. Usa el cliente service-role porque el
// webhook corre sin sesión; la seguridad la da el código de un solo uso + la
// firma de Twilio validada antes de llegar aquí.

import { randomInt } from 'crypto';

import { createAdminClient } from '@/lib/supabase/server';

const CODE_TTL_MINUTES = 10;

/** Código aleatorio de 6 dígitos (con ceros a la izquierda). */
export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Crea un código de vinculación para el usuario y lo persiste. Devuelve el código. */
export async function createLinkCode(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  await supabase
    .from('whatsapp_link_codes')
    .insert({ code, user_id: userId, expires_at: expiresAt });
  return code;
}

export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' };

/**
 * Canjea un código: valida vigencia y no-uso, lo marca usado y vincula el
 * número (upsert por phone_e164, así re-vincular mueve el número de presupuesto).
 */
export async function redeemLinkCode(
  code: string,
  phoneE164: string,
): Promise<RedeemResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: row } = await supabase
    .from('whatsapp_link_codes')
    .select('code, user_id')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const userId = (row as { user_id: string }).user_id;

  await supabase
    .from('whatsapp_link_codes')
    .update({ used_at: nowIso })
    .eq('code', code);

  await supabase
    .from('whatsapp_links')
    .upsert(
      { phone_e164: phoneE164, user_id: userId },
      { onConflict: 'phone_e164' },
    );

  return { ok: true, userId };
}

/** Resuelve el presupuesto (user_id) dueño de un número, o null. */
export async function getLinkByPhone(
  phoneE164: string,
): Promise<{ userId: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  return data ? { userId: (data as { user_id: string }).user_id } : null;
}
