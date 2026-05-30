import OpenAI from 'openai';

const FALLBACK = 'OTROS';

export function buildCategorizationPrompt(
  items: Array<{ description: string }>,
  categories: string[],
): string {
  const list = items
    .map((it, i) => `${i + 1}. ${it.description}`)
    .join('\n');
  return [
    'Eres un asistente de finanzas personales. Clasifica cada ítem de una',
    'factura en EXACTAMENTE una de estas categorías:',
    `${categories.join(', ')  }.`,
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return result;
  }
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
 * Categoriza los ítems con OpenAI. Ante cualquier error devuelve todo OTROS.
 */
export async function categorizeInvoiceItems(
  items: Array<{ description: string }>,
  categories: string[],
): Promise<string[]> {
  if (items.length === 0) return [];
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CATEGORIZE_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'user', content: buildCategorizationPrompt(items, categories) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const content = completion.choices[0]?.message?.content ?? null;
    return parseCategorizationResponse(content, items.length, categories);
  } catch (error) {
    console.error('Error categorizando items con IA:', error);
    return new Array(items.length).fill(FALLBACK);
  }
}
