import { redirect } from 'next/navigation';

import UnlinkPhoneButton from '@/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton';
import AccountsPanel from '@/components/organisms/AccountsPanel/AccountsPanel';
import CategoriesPanel from '@/components/organisms/CategoriesPanel/CategoriesPanel';
import DocumentosDianPanel from '@/components/organisms/DocumentosDianPanel/DocumentosDianPanel';
import WhatsAppLinkPanel from '@/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel';
import { createClient } from '@/lib/supabase/server';
import {
  enmascararTelefono,
  formatearFechaBogota,
} from '@/lib/whatsapp/format';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const { data: links, error: linksError } = await supabase
    .from('whatsapp_links')
    .select('id, phone_e164, linked_at')
    .eq('user_id', user.id)
    .order('linked_at', { ascending: false });
  if (linksError) {
    // Solo el code: el mensaje podría traer datos del usuario.
    console.error(
      'SettingsPage: error cargando números vinculados:',
      linksError.code,
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-white">Ajustes</h1>

      <AccountsPanel />

      <CategoriesPanel />

      <WhatsAppLinkPanel />

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
        <h3 className="mb-3 text-lg font-medium text-white">
          Números vinculados
        </h3>
        {linksError ? (
          // Sin esto se vería "no hay números" mientras el bot sigue
          // registrando gastos desde ellos y no se podrían desvincular.
          <p className="text-sm text-red-400">
            No pudimos cargar tus números vinculados. Recarga la página.
          </p>
        ) : links && links.length > 0 ? (
          <ul className="space-y-2">
            {links.map(l => {
              // El número completo se queda en el servidor: al cliente solo
              // llegan el id del link y el número enmascarado (§5.2).
              const masked = enmascararTelefono(l.phone_e164 as string);
              return (
                <li
                  key={l.id as string}
                  className="flex items-center justify-between gap-3 rounded bg-slate-800 px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-slate-200">{masked}</span>
                    <span className="text-xs text-slate-500">
                      Vinculado el {formatearFechaBogota(l.linked_at as string)}
                    </span>
                  </div>
                  <UnlinkPhoneButton
                    linkId={l.id as string}
                    maskedPhone={masked}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Aún no hay números vinculados.
          </p>
        )}
      </section>

      <DocumentosDianPanel />
    </main>
  );
}
