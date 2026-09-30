import { NextRequest } from 'next/server';

import { createServerClient } from '@supabase/ssr';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { middleware } from '../middleware';

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

function pedir(ruta: string) {
  return middleware(new NextRequest(`${ORIGEN}${ruta}`));
}

/** El middleware dejó pasar la petición (NextResponse.next()). */
function pasa(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

describe('middleware', () => {
  // Prueba ../middleware (raíz), que según ADR-004 / H10 Next.js quizá no
  // carga con src/: pasar aquí no garantiza que corra en producción. Al
  // resolver H10 y moverlo a src/middleware.ts, actualizar el import.
  beforeEach(() => vi.clearAllMocks());

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

  it.each(['/terms', '/privacy'])('%s es pública sin sesión', async ruta => {
    sesion(false);

    expect(pasa(await pedir(ruta))).toBe(true);
  });
});
