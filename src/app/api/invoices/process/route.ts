// POST /api/invoices/process  { cufe }
// Dedup + crea borrador sincrónico, responde invoiceId al instante y procesa en
// segundo plano con after() (fire-and-forget; no depende de la pestaña). El
// avance se persiste en la fila para que la UI lo muestre por polling.

import { after, NextRequest } from 'next/server';

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
  type ProgressEvent,
} from '@/lib/dian/process-invoice';
import {
  resolveUserCategoryNames,
  updateInvoiceProgress,
} from '@/lib/services/invoices';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let cufe: string | undefined;
  try {
    const body = (await request.json()) as { cufe?: string };
    cufe = body.cufe?.trim();
  } catch {
    cufe = undefined;
  }

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

  const prep = await prepareInvoiceProcessing(user.id, cufe);
  if (prep.kind === 'duplicate') {
    return Response.json(
      {
        error: 'Esta factura ya fue procesada',
        invoiceId: prep.invoice.id,
        status: prep.invoice.status,
      },
      { status: 409 },
    );
  }
  if (prep.kind === 'error') {
    return Response.json({ error: prep.message }, { status: 500 });
  }

  const cufeValue = cufe;
  const invoiceId = prep.invoiceId;

  after(async () => {
    const categoryNames = await resolveUserCategoryNames();

    // Persiste el avance, pero solo cuando el porcentaje sube ≥5 o el paso es
    // relevante, para no martillar la DB con cada evento del stream.
    let lastPersisted = -1;
    const onProgress = async (event: ProgressEvent) => {
      const percent = typeof event.progress === 'number' ? event.progress : null;
      const isMilestone =
        event.step === 'retrying' || event.step === 'categorizing';
      if (percent == null && !isMilestone) return;
      if (percent != null && percent - lastPersisted < 5 && !isMilestone) return;
      lastPersisted = percent ?? lastPersisted;
      await updateInvoiceProgress(
        invoiceId,
        percent ?? lastPersisted,
        (event.message as string) || (event.step as string) || 'Procesando...',
      );
    };

    await runInvoiceProcessing(invoiceId, cufeValue, {
      categoryNames,
      onProgress,
    });
  });

  return Response.json({ invoiceId, status: 'processing' });
}
