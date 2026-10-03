import { redirect } from 'next/navigation';

import ActivosPanel from '@/components/organisms/ActivosPanel/ActivosPanel';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ActivosRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="mb-1 text-3xl font-bold text-blue-400">Activos</h1>
        <p className="text-gray-300">
          Todo lo que tienes: inmuebles, vehículos, inversiones y ahorros.
        </p>
      </div>

      <ActivosPanel />
    </main>
  );
}
