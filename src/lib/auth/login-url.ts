export const LOGIN_PATH = '/auth/login';

/**
 * URL del login que devuelve al usuario a `pathname` (con su query, si la
 * hay) al iniciar sesión. Usa URLSearchParams para codificar `redirectTo`: la
 * query de origen no se mezcla con la del login.
 */
export function loginUrl(pathname: string, search?: string): string {
  const query = (search ?? '').replace(/^\?/, '');
  const destino = query ? `${pathname}?${query}` : pathname;
  const params = new URLSearchParams({ redirectTo: destino });
  return `${LOGIN_PATH}?${params.toString()}`;
}
