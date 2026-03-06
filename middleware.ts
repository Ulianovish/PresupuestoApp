import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de Next.js para proteger rutas y manejar autenticación
 * Se ejecuta en todas las rutas antes del rendering
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificar la sesión del usuario
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Rutas públicas que no requieren autenticación
  const publicRoutes = [
    '/',
    '/test',
    '/terms',
    '/privacy'
  ]

  // Rutas de autenticación
  const authRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/auth/forgot-password',
    '/auth/reset-password'
  ]

  // Rutas protegidas que requieren autenticación
  const protectedRoutes = [
    '/dashboard',
    '/presupuesto',
    '/gastos',
    '/ingresos',
    '/deudas',
    '/profile',
    '/settings'
  ]

  // Log para debugging (solo en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 Middleware: ${pathname} - Usuario: ${user ? user.email : 'No autenticado'}`)
  }

  // Permitir acceso a rutas públicas siempre
  if (publicRoutes.includes(pathname)) {
    return supabaseResponse
  }

  // Permitir acceso a rutas de auth siempre (pero redirigir si ya está logueado)
  if (authRoutes.some(route => pathname.startsWith(route))) {
    // Si está autenticado y trata de ir a login/register, redirigir al dashboard
    if (user && (pathname === '/auth/login' || pathname === '/auth/register')) {
      console.log('👤 Usuario autenticado intentando acceder a auth, redirigiendo al dashboard')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Para rutas protegidas, verificar autenticación
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!user) {
      console.log('🚫 Usuario no autenticado intentando acceder a ruta protegida, redirigiendo al login')
      const redirectUrl = new URL('/auth/login', request.url)
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
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
} 