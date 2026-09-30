import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  // Como en Next: redirect() corta la ejecución lanzando.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/whatsapp/format', () => ({ todayBogota: () => '2026-09-15' }));

import { createClient } from '@/lib/supabase/server';

import {
  ensureStarterKitAction,
  saveOnboardingIncomeAction,
} from './onboarding';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface Llamada {
  table: string;
  method: string;
  args: unknown[];
}

const METODOS = [
  'insert',
  'update',
  'select',
  'eq',
  'order',
  'single',
  'maybeSingle',
] as const;

/**
 * Cliente de cookie falso. Cada `from(tabla)` devuelve una cadena "thenable"
 * que registra cada método llamado y, al hacer `await`, resuelve con
 * `results[tabla]` (por defecto sin error). Conserva la firma del de S10
 * (`{ user, rpcResult }` → `{ client }`), así sus tests siguen igual.
 */
function clienteFalso({
  user = { id: USER_ID } as { id: string } | null,
  results = {} as Record<string, Resultado>,
  rpcResult = { data: true, error: null } as Resultado,
} = {}) {
  const llamadas: Llamada[] = [];
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      then: (
        resolve: (r: Resultado) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    for (const metodo of METODOS) {
      chain[metodo] = vi.fn((...args: unknown[]) => {
        llamadas.push({ table, method: metodo, args });
        return chain;
      });
    }
    return chain;
  });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, llamadas };
}

function llamadasDe(llamadas: Llamada[], table: string, method: string) {
  return llamadas.filter(l => l.table === table && l.method === method);
}

describe('ensureStarterKitAction', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // Restaura el spy aunque una aserción falle antes del final del test.
  afterEach(() => vi.restoreAllMocks());

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
  });

  it('error de la RPC sin code → error rpc_error', async () => {
    clienteFalso({ rpcResult: { data: null, error: { message: 'x' } } });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'rpc_error',
    });
  });

  it('nunca lanza: si crear el cliente falla → error unexpected, sin loguear el detalle', async () => {
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
  });
});

describe('ensureStarterKitAction durante el render (§5.2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no revalida ni redirige, ni con éxito, ni sin sesión, ni con error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    clienteFalso();
    await ensureStarterKitAction();
    clienteFalso({ user: null });
    await ensureStarterKitAction();
    clienteFalso({ rpcResult: { data: null, error: { code: 'PGRST202' } } });
    await ensureStarterKitAction();

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('saveOnboardingIncomeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guarda el ingreso del usuario con la fecha de hoy en Bogotá', async () => {
    const { llamadas } = clienteFalso();

    const r = await saveOnboardingIncomeAction({
      monto: 3_500_000,
      fuente: '  Salario ',
    });

    expect(r).toEqual({ ok: true });
    const inserts = llamadasDe(llamadas, 'ingresos', 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[0]).toEqual({
      user_id: USER_ID,
      descripcion: 'Ingreso mensual',
      fuente: 'Salario',
      monto: 3_500_000,
      fecha: '2026-09-15',
      tipo: 'ingreso',
    });
  });

  it.each([0, -100_000, 1500.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'monto inválido (%s) → error sin tocar la DB',
    async monto => {
      const { client } = clienteFalso();

      const r = await saveOnboardingIncomeAction({ monto, fuente: 'Salario' });

      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/ingreso/i);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it('fuente vacía → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    const r = await saveOnboardingIncomeAction({
      monto: 1_000_000,
      fuente: '   ',
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/de dónde/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin sesión → No autenticado', async () => {
    const { client } = clienteFalso({ user: null });

    expect(
      await saveOnboardingIncomeAction({ monto: 1_000_000, fuente: 'Salario' }),
    ).toEqual({ ok: false, error: 'No autenticado' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('error de la DB → mensaje genérico y no loguea el monto', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: {
        ingresos: {
          data: null,
          error: { code: '23514', message: 'Failing row contains (3500000)' },
        },
      },
    });

    const r = await saveOnboardingIncomeAction({
      monto: 3_500_000,
      fuente: 'Salario',
    });

    expect(r).toEqual({
      ok: false,
      error: 'No pudimos guardar tu ingreso. Intenta de nuevo.',
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('3500000');
    errorSpy.mockRestore();
  });
});
