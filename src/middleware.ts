import { NextResponse, type NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';

import { getRouteAccess, redirectsSignedInUser } from '@/lib/auth/route-access';

/**
 * Middleware de Next.js para proteger rutas y manejar autenticación
 * Se ejecuta en todas las rutas antes del rendering
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

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

  // Verificar la sesión del usuario
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const access = getRouteAccess(pathname);

  // Log para debugging (solo en desarrollo). Sin correo: nada de datos personales en logs.
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `🔐 Middleware: ${pathname} - ${user ? 'con sesión' : 'sin sesión'}`,
    );
  }

  if (access === 'public') {
    return supabaseResponse;
  }

  // Rutas de auth: siempre accesibles (confirmar correo, recuperar contraseña…),
  // pero login y registro redirigen al dashboard si ya hay sesión.
  if (access === 'auth') {
    if (user && redirectsSignedInUser(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return supabaseResponse;
  }

  if (access === 'protected' && !user) {
    const redirectUrl = new URL('/auth/login', request.url);
    redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

// Configurar en qué rutas debe ejecutarse el middleware
export const config = {
  matcher: [
    /*
     * Aplicar a todas las rutas excepto:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - archivos con extensión
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|ttf|woff|woff2)$).*)',
  ],
};
