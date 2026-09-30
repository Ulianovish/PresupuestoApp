import { redirect } from 'next/navigation';

import DashboardContent from '@/components/pages/DashboardContent';
import { getCurrentUser } from '@/lib/actions/auth';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loginUrl } from '@/lib/auth/login-url';
import { loadDashboardChecklist } from '@/lib/onboarding/checklist';
import { createClient } from '@/lib/supabase/server';

/**
 * DashboardPage - Página principal del dashboard
 * Server Component protegido que requiere autenticación.
 * Repara el kit inicial a quien aún no termina la bienvenida y calcula la
 * checklist de configuración antes de renderizar el contenido (cliente).
 */
export default async function DashboardPage() {
  // Verificar autenticación en el servidor
  const user = await getCurrentUser();

  if (!user) {
    redirect(loginUrl('/dashboard'));
  }

  const supabase = await createClient();

  // Una sola lectura del perfil para las dos decisiones (kit y checklist).
  // Si falla (p. ej. las columnas de S09 aún no existen) o no hay fila, ni se
  // repara el kit ni se muestra la checklist.
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at, onboarding_dismissed_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('DashboardPage: error leyendo el perfil:', error.code);
  }
  const perfil = error
    ? null
    : (data as {
        onboarding_completed_at: string | null;
        onboarding_dismissed_at: string | null;
      } | null);

  // Repara a quien el trigger de registro no le sembró el kit (ADR-001), pero
  // solo si aún no terminó la bienvenida: después, el kit reactivaría
  // categorías que el usuario borró a propósito (contratos §5.2). Va antes de
  // la checklist porque el kit crea la cuenta Efectivo que la checklist
  // cuenta. Nunca lanza (contratos §5.2): sin try/catch.
  if (perfil !== null && perfil.onboarding_completed_at === null) {
    await ensureStarterKitAction();
  }

  const checklist = await loadDashboardChecklist(supabase, user.id, perfil);

  // Pasar datos del usuario al componente cliente
  return <DashboardContent user={user} checklist={checklist} />;
}
