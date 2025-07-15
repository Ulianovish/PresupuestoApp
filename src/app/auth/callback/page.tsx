import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

/**
 * AuthCallbackPage - Página para manejar el callback de autenticación
 * Server Component que procesa el callback de Supabase
 */
export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; redirectTo?: string }>;
}) {
  // Extraer searchParams de forma async (Next.js 15)
  const params = await searchParams;

  const supabase = await createClient();

  // Si hay un código de autenticación, intercambiarlo por sesión
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);

    if (error) {
      console.error('Error en callback de autenticación:', error);
      redirect('/auth/login?error=Authentication failed');
    }

    // Redirigir al destino solicitado o al dashboard por defecto
    const redirectTo = params.redirectTo || '/dashboard';
    redirect(redirectTo);
  }

  // Si hay un error, redirigir al login con el error
  if (params.error) {
    console.error('Error en callback:', params.error);
    redirect(`/auth/login?error=${encodeURIComponent(params.error)}`);
  }

  // Fallback: redirigir al login
  redirect('/auth/login');
}
