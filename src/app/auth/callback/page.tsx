import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * AuthCallbackPage - Página para manejar el callback de autenticación
 * Server Component que procesa el callback de Supabase
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; redirectTo?: string };
}) {
  const supabase = await createClient();

  // Si hay un código de autenticación, intercambiarlo por sesión
  if (searchParams.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(searchParams.code);
    
    if (error) {
      console.error('Error en callback de autenticación:', error);
      redirect('/auth/login?error=Authentication failed');
    }

    // Redirigir al destino solicitado o al dashboard por defecto
    const redirectTo = searchParams.redirectTo || '/dashboard';
    redirect(redirectTo);
  }

  // Si hay un error, redirigir al login con el error
  if (searchParams.error) {
    console.error('Error en callback:', searchParams.error);
    redirect(`/auth/login?error=${encodeURIComponent(searchParams.error)}`);
  }

  // Fallback: redirigir al login
  redirect('/auth/login');
}

/**
 * Loading component para Suspense
 */
function LoadingComponent() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-white">Procesando autenticación...</p>
      </div>
    </div>
  );
}

/**
 * Wrapper con Suspense para el callback
 */
export function CallbackPageWithSuspense(props: any) {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <AuthCallbackPage {...props} />
    </Suspense>
  );
} 