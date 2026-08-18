// POST /api/invoices/[id]/complete
// Body: { accountName: string }
//
// Reemplaza al viejo /approve. Ya no hay un trámite de "aprobación": el bot
// de WhatsApp pregunta la cuenta y registra directo. Esta ruta solo existe
// para la vista de rescate ("Facturas sin completar") — completar desde la
// app una factura que quedó en `pending_review` (nunca se contestó la
// cuenta) o reintentar una que quedó en `pending_review` tras un fallo sin
// gastos creados. Usa el mismo camino que el agente: `createInvoiceDirect`.

import { NextRequest } from 'next/server';

import { createInvoiceDirect } from '@/lib/services/invoices';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: { accountName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  if (!body.accountName) {
    return Response.json(
      { error: 'accountName es requerido' },
      { status: 400 },
    );
  }

  const result = await createInvoiceDirect(user.id, id, body.accountName);

  if (!result.ok) {
    return Response.json(
      { error: result.error, itemsFound: result.itemsFound },
      { status: 400 },
    );
  }

  return Response.json({ success: true, itemsFound: result.itemsFound });
}
