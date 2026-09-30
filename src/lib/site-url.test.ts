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
