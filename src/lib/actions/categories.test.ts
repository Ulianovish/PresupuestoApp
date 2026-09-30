import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/budget/item-defaults-supabase', () => ({
  resolveBudgetItemDefaults: vi.fn(),
}));

import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import { createClient } from '@/lib/supabase/server';

import {
  createBudgetItemInMonth,
  createDefaultBudgetItemForCategory,
} from './categories';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedResolve = resolveBudgetItemDefaults as unknown as ReturnType<
  typeof vi.fn
>;

const IDS = {
  classificationId: 'cls-elegida',
  controlId: 'ctl-elegido',
  statusId: 'st-activo',
};
const GENERAL = { classification: 'Estilo de Vida', control: 'Reducir' };
const DEUDA = { classification: 'Basico', control: 'Necesario' };

/**
 * Cadena falsa de PostgREST: todos los métodos devuelven la misma cadena y,
 * al hacer await (directo, o vía single/maybeSingle), resuelve `resultado`.
 */
function cadena(resultado: unknown) {
  const chain: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'ilike', 'order', 'insert']) {
    chain[metodo] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(resultado);
  chain.maybeSingle = vi.fn().mockResolvedValue(resultado);
  chain.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
    Promise.resolve(resultado).then(ok, ko);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}

function clienteFalso({
  user = { id: 'user-1' } as { id: string } | null,
  categoria = { name: 'VIVIENDA' } as { name: string } | null,
} = {}) {
  const categories = cadena({ data: categoria, error: null });
  const budgetItems = cadena({ data: { id: 'item-1' }, error: null });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: 'tpl-1', error: null }),
    from: vi.fn((tabla: string) =>
      tabla === 'categories' ? categories : budgetItems,
    ),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, categories, budgetItems };
}

describe('createDefaultBudgetItemForCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('pide Estilo de Vida / Reducir y los inserta en el rubro', async () => {
    const { client, budgetItems } = clienteFalso();

    const r = await createDefaultBudgetItemForCategory(
      'cat-1',
      'VIVIENDA',
      '2026-09',
    );

    expect(r).toEqual({ success: true });
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
    expect(budgetItems.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        template_id: 'tpl-1',
        category_id: 'cat-1',
        name: 'VIVIENDA',
        classification_id: 'cls-elegida',
        control_id: 'ctl-elegido',
        status_id: 'st-activo',
      }),
    );
  });

  it('categoría DEUDAS → pide Basico / Necesario', async () => {
    const { client } = clienteFalso();

    await createDefaultBudgetItemForCategory('cat-2', 'DEUDAS', '2026-09');

    expect(mockedResolve).toHaveBeenCalledWith(client, DEUDA);
  });

  it('sin valores por defecto → error y no inserta', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { budgetItems } = clienteFalso();

    const r = await createDefaultBudgetItemForCategory(
      'cat-1',
      'VIVIENDA',
      '2026-09',
    );

    expect(r).toEqual({
      success: false,
      error: 'No se pudieron obtener los valores por defecto del ítem',
    });
    expect(budgetItems.insert).not.toHaveBeenCalled();
  });
});

describe('createBudgetItemInMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('lee el nombre de la categoría del usuario y usa los valores generales', async () => {
    const { client, categories, budgetItems } = clienteFalso();

    const r = await createBudgetItemInMonth('cat-1', '  Arriendo ', '2026-09');

    expect(r).toEqual({ success: true, itemId: 'item-1' });
    expect(categories.select).toHaveBeenCalledWith('name');
    expect(categories.eq).toHaveBeenCalledWith('id', 'cat-1');
    expect(categories.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
    expect(budgetItems.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-1',
        name: 'Arriendo',
        classification_id: 'cls-elegida',
        control_id: 'ctl-elegido',
        status_id: 'st-activo',
      }),
    );
  });

  it('categoría DEUDAS → pide Basico / Necesario', async () => {
    const { client } = clienteFalso({ categoria: { name: 'Deudas' } });

    await createBudgetItemInMonth('cat-2', 'Tarjeta', '2026-09');

    expect(mockedResolve).toHaveBeenCalledWith(client, DEUDA);
  });

  it('categoría no encontrada → valores generales, igual crea el rubro', async () => {
    const { client } = clienteFalso({ categoria: null });

    const r = await createBudgetItemInMonth('cat-x', 'Algo', '2026-09');

    expect(r).toEqual({ success: true, itemId: 'item-1' });
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
  });

  it('sin valores por defecto → error y no inserta', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { budgetItems } = clienteFalso();

    const r = await createBudgetItemInMonth('cat-1', 'Arriendo', '2026-09');

    expect(r).toEqual({
      success: false,
      error: 'No se pudieron obtener los valores por defecto del ítem',
    });
    expect(budgetItems.insert).not.toHaveBeenCalled();
  });
});
