import { redirect } from 'next/navigation';

import { INVALID_LINK_LOGIN_PATH } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import type { EmailOtpType } from '@supabase/supabase-js';

/**
 * GET /auth/confirm?token_hash=…&type=…&next=…
 * GET /auth/confirm?code=…[&type=recovery][&next=…]
 *
 * Destino de los enlaces de los correos de Supabase (confirmar registro,
 * invitación, recuperar contraseña, cambio de correo). `verifyOtp` con el
 * cliente de cookie deja la sesión guardada, así que funciona aunque el
 * correo se abra en otro dispositivo (ADR-003). `?code=` cubre plantillas que
 * usen `{{ .ConfirmationURL }}` (contratos §5.2); ese flujo PKCE sí exige el
 * mismo navegador.
 *
 * Sin `next` válido: recovery → /auth/reset-password; lo demás → getPostLoginPath.
 */
const TIPOS_PERMITIDOS: readonly string[] = [
  'signup',
  'email',
  'recovery',
  'invite',
  'email_change',
];

function esTipoPermitido(valor: string | null): valor is EmailOtpType {
  return valor !== null && TIPOS_PERMITIDOS.includes(valor);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Enlace = { tokenHash: string; type: EmailOtpType } | { code: string };

/** Lee el enlace de la URL. null = parámetros faltantes o inválidos. */
function leerEnlace(searchParams: URLSearchParams): Enlace | null {
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');

  if (tokenHash) {
    return esTipoPermitido(type) ? { tokenHash, type } : null;
  }
  return code ? { code } : null;
}

/** Canjea el enlace (deja la sesión en cookies). Devuelve el usuario o null. */
async function canjear(supabase: Supabase, enlace: Enlace) {
  const { data, error } =
    'tokenHash' in enlace
      ? await supabase.auth.verifyOtp({
          type: enlace.type,
          token_hash: enlace.tokenHash,
        })
      : await supabase.auth.exchangeCodeForSession(enlace.code);

  if (error || !data.user) {
    console.error('No se pudo verificar el enlace del correo:', {
      via: 'tokenHash' in enlace ? 'token_hash' : 'code',
      code: error?.code ?? 'sin_usuario',
    });
    return null;
  }
  return data.user;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  const enlace = leerEnlace(searchParams);
  if (!enlace) {
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  const supabase = await createClient();
  const user = await canjear(supabase, enlace);
  if (!user) {
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  const fallback =
    type === 'recovery'
      ? '/auth/reset-password'
      : await getPostLoginPath(supabase, user.id);

  redirect(safeRedirectPath(next, fallback));
}
