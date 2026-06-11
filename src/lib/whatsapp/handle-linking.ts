// Orquesta la respuesta a un mensaje entrante en la fase de vinculación.
// Recibe las dependencias inyectadas para ser testeable sin tocar la DB.

import type { RedeemResult } from '@/lib/services/whatsapp-links';
import { parseCommand } from '@/lib/whatsapp/message';

export interface LinkingDeps {
  redeemLinkCode: (code: string, phoneE164: string) => Promise<RedeemResult>;
  getLinkByPhone: (phoneE164: string) => Promise<{ userId: string } | null>;
}

const MSG_LINKED_OK =
  '✅ ¡Listo! Tu WhatsApp quedó vinculado a tu presupuesto. Pronto podrás ' +
  'enviarme tus facturas (CUFE o foto) y transferencias para registrar gastos.';
const MSG_CODE_INVALID =
  '❌ Ese código no es válido o ya expiró. Genera uno nuevo en la app ' +
  '(Ajustes → Conectar WhatsApp) y envíame: VINCULAR 123456';
const MSG_ALREADY_LINKED =
  'Tu número ya está vinculado a tu presupuesto. 👍 El registro de gastos por ' +
  'mensaje llegará muy pronto.';
const MSG_NEEDS_LINK =
  'Hola 👋 Para conectar tu WhatsApp con tu presupuesto, entra a la app → ' +
  'Ajustes → Conectar WhatsApp, genera tu código de 6 dígitos y envíame: ' +
  'VINCULAR 123456';

export async function handleLinkingMessage(
  phoneE164: string,
  body: string,
  deps: LinkingDeps,
): Promise<string> {
  const cmd = parseCommand(body);

  if (cmd.kind === 'link') {
    const res = await deps.redeemLinkCode(cmd.code, phoneE164);
    return res.ok ? MSG_LINKED_OK : MSG_CODE_INVALID;
  }

  const link = await deps.getLinkByPhone(phoneE164);
  return link ? MSG_ALREADY_LINKED : MSG_NEEDS_LINK;
}
