/**
 * Traduce los errores de Supabase Auth a textos en español para la UI
 * (contratos §2.2 + §5.2).
 *
 * Compara `code` solo si es uno conocido; si no hay `code` o no está en la
 * tabla, compara `message` (exacto; solo 'signup_not_allowed' también como
 * subcadena). Sin distinguir mayúsculas. El rechazo del hook de
 * la allowlist llega sin `code` (message 'signup_not_allowed', 403) y el del
 * trigger con `code: 'unexpected_failure'` y message 'Database error saving
 * new user': ambos terminan en el texto de "sin invitación".
 * Nunca devuelve el mensaje crudo de Supabase.
 */
export const GENERIC_AUTH_ERROR =
  'No pudimos completar la operación. Intenta de nuevo.';

/** Código que usan /auth/confirm y /auth/callback en `?error=` del login. */
export const INVALID_LINK_ERROR_CODE = 'enlace_invalido';
export const INVALID_LINK_LOGIN_PATH = `/auth/login?error=${INVALID_LINK_ERROR_CODE}`;

const SIN_INVITACION =
  'Este correo no tiene invitación. Pídele acceso a quien administra la app.';
const CREDENCIALES = 'Correo o contraseña incorrectos.';
const YA_EXISTE =
  'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.';
const LIMITE_CORREOS =
  'Enviamos demasiados correos. Intenta de nuevo en unos minutos.';

// Claves en minúsculas. Map (no objeto) para que 'constructor' o
// 'toString' no encuentren nada en el prototipo.
const MENSAJES = new Map<string, string>([
  ['signup_not_allowed', SIN_INVITACION],
  ['database error saving new user', SIN_INVITACION],
  ['invalid_credentials', CREDENCIALES],
  ['invalid login credentials', CREDENCIALES],
  [
    'email_not_confirmed',
    'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
  ],
  ['user_already_exists', YA_EXISTE],
  ['user already registered', YA_EXISTE],
  ['weak_password', 'La contraseña es muy débil. Usa al menos 8 caracteres.'],
  ['over_email_send_rate_limit', LIMITE_CORREOS],
  ['email rate limit exceeded', LIMITE_CORREOS],
  [
    'email_address_not_authorized',
    'No pudimos enviar el correo a esta dirección. Escríbele a quien administra la app.',
  ],
  ['signup_disabled', 'El registro está cerrado por ahora.'],
  ['otp_expired', 'El enlace venció. Pide uno nuevo.'],
  [
    INVALID_LINK_ERROR_CODE,
    'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
  ],
  ['same_password', 'La contraseña nueva debe ser distinta de la anterior.'],
]);

function normalizar(valor: string | undefined): string {
  return (valor ?? '').trim().toLowerCase();
}

export function translateAuthError(
  err: { message?: string; code?: string } | null | undefined,
): string {
  if (!err) return GENERIC_AUTH_ERROR;

  // 1) `code` solo si es conocido (p. ej. 'unexpected_failure' no lo es).
  const code = normalizar(err.code);
  const porCodigo = code ? MENSAJES.get(code) : undefined;
  if (porCodigo) return porCodigo;

  // 2) Si no, `message`.
  const message = normalizar(err.message);
  if (!message) return GENERIC_AUTH_ERROR;

  const exacto = MENSAJES.get(message);
  if (exacto) return exacto;

  // Solo el literal del hook se busca como subcadena: puede venir envuelto
  // ("Hook requires authorization: signup_not_allowed"). El resto, exacto.
  if (message.includes('signup_not_allowed')) return SIN_INVITACION;
  return GENERIC_AUTH_ERROR;
}
