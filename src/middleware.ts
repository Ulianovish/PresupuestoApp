import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { LOGIN_PATH, loginUrl } from '@/lib/auth/login-url';
import { getRouteAccess, redirectsSignedInUser } from '@/lib/auth/route-access';
import { esFaltaDeSesion, resumenErrorAuth } from '@/lib/auth/session-error';

/**
 * Middleware de Next.js para proteger rutas y manejar autenticación
 * Se ejecuta en todas las rutas antes del rendering
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Si Supabase falla (variables de entorno ausentes, red, SDK) se sigue sin
  // usuario: las rutas públicas y de auth deben servir igual y las protegidas
  // van al login. Un 500 aquí dejaría a todos sin poder ni entrar al login.
  let user: { id: string } | null = null;
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    // Sin sesión es lo normal (no se registra); cualquier otro error sí: con
    // code (refresh_token_not_found) o sin él (AuthRetryableFetchError cuando
    // Supabase no responde). Nunca el mensaje: podría llevar datos personales.
    if (error && !esFaltaDeSesion(error)) {
      console.error('middleware: getUser falló', resumenErrorAuth(error));
    }
  } catch (err) {
    console.error('middleware: no se pudo verificar la sesión', {
      name: err instanceof Error ? err.name : typeof err,
    });
    user = null;
  }

  const { pathname, search } = request.nextUrl;
  const access = getRouteAccess(pathname);

  // Log para debugging (solo en desarrollo). Sin correo: nada de datos personales en logs.
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `🔐 Middleware: ${pathname} - ${user ? 'con sesión' : 'sin sesión'}`,
    );
  }

  // Toda redirección lleva las cookies que Supabase haya escrito al refrescar
  // la sesión (patrón oficial de @supabase/ssr); si no, el navegador se queda
  // con el refresh token ya usado y la sesión se pierde.
  // Una Server Action (POST con next-action) o cualquier petición que no sea
  // GET/HEAD recibe 303: con 307 el navegador repetiría el POST contra el
  // login con un id de acción que allí no existe.
  const esNavegacion =
    (request.method === 'GET' || request.method === 'HEAD') &&
    !request.headers.has('next-action');
  const redirigir = (url: URL) => {
    const respuesta = NextResponse.redirect(url, esNavegacion ? 307 : 303);
    supabaseResponse.cookies
      .getAll()
      .forEach(cookie => respuesta.cookies.set(cookie));
    return respuesta;
  };

  if (access === 'public') {
    return supabaseResponse;
  }

  // Rutas de auth: siempre accesibles (confirmar correo, recuperar contraseña…),
  // pero login y registro redirigen al dashboard si ya hay sesión. Si el login
  // trae redirectTo o error, alguien (una guardia de página cuyo getUser()
  // falló) mandó aquí a propósito: rebotar al dashboard formaría un bucle.
  if (access === 'auth') {
    const loginConMarcador =
      pathname === LOGIN_PATH &&
      (request.nextUrl.searchParams.has('redirectTo') ||
        request.nextUrl.searchParams.has('error'));
    if (user && redirectsSignedInUser(pathname) && !loginConMarcador) {
      return redirigir(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  if (access === 'protected' && !user) {
    return redirigir(new URL(loginUrl(pathname, search), request.url));
  }

  return supabaseResponse;
}

// Configurar en qué rutas debe ejecutarse el middleware
export const config = {
  matcher: [
    /*
     * Aplicar a todas las rutas excepto:
     * - api (API routes: '/api' y '/api/…', no '/apiario')
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - archivos con extensión (imágenes, fuentes, css/js, json, txt, xml, map, webmanifest)
     */
    '/((?!api/|api$|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|ttf|woff|woff2|json|txt|xml|map|webmanifest)$).*)',
  ],
};
