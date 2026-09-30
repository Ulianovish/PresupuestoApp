import { translateAuthError } from './error-messages';

/**
 * Qué muestra la página de login según `?error=` y `?message=`.
 *
 * Los dos parámetros llevan CÓDIGOS, nunca texto: cualquiera puede armar una
 * URL de login con un texto engañoso. `error` se traduce con
 * translateAuthError (código desconocido → texto genérico) y `message` sale
 * de una lista cerrada (desconocido → no se muestra nada).
 */
export const CHECK_EMAIL_MESSAGE_CODE = 'revisa_correo';
export const CHECK_EMAIL_MESSAGE =
  'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';

// Map (no objeto) para que 'constructor' o 'toString' no encuentren nada.
const MENSAJES = new Map<string, string>([
  [CHECK_EMAIL_MESSAGE_CODE, CHECK_EMAIL_MESSAGE],
]);

export type LoginFeedback = { error: string | null; message: string | null };

export function resolveLoginFeedback(params: {
  error: string | null | undefined;
  message: string | null | undefined;
}): LoginFeedback {
  const error = params.error
    ? translateAuthError({ code: params.error })
    : null;
  const message = params.message
    ? (MENSAJES.get(params.message) ?? null)
    : null;
  return { error, message };
}
