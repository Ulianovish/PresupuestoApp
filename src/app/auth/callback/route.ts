import { redirect } from 'next/navigation';

import { isEmailOtpType } from '@/lib/auth/email-otp-types';

/**
 * GET /auth/callback?code=…[&type=…][&next=… | &redirectTo=…]
 *
 * Compatibilidad con enlaces viejos del flujo PKCE. No canjea nada: reenvía
 * a /auth/confirm (ADR-003), que tiene la única lógica de canje, de destino
 * seguro y de enlace inválido. `redirectTo` (enlaces viejos) pasa como
 * `next`; `type` pasa solo si está en EMAIL_OTP_TYPES; los demás parámetros
 * se descartan.
 *
 * Decisiones (S06): sin `code` ya no va al login a secas sino a
 * /auth/confirm, que responde ?error=enlace_invalido. Un `code` con
 * type=recovery termina en /auth/reset-password (así lo decide confirm).
 * Si Supabase manda `error`/`error_code` (p. ej. otp_expired), se registra
 * solo el código, sin datos personales.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? searchParams.get('redirectTo');

  if (searchParams.has('error') || searchParams.has('error_code')) {
    console.error('Callback de auth con error:', {
      code: searchParams.get('error_code') ?? 'sin_codigo',
    });
  }

  const params = new URLSearchParams();
  if (code) params.set('code', code);
  if (isEmailOtpType(type)) params.set('type', type);
  if (next) params.set('next', next);

  const query = params.toString();
  redirect(query ? `/auth/confirm?${query}` : '/auth/confirm');
}
