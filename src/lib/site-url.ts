/**
 * URL pública de la app, sin barra final. Solo para código de servidor
 * (server actions, route handlers): arma los enlaces que Supabase pone en los
 * correos.
 *
 * Orden: NEXT_PUBLIC_SITE_URL → (solo si VERCEL_ENV === 'production')
 * https://${VERCEL_PROJECT_PRODUCTION_URL} → https://${VERCEL_URL} →
 * http://localhost:3001. Una variable vacía cuenta como ausente.
 * En producción VERCEL_URL es el dominio del despliegue (*.vercel.app), no el
 * dominio público: los enlaces de los correos no deben apuntar ahí.
 */
const LOCAL_SITE_URL = 'http://localhost:3001';

function limpiar(valor: string | undefined): string {
  return (valor ?? '').trim();
}

export function getSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicita = limpiar(env.NEXT_PUBLIC_SITE_URL);
  const produccion =
    env.VERCEL_ENV === 'production'
      ? limpiar(env.VERCEL_PROJECT_PRODUCTION_URL)
      : '';
  const vercel = produccion || limpiar(env.VERCEL_URL);
  const url = explicita || (vercel ? `https://${vercel}` : LOCAL_SITE_URL);
  return url.replace(/\/+$/, '');
}
