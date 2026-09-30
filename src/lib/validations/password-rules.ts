/**
 * Regla de contraseña (contratos §2.4): la usan passwordSchema (Zod) y los
 * formularios (minLength, maxLength y el texto de ayuda), para que la UI
 * nunca diga una regla distinta de la que se valida.
 * 72 es el límite de bcrypt en Supabase Auth.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`;
