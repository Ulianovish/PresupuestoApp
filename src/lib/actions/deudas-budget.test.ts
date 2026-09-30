import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/budget/item-defaults-supabase', () => ({
  resolveBudgetItemDefaults: vi.fn(),
}));

import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import { createClient } from '@/lib/supabase/server';
import { cadena } from '@/test-utils/postgrest-chain';

import { createBudgetItemsForDeuda } from './deudas-budget';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedResolve = resolveBudgetItemDefaults as unknown as ReturnType<
  typeof vi.fn
>;

const IDS = {
  classificationId: 'cls-basico',
  controlId: 'ctl-necesario',
  statusId: 'st-activo',
};

/**
 * budget_items se consulta dos veces: primero los templates que ya tienen
 * ítem para la deuda, después el insert. Se sirven en ese orden.
 */
function clienteFalso() {
  const categories = cadena({ data: { id: 'cat-deudas' }, error: null });
  const templates = cadena({
    data: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
    error: null,
  });
  const existentes = cadena({ data: [{ template_id: 'tpl-2' }], error: null });
  const insert = cadena({ error: null });
  const colaItems = [existentes, insert];

  const client = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((tabla: string) => {
      if (tabla === 'categories') return categories;
      if (tabla === 'budget_templates') return templates;
      return colaItems.shift();
    }),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, insert };
}

describe('createBudgetItemsForDeuda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('pide Basico / Necesario por nombre y los pone en los rubros nuevos', async () => {
    const { client, insert } = clienteFalso();

    const r = await createBudgetItemsForDeuda('deuda-1', 'Tarjeta X');

    expect(r).toEqual({ success: true });
    expect(mockedResolve).toHaveBeenCalledWith(client, {
      classification: 'Basico',
      control: 'Necesario',
    });
    expect(insert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        template_id: 'tpl-1',
        category_id: 'cat-deudas',
        name: 'Tarjeta X',
        deuda_id: 'deuda-1',
        classification_id: 'cls-basico',
        control_id: 'ctl-necesario',
        status_id: 'st-activo',
      }),
    ]);
  });

  it('sin valores por defecto → error y no consulta templates', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { client } = clienteFalso();

    const r = await createBudgetItemsForDeuda('deuda-1', 'Tarjeta X');

    expect(r).toEqual({ success: false, error: 'Faltan valores por defecto' });
    expect(client.from).not.toHaveBeenCalledWith('budget_templates');
  });
});
