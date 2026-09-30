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

function pedir(ruta: string) {
  return middleware(new NextRequest(`${ORIGEN}${ruta}`));
}

/** El middleware dejó pasar la petición (NextResponse.next()). */
function pasa(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

describe('middleware', () => {
  beforeEach(() => vi.resetAllMocks());

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
});
