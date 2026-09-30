import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('sin entrada devuelve /dashboard', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
  });

  it('usa el fallback que se le pasa', () => {
    expect(safeRedirectPath(null, '/bienvenida')).toBe('/bienvenida');
    expect(safeRedirectPath('//otro.ejemplo.com', '/auth/reset-password')).toBe(
      '/auth/reset-password',
    );
  });

  it.each([
    ['/gastos', '/gastos'],
    ['/presupuesto', '/presupuesto'],
    ['/gastos?mes=2026-09#nuevo', '/gastos?mes=2026-09#nuevo'],
    ['/auth/reset-password', '/auth/reset-password'],
    ['/bienvenida', '/bienvenida'],
  ])('acepta la ruta interna %s', (entrada, esperado) => {
    expect(safeRedirectPath(entrada)).toBe(esperado);
  });

  it.each([
    ['//otro.ejemplo.com'],
    ['/\\otro.ejemplo.com'],
    ['/gastos\\..\\..\\otro'],
    ['https://otro.ejemplo.com'],
    ['javascript:alert(1)'],
    ['gastos'],
    ['/\t/otro.ejemplo.com'],
    ['/\n/otro.ejemplo.com'],
    ['/auth'],
    ['/auth/login'],
    ['/auth/register'],
    ['/auth/confirm?token_hash=abc&type=email'],
    ['/auth/callback?code=abc'],
    ['/AUTH/login'],
    ['/dashboard/../auth/login'],
  ])('rechaza %j', entrada => {
    expect(safeRedirectPath(entrada)).toBe('/dashboard');
  });
});
