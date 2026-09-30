import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validations/password-rules';

import { translateAuthError } from './error-messages';

/**
 * Qué muestran /auth/forgot-password y /auth/reset-password según la URL.
 *
 * Igual que el login y el registro: `?error=` y `?message=` llevan CÓDIGOS,
 * nunca texto, porque cualquiera puede armar una URL con un texto engañoso.
 * Los códigos propios salen de una lista cerrada; el resto de `error` se
 * traduce con translateAuthError (código desconocido → texto genérico) y un
 * `message` desconocido no se muestra.
 */

/** `?error=` de /auth/forgot-password cuando el correo no es válido. */
export const FORGOT_PASSWORD_INVALID_EMAIL_CODE = 'correo_invalido';
/** `?message=` de /auth/forgot-password: mismo código exista o no el correo. */
export const FORGOT_PASSWORD_SENT_CODE = 'enlace_enviado';

/**
 * Destino cuando no hay sesión para cambiar la contraseña (enlace vencido o
 * ya usado): /auth/reset-password y resetPasswordAction mandan aquí.
 * `otp_expired` se traduce a "El enlace venció. Pide uno nuevo."
 */
export const RESET_LINK_EXPIRED_PATH =
  '/auth/forgot-password?error=otp_expired';

// Map (no objeto) para que 'constructor' o 'toString' no encuentren nada.
const ERRORES_FORGOT = new Map<string, string>([
  [FORGOT_PASSWORD_INVALID_EMAIL_CODE, 'Escribe un correo válido.'],
]);

const MENSAJES_FORGOT = new Map<string, string>([
  [
    FORGOT_PASSWORD_SENT_CODE,
    'Si el correo está registrado, te enviamos un enlace.',
  ],
]);

export type PasswordFeedback = { error: string | null; message: string | null };

export function resolveForgotPasswordFeedback(params: {
  error: string | null | undefined;
  message: string | null | undefined;
}): PasswordFeedback {
  const error = params.error
    ? (ERRORES_FORGOT.get(params.error) ??
      translateAuthError({ code: params.error }))
    : null;
  const message = params.message
    ? (MENSAJES_FORGOT.get(params.message) ?? null)
    : null;
  return { error, message };
}

// Códigos de validación de resetPasswordAction (lista cerrada).
const ERRORES_RESET = new Map<string, string>([
  [
    'password_corta',
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  ],
  [
    'password_larga',
    `La contraseña puede tener como máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  ],
  ['no_coinciden', 'Las contraseñas no coinciden.'],
  ['confirmar_password', 'Confirma tu contraseña.'],
  ['datos_invalidos', 'Revisa la contraseña.'],
]);

/** Códigos de validación que resetPasswordAction puede mandar en `?error=`. */
export const RESET_PASSWORD_VALIDATION_ERROR_CODES: ReadonlySet<string> =
  new Set(ERRORES_RESET.keys());

type IssueMinimo = {
  readonly path: readonly PropertyKey[];
  readonly code: string;
};

/** Código del primer error de Zod del formulario de contraseña nueva. */
export function resetPasswordValidationErrorCode(
  issues: readonly IssueMinimo[],
): string {
  const issue = issues[0];
  switch (issue?.path[0]) {
    case 'password':
      if (issue.code === 'too_small') return 'password_corta';
      if (issue.code === 'too_big') return 'password_larga';
      return 'datos_invalidos';
    case 'confirmPassword':
      return issue.code === 'too_small' ? 'confirmar_password' : 'no_coinciden';
    default:
      return 'datos_invalidos';
  }
}

/** Qué muestra /auth/reset-password según `?error=`. */
export function resolveResetPasswordError(
  error: string | null | undefined,
): string | null {
  if (!error) return null;
  return ERRORES_RESET.get(error) ?? translateAuthError({ code: error });
}
