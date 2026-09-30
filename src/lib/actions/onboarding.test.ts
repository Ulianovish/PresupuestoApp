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
  completeOnboardingAction,
  dismissChecklistAction,
  ensureStarterKitAction,
  saveOnboardingBudgetAction,
  saveOnboardingIncomeAction,
} from './onboarding';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';

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

describe('saveOnboardingBudgetAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('actualiza solo budgeted_amount de cada rubro, filtrando por id y user_id', async () => {
    const { llamadas } = clienteFalso();

    const r = await saveOnboardingBudgetAction({
      [ITEM_A]: 1_200_000,
      [ITEM_B]: 0,
    });

    expect(r).toEqual({ ok: true });
    const updates = llamadasDe(llamadas, 'budget_items', 'update');
    expect(updates.map(u => u.args[0])).toEqual([
      { budgeted_amount: 1_200_000 },
      { budgeted_amount: 0 },
    ]);
    const filtros = llamadasDe(llamadas, 'budget_items', 'eq').map(l => l.args);
    expect(filtros).toContainEqual(['id', ITEM_A]);
    expect(filtros).toContainEqual(['id', ITEM_B]);
    expect(filtros.filter(f => f[0] === 'user_id')).toEqual([
      ['user_id', USER_ID],
      ['user_id', USER_ID],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/presupuesto');
  });

  it.each([-1, 1000.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'monto inválido (%s) → error sin tocar la DB',
    async monto => {
      const { client } = clienteFalso();

      const r = await saveOnboardingBudgetAction({ [ITEM_A]: monto });

      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/pesos enteros/i);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it('id que no es uuid → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    const r = await saveOnboardingBudgetAction({ 'otro-rubro': 1000 });

    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin montos → ok sin tocar la DB', async () => {
    clienteFalso();

    expect(await saveOnboardingBudgetAction({})).toEqual({ ok: true });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin sesión → No autenticado', async () => {
    const { client } = clienteFalso({ user: null });

    expect(await saveOnboardingBudgetAction({ [ITEM_A]: 1000 })).toEqual({
      ok: false,
      error: 'No autenticado',
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('error de la DB → mensaje genérico y no revalida', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: {
        budget_items: { data: null, error: { code: '42501', message: 'x' } },
      },
    });

    const r = await saveOnboardingBudgetAction({ [ITEM_A]: 1000 });

    expect(r).toEqual({
      ok: false,
      error: 'No pudimos guardar tu presupuesto. Intenta de nuevo.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

const AHORA = '2026-09-30T15:00:00.000Z';

describe('completeOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
  });
  afterEach(() => vi.useRealTimers());

  it('marca onboarding_completed_at del propio usuario y lleva al dashboard', async () => {
    const { llamadas } = clienteFalso();

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );

    const updates = llamadasDe(llamadas, 'profiles', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0]).toEqual({ onboarding_completed_at: AHORA });
    expect(llamadasDe(llamadas, 'profiles', 'eq')[0].args).toEqual([
      'id',
      USER_ID,
    ]);
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('sin sesión → login y no toca profiles', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login',
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('si el UPDATE falla igual lleva al dashboard (no deja al usuario atrapado)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: { profiles: { data: null, error: { code: '42703' } } },
    });

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('dismissChecklistAction (§5.2: devuelve { ok } y nunca lanza)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('marca onboarding_dismissed_at del propio usuario y devuelve ok: true', async () => {
    const { llamadas } = clienteFalso();

    await expect(dismissChecklistAction()).resolves.toEqual({ ok: true });

    expect(llamadasDe(llamadas, 'profiles', 'update')[0].args[0]).toEqual({
      onboarding_dismissed_at: AHORA,
    });
    expect(llamadasDe(llamadas, 'profiles', 'eq')[0].args).toEqual([
      'id',
      USER_ID,
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('sin sesión → ok: false y no toca profiles', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(dismissChecklistAction()).resolves.toEqual({ ok: false });
    expect(client.from).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('si el UPDATE falla → ok: false, console.warn solo con el code y sin revalidar', async () => {
    clienteFalso({
      results: {
        profiles: {
          data: null,
          error: { code: '42703', message: 'fallo con usuario@ejemplo.com' },
        },
      },
    });

    await expect(dismissChecklistAction()).resolves.toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), '42703');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('nunca lanza: si crear el cliente falla → ok: false, sin loguear el detalle', async () => {
    mockedCreateClient.mockRejectedValueOnce(
      new Error('fallo con usuario@ejemplo.com'),
    );

    await expect(dismissChecklistAction()).resolves.toEqual({ ok: false });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
  });
});
