// Route SSE: recibe un CUFE, hace proxy a factura-dian.vercel.app, categoriza
// los items con IA y persiste un borrador en electronic_invoices.
// GET /api/invoices/process?cufe=...

import { NextRequest } from 'next/server';

import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { parseSSEEventLine } from '@/lib/dian/sse';
import {
  createProcessingInvoice,
  getInvoiceByCufe,
  markInvoiceError,
  resetInvoiceToProcessing,
  saveProcessedInvoice,
} from '@/lib/services/invoices';
import { createClient } from '@/lib/supabase/server';
import type {
  CufeProcessResult,
  StoredInvoiceItem,
} from '@/types/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function send(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>,
) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
  );
}

// Cuántos intentos totales contra el scraper upstream. OJO: cada intento
// resuelve captchas en 2captcha (cuesta dinero y ~60s), así que mantenemos
// 2 (un reintento) y solo ante errores transitorios.
const MAX_UPSTREAM_ATTEMPTS = 2;

// Errores del scraper que valen la pena reintentar: saturación de recursos en
// la función serverless (memoria / disco en /tmp) o cierre abrupto del stream.
// Un CUFE inválido o un 4xx NO entran aquí (no se reintentan).
function isTransientUpstreamError(message: string): boolean {
  return /INSUFFICIENT_RESOURCES|FILE_ERROR_NO_SPACE|temporary directory|Target page, context or browser has been closed|closed prematurely|cerró la conexión|ECONNRESET|socket hang up|fetch failed|terminated/i.test(
    message,
  );
}

// Consume UNA vez el stream SSE del upstream, haciendo passthrough del progreso
// al cliente. Devuelve el resultado o lanza. Distingue 3 finales:
//  - `complete` con result.success -> devuelve el result
//  - `error`/`{error}` explícito    -> lanza con el mensaje real
//  - stream cerrado sin complete    -> lanza "closed prematurely" (transitorio)
async function streamUpstreamOnce(
  controller: ReadableStreamDefaultController,
  url: string,
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

      // Passthrough de progreso al cliente.
      send(controller, event as unknown as Record<string, unknown>);

      if (event.step === 'complete' && event.result) {
        result = event.result;
      }
      // factura-dian emite los fallos como `event: error` con `{error}` pero
      // SIN campo `step`. Detectamos ambas formas para no tragarnos la causa
      // real (p. ej. "Error descargando PDF...") y mostrar el genérico.
      if (event.step === 'error' || event.error) {
        throw new Error(event.error || 'Error en factura-dian');
      }
    }
  }

  if (!result) {
    // Terminó el stream sin `complete` ni `error`: el upstream cerró la conexión
    // a mitad (típico de saturación de recursos en el scraper). Transitorio.
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
  controller: ReadableStreamDefaultController,
  url: string,
): Promise<CufeProcessResult> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt++) {
    try {
      return await streamUpstreamOnce(controller, url);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const transient = isTransientUpstreamError(lastError.message);
      if (!transient || attempt >= MAX_UPSTREAM_ATTEMPTS) throw lastError;

      const waitMs = 5000 * attempt; // 5s, 10s...
      send(controller, {
        step: 'retrying',
        message: `Servicio DIAN saturado, reintentando en ${waitMs / 1000}s...`,
        progress: 5,
      });
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
  throw lastError ?? new Error('No se obtuvieron datos');
}

export async function GET(request: NextRequest) {
  const cufe = request.nextUrl.searchParams.get('cufe')?.trim();

  if (!cufe) {
    return Response.json({ error: 'El parámetro cufe es requerido' }, {
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }
  const userId = user.id;

  // Dedup: solo bloquear si ya está en revisión o aprobada.
  // Filas atascadas en 'processing' o fallidas en 'error' se pueden reintentar.
  const existing = await getInvoiceByCufe(userId, cufe);
  if (
    existing &&
    (existing.status === 'pending_review' || existing.status === 'approved')
  ) {
    return Response.json(
      {
        error: 'Esta factura ya fue procesada',
        invoiceId: existing.id,
        status: existing.status,
      },
      { status: 409 },
    );
  }

  const baseUrl =
    process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      let invoiceId: string | null;
      if (existing) {
        invoiceId = existing.id;
        await resetInvoiceToProcessing(existing.id);
      } else {
        invoiceId = await createProcessingInvoice(userId, cufe);
      }
      if (!invoiceId) {
        send(controller, { step: 'error', error: 'No se pudo crear el borrador' });
        controller.close();
        return;
      }

      try {
        const upstreamUrl = `${baseUrl}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
          cufe,
        )}&method=${method}&download-pdf=false`;

        // Consume el stream upstream con passthrough de progreso y reintento
        // automático ante fallos transitorios (saturación / cierre prematuro).
        const result = await streamUpstreamWithRetry(controller, upstreamUrl);

        // Categorizar con IA. Usamos las categorías activas del usuario
        // (mismas que el tab de presupuesto), no la lista fija. Si la consulta
        // falla o no hay categorías, caemos a EXPENSE_CATEGORIES.
        send(controller, {
          step: 'categorizing',
          message: 'Clasificando ítems con IA...',
          progress: 95,
        });
        const { data: userCategories } = await supabase
          .from('categories')
          .select('name')
          .eq('is_active', true)
          .order('name');
        const categoryNames =
          userCategories && userCategories.length > 0
            ? userCategories.map(c => c.name as string)
            : [...EXPENSE_CATEGORIES];
        const categories = await categorizeInvoiceItems(
          result.items.map(it => ({ description: it.description })),
          categoryNames,
        );
        const storedItems: StoredInvoiceItem[] = result.items.map(
          (it, idx) => ({
            ...it,
            suggested_category: categories[idx] ?? 'OTROS',
            category: categories[idx] ?? 'OTROS',
          }),
        );

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

        send(controller, {
          step: 'saved',
          message: 'Factura guardada como borrador',
          progress: 100,
          invoiceId,
          items_found: storedItems.length,
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markInvoiceError(invoiceId, message);
        send(controller, { step: 'error', error: message, invoiceId });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
