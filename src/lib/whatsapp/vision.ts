// Extractor de visión: lee una imagen (transferencia o factura) con MiniMax-VL
// vía el endpoint Anthropic-compatible (validado). Devuelve datos estructurados
// o { kind: 'unknown' } ante cualquier problema. Nunca lanza.

export type TransferVision = {
  kind: 'transfer';
  amount: number;
  date: string | null;
  account: string | null;
  description: string | null;
  confidence: number;
};

export type ReceiptVision = {
  kind: 'receipt';
  supplier: string | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  total: number | null;
  confidence: number;
};

export type VisionResult = TransferVision | ReceiptVision | { kind: 'unknown' };

const PROMPT = [
  'Eres un asistente que lee imágenes financieras colombianas. Analiza la imagen',
  'y responde SOLO con un JSON (sin texto extra).',
  '',
  'Si es un comprobante de TRANSFERENCIA o pago (Nequi, Bancolombia, Daviplata,',
  'Davivienda, etc.):',
  '{"type":"transfer","amount":<entero COP sin separadores>,"date":"YYYY-MM-DD"|null,',
  '"account":"<app/banco de ORIGEN, ej Nequi>"|null,"description":"<destinatario o',
  'concepto>"|null,"confidence":<0..1>}',
  '',
  'Si es una FACTURA o recibo de compra con ítems:',
  '{"type":"receipt","supplier":"<tienda>"|null,"date":"YYYY-MM-DD"|null,',
  '"items":[{"description":"<ítem>","amount":<entero COP pagado del ítem>}],',
  '"total":<entero COP>|null,"confidence":<0..1>}',
  '',
  'Si no puedes leerla o no es ninguna de las dos: {"type":"unknown"}',
].join('\n');

/** Extrae un objeto JSON de un texto (directo, entre fences, o el primer {...}). */
function extractJson(content: string): unknown | null {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* sigue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* sigue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* sigue */
    }
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toResult(parsed: unknown): VisionResult {
  const obj = parsed as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') return { kind: 'unknown' };

  if (obj.type === 'transfer') {
    const amount = toInt(obj.amount);
    if (amount == null) return { kind: 'unknown' };
    return {
      kind: 'transfer',
      amount,
      date: typeof obj.date === 'string' ? obj.date : null,
      account: typeof obj.account === 'string' ? obj.account : null,
      description: typeof obj.description === 'string' ? obj.description : null,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    };
  }

  if (obj.type === 'receipt') {
    const rawItems = Array.isArray(obj.items) ? obj.items : [];
    const items = rawItems
      .map(it => {
        const i = it as Record<string, unknown>;
        const amount = toInt(i?.amount);
        const description =
          typeof i?.description === 'string' ? i.description.trim() : '';
        return amount != null && description ? { description, amount } : null;
      })
      .filter((x): x is { description: string; amount: number } => x !== null);
    if (items.length === 0) return { kind: 'unknown' };
    return {
      kind: 'receipt',
      supplier: typeof obj.supplier === 'string' ? obj.supplier : null,
      date: typeof obj.date === 'string' ? obj.date : null,
      items,
      total: toInt(obj.total),
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    };
  }

  return { kind: 'unknown' };
}

/** Analiza una imagen con MiniMax-VL. Nunca lanza; ante error → unknown. */
export async function analyzeImage(
  base64: string,
  mime: string,
): Promise<VisionResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return { kind: 'unknown' };

  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic';
  const model = process.env.VISION_MODEL || 'MiniMax-VL-01';

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
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mime, data: base64 },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { kind: 'unknown' };

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : '';
    const parsed = extractJson(text);
    if (!parsed) return { kind: 'unknown' };
    return toResult(parsed);
  } catch (err) {
    console.error('Error en analyzeImage:', err);
    return { kind: 'unknown' };
  }
}
