import { redirect } from 'next/navigation';

import { RESET_LINK_EXPIRED_PATH } from '@/lib/auth/password-reset-feedback';
import { createClient } from '@/lib/supabase/server';

import ResetPasswordForm from './ResetPasswordForm';

// Depende de la sesión en cookies: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

/**
 * ResetPasswordPage - Página para crear la contraseña nueva
 * Requiere la sesión que deja /auth/confirm al abrir el enlace del correo.
 * Sin sesión va al mismo destino que resetPasswordAction
 * (RESET_LINK_EXPIRED_PATH: "El enlace venció. Pide uno nuevo.").
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(RESET_LINK_EXPIRED_PATH);
  }

  return <ResetPasswordForm />;
}
