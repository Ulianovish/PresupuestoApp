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
