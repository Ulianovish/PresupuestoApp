import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/services/expense-classification', () => ({
  clasificarGastos: vi.fn(),
  sugerirDesdeHistorial: vi.fn(),
}));

import {
  clasificarGastos,
  sugerirDesdeHistorial,
} from '@/lib/services/expense-classification';
import { createClient } from '@/lib/supabase/server';

import { GET, POST } from './route';

const mockedCreateClient = vi.mocked(createClient);
const mockedClasificar = vi.mocked(clasificarGastos);
const mockedSugerir = vi.mocked(sugerirDesdeHistorial);

const PENDIENTES = [
  {
    id: 't1',
    description: 'Cena',
    amount: 50000,
    category_name: 'GASTOS PERSONALES',
    transaction_date: '2026-09-10',
  },
  {
    id: 't2',
    description: 'Arriendo',
    amount: 1900000,
    category_name: 'VIVIENDA',
    transaction_date: '2026-09-01',
  },
];

function fakeClient(opts: { user?: { id: string } | null } = {}) {
  const user = opts.user === undefined ? { id: 'u1' } : opts.user;
  const rpc = vi.fn(async (name: string) => {
    if (name === 'get_unclassified_expenses') {
      return { data: PENDIENTES, error: null };
    }
    throw new Error(`rpc inesperado: ${name}`);
  });
  const is = vi.fn().mockResolvedValue({
    data: [
      {
        id: 't9',
        description: 'Mercado',
        category_name: 'MERCADO',
        month_year: '2026-09',
      },
    ],
    error: null,
  });
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is,
  };
  const from = vi.fn(() => builder);
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) },
    rpc,
    from,
  };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, rpc, from, builder };
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/expenses/classify', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
  );
}

describe('POST /api/expenses/classify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 sin sesión', async () => {
    fakeClient({ user: null });
    const res = await post({ monthYear: '2026-09' });
    expect(res.status).toBe(401);
    expect(mockedClasificar).not.toHaveBeenCalled();
  });

  it('400 si no viene ni mes ni ids', async () => {
    fakeClient();
    const res = await post({});
    expect(res.status).toBe(400);
  });

  it('por mes: clasifica los pendientes del mes y devuelve los conteos REALES', async () => {
    const { client } = fakeClient();
    mockedClasificar.mockResolvedValue({
      total: 2,
      asignados: [{ expenseId: 't2', budgetItemId: 'arriendo', source: 'ai' }],
      sinPresupuesto: 0,
      sinCoincidencia: 1,
      categoriasCambiadas: 0,
    });

    const res = await post({ monthYear: '2026-09' });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockedClasificar).toHaveBeenCalledWith(client, 'u1', [
      {
        id: 't1',
        description: 'Cena',
        categoryName: 'GASTOS PERSONALES',
        monthYear: '2026-09',
      },
      {
        id: 't2',
        description: 'Arriendo',
        categoryName: 'VIVIENDA',
        monthYear: '2026-09',
      },
    ]);
    expect(json).toEqual({
      total: 2,
      assigned: 1,
      byHistory: 0,
      byAi: 1,
      skippedNoBudget: 0,
      unmatched: 1,
      recategorized: 0,
    });
  });

  it('reporta cuántos se saltaron por no haber presupuesto en el mes', async () => {
    fakeClient();
    mockedClasificar.mockResolvedValue({
      total: 2,
      asignados: [],
      sinPresupuesto: 2,
      sinCoincidencia: 0,
      categoriasCambiadas: 0,
    });

    const json = await (await post({ monthYear: '2026-09' })).json();
    expect(json.assigned).toBe(0);
    expect(json.skippedNoBudget).toBe(2);
  });

  it('por ids: solo los gastos del usuario que siguen sin ítem', async () => {
    const { from, builder } = fakeClient();
    mockedClasificar.mockResolvedValue({
      total: 1,
      asignados: [
        { expenseId: 't9', budgetItemId: 'aseo', source: 'historial' },
      ],
      sinPresupuesto: 0,
      sinCoincidencia: 0,
      categoriasCambiadas: 0,
    });

    const json = await (
      await post({ expenseIds: ['11111111-1111-4111-8111-111111111111'] })
    ).json();

    expect(from).toHaveBeenCalledWith('transactions');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.is).toHaveBeenCalledWith('budget_item_id', null);
    expect(mockedClasificar).toHaveBeenCalledWith(expect.anything(), 'u1', [
      {
        id: 't9',
        description: 'Mercado',
        categoryName: 'MERCADO',
        monthYear: '2026-09',
      },
    ]);
    expect(json.byHistory).toBe(1);
    expect(json.assigned).toBe(1);
  });

  it('marca como ADIVINADA solo la categoría de los ids que el cliente dice (import con palabras clave)', async () => {
    fakeClient();
    mockedClasificar.mockResolvedValue({
      total: 1,
      asignados: [
        { expenseId: 't9', budgetItemId: 'aseo', source: 'historial' },
      ],
      sinPresupuesto: 0,
      sinCoincidencia: 0,
      categoriasCambiadas: 1,
    });

    const json = await (
      await post({
        expenseIds: ['11111111-1111-4111-8111-111111111111'],
        guessedCategoryIds: ['t9'],
      })
    ).json();

    expect(mockedClasificar).toHaveBeenCalledWith(expect.anything(), 'u1', [
      {
        id: 't9',
        description: 'Mercado',
        categoryName: 'MERCADO',
        monthYear: '2026-09',
        categoriaAdivinada: true,
      },
    ]);
    // La UI lo avisa: "N cambiaron de categoría".
    expect(json.recategorized).toBe(1);
  });
});

describe('GET /api/expenses/classify', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve las sugerencias del historial para los pendientes del mes (sin asignar)', async () => {
    fakeClient();
    mockedSugerir.mockResolvedValue({
      t2: { budgetItemId: 'arriendo', source: 'historial' },
    });

    const res = await GET(
      new Request('http://localhost/api/expenses/classify?monthYear=2026-09'),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({
      suggestions: { t2: { budgetItemId: 'arriendo', source: 'historial' } },
    });
    expect(mockedSugerir.mock.calls[0][2]).toHaveLength(2);
    expect(mockedClasificar).not.toHaveBeenCalled();
  });

  it('400 con un mes inválido', async () => {
    fakeClient();
    const res = await GET(
      new Request('http://localhost/api/expenses/classify?monthYear=sept'),
    );
    expect(res.status).toBe(400);
  });
});
