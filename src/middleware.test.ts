import { NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from './middleware';

// vi.mock se eleva por encima de los imports.
vi.mock('@supabase/ssr', () => ({ createServerClient: vi.fn() }));

const mockedCreateServerClient = vi.mocked(createServerClient);
const ORIGEN = 'http://localhost:3001';
const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';

function sesion(conUsuario: boolean) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user: conUsuario ? { id: USER_ID } : null },
    error: null,
  });
  mockedCreateServerClient.mockReturnValue({
    auth: { getUser },
  } as unknown as ReturnType<typeof createServerClient>);
}

/** getUser() que, como hace Supabase al refrescar, escribe cookies. */
function sesionQueRefresca(conUsuario: boolean) {
  mockedCreateServerClient.mockImplementation((_url, _key, opciones) => {
    const getUser = vi.fn().mockImplementation(async () => {
      await opciones.cookies.setAll?.([
        {
          name: 'sb-prueba-auth-token',
          value: 'renovado',
          options: { path: '/' },
        },
      ]);
      return {
        data: { user: conUsuario ? { id: USER_ID } : null },
        error: null,
      };
    });
    return { auth: { getUser } } as unknown as ReturnType<
      typeof createServerClient
    >;
  });
}

/** getUser() que lanza (SDK roto, red caída, variables de entorno ausentes…). */
function sesionQueFalla() {
  mockedCreateServerClient.mockReturnValue({
    auth: { getUser: vi.fn().mockRejectedValue(new TypeError('fetch failed')) },
  } as unknown as ReturnType<typeof createServerClient>);
}

/**
 * Sesión vencida tal como la trata Supabase: getUser() borra las cookies sb-*
 * (setAll con valor vacío y maxAge 0) y devuelve usuario nulo con error.
 */
function sesionVencida() {
  mockedCreateServerClient.mockImplementation((_url, _key, opciones) => {
    const getUser = vi.fn().mockImplementation(async () => {
      await opciones.cookies.setAll?.([
        {
          name: 'sb-prueba-auth-token',
          value: '',
          options: { path: '/', maxAge: 0 },
        },
      ]);
      return {
        data: { user: null },
        error: { name: 'AuthApiError', code: 'refresh_token_not_found' },
      };
    });
    return { auth: { getUser } } as unknown as ReturnType<
      typeof createServerClient
    >;
  });
}

function pedir(
  ruta: string,
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return middleware(new NextRequest(`${ORIGEN}${ruta}`, init));
}

/** El middleware dejó pasar la petición (NextResponse.next()). */
function pasa(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

describe('middleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('ruta protegida sin sesión → 307 al login con la ruta y la query', async () => {
    sesion(false);

    const res = await pedir('/gastos?mes=3');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      `${ORIGEN}/auth/login?redirectTo=%2Fgastos%3Fmes%3D3`,
    );
  });

  it('/bienvenida sin sesión redirige al login', async () => {
    sesion(false);

    const res = await pedir('/bienvenida');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      `${ORIGEN}/auth/login?redirectTo=%2Fbienvenida`,
    );
  });

  it('/auth/confirm con sesión pasa (no manda al dashboard)', async () => {
    sesion(true);

    const res = await pedir('/auth/confirm?token_hash=abc&type=signup');

    expect(pasa(res)).toBe(true);
    expect(res.headers.get('location')).toBeNull();
  });

  it('/auth/login con sesión → dashboard', async () => {
    sesion(true);

    const res = await pedir('/auth/login');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(`${ORIGEN}/dashboard`);
  });

  it('ruta protegida con sesión pasa', async () => {
    sesion(true);

    expect(pasa(await pedir('/gastos?mes=3'))).toBe(true);
  });

  it.each(['/', '/terms', '/privacy'])(
    '%s es pública sin sesión',
    async ruta => {
      sesion(false);

      expect(pasa(await pedir(ruta))).toBe(true);
    },
  );

  it('/ingresos-deudas sin sesión redirige al login', async () => {
    sesion(false);

    const res = await pedir('/ingresos-deudas');

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      `${ORIGEN}/auth/login?redirectTo=%2Fingresos-deudas`,
    );
  });

  it('/auth/login sin sesión pasa (sin bucle de redirección)', async () => {
    sesion(false);

    expect(pasa(await pedir('/auth/login?redirectTo=%2Fgastos'))).toBe(true);
  });

  // Patrón oficial de @supabase/ssr: si getUser() refresca la sesión, las
  // cookies nuevas deben viajar también en las redirecciones; si no, el
  // navegador se queda con el refresh token ya usado y la sesión se pierde.
  it.each([
    ['/auth/login', true],
    ['/gastos', false],
  ])(
    'la redirección desde %s conserva las cookies que escribió Supabase',
    async (ruta, conUsuario) => {
      sesionQueRefresca(conUsuario);

      const res = await pedir(ruta);

      expect(res.status).toBe(307);
      expect(res.headers.get('set-cookie')).toContain(
        'sb-prueba-auth-token=renovado',
      );
    },
  );

  describe('si getUser() lanza', () => {
    it.each(['/', '/terms', '/privacy', '/auth/login'])(
      '%s sigue pasando',
      async ruta => {
        sesionQueFalla();

        expect(pasa(await pedir(ruta))).toBe(true);
      },
    );

    it('una ruta protegida redirige al login', async () => {
      sesionQueFalla();

      const res = await pedir('/gastos');

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        `${ORIGEN}/auth/login?redirectTo=%2Fgastos`,
      );
    });

    it('registra solo el nombre del error', async () => {
      sesionQueFalla();

      await pedir('/gastos');

      expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
        name: 'TypeError',
      });
    });

    it('si createServerClient lanza, /auth/login pasa y /gastos redirige', async () => {
      mockedCreateServerClient.mockImplementation(() => {
        throw new Error('supabaseUrl is required.');
      });

      expect(pasa(await pedir('/auth/login'))).toBe(true);
      expect((await pedir('/gastos')).status).toBe(307);
    });
  });

  it('sin sesión (AuthSessionMissingError, sin code) no registra nada', async () => {
    mockedCreateServerClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { name: 'AuthSessionMissingError', code: undefined },
        }),
      },
    } as unknown as ReturnType<typeof createServerClient>);

    await pedir('/gastos');

    expect(console.error).not.toHaveBeenCalled();
  });

  describe('sesión vencida (refresh_token_not_found)', () => {
    it('una ruta protegida va al login con las cookies de borrado', async () => {
      sesionVencida();

      const res = await pedir('/gastos');

      expect(res.status).toBe(307);
      expect(res.headers.get('location')).toBe(
        `${ORIGEN}/auth/login?redirectTo=%2Fgastos`,
      );
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toContain('sb-prueba-auth-token=;');
      expect(cookie).toMatch(/Max-Age=0/i);
    });

    it('/auth/login pasa sin bucle', async () => {
      sesionVencida();

      const res = await pedir('/auth/login?redirectTo=%2Fgastos');

      expect(pasa(res)).toBe(true);
      expect(res.headers.get('location')).toBeNull();
    });

    it('registra solo el code del error', async () => {
      sesionVencida();

      await pedir('/gastos');

      expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
        code: 'refresh_token_not_found',
      });
    });
  });

  // Rompe el ciclo /dashboard → /auth/login → /dashboard cuando el getUser()
  // de la página falla y el del middleware no: las guardias de las páginas
  // mandan al login con redirectTo, y entonces el middleware no rebota.
  it.each([
    '/auth/login?redirectTo=%2Fdashboard',
    '/auth/login?error=enlace_invalido',
  ])('%s con sesión pasa (no manda al dashboard)', async ruta => {
    sesion(true);

    const res = await pedir(ruta);

    expect(pasa(res)).toBe(true);
    expect(res.headers.get('location')).toBeNull();
  });

  it('/auth/register con sesión y redirectTo sigue mandando al dashboard', async () => {
    sesion(true);

    const res = await pedir('/auth/register?redirectTo=%2Fgastos');

    expect(res.headers.get('location')).toBe(`${ORIGEN}/dashboard`);
  });

  describe('Server Actions y peticiones que no son GET', () => {
    it('POST con next-action desde una ruta protegida sin sesión → 303', async () => {
      sesion(false);

      const res = await pedir('/gastos', {
        method: 'POST',
        headers: { 'next-action': 'abc123' },
      });

      expect(res.status).toBe(303);
      expect(res.headers.get('location')).toBe(
        `${ORIGEN}/auth/login?redirectTo=%2Fgastos`,
      );
    });

    it('HEAD sin sesión sigue con 307', async () => {
      sesion(false);

      expect((await pedir('/gastos', { method: 'HEAD' })).status).toBe(307);
    });
  });
});
