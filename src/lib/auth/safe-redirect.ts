/**
 * Convierte un destino que viene de la URL o de un formulario (`next`,
 * `redirectTo`) en una ruta interna segura. Si no lo es, devuelve `fallback`.
 *
 * Acepta solo rutas que empiezan con '/' y no con '//' ni '/\'. Rechaza
 * esquemas, barras invertidas, caracteres de control (el navegador borra
 * tabs y saltos de línea: '/\t/otro.sitio' terminaría en '//otro.sitio') y
 * rutas de /auth/* salvo /auth/reset-password.
 */
const DEFAULT_FALLBACK = '/dashboard';
const BASE = 'http://safe-redirect.invalid';
const RUTAS_AUTH_PERMITIDAS = new Set(['/auth/reset-password']);

function tieneCaracteresDeControl(texto: string): boolean {
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(
  input: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (typeof input !== 'string' || input.length === 0) return fallback;
  if (!input.startsWith('/') || input.startsWith('//')) return fallback;
  if (input.includes('\\') || tieneCaracteresDeControl(input)) return fallback;

  let url: URL;
  try {
    url = new URL(input, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  // Se revisa la ruta ya normalizada: '/dashboard/../auth/login' → '/auth/login'.
  const ruta = url.pathname.toLowerCase();
  const esAuth = ruta === '/auth' || ruta.startsWith('/auth/');
  if (esAuth && !RUTAS_AUTH_PERMITIDAS.has(ruta)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
