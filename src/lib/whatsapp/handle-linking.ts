// Orquesta la respuesta a un mensaje entrante en la fase de vinculación.
// Recibe las dependencias inyectadas para ser testeable sin tocar la DB.

import type {
  LinkAttemptReservation,
  RedeemResult,
} from '@/lib/services/whatsapp-links';
import { parseCommand } from '@/lib/whatsapp/message';

export interface LinkingDeps {
  redeemLinkCode: (code: string, phoneE164: string) => Promise<RedeemResult>;
  getLinkByPhone: (phoneE164: string) => Promise<{ userId: string } | null>;
  /**
   * Registra el intento ANTES de canjear y cuenta los de la ventana (este
   * incluido): con más de 5 no deja pasar. Así una ráfaga en paralelo no
   * puede probar más de 5 códigos.
   */
  reserveLinkAttempt: (phoneE164: string) => Promise<LinkAttemptReservation>;
  /** Borra un intento reservado que al final no fue un fallo del usuario. */
  releaseLinkAttempt: (attemptId: number) => Promise<void>;
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
    // fuerza de intentos deja de ser posible. La reserva rechazada se borra
    // sola, así que al pasar 15 minutos el número vuelve a poder.
    const reserva = await deps.reserveLinkAttempt(phoneE164);
    if (!reserva.allowed) {
      return MSG_TOO_MANY_ATTEMPTS;
    }
    const liberar = async () => {
      if (reserva.attemptId !== null) {
        await deps.releaseLinkAttempt(reserva.attemptId);
      }
    };

    let res: RedeemResult;
    try {
      res = await deps.redeemLinkCode(cmd.code, phoneE164);
    } catch (err) {
      await liberar();
      throw err;
    }
    // Solo un código inexistente o vencido cuenta (su reserva queda como el
    // fallo); un canje exitoso o un error de base no es culpa de quien escribe.
    if (res.ok || res.reason === 'link_failed') {
      await liberar();
    }
    if (res.ok) return MSG_LINKED_OK;

    // Twilio reintenta el webhook si la primera respuesta tardó: el código ya
    // se canjeó y el reintento lo ve como inválido. Si el número ya quedó
    // vinculado, no fue un fallo: se libera la reserva y se confirma.
    if (res.reason === 'invalid_or_expired') {
      const vinculado = await deps.getLinkByPhone(phoneE164).catch(() => null);
      if (vinculado) {
        await liberar();
        return MSG_LINKED_OK;
      }
    }
    return MSG_CODE_INVALID;
  }

  const link = await deps.getLinkByPhone(phoneE164);
  return link ? MSG_ALREADY_LINKED : MSG_NEEDS_LINK;
}
