import { redirect } from 'next/navigation';

import DashboardContent from '@/components/pages/DashboardContent';
import { getCurrentUser } from '@/lib/actions/auth';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
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
    redirect('/auth/login');
  }

  const supabase = await createClient();

  // Repara a quien el trigger de registro no le sembró el kit (ADR-001), pero
  // solo si aún no terminó la bienvenida: después, el kit reactivaría
  // categorías que el usuario borró a propósito. Si la lectura falla (p. ej.
  // la columna aún no existe) o no hay fila, no se llama. Va antes de la
  // checklist porque el kit crea la cuenta Efectivo que la checklist cuenta.
  // Nunca lanza (contratos §5.2): sin try/catch.
  const { data: perfil, error } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    console.error('DashboardPage: error leyendo el perfil:', error.code);
  }
  const bienvenidaPendiente =
    !error &&
    perfil !== null &&
    (perfil as { onboarding_completed_at: string | null })
      .onboarding_completed_at === null;
  if (bienvenidaPendiente) {
    await ensureStarterKitAction();
  }

  const checklist = await loadDashboardChecklist(supabase, user.id);

  // Pasar datos del usuario al componente cliente
  return <DashboardContent user={user} checklist={checklist} />;
}
