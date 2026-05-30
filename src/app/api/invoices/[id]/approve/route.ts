// POST /api/invoices/[id]/approve
// Body: { accountName: string, categoryOverrides?: Record<number, string> }

import { NextRequest } from 'next/server';

import { approveInvoice } from '@/lib/services/invoices';
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

  let body: { accountName?: string; categoryOverrides?: Record<number, string> };
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

  const result = await approveInvoice(
    user.id,
    id,
    body.accountName,
    body.categoryOverrides,
  );

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true, created: result.created });
}
