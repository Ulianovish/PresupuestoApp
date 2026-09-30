/**
 * `getUser()` sin cookie de sesión devuelve `AuthSessionMissingError`: es lo
 * normal para un visitante sin sesión, no un fallo, así que no se registra.
 * Se compara por nombre (el error puede llegar como objeto plano).
 */
export function esFaltaDeSesion(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AuthSessionMissingError'
  );
}
