import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import * as middlewareModule from './middleware';

vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

// Con carpeta src/, Next.js solo carga src/middleware.ts: uno en la raíz se
// ignora sin error (ADR-004).
describe('ubicación del middleware', () => {
  it('src/middleware.ts exporta middleware y config', () => {
    expect(typeof middlewareModule.middleware).toBe('function');
    expect(middlewareModule.config.matcher).toHaveLength(1);
  });

  it('no queda un middleware.ts en la raíz', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'middleware.ts'))).toBe(
      false,
    );
  });
});

describe('config.matcher', () => {
  const patron = new RegExp(`^${middlewareModule.config.matcher[0]}$`);

  it.each([
    '/api/whatsapp/webhook',
    '/api/cron/alertas-pendientes',
    '/_next/static/x.js',
    '/_next/image',
    '/favicon.ico',
    '/logo.png',
  ])('no toca %s', ruta => {
    expect(patron.test(ruta)).toBe(false);
  });

  it.each([
    '/',
    '/gastos',
    '/bienvenida',
    '/auth/login',
    '/auth/confirm',
    '/terms',
    '/privacy',
    '/ingresos-deudas',
  ])('se ejecuta en %s', ruta => {
    expect(patron.test(ruta)).toBe(true);
  });
});
