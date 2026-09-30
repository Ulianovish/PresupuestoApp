/**
 * URL pública de la app, sin barra final. Solo para código de servidor
 * (server actions, route handlers): arma los enlaces que Supabase pone en los
 * correos.
 *
 * Orden: NEXT_PUBLIC_SITE_URL → https://${VERCEL_URL} → http://localhost:3001.
 * Una variable vacía cuenta como ausente.
 */
const LOCAL_SITE_URL = 'http://localhost:3001';

function limpiar(valor: string | undefined): string {
  return (valor ?? '').trim();
}

export function getSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicita = limpiar(env.NEXT_PUBLIC_SITE_URL);
  const vercel = limpiar(env.VERCEL_URL);
  const url = explicita || (vercel ? `https://${vercel}` : LOCAL_SITE_URL);
  return url.replace(/\/+$/, '');
}
