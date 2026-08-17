import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import {
  applyCorrection,
  correctLastExpense,
  queryExpenseTotal,
} from '@/lib/services/whatsapp-queries';
import { createAdminClient } from '@/lib/supabase/server';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

const ULTIMO = {
  kind: 'expense' as const,
  transactionId: 'tx-1',
  amount: 45000,
  description: 'mercado',
  accountName: 'Efectivo',
  category: 'MERCADO',
  date: '2026-08-17',
};

describe('applyCorrection', () => {
  it('corrige el monto interpretando "30 mil"', () => {
    const r = applyCorrection(ULTIMO, 'monto', '30 mil');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.amount).toBe(30000);
  });

  it('corrige el monto interpretando "30k"', () => {
    const r = applyCorrection(ULTIMO, 'monto', '30k');
    if (r.ok) expect(r.patch.amount).toBe(30000);
  });

  it('rechaza un monto que no se puede interpretar', () => {
    expect(applyCorrection(ULTIMO, 'monto', 'como cinco').ok).toBe(false);
  });

  it('rechaza un monto por encima del tope de 100 millones', () => {
    // Mismo tope que `validateGasto` al dar de alta: un typo tipo "300000k"
    // (300 millones) no puede colarse por la corrección cuando el alta lo
    // rechaza.
    const r = applyCorrection(ULTIMO, 'monto', '300000k');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tope/i);
  });

  it('corrige la descripción', () => {
    const r = applyCorrection(ULTIMO, 'descripcion', 'mercado del mes');
    if (r.ok) expect(r.patch.description).toBe('mercado del mes');
  });

  it('corrige la cuenta', () => {
    const r = applyCorrection(ULTIMO, 'cuenta', 'Nequi');
    if (r.ok) expect(r.patch.accountName).toBe('Nequi');
  });

  it('corrige la fecha solo en formato válido', () => {
    expect(applyCorrection(ULTIMO, 'fecha', '2026-08-16').ok).toBe(true);
    expect(applyCorrection(ULTIMO, 'fecha', '16/08/2026').ok).toBe(false);
  });

  it('rechaza un campo desconocido', () => {
    expect(applyCorrection(ULTIMO, 'color', 'rojo').ok).toBe(false);
  });

  it('acepta el campo item con un patch vacío: el ítem no vive en LastEntity', () => {
    const r = applyCorrection(ULTIMO, 'item', 'Mercado quincenal');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch).toEqual({});
  });

  it('rechaza un item vacío', () => {
    expect(applyCorrection(ULTIMO, 'item', '  ').ok).toBe(false);
  });
});

describe('correctLastExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Cadena mínima de `update().eq().eq().select()` que resuelve `result`. */
  function fakeTransactionsUpdate(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn().mockResolvedValue(result);
    return chain;
  }

  it('devuelve ok:false y un mensaje útil si el gasto ya no existe (el update no afecta filas)', async () => {
    // Supabase no manda `error` cuando el `.eq()` no matchea ninguna fila
    // (p. ej. el usuario borró el gasto en la app antes de corregirlo por
    // chat) — por eso el chequeo es sobre `data`, no sobre `error`.
    const chain = fakeTransactionsUpdate({ data: [], error: null });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '30 mil');

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ya no existe|borrado/i);
  });

  it('actualiza cuando el update sí afecta una fila', async () => {
    const chain = fakeTransactionsUpdate({
      data: [{ id: 'tx-1' }],
      error: null,
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '30 mil');

    expect(res.ok).toBe(true);
  });

  it('rechaza un monto por encima del tope sin llamar a la base', async () => {
    const from = vi.fn();
    mockedAdmin.mockReturnValue({ from });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '300000k');

    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it('corregir el item asigna el ítem del mes y lo marca manual (la IA no lo revierte)', async () => {
    const chain = fakeTransactionsUpdate({
      data: [{ id: 'tx-1' }],
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          item_id: 'item-9',
          item_name: 'Mercado quincenal',
          category_name: 'MERCADO',
        },
      ],
      error: null,
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain), rpc });

    // Sin tildes ni mayúsculas exactas: igual tiene que resolver.
    const res = await correctLastExpense(
      'user-1',
      ULTIMO,
      'item',
      'mercado quincenal',
    );

    expect(res.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith('get_budget_items_for_month', {
      p_user_id: 'user-1',
      p_month_year: '2026-08',
    });
    expect(chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        budget_item_id: 'item-9',
        budget_item_source: 'manual',
      }),
    );
  });

  it('un item que no está en el presupuesto del mes no se inventa: falla y lista los reales', async () => {
    const chain = fakeTransactionsUpdate({
      data: [{ id: 'tx-1' }],
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          item_id: 'item-9',
          item_name: 'Mercado quincenal',
          category_name: 'MERCADO',
        },
      ],
      error: null,
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain), rpc });

    const res = await correctLastExpense('user-1', ULTIMO, 'item', 'Antojos');

    expect(res.ok).toBe(false);
    expect(res.error).toContain('Mercado quincenal');
    expect(chain.update).not.toHaveBeenCalled();
  });
});

describe('queryExpenseTotal', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Cadena de `select().eq().eq().gte().lte()` (y `eq` extra por categoría). */
  function fakeSelect(rows: Array<{ amount: number }>) {
    const filtros: Array<[string, unknown]> = [];
    const chain: Record<string, unknown> = { data: rows, error: null };
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn((col: string, val: unknown) => {
      filtros.push([col, val]);
      return chain;
    });
    chain.gte = vi.fn((col: string, val: unknown) => {
      filtros.push([`gte:${col}`, val]);
      return chain;
    });
    chain.lte = vi.fn((col: string, val: unknown) => {
      filtros.push([`lte:${col}`, val]);
      return chain;
    });
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolve({ data: rows, error: null }));
    return { chain, filtros };
  }

  it('sin fechas acota al mes en curso y lo reporta: "¿cuánto llevo en mercado?" es de este mes', async () => {
    // Sin este default se sumaba TODA la historia y el usuario recibía un
    // número que podía ser diez veces el real, sin ninguna señal.
    const { chain, filtros } = fakeSelect([{ amount: 10000 }, { amount: 5000 }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await queryExpenseTotal('user-1', { categoria: 'MERCADO' });

    expect(res.total).toBe(15000);
    expect(res.mesEnCurso).toBe(true);
    expect(res.desde.endsWith('-01')).toBe(true);
    expect(res.desde.slice(0, 7)).toBe(res.hasta.slice(0, 7));
    expect(filtros).toContainEqual(['gte:transaction_date', res.desde]);
    expect(filtros).toContainEqual(['lte:transaction_date', res.hasta]);
  });

  it('filtra por tipo Gasto: un ingreso no puede entrar al total de gastos', async () => {
    const { chain, filtros } = fakeSelect([]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    await queryExpenseTotal('user-1', {});

    expect(filtros).toContainEqual(['transaction_types.name', 'Gasto']);
  });

  it('respeta las fechas que sí manda el modelo y no dice "mes en curso"', async () => {
    const { chain, filtros } = fakeSelect([{ amount: 1000 }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await queryExpenseTotal('user-1', {
      desde: '2026-07-01',
      hasta: '2026-07-31',
    });

    expect(res.mesEnCurso).toBe(false);
    expect(res.desde).toBe('2026-07-01');
    expect(filtros).toContainEqual(['lte:transaction_date', '2026-07-31']);
  });
});
