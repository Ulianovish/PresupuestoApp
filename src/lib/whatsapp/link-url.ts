// Enlace "click to chat" de WhatsApp para vincular un número desde la app.
// El número del bot viene de NEXT_PUBLIC_WHATSAPP_BOT_NUMBER (público: es el
// mismo número al que la gente le escribe). Sin número válido → null, y la UI
// muestra solo el código, como antes.

/** Entre 8 y 15 dígitos: rango de E.164 sin el '+'. */
const SOLO_DIGITOS = /^\d{8,15}$/;

export function buildWhatsAppLinkUrl(
  botNumber: string | undefined,
  code: string,
): string | null {
  if (!botNumber) return null;
  const digitos = botNumber.replace(/^\s*whatsapp:/i, '').replace(/[\s+]/g, '');
  if (!SOLO_DIGITOS.test(digitos)) return null;
  const texto = encodeURIComponent(`VINCULAR ${code}`);
  return `https://wa.me/${digitos}?text=${texto}`;
}
