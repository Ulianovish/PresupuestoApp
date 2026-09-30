/**
 * Clasifica las rutas para el middleware.
 *
 * - public: siempre accesibles (coincidencia exacta).
 * - auth: accesibles sin sesión; login/registro redirigen si ya hay sesión.
 * - protected: exigen sesión.
 * - open: todo lo demás (el middleware no hace nada).
 *
 * `auth` y `protected` usan `startsWith`, igual que el middleware anterior
 * (por eso '/ingresos-deudas' queda protegida por '/ingresos').
 */
export type RouteAccess = 'public' | 'auth' | 'protected' | 'open';

export const PUBLIC_ROUTES: readonly string[] = [
  '/',
  '/test',
  '/terms',
  '/privacy',
];

export const AUTH_ROUTES: readonly string[] = [
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/confirm',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export const PROTECTED_ROUTES: readonly string[] = [
  '/dashboard',
  '/bienvenida',
  '/presupuesto',
  '/gastos',
  '/ingresos',
  '/deudas',
  '/profile',
  '/settings',
];

export function getRouteAccess(pathname: string): RouteAccess {
  if (PUBLIC_ROUTES.includes(pathname)) return 'public';
  if (AUTH_ROUTES.some(route => pathname.startsWith(route))) return 'auth';
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route)))
    return 'protected';
  return 'open';
}

/** Login y registro no tienen sentido con sesión: se manda al dashboard. */
export function redirectsSignedInUser(pathname: string): boolean {
  return pathname === '/auth/login' || pathname === '/auth/register';
}
