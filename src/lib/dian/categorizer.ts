const FALLBACK = 'OTROS';

export function buildCategorizationPrompt(
  items: Array<{ description: string }>,
  categories: string[],
): string {
  const list = items.map((it, i) => `${i + 1}. ${it.description}`).join('\n');
  return [
    'Eres un asistente de finanzas personales. Clasifica cada ítem de una',
    'factura en EXACTAMENTE una de estas categorías:',
    `${categories.join(', ')}.`,
    '',
    'Ítems:',
    list,
    '',
    'Responde SOLO con JSON: {"categories": ["CAT1", "CAT2", ...]} en el',
    'mismo orden y con la misma cantidad de ítems. Usa solo las categorías',
    'listadas; si dudas, usa OTROS.',
  ].join('\n');
}

/**
 * Extrae un objeto JSON de un texto que puede venir como JSON puro, envuelto en
 * fences markdown (```json ... ```), o precedido de razonamiento del modelo.
 * Devuelve el objeto parseado o null.
 */
function extractJsonObject(content: string): unknown | null {
  const trimmed = content.trim();

  // 1. Intento directo.
  try {
    return JSON.parse(trimmed);
  } catch {
    // continúa
  }

  // 2. Bloque entre fences ```json ... ``` o ``` ... ```.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // continúa
    }
  }

  // 3. Primer objeto {...} balanceado dentro del texto.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // continúa
    }
  }

  return null;
}

/**
 * Valida la respuesta cruda del modelo. Garantiza un array de longitud
 * `itemCount` con categorías válidas; cualquier valor inválido/faltante → OTROS.
 */
export function parseCategorizationResponse(
  content: string | null,
  itemCount: number,
  categories: string[],
): string[] {
  const result: string[] = new Array(itemCount).fill(FALLBACK);
  if (!content) return result;

  const parsed = extractJsonObject(content);
  const cats = (parsed as { categories?: unknown })?.categories;
  if (!Array.isArray(cats)) return result;

  const valid = new Set(categories);
  for (let i = 0; i < itemCount; i++) {
    const c = cats[i];
    if (typeof c === 'string' && valid.has(c)) {
      result[i] = c;
    }
  }
  return result;
}

/**
 * Categoriza los ítems con MiniMax (endpoint Anthropic-compatible del Coding
 * Plan). Ante cualquier error o falta de API key devuelve todo OTROS.
 */
export async function categorizeInvoiceItems(
  items: Array<{ description: string }>,
  categories: string[],
): Promise<string[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    return new Array(items.length).fill(FALLBACK);
  }

  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic';
  const model = process.env.CATEGORIZE_MODEL || 'MiniMax-M2.7';

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        // MiniMax-M2.7 es un modelo de razonamiento: emite un bloque "thinking"
        // ANTES del bloque "text" con el JSON. Con facturas de muchos ítems el
        // thinking consume todo el presupuesto y la respuesta se corta
        // (stop_reason=max_tokens) sin emitir el JSON -> todo cae a OTROS.
        // 8192 da margen para el razonamiento + la respuesta.
        max_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: buildCategorizationPrompt(items, categories),
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`MiniMax respondió ${res.status}`);
    }

    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    const content = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : null;

    return parseCategorizationResponse(content, items.length, categories);
  } catch (error) {
    console.error('Error categorizando items con IA:', error);
    return new Array(items.length).fill(FALLBACK);
  }
}
