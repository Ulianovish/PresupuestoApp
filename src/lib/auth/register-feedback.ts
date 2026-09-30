import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validations/password-rules';

import { translateAuthError } from './error-messages';

/**
 * Qué muestra la página de registro según `?error=`.
 *
 * Igual que en el login (resolveLoginFeedback): `?error=` lleva un CÓDIGO,
 * nunca texto, porque cualquiera puede armar una URL de registro con un texto
 * engañoso. Los códigos de validación salen de una lista cerrada; el resto se
 * traduce con translateAuthError (código desconocido → texto genérico).
 */

// Map (no objeto) para que 'constructor' o 'toString' no encuentren nada.
const MENSAJES_VALIDACION = new Map<string, string>([
  ['email_invalido', 'Debe ser un email válido.'],
  [
    'password_corta',
    `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  ],
  [
    'password_larga',
    `La contraseña puede tener como máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  ],
  ['no_coinciden', 'Las contraseñas no coinciden.'],
  ['nombre_invalido', 'Escribe tu nombre completo (entre 2 y 255 caracteres).'],
  ['datos_invalidos', 'Revisa los datos del formulario.'],
]);

/** Códigos de validación que registerAction puede mandar en `?error=`. */
export const REGISTER_VALIDATION_ERROR_CODES: ReadonlySet<string> = new Set(
  MENSAJES_VALIDACION.keys(),
);

type IssueMinimo = {
  readonly path: readonly PropertyKey[];
  readonly code: string;
};

/** Código del primer error de Zod de registerSchema (lista cerrada). */
export function registerValidationErrorCode(
  issues: readonly IssueMinimo[],
): string {
  const issue = issues[0];
  switch (issue?.path[0]) {
    case 'email':
      return 'email_invalido';
    case 'password':
      if (issue.code === 'too_small') return 'password_corta';
      if (issue.code === 'too_big') return 'password_larga';
      return 'datos_invalidos';
    case 'confirmPassword':
      return 'no_coinciden';
    case 'fullName':
      return 'nombre_invalido';
    default:
      return 'datos_invalidos';
  }
}

export function resolveRegisterError(
  error: string | null | undefined,
): string | null {
  if (!error) return null;
  return MENSAJES_VALIDACION.get(error) ?? translateAuthError({ code: error });
}
