import { beforeEach, describe, expect, it, vi } from 'vitest';

// `budget.ts` instancia el cliente UNA sola vez a nivel de módulo
// (`const supabase = createClient();`), así que no alcanza con
// `mockReturnValue` por test: hay que fijar los `vi.fn()` ANTES de que el
// mock de `@/lib/supabase/client` se evalúe. `vi.hoisted` es la forma segura
// de vitest de lograr eso (evita el problema de orden que rompería un mock
// armado con variables normales).
const { mockGetUser, mockRpc, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

import { getBudgetByMonth } from './budget';

/** Cadena mínima de `from('categories').select().eq().eq().order()`. */
function fakeCategoriesChain(rows: Array<{ id: string; name: string }>) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn().mockResolvedValue({ data: rows, error: null });
  return chain;
}

describe('getBudgetByMonth', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('mapea alerts_enabled de la fila del RPC a alertsEnabled del item, en sus tres estados', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          template_id: 't1',
          template_name: 'Presupuesto Septiembre',
          category_id: 'c1',
          category_name: 'MERCADO',
          item_id: 'i-false',
          item_name: 'Dulces',
          due_date: '',
          classification_name: 'Variable',
          control_name: 'Reducir',
          budgeted_amount: 150000,
          real_amount: 0,
          deuda_id: null,
          alerts_enabled: false,
        },
        {
          template_id: 't1',
          template_name: 'Presupuesto Septiembre',
          category_id: 'c1',
          category_name: 'MERCADO',
          item_id: 'i-true',
          item_name: 'Cine',
          due_date: '',
          classification_name: 'Basico',
          control_name: 'Reducir',
          budgeted_amount: 60000,
          real_amount: 0,
          deuda_id: null,
          alerts_enabled: true,
        },
        {
          template_id: 't1',
          template_name: 'Presupuesto Septiembre',
          category_id: 'c1',
          category_name: 'MERCADO',
          item_id: 'i-null',
          item_name: 'Arena',
          due_date: '',
          classification_name: 'Variable',
          control_name: 'Reducir',
          budgeted_amount: 17000,
          real_amount: 0,
          deuda_id: null,
          alerts_enabled: null,
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(
      fakeCategoriesChain([{ id: 'c1', name: 'MERCADO' }]),
    );

    const result = await getBudgetByMonth('2026-09');
    const items = result?.categories.find(c => c.id === 'c1')?.items ?? [];
    const byId = Object.fromEntries(items.map(i => [i.id, i]));

    // Esta es exactamente la regresión que se coló: sin `alerts_enabled` en
    // el RETURNS TABLE de get_budget_by_month (o sin este mapeo), los tres
    // casos habrían llegado como `undefined`, y el formulario los habría
    // mandado de vuelta como `null` en el siguiente guardado, pisando el
    // override del usuario en silencio.
    expect(byId['i-false'].alertsEnabled).toBe(false);
    expect(byId['i-true'].alertsEnabled).toBe(true);
    expect(byId['i-null'].alertsEnabled).toBeNull();
  });
});
