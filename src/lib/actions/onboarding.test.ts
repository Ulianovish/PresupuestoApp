import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';

import { ensureStarterKitAction } from './onboarding';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

/**
 * Cliente de cookie falso: auth.getUser y rpc. S11 lo reemplaza por uno más
 * completo (con from) que conserva esta firma: `clienteFalso({ user,
 * rpcResult })` y devuelve `{ client }`.
 */
function clienteFalso({
  user = { id: USER_ID } as { id: string } | null,
  rpcResult = { data: true, error: null } as Resultado,
} = {}) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client };
}

describe('ensureStarterKitAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llama ensure_starter_kit sin parámetros y devuelve seeded: true', async () => {
    const { client } = clienteFalso();

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: true });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('ensure_starter_kit');
  });

  it('si ya tenía categorías activas (false) → seeded: false, sin error', async () => {
    clienteFalso({ rpcResult: { data: false, error: null } });

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: false });
  });

  it('trata un data nulo como no sembrado', async () => {
    clienteFalso({ rpcResult: { data: null, error: null } });

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: false });
  });

  it('sin sesión → error no_session y no llama la RPC', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'no_session',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('si la RPC falla devuelve su code y hace console.warn solo con el code', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clienteFalso({
      rpcResult: {
        data: null,
        error: {
          code: '23503',
          message: 'violates foreign key constraint usuario@ejemplo.com',
        },
      },
    });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: '23503',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), '23503');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    warnSpy.mockRestore();
  });

  it('error de la RPC sin code → error rpc_error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clienteFalso({ rpcResult: { data: null, error: { message: 'x' } } });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'rpc_error',
    });
    warnSpy.mockRestore();
  });

  it('nunca lanza: si crear el cliente falla → error unexpected, sin loguear el detalle', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedCreateClient.mockRejectedValueOnce(
      new Error('fallo con usuario@ejemplo.com'),
    );

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'unexpected',
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    warnSpy.mockRestore();
  });
});
