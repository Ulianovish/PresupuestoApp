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

        const upstream = await fetch(upstreamUrl, {
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
            if (event.step === 'error') {
              throw new Error(event.error || 'Error en factura-dian');
            }
          }
        }

        if (!result || !result.success) {
          throw new Error(result?.error || 'No se obtuvieron datos');
        }

        // Categorizar con IA.
        send(controller, {
          step: 'categorizing',
          message: 'Clasificando ítems con IA...',
          progress: 95,
        });
        const categories = await categorizeInvoiceItems(
          result.items.map(it => ({ description: it.description })),
          [...EXPENSE_CATEGORIES],
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
