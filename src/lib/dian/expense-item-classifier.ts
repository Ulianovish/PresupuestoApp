import { extractJsonObject } from './categorizer';

/**
 * Construye el prompt para mapear cada descripción de gasto a UN nombre de ítem
 * del presupuesto (o "NINGUNO" si no encaja en ninguno).
 */
export function buildExpenseItemPrompt(
  items: Array<{ description: string }>,
  itemNames: string[],
): string {
  const list = items.map((it, i) => `${i + 1}. ${it.description}`).join('\n');
  return [
    'Eres un asistente de finanzas personales. A cada gasto asígnale',
    'EXACTAMENTE uno de estos ítems de presupuesto:',
    `${itemNames.join(', ')}.`,
    'Si un gasto no encaja claramente en ninguno, responde "NINGUNO".',
    '',
    'Gastos:',
    list,
    '',
    'Responde SOLO con JSON: {"items": ["ITEM1", "NINGUNO", ...]} en el mismo',
    'orden y con la misma cantidad. Usa solo los ítems listados o "NINGUNO".',
  ].join('\n');
}

/**
 * Valida la respuesta del modelo. Devuelve un array de longitud `itemCount`:
 * cada posición es un nombre de ítem válido o `null` (NINGUNO / inválido).
 */
export function parseExpenseItemResponse(
  content: string | null,
  itemCount: number,
  itemNames: string[],
): Array<string | null> {
  const result: Array<string | null> = new Array(itemCount).fill(null);
  if (!content) return result;

  const parsed = extractJsonObject(content);
  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) return result;

  const valid = new Set(itemNames);
  for (let i = 0; i < itemCount; i++) {
    const v = items[i];
    if (typeof v === 'string' && valid.has(v)) {
      result[i] = v;
    }
  }
  return result;
}

/**
 * Clasifica gastos en nombres de ítems usando el AI Gateway (mismo patrón que
 * categorizeInvoiceItems). Ante error o falta de API key devuelve todo null.
 */
export async function classifyExpensesToItems(
  items: Array<{ description: string }>,
  itemNames: string[],
): Promise<Array<string | null>> {
  if (items.length === 0 || itemNames.length === 0) {
    return new Array(items.length).fill(null);
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('classifyExpensesToItems: falta AI_GATEWAY_API_KEY');
    return new Array(items.length).fill(null);
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
        max_tokens: 8192,
        messages: [
          { role: 'user', content: buildExpenseItemPrompt(items, itemNames) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`IA respondió ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const content = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : null;
    return parseExpenseItemResponse(content, items.length, itemNames);
  } catch (error) {
    console.error('Error clasificando gastos a ítems:', error);
    return new Array(items.length).fill(null);
  }
}
