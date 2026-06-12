// Clasificación pura del mensaje de un usuario YA vinculado, y los textos de
// respuesta. No toca DB ni red: el webhook clasifica de forma síncrona para
// responder un ACK inmediato y decidir qué corre en background.

import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';

export type Decision = 'cufe' | 'quick_expense' | 'image' | 'help' | 'unknown';

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

export function classifyText(body: string, numMedia: number): Decision {
  if (numMedia > 0) return 'image';
  const text = (body || '').trim();
  if (extractCufe(text)) return 'cufe';
  if (/^(ayuda|help)$/i.test(text)) return 'help';
  if (parseQuickExpense(text)) return 'quick_expense';
  return 'unknown';
}

/** Respuesta inmediata (TwiML) para los casos que siguen en background. */
export function ackMessage(decision: 'cufe' | 'quick_expense'): string {
  if (decision === 'cufe') {
    return '🧾 Recibí tu factura, la estoy procesando (~1 min). Te aviso cuando esté lista para revisar.';
  }
  return '✍️ Anotando tu gasto...';
}

/** Respuesta completa (TwiML) para los casos que NO necesitan background. */
export function simpleReply(decision: 'image' | 'help' | 'unknown'): string {
  if (decision === 'image') {
    return '📷 ¡Gracias! Aún no proceso fotos ni QR, pero muy pronto podré. Por ahora envíame el CUFE en texto o un gasto como "20k taxi".';
  }
  if (decision === 'help') {
    return [
      'Puedo registrar tus gastos 💸',
      '• Pega el *CUFE* de una factura DIAN → la dejo lista para aprobar.',
      '• Escribe un gasto: "20k taxi", "gasté 35000 en mercado".',
      '(Las fotos y QR llegan pronto.)',
    ].join('\n');
  }
  return 'No te entendí 🤔. Pega el *CUFE* de una factura, o escribe un gasto como "20k taxi". Escribe *ayuda* para ver qué puedo hacer.';
}
