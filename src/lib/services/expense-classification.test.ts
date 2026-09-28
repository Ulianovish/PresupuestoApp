import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dian/expense-item-classifier', () => ({
  classifyExpensesToItems: vi.fn(),
}));

import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';

import { clasificarGastos } from './expense-classification';

const mockedClassify = vi.mocked(classifyExpensesToItems);

const ITEMS_SEPT = [
  {
    item_id: 'rest',
    item_name: 'Restaurantes',
    category_name: 'GASTOS PERSONALES',
  },
  { item_id: 'cine', item_name: 'Cine', category_name: 'GASTOS PERSONALES' },
  { item_id: 'arriendo', item_name: 'Arriendo', category_name: 'VIVIENDA' },
];

/** Fake de supabase: ítems por mes y RPC de asignación configurable. */
function fakeSupabase(opts: {
  itemsPorMes?: Record<string, typeof ITEMS_SEPT>;
  assignError?: { message: string } | null;
}) {
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'get_budget_items_for_month') {
      const mes = args.p_month_year as string;
      return { data: opts.itemsPorMes?.[mes] ?? [], error: null };
    }
    if (name === 'assign_expense_budget_item') {
      return { error: opts.assignError ?? null };
    }
    throw new Error(`rpc inesperado: ${name}`);
  });
  return {
    client: { rpc } as unknown as Parameters<typeof clasificarGastos>[0],
    rpc,
  };
}

describe('clasificarGastos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('asigna con IA dentro de la categoría y reporta el número REAL asignado', async () => {
    mockedClassify.mockImplementation(async items =>
      items.map(it => (it.description === 'Cena' ? 'Restaurantes' : null)),
    );
    const { client, rpc } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
    });

    const r = await clasificarGastos(client, 'u1', [
      {
        id: 't1',
        description: 'Cena',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-09',
      },
      {
        id: 't2',
        description: 'Algo raro',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-09',
      },
    ]);

    expect(r.total).toBe(2);
    expect(r.asignados).toEqual([
      { expenseId: 't1', budgetItemId: 'rest', source: 'ai' },
    ]);
    expect(r.sinCoincidencia).toBe(1);
    expect(r.sinPresupuesto).toBe(0);
    expect(rpc).toHaveBeenCalledWith('assign_expense_budget_item', {
      p_user_id: 'u1',
      p_transaction_id: 't1',
      p_budget_item_id: 'rest',
      p_source: 'ai',
    });
  });

  it('cuenta aparte los gastos de meses sin presupuesto (y no llama a la IA)', async () => {
    const { client } = fakeSupabase({ itemsPorMes: {} });

    const r = await clasificarGastos(client, 'u1', [
      {
        id: 't1',
        description: 'Cena',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-11',
      },
      {
        id: 't2',
        description: 'Cine',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-11',
      },
    ]);

    expect(r.asignados).toEqual([]);
    expect(r.sinPresupuesto).toBe(2);
    expect(r.sinCoincidencia).toBe(0);
    expect(mockedClassify).not.toHaveBeenCalled();
  });

  it('si el RPC de asignación falla, el gasto NO cuenta como asignado', async () => {
    mockedClassify.mockImplementation(async items => items.map(() => 'Cine'));
    const { client } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
      assignError: { message: 'boom' },
    });

    const r = await clasificarGastos(client, 'u1', [
      {
        id: 't1',
        description: 'Cine',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-09',
      },
    ]);

    expect(r.asignados).toEqual([]);
    expect(r.sinCoincidencia).toBe(1);
  });

  it('compara la categoría sin distinguir mayúsculas ni tildes', async () => {
    mockedClassify.mockImplementation(async items =>
      items.map(() => 'Arriendo'),
    );
    const { client } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
    });

    const r = await clasificarGastos(client, 'u1', [
      {
        id: 't1',
        description: 'Arriendo',
        categoryName: 'Vivienda',
        monthYear: '2026-09',
      },
    ]);

    expect(r.asignados).toHaveLength(1);
  });
});
