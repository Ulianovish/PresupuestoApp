// Transporte saliente de WhatsApp vía la REST API de Twilio.
// Interfaz delgada y reemplazable: el núcleo del agente solo depende de
// `sendWhatsAppMessage`, así que migrar a Meta Cloud API = otra implementación.

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Asegura el prefijo whatsapp: en un número E.164 sin duplicarlo. */
function toWhatsApp(addr: string): string {
  const trimmed = addr.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

/**
 * Envía un mensaje de WhatsApp por Twilio. Nunca lanza: ante credenciales
 * faltantes o error de Twilio devuelve { ok: false } (el llamador decide).
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    console.error('Transporte WhatsApp sin configurar (SID/TOKEN/FROM)');
    return { ok: false, error: 'no_config' };
  }

  const params = new URLSearchParams();
  params.set('From', from);
  params.set('To', toWhatsApp(to));
  params.set('Body', body);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Twilio respondió ${res.status}: ${detail}`);
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('Error enviando WhatsApp:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
