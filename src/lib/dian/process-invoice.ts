// Orquestación de procesamiento de CUFE, sin streaming al cliente.
// Reusable por el route web (en after, con onProgress que persiste) y, en planes
// posteriores, por WhatsApp. Conserva la resiliencia del route: reintento ante
// errores transitorios, detección del error real del upstream y cierre prematuro.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { parseSSEEventLine } from '@/lib/dian/sse';
import {
  createProcessingInvoice,
  getInvoiceByCufe,
  markInvoiceError,
  resetInvoiceToProcessing,
  saveProcessedInvoice,
} from '@/lib/services/invoices';
import type {
  CufeProcessResult,
  ElectronicInvoice,
  StoredInvoiceItem,
} from '@/types/invoices';

export type PrepareResult =
  | { kind: 'duplicate'; invoice: ElectronicInvoice }
  | { kind: 'ready'; invoiceId: string }
  | { kind: 'error'; message: string };

export type RunResult =
  | { ok: true; itemsFound: number }
  | { ok: false; message: string };

/** Evento de progreso (forma libre tipo SSE) que se reporta vía onProgress. */
export type ProgressEvent = Record<string, unknown> & {
  step?: string;
  progress?: number;
  message?: string;
};

export interface RunOptions {
  /** Categorías candidatas para la IA (las activas del usuario; fallback arriba). */
  categoryNames: string[];
  /** Se invoca con cada evento de avance; el route lo usa para persistir progreso. */
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  /** Base del backoff entre reintentos (ms). Default 5000; los tests pasan 0. */
  retryBaseMs?: number;
}

// Errores del scraper que vale la pena reintentar (saturación / cierre abrupto).
// Un CUFE inválido o un 4xx NO entran aquí.
function isTransientUpstreamError(message: string): boolean {
  return /INSUFFICIENT_RESOURCES|FILE_ERROR_NO_SPACE|temporary directory|Target page, context or browser has been closed|closed prematurely|cerró la conexión|ECONNRESET|socket hang up|fetch failed|terminated/i.test(
    message,
  );
}

/**
 * Dedup + creación/reinicio de la fila en estado processing. Rápido (sin red
 * pesada): pensado para correr sincrónico antes de responder al cliente.
 */
export async function prepareInvoiceProcessing(
  userId: string,
  cufe: string,
): Promise<PrepareResult> {
  const existing = await getInvoiceByCufe(userId, cufe);
  if (
    existing &&
    (existing.status === 'pending_review' || existing.status === 'approved')
  ) {
    return { kind: 'duplicate', invoice: existing };
  }

  let invoiceId: string | null;
  if (existing) {
    invoiceId = existing.id;
    await resetInvoiceToProcessing(existing.id);
  } else {
    invoiceId = await createProcessingInvoice(userId, cufe);
  }
  if (!invoiceId) {
    return { kind: 'error', message: 'No se pudo crear el borrador' };
  }
  return { kind: 'ready', invoiceId };
}

// Consume UNA vez el stream SSE del upstream, reportando progreso. Distingue:
//  - `complete` con result.success -> devuelve el result
//  - `error`/`{error}` explícito    -> lanza con el mensaje real
//  - stream cerrado sin complete    -> lanza "closed prematurely" (transitorio)
async function streamUpstreamOnce(
  url: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>,
): Promise<CufeProcessResult> {
  const upstream = await fetch(url, {
    headers: { Accept: 'text/event-stream' },
  });
  if (!upstream.ok || !upstream.body) {
    throw new Error(`factura-dian respondió ${upstream.status}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let result: CufeProcessResult | null = null;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const event = parseSSEEventLine(line);
      if (!event) continue;

      await onProgress?.(event as ProgressEvent);

      if (event.step === 'complete' && event.result) {
        result = event.result;
      }
      // factura-dian emite fallos como `event: error` con `{error}` pero SIN
      // campo `step`. Detectamos ambas formas para no tragarnos la causa real.
      if (event.step === 'error' || event.error) {
        throw new Error(event.error || 'Error en factura-dian');
      }
    }
  }

  if (!result) {
    throw new Error(
      'El servicio DIAN cerró la conexión sin completar (closed prematurely). Posible saturación; reintenta en unos minutos.',
    );
  }
  if (!result.success) {
    throw new Error(result.error || 'No se obtuvieron datos');
  }
  return result;
}

// Envuelve streamUpstreamOnce con reintento + backoff ante errores transitorios.
async function streamUpstreamWithRetry(
  url: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>,
  retryBaseMs = 5000,
): Promise<CufeProcessResult> {
  const MAX_ATTEMPTS = 2;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await streamUpstreamOnce(url, onProgress);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const transient = isTransientUpstreamError(lastError.message);
      if (!transient || attempt >= MAX_ATTEMPTS) throw lastError;

      const waitMs = retryBaseMs * attempt;
      await onProgress?.({
        step: 'retrying',
        message: `Servicio DIAN saturado, reintentando en ${Math.round(waitMs / 1000)}s...`,
        progress: 5,
      });
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError ?? new Error('No se obtuvieron datos');
}

/**
 * Parte pesada (~1 min): proxy SSE a factura-dian (con reintento), categorización
 * con las categorías dadas y persistencia. Reporta avance vía onProgress. No
 * streamea al cliente. Marca error en la fila ante fallo.
 */
export async function runInvoiceProcessing(
  invoiceId: string,
  cufe: string,
  opts: RunOptions,
): Promise<RunResult> {
  const startTime = Date.now();
  const baseUrl =
    process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';
  const { categoryNames, onProgress, retryBaseMs } = opts;

  try {
    const upstreamUrl = `${baseUrl}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
      cufe,
    )}&method=${method}&download-pdf=false`;

    const result = await streamUpstreamWithRetry(
      upstreamUrl,
      onProgress,
      retryBaseMs,
    );

    await onProgress?.({
      step: 'categorizing',
      message: 'Clasificando ítems con IA...',
      progress: 95,
    });
    const categories = await categorizeInvoiceItems(
      result.items.map(it => ({ description: it.description })),
      categoryNames,
    );
    const storedItems: StoredInvoiceItem[] = result.items.map((it, idx) => ({
      ...it,
      suggested_category: categories[idx] ?? 'OTROS',
      category: categories[idx] ?? 'OTROS',
    }));

    await saveProcessedInvoice(invoiceId, {
      supplierName: result.invoice_details.storeName,
      supplierNit: result.invoice_details.nit,
      invoiceDate: result.invoice_details.date,
      currency: result.invoice_details.currency,
      subtotal: result.invoice_details.subtotal,
      totalAmount: result.invoice_details.total_amount,
      items: storedItems,
      processingTimeMs: Date.now() - startTime,
    });

    return { ok: true, itemsFound: storedItems.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markInvoiceError(invoiceId, message);
    return { ok: false, message };
  }
}
