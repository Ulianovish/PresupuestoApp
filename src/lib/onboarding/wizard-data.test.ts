import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database';

import { loadWizardData } from './wizard-data';

import type { SupabaseClient } from '@supabase/supabase-js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function clienteFalso({
  rpcResult = { data: [], error: null } as Resultado,
  categoriasResult = { data: [], error: null } as Resultado,
} = {}) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (
      resolve: (r: Resultado) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(categoriasResult).then(resolve, reject),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  const client = {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn(() => chain),
  };
  return {
    client,
    chain,
    supabase: client as unknown as SupabaseClient<Database>,
  };
}

const FILAS = [
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: 'c1',
    category_name: 'VIVIENDA',
    item_id: ITEM_A,
    item_name: 'Arriendo o cuota',
    classification_name: 'Basico',
    budgeted_amount: '0',
  },
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: 'c1',
    category_name: 'VIVIENDA',
    item_id: ITEM_B,
    item_name: 'Internet',
    classification_name: 'Calidad de Vida',
    budgeted_amount: 120000,
  },
  // Plantilla sin rubros: el LEFT JOIN devuelve la fila con item_id null.
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: null,
    category_name: null,
    item_id: null,
    item_name: null,
    classification_name: null,
    budgeted_amount: null,
  },
];

describe('loadWizardData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide el presupuesto del mes del propio usuario y mapea los rubros', async () => {
    const { client, supabase } = clienteFalso({
      rpcResult: { data: FILAS, error: null },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(client.rpc).toHaveBeenCalledWith('get_budget_by_month', {
      p_user_id: USER_ID,
      p_month_year: '2026-09',
    });
    expect(r.items).toEqual([
      {
        id: ITEM_A,
        name: 'Arriendo o cuota',
        categoryName: 'VIVIENDA',
        classificationName: 'Basico',
        budgetedAmount: 0,
      },
      {
        id: ITEM_B,
        name: 'Internet',
        categoryName: 'VIVIENDA',
        classificationName: 'Calidad de Vida',
        budgetedAmount: 120000,
      },
    ]);
  });

  it('devuelve los nombres de las categorías activas del usuario', async () => {
    const { client, chain, supabase } = clienteFalso({
      categoriasResult: {
        data: [{ name: 'MERCADO' }, { name: 'OTROS' }],
        error: null,
      },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(client.from).toHaveBeenCalledWith('categories');
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
    expect(r.categoryNames).toEqual(['MERCADO', 'OTROS']);
  });

  it('si la RPC falla → sin rubros, y loguea solo el código', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { supabase } = clienteFalso({
      rpcResult: {
        data: null,
        error: { code: '42501', message: 'no autorizado usuario@ejemplo.com' },
      },
      categoriasResult: { data: [{ name: 'OTROS' }], error: null },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(r).toEqual({ items: [], categoryNames: ['OTROS'] });
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    errorSpy.mockRestore();
  });

  it('si la consulta de categorías falla → sin categorías', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { supabase } = clienteFalso({
      rpcResult: { data: FILAS, error: null },
      categoriasResult: { data: null, error: { code: '42P01' } },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(r.categoryNames).toEqual([]);
    expect(r.items).toHaveLength(2);
    errorSpy.mockRestore();
  });
});
