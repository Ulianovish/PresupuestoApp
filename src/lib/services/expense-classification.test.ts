import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dian/expense-item-classifier', () => ({
  classifyExpensesToItems: vi.fn(),
}));

import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';
import { construirHistorial } from '@/lib/dian/historial-clasificacion';

import {
  clasificarGastos,
  sugerirDesdeHistorial,
} from './expense-classification';

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
  // update(...).eq(...).eq(...) para corregir la categoría de un gasto OTROS
  const eqFinal = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: vi.fn(() => ({ eq: eqFinal })) }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { rpc, from } as unknown as Parameters<typeof clasificarGastos>[0],
    rpc,
    from,
    update,
  };
}

const HISTORIAL = construirHistorial([
  {
    description:
      'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
    category_name: 'VIVIENDA',
    transaction_date: '2026-08-15',
    budget_items: { name: 'Arriendo', categories: { name: 'VIVIENDA' } },
  },
  {
    description: 'Cena',
    category_name: 'GASTOS PERSONALES',
    transaction_date: '2026-09-01',
    budget_items: {
      name: 'Restaurantes',
      categories: { name: 'GASTOS PERSONALES' },
    },
  },
]);

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

  it('reutiliza el historial manual antes que la IA (origen "historial")', async () => {
    mockedClassify.mockImplementation(async items => items.map(() => null));
    const { client, rpc } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
    });

    const r = await clasificarGastos(
      client,
      'u1',
      [
        {
          id: 't1',
          description: 'cena',
          categoryName: 'GASTOS PERSONALES',
          monthYear: '2026-09',
        },
        {
          id: 't2',
          description: 'Otra cosa',
          categoryName: 'GASTOS PERSONALES',
          monthYear: '2026-09',
        },
      ],
      { historial: HISTORIAL },
    );

    expect(r.asignados).toEqual([
      { expenseId: 't1', budgetItemId: 'rest', source: 'historial' },
    ]);
    expect(rpc).toHaveBeenCalledWith('assign_expense_budget_item', {
      p_user_id: 'u1',
      p_transaction_id: 't1',
      p_budget_item_id: 'rest',
      p_source: 'historial',
    });
    // Solo el que no estaba en el historial va a la IA.
    expect(mockedClassify).toHaveBeenCalledTimes(1);
    expect(mockedClassify.mock.calls[0][0]).toEqual([
      { description: 'Otra cosa' },
    ]);
  });

  it('un gasto con categoría ADIVINADA que el historial reconoce toma también la categoría (y se cuenta)', async () => {
    const { client, from, update } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
    });

    const r = await clasificarGastos(
      client,
      'u1',
      [
        {
          id: 't1',
          description:
            'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
          categoryName: 'OTROS',
          monthYear: '2026-09',
          categoriaAdivinada: true,
        },
      ],
      { historial: HISTORIAL },
    );

    expect(from).toHaveBeenCalledWith('transactions');
    expect(update).toHaveBeenCalledWith({ category_name: 'VIVIENDA' });
    expect(r.asignados).toEqual([
      { expenseId: 't1', budgetItemId: 'arriendo', source: 'historial' },
    ]);
    expect(r.categoriasCambiadas).toBe(1);
    expect(mockedClassify).not.toHaveBeenCalled();
  });

  it('OTROS elegido por el usuario NO se reescribe desde el historial: sigue la IA en OTROS', async () => {
    mockedClassify.mockImplementation(async items => items.map(() => null));
    const { client, update } = fakeSupabase({
      itemsPorMes: {
        '2026-09': [
          ...ITEMS_SEPT,
          { item_id: 'varios', item_name: 'Varios', category_name: 'OTROS' },
        ],
      },
    });

    const r = await clasificarGastos(
      client,
      'u1',
      [
        {
          id: 't1',
          description:
            'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
          categoryName: 'OTROS',
          monthYear: '2026-09',
        },
      ],
      { historial: HISTORIAL },
    );

    expect(update).not.toHaveBeenCalled();
    expect(r.categoriasCambiadas).toBe(0);
    expect(mockedClassify).toHaveBeenCalledWith(
      [
        {
          description:
            'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
        },
      ],
      ['Varios'],
    );
  });
});

describe('sugerirDesdeHistorial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sugiere (sin asignar) el ítem del historial, solo si la categoría coincide', async () => {
    const { client, rpc } = fakeSupabase({
      itemsPorMes: { '2026-09': ITEMS_SEPT },
    });

    const sug = await sugerirDesdeHistorial(
      client,
      'u1',
      [
        {
          id: 't1',
          description: 'Cena',
          categoryName: 'GASTOS PERSONALES',
          monthYear: '2026-09',
        },
        // En OTROS: la sugerencia implicaría cambiar la categoría; eso lo hace
        // "Clasificar con IA", no el desplegable.
        {
          id: 't2',
          description:
            'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
          categoryName: 'OTROS',
          monthYear: '2026-09',
        },
        {
          id: 't3',
          description: 'Nada que ver',
          categoryName: 'VIVIENDA',
          monthYear: '2026-09',
        },
      ],
      { historial: HISTORIAL },
    );

    expect(sug).toEqual({ t1: { budgetItemId: 'rest', source: 'historial' } });
    expect(rpc).not.toHaveBeenCalledWith(
      'assign_expense_budget_item',
      expect.anything(),
    );
    expect(mockedClassify).not.toHaveBeenCalled();
  });
});
