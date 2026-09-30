import { describe, expect, it, vi } from 'vitest';

import { getPostLoginPath } from './post-login';

import type { SupabaseClient } from '@supabase/supabase-js';

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';

/** Cliente falso: from('profiles').select(...).eq(...).maybeSingle(). */
function clienteFalso(resultado: { data: unknown; error: unknown } | Error) {
  const maybeSingle =
    resultado instanceof Error
      ? vi.fn().mockRejectedValue(resultado)
      : vi.fn().mockResolvedValue(resultado);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const client = { from } as unknown as SupabaseClient;
  return { client, from, select, eq, maybeSingle };
}

describe('getPostLoginPath', () => {
  it('onboarding sin terminar → /bienvenida, consultando el perfil del usuario', async () => {
    const { client, from, select, eq } = clienteFalso({
      data: { onboarding_completed_at: null },
      error: null,
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe(
      '/bienvenida',
    );
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('onboarding_completed_at');
    expect(eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('onboarding terminado → /dashboard', async () => {
    const { client } = clienteFalso({
      data: { onboarding_completed_at: '2026-09-30T15:00:00.000Z' },
      error: null,
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('error de la consulta (columna aún no existe) → /dashboard', async () => {
    const { client } = clienteFalso({
      data: null,
      error: {
        code: '42703',
        message: 'column profiles.onboarding_completed_at does not exist',
      },
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('sin fila de perfil → /dashboard', async () => {
    const { client } = clienteFalso({ data: null, error: null });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('si la consulta lanza → /dashboard', async () => {
    const { client } = clienteFalso(new Error('fetch failed'));

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });
});
