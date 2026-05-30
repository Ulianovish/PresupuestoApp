import { listDraftInvoices } from '@/lib/services/invoices';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }
  const invoices = await listDraftInvoices(user.id);
  return Response.json({ invoices });
}
