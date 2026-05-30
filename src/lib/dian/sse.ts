import type { SSEEvent } from '@/types/invoices';

/**
 * Parsea una línea de un stream SSE. Devuelve el evento si la línea es
 * `data: <json>` válido; en cualquier otro caso devuelve null.
 */
export function parseSSEEventLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }
  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch {
    return null;
  }
}
