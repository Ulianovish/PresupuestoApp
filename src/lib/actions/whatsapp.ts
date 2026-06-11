'use server';

import { createLinkCode } from '@/lib/services/whatsapp-links';
import { createClient } from '@/lib/supabase/server';

export type GenerateCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/** Genera un código de vinculación de WhatsApp para el usuario autenticado. */
export async function generateWhatsAppLinkCodeAction(): Promise<GenerateCodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }
  const code = await createLinkCode(user.id);
  return { ok: true, code };
}
