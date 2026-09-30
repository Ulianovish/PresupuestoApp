import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));

import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { GET } from './route';

const mockedCreateClient = vi.mocked(createClient);
const mockedPostLogin = vi.mocked(getPostLoginPath);

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';
const BASE = 'http://localhost:3001/auth/callback';
const ENLACE_INVALIDO = '/auth/login?error=enlace_invalido';

function clienteFalso(
  resultado: { data: { user: { id: string } | null }; error: unknown } = {
    data: { user: { id: USER_ID } },
    error: null,
  },
) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue(resultado);
  const client = { auth: { exchangeCodeForSession } };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, exchangeCodeForSession };
}

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

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('canjea el code y usa getPostLoginPath sin next', async () => {
    const { client, exchangeCodeForSession } = clienteFalso();

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(
      '/bienvenida',
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith('codigo-de-prueba');
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('respeta next interno', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&next=%2Fgastos'),
    ).resolves.toBe('/gastos');
  });

  it('respeta redirectTo interno (enlaces viejos)', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&redirectTo=%2Fpresupuesto'),
    ).resolves.toBe('/presupuesto');
  });

  it('un redirectTo externo cae al destino de getPostLoginPath', async () => {
    clienteFalso();
    mockedPostLogin.mockResolvedValue('/dashboard');

    await expect(
      destino(
        '?code=codigo-de-prueba&redirectTo=https%3A%2F%2Fotro.ejemplo.com',
      ),
    ).resolves.toBe('/dashboard');
  });

  it('error al canjear → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: { code: 'bad_code_verifier', message: 'code verifier mismatch' },
    });

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(
      ENLACE_INVALIDO,
    );
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('Supabase manda error en la URL → enlace_invalido sin tocar Supabase', async () => {
    await expect(
      destino('?error=access_denied&error_code=otp_expired'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin code → /auth/login', async () => {
    await expect(destino('')).resolves.toBe('/auth/login');
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
