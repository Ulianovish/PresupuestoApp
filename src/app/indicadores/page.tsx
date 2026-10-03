import { redirect } from 'next/navigation';

import IndicadoresPage from '@/components/pages/IndicadoresPage';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function IndicadoresRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return <IndicadoresPage />;
}
