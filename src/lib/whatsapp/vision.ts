// Extractor de visión: lee una imagen (transferencia o factura) vía la superficie
// Anthropic Messages del Vercel AI Gateway. Nunca lanza. Distingue dos fracasos:
//   - 'unknown'       → el modelo respondió pero no pudo interpretar la imagen.
//   - 'service_error' → falló la llamada (sin key, 4xx/5xx, red). NO es culpa de
//                       la foto, así que el llamador no debe pedir "reenviala
//                       más clara". Los transitorios se reintentan antes.

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

export type VisionResult =
  | TransferVision
  | ReceiptVision
  | { kind: 'unknown' }
  | { kind: 'service_error' };

/** Status que vale la pena reintentar: saturación o fallo pasajero del proveedor. */
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Tope: un monto > 100M COP leído de una imagen casi siempre es un error de OCR.
const MAX_AMOUNT = 100_000_000;

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT ? Math.round(n) : null;
}

/** Acepta solo fechas ISO YYYY-MM-DD; cualquier otra cosa → null (cae a hoy). */
function toIsoDate(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
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
      date: toIsoDate(obj.date),
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
      date: toIsoDate(obj.date),
      items,
      total: toInt(obj.total),
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    };
  }

  return { kind: 'unknown' };
}

/**
 * Analiza una imagen con el modelo de visión configurado. Nunca lanza.
 * Reintenta los fallos transitorios (429/5xx/red) hasta MAX_ATTEMPTS: la misma
 * imagen fallaba de forma intermitente porque no había ningún reintento.
 */
export async function analyzeImage(
  base64: string,
  mime: string,
): Promise<VisionResult> {
  // Se leen los nombres nuevos con caída a los viejos para que el deploy y el
  // cambio de env puedan ocurrir en cualquier orden sin dejar el bot ciego.
  const apiKey =
    process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error(
      'analyzeImage: falta AI_GATEWAY_API_KEY (ni MINIMAX_API_KEY como respaldo)',
    );
    return { kind: 'service_error' };
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  const model = process.env.VISION_MODEL || 'alibaba/qwen3-vl-instruct';
  const retryDelayMs = Number(process.env.VISION_RETRY_DELAY_MS ?? 1500);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const intento = `intento ${attempt}/${MAX_ATTEMPTS}`;
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

      if (!res.ok) {
        // El cuerpo es lo único que distingue "sin cupo" de "imagen rechazada"
        // de "modelo inexistente". Sin esto el fallo es indistinguible de una
        // foto borrosa y se diagnostica a ciegas.
        const body = await res.text().catch(() => '');
        const contexto = `modelo=${model} bytesB64=${base64.length} mime=${mime}`;
        console.error(
          `analyzeImage HTTP ${res.status} (${intento}) ${contexto} body=${body.slice(0, 500)}`,
        );
        if (TRANSIENT_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
        return { kind: 'service_error' };
      }

      const data = (await res.json()) as { content?: Array<{ text?: string }> };
      const text = Array.isArray(data.content)
        ? data.content.map(c => c?.text ?? '').join('')
        : '';
      const parsed = extractJson(text);
      if (!parsed) {
        const preview = text.slice(0, 300);
        console.error(
          `analyzeImage: respuesta sin JSON parseable (modelo=${model}): ${preview}`,
        );
        return { kind: 'unknown' };
      }
      return toResult(parsed);
    } catch (err) {
      console.error(`Error en analyzeImage (${intento}):`, err);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      return { kind: 'service_error' };
    }
  }

  return { kind: 'service_error' };
}
