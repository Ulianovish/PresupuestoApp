// Orquesta la respuesta a un mensaje entrante en la fase de vinculación.
// Recibe las dependencias inyectadas para ser testeable sin tocar la DB.

import type { RedeemResult } from '@/lib/services/whatsapp-links';
import { parseCommand } from '@/lib/whatsapp/message';

export interface LinkingDeps {
  redeemLinkCode: (code: string, phoneE164: string) => Promise<RedeemResult>;
  getLinkByPhone: (phoneE164: string) => Promise<{ userId: string } | null>;
  /** true si el número ya tiene 5 VINCULAR fallidos en los últimos 15 min. */
  isLinkAttemptLimitReached: (phoneE164: string) => Promise<boolean>;
  /** Suma un VINCULAR fallido (código inexistente o vencido) al número. */
  recordFailedLinkAttempt: (phoneE164: string) => Promise<void>;
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

export const MSG_TOO_MANY_ATTEMPTS =
  'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.';

export async function handleLinkingMessage(
  phoneE164: string,
  body: string,
  deps: LinkingDeps,
): Promise<string> {
  const cmd = parseCommand(body);

  if (cmd.kind === 'link') {
    // Con el límite alcanzado ni se mira el código: adivinar los 6 dígitos a
    // fuerza de intentos deja de ser posible. Estos intentos no se registran,
    // así que al pasar 15 minutos el número vuelve a poder.
    if (await deps.isLinkAttemptLimitReached(phoneE164)) {
      return MSG_TOO_MANY_ATTEMPTS;
    }
    const res = await deps.redeemLinkCode(cmd.code, phoneE164);
    if (res.ok) {
      return MSG_LINKED_OK;
    }
    // Solo un código inexistente o vencido cuenta; un error de base no es
    // culpa de quien escribe.
    if (res.reason === 'invalid_or_expired') {
      await deps.recordFailedLinkAttempt(phoneE164);
    }
    return MSG_CODE_INVALID;
  }

  const link = await deps.getLinkByPhone(phoneE164);
  return link ? MSG_ALREADY_LINKED : MSG_NEEDS_LINK;
}
