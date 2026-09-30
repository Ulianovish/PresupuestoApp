import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSiteUrl } from './site-url';

describe('getSiteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('usa NEXT_PUBLIC_SITE_URL cuando está definida', () => {
    expect(
      getSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://app.ejemplo.com',
        VERCEL_URL: 'presupuesto-abc123.vercel.app',
      }),
    ).toBe('https://app.ejemplo.com');
  });

  it('quita las barras finales y los espacios', () => {
    expect(
      getSiteUrl({ NEXT_PUBLIC_SITE_URL: ' https://app.ejemplo.com// ' }),
    ).toBe('https://app.ejemplo.com');
  });

  it('sin NEXT_PUBLIC_SITE_URL usa https://VERCEL_URL', () => {
    expect(getSiteUrl({ VERCEL_URL: 'presupuesto-abc123.vercel.app' })).toBe(
      'https://presupuesto-abc123.vercel.app',
    );
  });

  it('en producción sin NEXT_PUBLIC_SITE_URL usa el dominio de producción', () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'presupuesto.ejemplo.com',
        VERCEL_URL: 'presupuesto-abc123.vercel.app',
      }),
    ).toBe('https://presupuesto.ejemplo.com');
  });

  it('en producción NEXT_PUBLIC_SITE_URL sigue ganando', () => {
    expect(
      getSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://app.ejemplo.com',
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'presupuesto.ejemplo.com',
      }),
    ).toBe('https://app.ejemplo.com');
  });

  it('en preview ignora el dominio de producción y usa VERCEL_URL', () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: 'preview',
        VERCEL_PROJECT_PRODUCTION_URL: 'presupuesto.ejemplo.com',
        VERCEL_URL: 'presupuesto-abc123.vercel.app',
      }),
    ).toBe('https://presupuesto-abc123.vercel.app');
  });

  it('en producción sin dominio de producción cae a VERCEL_URL', () => {
    expect(
      getSiteUrl({
        VERCEL_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: ' ',
        VERCEL_URL: 'presupuesto-abc123.vercel.app',
      }),
    ).toBe('https://presupuesto-abc123.vercel.app');
  });

  it('trata las variables vacías como ausentes', () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: '', VERCEL_URL: '  ' })).toBe(
      'http://localhost:3001',
    );
  });

  it('sin variables usa http://localhost:3001', () => {
    expect(getSiteUrl({})).toBe('http://localhost:3001');
  });

  it('sin argumento lee process.env', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://desde-env.ejemplo.com/');
    expect(getSiteUrl()).toBe('https://desde-env.ejemplo.com');
  });
});
