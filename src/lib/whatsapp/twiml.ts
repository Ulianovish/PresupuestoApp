// Constructores de respuestas TwiML para webhooks de Twilio (síncronas).

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Respuesta con un mensaje de vuelta al remitente. */
export function twimlMessage(text: string): string {
  return `${HEADER}<Response><Message>${escapeXml(text)}</Message></Response>`;
}

/** Respuesta vacía (acusar recibo sin contestar). */
export function twimlEmpty(): string {
  return `${HEADER}<Response></Response>`;
}
