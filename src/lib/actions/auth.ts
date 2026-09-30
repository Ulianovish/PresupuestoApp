'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { translateAuthError } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validations/schemas';

const MENSAJE_REVISA_CORREO =
  'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : '';
}

/** '/auth/login?error=…' (y redirectTo si es una ruta interna segura). */
function urlConError(
  base: '/auth/login' | '/auth/register',
  mensaje: string,
  redirectTo?: string,
): string {
  const params = new URLSearchParams({ error: mensaje });
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

  if (!parsed.success) {
    redirect(
      urlConError(
        '/auth/login',
        parsed.error.issues[0]?.message ?? translateAuthError(null),
        redirectTo,
      ),
    );
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
    redirect(urlConError('/auth/login', translateAuthError(error), redirectTo));
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
        parsed.error.issues[0]?.message ?? translateAuthError(null),
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
    redirect(urlConError('/auth/register', translateAuthError(error)));
  }

  // Con confirmación de correo activa no hay sesión: hay que abrir el enlace.
  if (data.session && data.user) {
    revalidatePath('/', 'layout');
    redirect(await getPostLoginPath(supabase, data.user.id));
  }

  redirect(
    `/auth/login?${new URLSearchParams({ message: MENSAJE_REVISA_CORREO }).toString()}`,
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
