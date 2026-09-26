// Clasificación pura del mensaje de un usuario YA vinculado, y los textos de
// respuesta. No toca DB ni red: el webhook clasifica de forma síncrona para
// responder un ACK inmediato y decidir qué corre en background.

export type Decision = 'cufe' | 'agent' | 'image' | 'help';

/** Un CUFE DIAN es un hash hexadecimal de 96 caracteres. */
export function isCufe(text: string): boolean {
  return /^[0-9a-f]{96}$/i.test((text || '').trim());
}

/**
 * Extrae un CUFE (96 hex) embebido en un texto: el bloque completo que devuelve
 * un QR de factura DIAN (campos NumFac/CUFE/...) o una URL del catálogo DIAN.
 * Toma la primera corrida de EXACTAMENTE 96 hex (no parte de un hash más largo).
 * Devuelve el CUFE en minúsculas, o null.
 */
export function extractCufe(text: string): string | null {
  const match = (text || '').match(/(?<![0-9a-f])[0-9a-f]{96}(?![0-9a-f])/i);
  return match ? match[0].toLowerCase() : null;
}

/**
 * NIT genéricos de consumidor final: los scrapers ya los prueban solos como
 * respaldo, mandarlos también solo repetiría el mismo intento.
 */
const NITS_GENERICOS = new Set(['222222222222', '2222222222']);

/**
 * Extrae del bloque del QR el NIT del emisor (`NitFac`) y el documento del
 * comprador (`DocAdq`), en ese orden. La DIAN exige uno de los dos para
 * buscar la factura, y con el genérico solo acierta si el comprador era
 * consumidor final. Acepta los dos formatos que devuelven los lectores de QR:
 * `NitFac="800149695"` en una línea y `NitFac: 800149695` por líneas.
 * Devuelve [] con el CUFE pelado (los scrapers caen a los genéricos).
 */
export function extractQrNits(text: string): string[] {
  const nits: string[] = [];
  for (const campo of ['NitFac', 'DocAdq']) {
    const match = (text || '').match(
      new RegExp(`\\b${campo}\\s*[:=]\\s*"?(\\d{5,15})(?!\\d)`, 'i'),
    );
    const nit = match?.[1];
    if (nit && !NITS_GENERICOS.has(nit) && !nits.includes(nit)) nits.push(nit);
  }
  return nits;
}

export function classifyText(body: string, numMedia: number): Decision {
  if (numMedia > 0) return 'image';
  const text = (body || '').trim();
  // El CUFE es 96 hex: determinista y gratis. Un LLM acá solo agregaría formas
  // de fallar.
  if (extractCufe(text)) return 'cufe';
  if (/^(ayuda|help)$/i.test(text)) return 'help';
  // Todo lo demás va al agente. `parseQuickExpense` ya no decide el enrutado:
  // acertaba mal en silencio ("2 empanadas 5000" -> $2) y esos casos nunca
  // llegaban a 'unknown', así que un LLM de respaldo jamás los habría visto.
  return 'agent';
}

/**
 * Respuesta inmediata (TwiML) para el CUFE, el único caso que sigue en
 * background con un ACK propio. Sin parámetro: recibía la decisión y no la
 * usaba. El texto tampoco habla ya de dejarla "lista para revisar": esa
 * pantalla de aprobación se eliminó, ahora el bot pregunta la cuenta y registra.
 */
export function ackMessage(): string {
  return '🧾 Recibí tu factura, la estoy consultando en la DIAN (~1 min). Después te pregunto con qué cuenta la pagaste.';
}

/** Respuesta completa (TwiML) para los casos que NO necesitan background. */
export function simpleReply(decision: 'image' | 'help'): string {
  if (decision === 'image') {
    return '📷 Recibí una imagen. Envíame la *foto* de una factura o de una transferencia y la registro.';
  }
  return [
    'Puedo registrar tus gastos 💸',
    '• Pega el *CUFE* de una factura DIAN → la dejo lista.',
    '• Envía una *foto* de una factura o de una transferencia → la leo y la registro.',
    '• Escribe un gasto: "20k taxi", "gasté 35000 en mercado".',
    '• Preguntame: "¿cuánto llevo en mercado?"',
  ].join('\n');
}
