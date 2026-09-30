'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { authErrorCode } from '@/lib/auth/error-messages';
import { CHECK_EMAIL_MESSAGE_CODE } from '@/lib/auth/login-feedback';
import {
  FORGOT_PASSWORD_INVALID_EMAIL_CODE,
  FORGOT_PASSWORD_SENT_CODE,
} from '@/lib/auth/password-reset-feedback';
import { registerValidationErrorCode } from '@/lib/auth/register-feedback';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validations/schemas';

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : '';
}

/**
 * '/auth/login?error=…' (y redirectTo si es una ruta interna segura).
 * Siempre va un CÓDIGO, nunca texto: la página lo traduce con una lista
 * cerrada (resolveLoginFeedback / resolveRegisterError).
 */
function urlConError(
  base: '/auth/login' | '/auth/register',
  codigo: string,
  redirectTo?: string,
): string {
  const params = new URLSearchParams({ error: codigo });
  const seguro = redirectTo ? safeRedirectPath(redirectTo, '') : '';
  if (seguro) params.set('redirectTo', seguro);
  return `${base}?${params.toString()}`;
}

/**
 * Server Action para el login de usuarios.
 * Con `redirectTo` (lo pone el middleware) vuelve a esa ruta si es segura;
 * sin él, o si no es seguro, va a /bienvenida o /dashboard según el onboarding.
 */
export async function loginAction(formData: FormData) {
  const redirectTo = texto(formData, 'redirectTo');
  const parsed = loginSchema.safeParse({
    email: texto(formData, 'email'),
    password: texto(formData, 'password'),
  });

  // Formato inválido: mismo aviso que unas credenciales malas.
  if (!parsed.success) {
    redirect(urlConError('/auth/login', 'invalid_credentials', redirectTo));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    console.error('Error de login:', {
      code: error?.code ?? 'sin_usuario',
      status: error?.status,
    });
    redirect(urlConError('/auth/login', authErrorCode(error), redirectTo));
  }

  // Un redirectTo presente pero inseguro cuenta como ausente.
  const seguro = redirectTo ? safeRedirectPath(redirectTo, '') : '';
  const destino = seguro || (await getPostLoginPath(supabase, data.user.id));

  revalidatePath('/', 'layout');
  redirect(destino);
}

/**
 * Server Action para el registro de usuarios.
 * El correo de confirmación vuelve a /auth/confirm (ADR-003).
 */
export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: texto(formData, 'email'),
    password: texto(formData, 'password'),
    confirmPassword: texto(formData, 'confirmPassword'),
    fullName: texto(formData, 'fullName'),
  });

  if (!parsed.success) {
    redirect(
      urlConError(
        '/auth/register',
        registerValidationErrorCode(parsed.error.issues),
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/bienvenida`,
      data: {
        full_name: parsed.data.fullName,
      },
    },
  });

  if (error) {
    console.error('Error de registro:', {
      code: error.code ?? 'sin_codigo',
      status: error.status,
    });
    redirect(urlConError('/auth/register', authErrorCode(error)));
  }

  // Con confirmación de correo activa no hay sesión: hay que abrir el enlace.
  if (data.session && data.user) {
    revalidatePath('/', 'layout');
    redirect(await getPostLoginPath(supabase, data.user.id));
  }

  redirect(
    `/auth/login?${new URLSearchParams({ message: CHECK_EMAIL_MESSAGE_CODE }).toString()}`,
  );
}

/**
 * Server Action para logout
 * Cierra sesión y redirecciona al home
 */
export async function logoutAction() {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error de logout:', error);
      redirect('/?error=Error al cerrar sesión');
    }

    revalidatePath('/', 'layout');
    redirect('/');
  } catch (error) {
    console.error('Error en logoutAction:', error);

    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error;
    }

    redirect('/?error=Error al cerrar sesión');
  }
}

/**
 * Función para obtener el usuario actual
 * Útil para verificar autenticación en Server Components
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

/**
 * Función para verificar si el usuario está autenticado
 * Útil para middleware y protección de rutas
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}

// ============================================
// RECUPERAR CONTRASEÑA (S05)
// ============================================

const forgotPasswordEmailSchema = z.string().trim().email();

/** `path?key=codigo`. Siempre un CÓDIGO: la página lo traduce. */
function conCodigo(
  path: '/auth/forgot-password' | '/auth/reset-password',
  key: 'error' | 'message',
  codigo: string,
): string {
  return `${path}?${new URLSearchParams({ [key]: codigo }).toString()}`;
}

/** Solo el `code` del error (sin mensaje, que podría llevar el correo). */
function codigoDeError(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code
  ) {
    return error.code;
  }
  return 'sin_codigo';
}

/**
 * Server Action: envía el correo para restablecer la contraseña.
 * El enlace del correo (plantilla "Reset Password") pasa por /auth/confirm,
 * que deja la sesión y redirige a /auth/reset-password.
 *
 * Se traga todo error de resetPasswordForEmail, devuelto o lanzado, incluido
 * el límite de envíos: responder distinto revelaría que el correo existe
 * (contratos §5.2). Solo se registra el `code`.
 */
export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = forgotPasswordEmailSchema.safeParse(texto(formData, 'email'));

  if (!parsed.success) {
    redirect(
      conCodigo(
        '/auth/forgot-password',
        'error',
        FORGOT_PASSWORD_INVALID_EMAIL_CODE,
      ),
    );
  }

  const supabase = await createClient();
  let fallo: unknown = null;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getSiteUrl()}/auth/confirm?type=recovery&next=/auth/reset-password`,
    });
    fallo = error;
  } catch (e) {
    fallo = e;
  }

  if (fallo) {
    console.error('forgotPasswordAction: resetPasswordForEmail falló', {
      code: codigoDeError(fallo),
    });
  }

  redirect(
    conCodigo('/auth/forgot-password', 'message', FORGOT_PASSWORD_SENT_CODE),
  );
}
