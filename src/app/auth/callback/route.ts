import { redirect } from 'next/navigation';

import { INVALID_LINK_LOGIN_PATH } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback?code=…&next=… (o &redirectTo=…)
 *
 * Compatibilidad con enlaces viejos del flujo PKCE. Es un route handler (no
 * una página) para que `exchangeCodeForSession` pueda escribir las cookies de
 * sesión. Los correos nuevos usan /auth/confirm (ADR-003).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? searchParams.get('redirectTo');

  if (searchParams.get('error') || searchParams.get('error_code')) {
    console.error('Callback de auth con error:', {
      code: searchParams.get('error_code') ?? 'sin_codigo',
    });
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  if (!code) {
    redirect('/auth/login');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('No se pudo canjear el código de auth:', {
      code: error?.code ?? 'sin_usuario',
    });
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  redirect(
    safeRedirectPath(next, await getPostLoginPath(supabase, data.user.id)),
  );
}
