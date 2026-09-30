import { translateAuthError } from './error-messages';

/**
 * Qué muestra la página de login según `?error=` y `?message=`.
 *
 * Los dos parámetros llevan CÓDIGOS, nunca texto: cualquiera puede armar una
 * URL de login con un texto engañoso. `error` sale de los códigos propios
 * del login o, si no es uno, de translateAuthError (código desconocido →
 * texto genérico); `message` sale
 * de una lista cerrada (desconocido → no se muestra nada).
 */
export const CHECK_EMAIL_MESSAGE_CODE = 'revisa_correo';
export const CHECK_EMAIL_MESSAGE =
  'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';

/** `?error=` de loginAction cuando el formulario no pasa loginSchema. */
export const LOGIN_VALIDATION_ERROR_CODE = 'datos_login_invalidos';

// Map (no objeto) para que 'constructor' o 'toString' no encuentren nada.
const MENSAJES = new Map<string, string>([
  [CHECK_EMAIL_MESSAGE_CODE, CHECK_EMAIL_MESSAGE],
]);

// Códigos de error propios del login (el resto va a translateAuthError).
const ERRORES = new Map<string, string>([
  [LOGIN_VALIDATION_ERROR_CODE, 'Revisa tu correo y tu contraseña.'],
]);

export type LoginFeedback = { error: string | null; message: string | null };

export function resolveLoginFeedback(params: {
  error: string | null | undefined;
  message: string | null | undefined;
}): LoginFeedback {
  const error = params.error
    ? (ERRORES.get(params.error) ?? translateAuthError({ code: params.error }))
    : null;
  const message = params.message
    ? (MENSAJES.get(params.message) ?? null)
    : null;
  return { error, message };
}
