import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';

import { GET } from './route';

const mockedCreateClient = vi.mocked(createClient);

const BASE = 'http://localhost:3001/auth/callback';

async function destino(query: string): Promise<string> {
  try {
    await GET(new Request(`${BASE}${query}`));
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith('NEXT_REDIRECT:')) {
      return mensaje.slice('NEXT_REDIRECT:'.length);
    }
    throw e;
  }
  throw new Error('GET no redirigió');
}

function partes(url: string): { ruta: string; query: URLSearchParams } {
  const [ruta, query = ''] = url.split('?');
  return { ruta: ruta ?? '', query: new URLSearchParams(query) };
}

// /auth/callback ya no canjea nada: delega en /auth/confirm (una sola lógica).
describe('GET /auth/callback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reenvía el code a /auth/confirm sin tocar Supabase', async () => {
    const { ruta, query } = partes(await destino('?code=codigo-de-prueba'));

    expect(ruta).toBe('/auth/confirm');
    expect(query.get('code')).toBe('codigo-de-prueba');
    expect(query.has('next')).toBe(false);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('conserva type y next', async () => {
    const { ruta, query } = partes(
      await destino('?code=codigo-de-prueba&type=recovery&next=%2Fgastos'),
    );

    expect(ruta).toBe('/auth/confirm');
    expect(query.get('type')).toBe('recovery');
    expect(query.get('next')).toBe('/gastos');
  });

  it('redirectTo (enlaces viejos) pasa como next', async () => {
    const { query } = partes(
      await destino('?code=codigo-de-prueba&redirectTo=%2Fpresupuesto'),
    );

    expect(query.get('next')).toBe('/presupuesto');
    expect(query.has('redirectTo')).toBe(false);
  });

  it('next gana sobre redirectTo', async () => {
    const { query } = partes(
      await destino('?code=c&next=%2Fgastos&redirectTo=%2Fpresupuesto'),
    );

    expect(query.get('next')).toBe('/gastos');
  });

  it('no pasa otros parámetros (p. ej. error de Supabase)', async () => {
    const { ruta, query } = partes(
      await destino('?error=access_denied&error_code=otp_expired'),
    );

    // Sin code, /auth/confirm responde enlace_invalido.
    expect(ruta).toBe('/auth/confirm');
    expect([...query.keys()]).toEqual([]);
  });

  it('decisión explícita: sin code va a /auth/confirm (→ enlace_invalido), ya no al login a secas', async () => {
    const { ruta, query } = partes(await destino(''));

    expect(ruta).toBe('/auth/confirm');
    expect([...query.keys()]).toEqual([]);
  });

  it('registra el error_code de Supabase sin datos personales', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await destino(
      '?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
    );

    expect(log).toHaveBeenCalledWith('Callback de auth con error:', {
      code: 'otp_expired',
    });
    log.mockRestore();
  });

  it('error sin error_code → sin_codigo', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await destino('?error=server_error');

    expect(log).toHaveBeenCalledWith('Callback de auth con error:', {
      code: 'sin_codigo',
    });
    log.mockRestore();
  });

  it('sin error no registra nada', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await destino('?code=c');

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it.each(['signup', 'email', 'recovery', 'invite', 'email_change'])(
    'reenvía type=%s (permitido por /auth/confirm)',
    async type => {
      const { query } = partes(await destino(`?code=c&type=${type}`));

      expect(query.get('type')).toBe(type);
    },
  );

  it.each(['magiclink', 'sms', 'RECOVERY', '<script>'])(
    'no reenvía un type fuera de la lista (%s)',
    async type => {
      const { query } = partes(
        await destino(`?code=c&type=${encodeURIComponent(type)}`),
      );

      expect(query.get('code')).toBe('c');
      expect(query.has('type')).toBe(false);
    },
  );
});
