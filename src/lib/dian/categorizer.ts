const FALLBACK = 'OTROS';

/** Contexto extra para categorizar mejor que solo con la descripción. */
export interface CategorizationContext {
  /** Comercio/proveedor de la factura, si se conoce (p. ej. "Tiendas D1"). */
  supplier?: string | null;
  /**
   * Asignaciones MANUALES recientes del usuario (few-shot): enseñan sus
   * convenciones, que el modelo no puede adivinar (p. ej. bebidas y mecato a
   * GASTOS HORMIGA, no a MERCADO). Ver `ejemplosParaPrompt`.
   */
  examples?: Array<{ description: string; category: string }>;
}

export function buildCategorizationPrompt(
  items: Array<{ description: string }>,
  categories: string[],
  context: CategorizationContext = {},
): string {
  const list = items.map((it, i) => `${i + 1}. ${it.description}`).join('\n');
  const supplier = context.supplier?.trim();
  const examples = context.examples ?? [];

  const lines = [
    'Eres un asistente de finanzas personales. Clasifica cada ítem de una',
    'factura en EXACTAMENTE una de estas categorías:',
    `${categories.join(', ')}.`,
  ];
  if (supplier) {
    lines.push('', `Proveedor / comercio: ${supplier}`);
  }
  if (examples.length > 0) {
    lines.push(
      '',
      'Así clasificó el usuario gastos anteriores (respeta sus convenciones,',
      'aunque no sean las obvias):',
      ...examples.map(e => `- ${e.description} → ${e.category}`),
    );
  }
  lines.push(
    '',
    'Ítems:',
    list,
    '',
    'Responde SOLO con JSON: {"categories": ["CAT1", "CAT2", ...]} en el',
    'mismo orden y con la misma cantidad de ítems. Usa solo las categorías',
    'listadas y elige la más probable para cada ítem; usa OTROS solo si',
    'ninguna otra categoría aplica.',
  );
  return lines.join('\n');
}

/**
 * Extrae un objeto JSON de un texto que puede venir como JSON puro, envuelto en
 * fences markdown (```json ... ```), o precedido de razonamiento del modelo.
 * Devuelve el objeto parseado o null.
 */
export function extractJsonObject(content: string): unknown | null {
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
  // Los fallbacks se avisan con console.warn para distinguir en los logs un
  // OTROS "porque falló algo" de un OTROS que el modelo eligió a propósito.
  if (!content) {
    console.warn(
      `[categorizer] respuesta vacía: ${itemCount} ítem(s) caen a ${FALLBACK}`,
    );
    return result;
  }

  const parsed = extractJsonObject(content);
  const cats = (parsed as { categories?: unknown })?.categories;
  if (!Array.isArray(cats)) {
    console.warn(
      `[categorizer] respuesta sin JSON válido: ${itemCount} ítem(s) caen a ${FALLBACK}`,
    );
    return result;
  }

  const valid = new Set(categories);
  let invalidos = 0;
  for (let i = 0; i < itemCount; i++) {
    const c = cats[i];
    if (typeof c === 'string' && valid.has(c)) {
      result[i] = c;
    } else {
      invalidos++;
    }
  }
  if (invalidos > 0) {
    console.warn(
      `[categorizer] ${invalidos} de ${itemCount} ítem(s) con categoría inválida o faltante caen a ${FALLBACK}`,
    );
  }
  return result;
}

/**
 * Categoriza los ítems con IA (AI Gateway / endpoint Anthropic-compatible).
 * `context` agrega el proveedor y ejemplos del historial del usuario. Ante
 * cualquier error o falta de API key devuelve todo OTROS (con console.warn).
 */
export async function categorizeInvoiceItems(
  items: Array<{ description: string }>,
  categories: string[],
  context: CategorizationContext = {},
): Promise<string[]> {
  if (items.length === 0) return [];

  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.warn(
      `[categorizer] falta AI_GATEWAY_API_KEY: ${items.length} ítem(s) caen a ${FALLBACK}`,
    );
    return new Array(items.length).fill(FALLBACK);
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  const model = process.env.CATEGORIZE_MODEL || 'alibaba/qwen3.7-flash';

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
            content: buildCategorizationPrompt(items, categories, context),
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
    console.warn(
      `[categorizer] error de la IA: ${items.length} ítem(s) caen a ${FALLBACK}`,
      error,
    );
    return new Array(items.length).fill(FALLBACK);
  }
}
