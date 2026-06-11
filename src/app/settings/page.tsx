import { redirect } from 'next/navigation';

import WhatsAppLinkPanel from '@/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function maskPhone(phone: string): string {
  // +573001234567 -> +57300 ***4567
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 6)} ***${phone.slice(-4)}`;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const { data: links } = await supabase
    .from('whatsapp_links')
    .select('phone_e164, linked_at')
    .eq('user_id', user.id)
    .order('linked_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-white">Ajustes</h1>

      <WhatsAppLinkPanel />

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
        <h3 className="mb-3 text-lg font-medium text-white">
          Números vinculados
        </h3>
        {links && links.length > 0 ? (
          <ul className="space-y-2">
            {links.map(l => (
              <li
                key={l.phone_e164 as string}
                className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-sm"
              >
                <span className="font-mono text-slate-200">
                  {maskPhone(l.phone_e164 as string)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(l.linked_at as string).toLocaleDateString('es-CO')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Aún no hay números vinculados.
          </p>
        )}
      </section>
    </main>
  );
}
