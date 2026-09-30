import { redirect } from 'next/navigation';

/**
 * GET /auth/callback?code=…[&type=…][&next=… | &redirectTo=…]
 *
 * Compatibilidad con enlaces viejos del flujo PKCE. No canjea nada: reenvía
 * a /auth/confirm (ADR-003), que tiene la única lógica de canje, de destino
 * seguro y de enlace inválido. `redirectTo` (enlaces viejos) pasa como
 * `next`; los demás parámetros se descartan.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? searchParams.get('redirectTo');

  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (type) params.set('type', type);
  if (next) params.set('next', next);

  const query = params.toString();
  redirect(query ? `/auth/confirm?${query}` : '/auth/confirm');
}
