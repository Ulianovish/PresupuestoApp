// Orquestación de procesamiento de CUFE, sin streaming al cliente.
// Reusable por el route web (en after, con onProgress que persiste) y, en planes
// posteriores, por WhatsApp. Conserva la resiliencia del route: reintento ante
// errores transitorios, detección del error real del upstream y cierre prematuro.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { parseSSEEventLine } from '@/lib/dian/sse';
import {
  createProcessingInvoice,
  esRegistroParcial,
  getInvoiceByCufe,
  markInvoiceError,
  resetInvoiceToProcessing,
  saveProcessedInvoice,
} from '@/lib/services/invoices';
import type { Database } from '@/types/database';
import type {
  CufeProcessResult,
  ElectronicInvoice,
  StoredInvoiceItem,
} from '@/types/invoices';

import type { SupabaseClient } from '@supabase/supabase-js';

type DBClient = SupabaseClient<Database>;

export type PrepareResult =
  | { kind: 'duplicate'; invoice: ElectronicInvoice }
  /**
   * La factura ya se scrapeó y quedó en `pending_review`, pero todavía nadie
   * dijo con qué cuenta se pagó (el usuario reenvió el mismo CUFE por las
   * dudas, o nunca contestó la pregunta). NO es un duplicado real — a
   * diferencia de `approved`, acá no hay nada que perder por retomarla: no
   * hace falta volver a scrapear (ni gastar otro captcha), solo recuperar el
   * id para preguntar de nuevo.
   */
  | { kind: 'awaiting_account'; invoice: ElectronicInvoice }
  /**
   * La factura se registró a medias: parte de sus ítems YA son transacciones
   * reales. No se puede reintentar (re-scrapear y volver a recorrer los ítems
   * los duplicaría), hay que completarla a mano en la app.
   */
  | { kind: 'partial_registration'; invoice: ElectronicInvoice }
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
  /** Cliente Supabase a inyectar (service-role para WhatsApp). Web: cookie por defecto. */
  client?: DBClient;
}

// Cuántos intentos totales contra el scraper upstream. OJO: cada intento resuelve
// captchas en 2captcha (cuesta dinero y ~60s), así que mantenemos 2 (un reintento)
// y solo ante errores transitorios.
const MAX_UPSTREAM_ATTEMPTS = 2;

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
  client?: DBClient,
): Promise<PrepareResult> {
  const existing = await getInvoiceByCufe(userId, cufe, client);
  if (existing && existing.status === 'approved') {
    return { kind: 'duplicate', invoice: existing };
  }
  if (existing && existing.status === 'pending_review') {
    return { kind: 'awaiting_account', invoice: existing };
  }
  // Una fila en 'error' se reintenta... salvo que el error sea un registro
  // parcial: ahí ya hay gastos creados. Reiniciarla a 'processing' la manda a
  // re-scrapear y después `createInvoiceDirect` recorre TODOS los ítems otra
  // vez, duplicando los que ya son transacciones reales. Reenviar el mismo
  // CUFE es justo lo que hace un usuario que vio "el resto falló".
  if (existing && esRegistroParcial(existing.error_message)) {
    return { kind: 'partial_registration', invoice: existing };
  }

  let invoiceId: string | null;
  if (existing) {
    invoiceId = existing.id;
    await resetInvoiceToProcessing(existing.id, client);
  } else {
    invoiceId = await createProcessingInvoice(userId, cufe, client);
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
// Exportada para el canario (src/lib/dian/canary.ts): así la verificación diaria
// ejercita EXACTAMENTE el mismo camino que usa el bot, sin el reintento (un
// canario debe reportar la primera falla, no disimularla).
export async function streamUpstreamOnce(
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
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt++) {
    try {
      return await streamUpstreamOnce(url, onProgress);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const transient = isTransientUpstreamError(lastError.message);
      if (!transient || attempt >= MAX_UPSTREAM_ATTEMPTS) throw lastError;

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

// Presupuesto de tiempo. La ruta que invoca esto tiene maxDuration = 300s, y si
// se agota, Vercel mata la función SIN ejecutar ningún catch: no se escribe
// error_message y el usuario no recibe nada (la fila queda en 'processing' para
// siempre). Por eso el trabajo pesado se corta antes, dejando margen para
// registrar el fallo y avisar. Silencio es el peor resultado posible.
const TOTAL_BUDGET_MS = 270_000;
/** Techo del scrape del VPS (headful + 2captcha: normalmente 60-70s). */
const VPS_MAX_MS = 240_000;
/**
 * Por debajo de esto no se arranca el segundo motor: no alcanza a terminar y
 * solo quema el margen que hace falta para reportar. Era el bug: el VPS agotaba
 * sus 240s, el respaldo arrancaba con ~60s disponibles necesitando ~235s, y la
 * función moría en silencio.
 */
const MIN_SECONDARY_MS = 90_000;

/** Corta una promesa que exceda su presupuesto, para no arrastrar a toda la función. */
function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`${label} superó su presupuesto de ${Math.round(ms / 1000)}s`),
        ),
      ms,
    );
  });
  return Promise.race([promise, limit]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}

// Scraper del VPS: endpoint HTTP plano que devuelve el MISMO shape que Vercel
// (CufeProcessResult). El VPS corre un browser headful (menos detectado por la DIAN
// → escala menos captchas: ~2 vs ~4 de Vercel), sin timeout de 300s y con más RAM,
// así que suele fallar menos. Se usa como motor primario o de respaldo según
// DIAN_VPS_PRIMARY (ver runInvoiceProcessing).
export async function fetchFromVps(
  cufe: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>,
  timeoutMs: number = VPS_MAX_MS,
): Promise<CufeProcessResult> {
  const base = process.env.DIAN_VPS_URL;
  if (!base) throw new Error('DIAN_VPS_URL no configurado');
  const url = `${base.replace(/\/$/, '')}/scrape?cufe=${encodeURIComponent(cufe)}`;

  await onProgress?.({
    step: 'connecting_dian',
    message: 'Procesando con scraper VPS (headful + 2captcha)...',
    progress: 15,
  });

  // El scrape del VPS resuelve captchas y descarga: puede tardar ~1-4 min.
  const resp = await fetch(url, {
    headers: { 'x-auth-token': process.env.DIAN_VPS_TOKEN || '' },
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  if (!resp.ok) {
    throw new Error(`VPS respondió ${resp.status}`);
  }
  const data = (await resp.json()) as CufeProcessResult;
  if (!data.success) {
    throw new Error(data.error || 'VPS no obtuvo datos');
  }
  return data;
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
  const { categoryNames, onProgress, retryBaseMs, client } = opts;

  try {
    const upstreamUrl = `${baseUrl}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
      cufe,
    )}&method=${method}&download-pdf=false`;

    // Motores. El VPS suele fallar menos (headful → menos captchas, sin timeout de
    // 300s, más RAM), así que por defecto es el PRIMARIO cuando está configurado.
    // Invertible con DIAN_VPS_PRIMARY=false (Vercel primario, VPS de respaldo).
    // Todo el trabajo pesado vive dentro de este presupuesto; lo que sobra es el
    // margen para categorizar, guardar y avisar.
    const deadline = startTime + TOTAL_BUDGET_MS;
    const remainingMs = () => deadline - Date.now();

    const tryVercel = () =>
      withDeadline(
        streamUpstreamWithRetry(upstreamUrl, onProgress, retryBaseMs),
        Math.max(1_000, remainingMs()),
        'Vercel',
      );
    // Al VPS se le da todo lo que quede (con su techo): es el motor que mejor
    // rinde, así que la prioridad es que alcance a terminar, no reservarle
    // tiempo a un respaldo que rara vez sirve.
    const tryVps = () =>
      fetchFromVps(
        cufe,
        onProgress,
        Math.max(1_000, Math.min(VPS_MAX_MS, remainingMs())),
      );

    const vpsConfigured = Boolean(process.env.DIAN_VPS_URL);
    const vpsPrimary =
      vpsConfigured && process.env.DIAN_VPS_PRIMARY !== 'false';

    let result: CufeProcessResult;
    if (!vpsConfigured) {
      // Sin VPS configurado: solo Vercel (comportamiento original).
      result = await tryVercel();
    } else {
      const primary = vpsPrimary ? tryVps : tryVercel;
      const secondary = vpsPrimary ? tryVercel : tryVps;
      const primaryName = vpsPrimary ? 'VPS' : 'Vercel';
      const secondaryName = vpsPrimary ? 'Vercel' : 'VPS';
      try {
        result = await primary();
      } catch (primaryErr) {
        const primaryMsg =
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr);

        // Solo se intenta el respaldo si de verdad alcanza a terminar. Arrancarlo
        // sin tiempo suficiente garantiza que la función muera antes de poder
        // avisar, que es exactamente lo que dejaba facturas colgadas.
        const left = remainingMs();
        if (left < MIN_SECONDARY_MS) {
          throw new Error(
            `${primaryName} falló (${primaryMsg}); quedaban ${Math.round(left / 1000)}s, insuficiente para ${secondaryName} (mínimo ${MIN_SECONDARY_MS / 1000}s). Se corta para poder reportar el fallo.`,
          );
        }

        await onProgress?.({
          step: 'retrying',
          message: `${primaryName} falló; intentando con ${secondaryName}...`,
          progress: 8,
        });
        try {
          result = await secondary();
        } catch (secondaryErr) {
          const secondaryMsg =
            secondaryErr instanceof Error
              ? secondaryErr.message
              : String(secondaryErr);
          throw new Error(
            `${primaryName} falló (${primaryMsg}); ${secondaryName} falló (${secondaryMsg})`,
          );
        }
      }
    }

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

    await saveProcessedInvoice(
      invoiceId,
      {
        supplierName: result.invoice_details.storeName,
        supplierNit: result.invoice_details.nit,
        invoiceDate: result.invoice_details.date,
        currency: result.invoice_details.currency,
        subtotal: result.invoice_details.subtotal,
        totalAmount: result.invoice_details.total_amount,
        items: storedItems,
        processingTimeMs: Date.now() - startTime,
      },
      client,
    );

    return { ok: true, itemsFound: storedItems.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markInvoiceError(invoiceId, message, client);
    return { ok: false, message };
  }
}
