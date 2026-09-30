import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * Tipos de enlace de correo que acepta /auth/confirm (y que /auth/callback
 * reenvía). Vive fuera de route.ts porque Next solo permite exportar los
 * handlers desde un archivo de ruta.
 */
export const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'email',
  'recovery',
  'invite',
  'email_change',
];

export function isEmailOtpType(valor: string | null): valor is EmailOtpType {
  return (
    valor !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(valor)
  );
}
