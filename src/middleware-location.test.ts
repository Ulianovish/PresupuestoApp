import fs from 'node:fs';
import path from 'node:path';

import { pathToRegexp } from 'next/dist/compiled/path-to-regexp';

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

const NO_TOCA = [
  '/api/whatsapp/webhook',
  '/api/cron/alertas-pendientes',
  '/api',
  '/_next/static/x.js',
  '/_next/image',
  '/favicon.ico',
  '/logo.png',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/site.webmanifest',
  '/_next/static/chunks/app.js.map',
  '/app.js.map',
];

const SE_EJECUTA = [
  '/',
  '/gastos',
  '/bienvenida',
  '/auth/login',
  '/auth/confirm',
  '/terms',
  '/privacy',
  '/ingresos-deudas',
  '/apiario',
];

// Aproximación rápida: el patrón compilado como RegExp nativo.
describe('config.matcher (RegExp nativo)', () => {
  const patron = new RegExp(`^${middlewareModule.config.matcher[0]}$`);

  it.each(NO_TOCA)('no toca %s', ruta => {
    expect(patron.test(ruta)).toBe(false);
  });

  it.each(SE_EJECUTA)('se ejecuta en %s', ruta => {
    expect(patron.test(ruta)).toBe(true);
  });
});

// Next.js compila el matcher con su copia de path-to-regexp: se prueba con esa
// misma función para no depender de que ambos intérpretes coincidan.
describe('config.matcher (path-to-regexp de Next.js)', () => {
  const patron = pathToRegexp(middlewareModule.config.matcher[0]);

  it.each(NO_TOCA)('no toca %s', ruta => {
    expect(patron.test(ruta)).toBe(false);
  });

  it.each(SE_EJECUTA)('se ejecuta en %s', ruta => {
    expect(patron.test(ruta)).toBe(true);
  });
});
