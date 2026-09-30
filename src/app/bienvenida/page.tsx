import { redirect } from 'next/navigation';

import OnboardingWizard from '@/components/organisms/OnboardingWizard/OnboardingWizard';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loginUrl } from '@/lib/auth/login-url';
import { loadWizardData } from '@/lib/onboarding/wizard-data';
import { createClient } from '@/lib/supabase/server';
import { todayBogota } from '@/lib/whatsapp/format';

export const dynamic = 'force-dynamic';

/**
 * Bienvenida del primer ingreso (contratos §2.7). Sin sesión → login. Si ya
 * terminó la bienvenida → dashboard. Si no, repara el kit inicial (por si el
 * trigger de registro falló) y muestra el wizard con los rubros del mes.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Con redirectTo, como las demás guardias (contratos v2.3): el login no
  // rebota al dashboard y, al entrar, vuelve aquí.
  if (!user) redirect(loginUrl('/bienvenida'));

  const { data: perfil } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  const completadoEn = (
    perfil as { onboarding_completed_at: string | null } | null
  )?.onboarding_completed_at;
  if (completadoEn) redirect('/dashboard');

  // Nunca lanza (contratos §5.2): si la RPC falla (p. ej. antes de H8) solo
  // devuelve { seeded: false, error } y el wizard se muestra igual.
  await ensureStarterKitAction();

  const mes = todayBogota().slice(0, 7);
  const { items, categoryNames } = await loadWizardData(supabase, user.id, mes);

  return (
    <main className="relative min-h-screen px-4 py-10 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10"
      />
      <div className="relative">
        <OnboardingWizard
          items={items}
          categoryNames={categoryNames}
          botNumber={process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER}
        />
      </div>
    </main>
  );
}
