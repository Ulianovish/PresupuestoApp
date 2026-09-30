import { describe, expect, it } from 'vitest';

import { getRouteAccess, redirectsSignedInUser } from './route-access';

describe('getRouteAccess', () => {
  it.each(['/', '/terms', '/privacy', '/test'])('%s es pública', ruta => {
    expect(getRouteAccess(ruta)).toBe('public');
  });

  it.each([
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/auth/confirm',
    '/auth/forgot-password',
    '/auth/reset-password',
  ])('%s es de auth (accesible sin sesión)', ruta => {
    expect(getRouteAccess(ruta)).toBe('auth');
  });

  it.each([
    '/dashboard',
    '/bienvenida',
    '/presupuesto',
    '/gastos',
    '/ingresos',
    '/ingresos-deudas',
    '/deudas',
    '/profile',
    '/settings',
    '/settings/whatsapp',
  ])('%s está protegida', ruta => {
    expect(getRouteAccess(ruta)).toBe('protected');
  });

  it('una ruta no listada queda abierta', () => {
    expect(getRouteAccess('/no-existe')).toBe('open');
  });
});

describe('redirectsSignedInUser', () => {
  it('solo login y registro', () => {
    expect(redirectsSignedInUser('/auth/login')).toBe(true);
    expect(redirectsSignedInUser('/auth/register')).toBe(true);
    expect(redirectsSignedInUser('/auth/confirm')).toBe(false);
    expect(redirectsSignedInUser('/auth/reset-password')).toBe(false);
  });
});
