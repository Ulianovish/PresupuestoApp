import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import ResetPasswordForm from './ResetPasswordForm';

// Depende de la sesión en cookies: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

/**
 * ResetPasswordPage - Página para crear la contraseña nueva
 * Requiere la sesión que deja /auth/confirm al abrir el enlace del correo.
 * Sin sesión va al mismo destino que resetPasswordAction (código otp_expired,
 * que la página de recuperación traduce a "El enlace venció. Pide uno nuevo.").
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/forgot-password?error=otp_expired');
  }

  return <ResetPasswordForm />;
}
