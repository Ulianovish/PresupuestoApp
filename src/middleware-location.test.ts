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

// Aproximación con la misma librería: Next.js compila el matcher con su copia
// de path-to-regexp, pero además lo envuelve con el prefijo de _next/data y el
// sufijo (.json)? y le pasa sus propias opciones (strict, delimiter). Aquí se
// usan las opciones por defecto, así que no cubre barras finales ni rutas
// _next/data; sí detecta diferencias de sintaxis frente al RegExp nativo.
describe('config.matcher (path-to-regexp de Next.js)', () => {
  const patron = pathToRegexp(middlewareModule.config.matcher[0]);

  it.each(NO_TOCA)('no toca %s', ruta => {
    expect(patron.test(ruta)).toBe(false);
  });

  it.each(SE_EJECUTA)('se ejecuta en %s', ruta => {
    expect(patron.test(ruta)).toBe(true);
  });
});
