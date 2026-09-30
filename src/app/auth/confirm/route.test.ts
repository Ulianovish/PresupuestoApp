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
const BASE = 'http://localhost:3001/auth/confirm';
const ENLACE_INVALIDO = '/auth/login?error=enlace_invalido';

function clienteFalso(
  resultado: { data: { user: { id: string } | null }; error: unknown } = {
    data: { user: { id: USER_ID } },
    error: null,
  },
) {
  const verifyOtp = vi.fn().mockResolvedValue(resultado);
  const exchangeCodeForSession = vi.fn().mockResolvedValue(resultado);
  const client = { auth: { verifyOtp, exchangeCodeForSession } };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, verifyOtp, exchangeCodeForSession };
}

/** Ejecuta GET y devuelve la ruta a la que redirigió. */
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

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('sin token_hash ni code → login con enlace_invalido, sin tocar Supabase', async () => {
    await expect(destino('?type=email')).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin type → enlace_invalido', async () => {
    await expect(destino('?token_hash=hash-de-prueba')).resolves.toBe(
      ENLACE_INVALIDO,
    );
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('type fuera de la lista (magiclink) → enlace_invalido', async () => {
    await expect(
      destino('?token_hash=hash-de-prueba&type=magiclink'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('confirmación sin next → verifica y usa getPostLoginPath', async () => {
    const { client, verifyOtp } = clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=email'),
    ).resolves.toBe('/bienvenida');
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'hash-de-prueba',
    });
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('acepta type=signup', async () => {
    const { verifyOtp } = clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=signup'),
    ).resolves.toBe('/bienvenida');
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'signup',
      token_hash: 'hash-de-prueba',
    });
  });

  it('respeta un next interno', async () => {
    clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=email&next=%2Fpresupuesto'),
    ).resolves.toBe('/presupuesto');
  });

  it('un next externo cae al destino de getPostLoginPath', async () => {
    clienteFalso();
    mockedPostLogin.mockResolvedValue('/dashboard');

    await expect(
      destino(
        '?token_hash=hash-de-prueba&type=email&next=%2F%2Fotro.ejemplo.com',
      ),
    ).resolves.toBe('/dashboard');
  });

  it('recovery sin next → /auth/reset-password, sin consultar el perfil', async () => {
    clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=recovery'),
    ).resolves.toBe('/auth/reset-password');
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('invite con next=/auth/reset-password → /auth/reset-password', async () => {
    clienteFalso();

    await expect(
      destino(
        '?token_hash=hash-de-prueba&type=invite&next=%2Fauth%2Freset-password',
      ),
    ).resolves.toBe('/auth/reset-password');
  });

  it('verifyOtp con error (enlace vencido) → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: {
        code: 'otp_expired',
        message: 'Email link is invalid or has expired',
      },
    });

    await expect(
      destino('?token_hash=hash-de-prueba&type=email'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('?code= (plantilla con ConfirmationURL) → exchangeCodeForSession y getPostLoginPath', async () => {
    const { client, verifyOtp, exchangeCodeForSession } = clienteFalso();

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(
      '/bienvenida',
    );
    expect(exchangeCodeForSession).toHaveBeenCalledWith('codigo-de-prueba');
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('?code= con type=recovery → /auth/reset-password, sin consultar el perfil', async () => {
    clienteFalso();

    await expect(destino('?code=codigo-de-prueba&type=recovery')).resolves.toBe(
      '/auth/reset-password',
    );
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('?code= con next interno lo respeta', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&next=%2Fgastos'),
    ).resolves.toBe('/gastos');
  });

  it('?code= que no se puede canjear → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: { code: 'bad_code_verifier', message: 'code verifier mismatch' },
    });

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(
      ENLACE_INVALIDO,
    );
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('si llegan token_hash y code, gana token_hash', async () => {
    const { verifyOtp, exchangeCodeForSession } = clienteFalso();

    await destino(
      '?token_hash=hash-de-prueba&type=email&code=codigo-de-prueba',
    );
    expect(verifyOtp).toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
