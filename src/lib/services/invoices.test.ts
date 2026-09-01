import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/dian/expense-item-classifier', () => ({
  classifyExpensesToItems: vi.fn(),
}));

import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';
import { createAdminClient } from '@/lib/supabase/server';
import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

import {
  classifyApprovedExpenses,
  createInvoiceDirect,
  esRegistroParcial,
  getPendingInvoiceSummary,
} from './invoices';


const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;
const mockedClassify = vi.mocked(classifyExpensesToItems);

const ITEM_ARROZ: StoredInvoiceItem = {
  description: 'arroz',
  quantity: 1,
  unit_price: 5000,
  total_price: 5000,
  total_with_tax: 5000,
  suggested_category: 'MERCADO',
  category: 'MERCADO',
};

const ITEM_LECHE: StoredInvoiceItem = {
  description: 'leche',
  quantity: 1,
  unit_price: 3000,
  total_price: 3000,
  total_with_tax: 3000,
  suggested_category: 'MERCADO',
  category: 'MERCADO',
};

function invoiceRow(overrides: Partial<ElectronicInvoice> = {}): Partial<ElectronicInvoice> {
  return {
    id: 'inv-1',
    user_id: 'user-1',
    cufe_code: null,
    source: 'vision_receipt',
    supplier_name: 'ÉXITO',
    invoice_date: '2026-08-17',
    total_amount: 8000,
    items: [ITEM_ARROZ, ITEM_LECHE],
    status: 'pending_review',
    ...overrides,
  };
}

/** Arma un mock de Supabase que distingue `select` (fetch por id) de `update`. */
function makeSupabaseMock(opts: {
  row: Partial<ElectronicInvoice> | null;
  rpc: ReturnType<typeof vi.fn>;
  update?: ReturnType<typeof vi.fn>;
}) {
  const update = opts.update ?? vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: opts.row, error: null }),
    update,
  }));
  return { rpc: opts.rpc, from, update };
}

describe('createInvoiceDirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registra todos los ítems, clasifica y marca la factura como approved', async () => {
    // El riesgo del cambio: classifyApprovedExpenses corría al aprobar. Si el
    // registro directo no lo llama, cada factura entra entera sin clasificar.
    const rpc = vi.fn().mockResolvedValue({ data: 'tx-1', error: null });
    const { from, update } = makeSupabaseMock({ row: invoiceRow(), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    let clasificado = false;
    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => {
        clasificado = true;
        return [];
      },
    });

    expect(res.ok).toBe(true);
    expect(res.itemsFound).toBe(2);
    expect(res.totalItems).toBe(2);
    expect(clasificado).toBe(true);
    expect(rpc).toHaveBeenCalledWith('upsert_monthly_expense', {
      p_user_id: 'user-1',
      p_description: 'arroz',
      p_amount: 5000,
      p_transaction_date: '2026-08-17',
      p_category_name: 'MERCADO',
      p_account_name: 'Nequi',
      p_place: 'ÉXITO',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', selected_account_name: 'Nequi' }),
    );
  });

  it('fallo a mitad de camino: reporta el conteo real, no cero, y marca la factura en error', async () => {
    // Este es el hallazgo crítico: un usuario que cree que no se guardó nada
    // reenvía la foto y duplica los ítems que sí se registraron.
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 'tx-1', error: null }) // arroz: ok
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } }); // leche: falla
    const { from, update } = makeSupabaseMock({ row: invoiceRow(), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    let clasificado = false;
    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => {
        clasificado = true;
        return [];
      },
    });

    expect(res.ok).toBe(false);
    expect(res.itemsFound).toBe(1); // el arroz sí se guardó
    expect(res.totalItems).toBe(2);
    expect(res.error).toMatch(/1 de 2/);
    expect(clasificado).toBe(true); // clasifica lo que sí se creó, best-effort
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('falla sin crear ningún gasto → vuelve a pending_review (reintentable, sin riesgo de duplicar)', async () => {
    // Distinto del caso "a mitad de camino": si no se creó ni un gasto, no
    // hay nada que duplicar reintentando. Dejarla en 'error' la sacaría de la
    // vista de rescate ("Facturas sin completar" solo lista pending_review y
    // error, pero solo pending_review ofrece el botón de completar).
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } }); // arroz: falla de entrada
    const { from, update } = makeSupabaseMock({ row: invoiceRow(), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    let clasificado = false;
    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => {
        clasificado = true;
        return [];
      },
    });

    expect(res.ok).toBe(false);
    expect(res.itemsFound).toBe(0);
    expect(res.totalItems).toBe(2);
    expect(clasificado).toBe(false); // nada que clasificar, no se creó nada
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending_review' }),
    );
  });

  it('no reintenta una factura que ya no está en pending_review (evita duplicar)', async () => {
    const rpc = vi.fn();
    const { from } = makeSupabaseMock({ row: invoiceRow({ status: 'approved' }), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi');

    expect(res.ok).toBe(false);
    expect(res.itemsFound).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('devuelve el total REGISTRADO (suma de los ítems), no el de la cabecera', async () => {
    // La cabecera dice 8000 (con descuento); los ítems suman 8000 acá, pero el
    // contrato importa cuando difieren: se confirma lo que quedó en la base.
    const rpc = vi.fn().mockResolvedValue({ data: 'tx-1', error: null });
    const { from } = makeSupabaseMock({
      row: invoiceRow({ total_amount: 312400 }),
      rpc,
    });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => [],
    });

    expect(res.totalAmount).toBe(8000); // 5000 arroz + 3000 leche
  });

  it('en un registro parcial, el total refleja solo lo que se alcanzó a escribir', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 'tx-1', error: null }) // arroz: ok
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } }); // leche: falla
    const { from } = makeSupabaseMock({ row: invoiceRow(), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => [],
    });

    expect(res.totalAmount).toBe(5000);
    // Y el mensaje que queda en la fila es el que `esRegistroParcial`
    // reconoce: es el acoplamiento del que depende no re-scrapear el CUFE.
    expect(esRegistroParcial(res.error ?? null)).toBe(true);
  });

  it('un error sin gastos creados NO se reconoce como registro parcial (sí se puede reintentar)', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    const { from } = makeSupabaseMock({ row: invoiceRow(), rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => [],
    });

    expect(esRegistroParcial(res.error ?? null)).toBe(false);
  });

  it('factura inexistente → ok:false sin tocar el RPC', async () => {
    const rpc = vi.fn();
    const { from } = makeSupabaseMock({ row: null, rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-inexistente', 'Nequi');

    expect(res.ok).toBe(false);
    expect(res.itemsFound).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('devuelve el mes DE LA FACTURA, no el de hoy: los budget_item_id son por mes', async () => {
    // El hallazgo crítico: si el llamador comparara las alertas contra el mes
    // de hoy en vez del de la factura, una factura vieja (o un CUFE que llega
    // a principios del mes siguiente) nunca matchearía sus propios
    // budget_item_id y la alerta no dispararía nunca, en silencio.
    const rpc = vi.fn().mockResolvedValue({ data: 'tx-1', error: null });
    const { from } = makeSupabaseMock({
      row: invoiceRow({ invoice_date: '2026-07-03' }), // factura de un mes anterior
      rpc,
    });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => [],
    });

    expect(res.monthYear).toBe('2026-07');
  });

  it('en un registro parcial, el mes devuelto también es el de la factura', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: 'tx-1', error: null }) // arroz: ok
      .mockResolvedValueOnce({ data: null, error: { message: 'boom' } }); // leche: falla
    const { from } = makeSupabaseMock({
      row: invoiceRow({ invoice_date: '2026-07-03' }),
      rpc,
    });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-1', 'Nequi', {
      classify: async () => [],
    });

    expect(res.monthYear).toBe('2026-07');
  });
});

describe('getPendingInvoiceSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mapea la fila a la vista que consume el prompt', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: invoiceRow(), error: null }),
    }));
    mockedAdmin.mockReturnValue({ from });

    const res = await getPendingInvoiceSummary('user-1', 'inv-1');

    expect(res).toEqual({
      source: 'vision_receipt',
      cufe: null,
      supplier: 'ÉXITO',
      date: '2026-08-17',
      total: 8000,
      items: [
        { description: 'arroz', amount: 5000 },
        { description: 'leche', amount: 3000 },
      ],
    });
  });

  it('solo mira facturas que SIGUEN esperando cuenta', async () => {
    // Si se completó desde la app, el prompt seguía anunciando "HAY UNA
    // FACTURA ESPERANDO CUENTA" por una factura que ya no espera nada.
    const eq = vi.fn().mockReturnThis();
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq,
      maybeSingle: vi.fn().mockResolvedValue({ data: invoiceRow(), error: null }),
    }));
    mockedAdmin.mockReturnValue({ from });

    await getPendingInvoiceSummary('user-1', 'inv-1');

    expect(eq).toHaveBeenCalledWith('status', 'pending_review');
  });

  it('devuelve null si no existe (o es de otro usuario)', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    mockedAdmin.mockReturnValue({ from });

    expect(await getPendingInvoiceSummary('user-1', 'inv-x')).toBeNull();
  });
});

describe('classifyApprovedExpenses', () => {
  beforeEach(() => vi.clearAllMocks());

  // Un solo ítem por categoría: alcanza para probar agrupado, dedupe y el
  // corte por RPC sin ambigüedad de a cuál ítem asignó el clasificador.
  const BUDGET_ITEMS = [
    { item_id: 'item-dulces', item_name: 'Dulces', category_name: 'MERCADO' },
    { item_id: 'item-gasolina', item_name: 'Gasolina', category_name: 'TRANSPORTE' },
  ];

  /** Fake de supabase que distingue el RPC por nombre, como en whatsapp-expenses.test.ts. */
  function fakeSupabase(opts: {
    budgetItems?: typeof BUDGET_ITEMS;
    assignError?: { message: string } | null;
  }) {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'get_budget_items_for_month') {
        return { data: opts.budgetItems ?? BUDGET_ITEMS, error: null };
      }
      if (name === 'assign_expense_budget_item') {
        return { error: opts.assignError ?? null };
      }
      throw new Error(`rpc inesperado: ${name}`);
    });
    return { rpc } as unknown as Parameters<typeof classifyApprovedExpenses>[0];
  }

  it('devuelve los rubros que asignó, sin repetir', async () => {
    // Dos gastos de MERCADO que caen en el mismo rubro y uno de TRANSPORTE:
    // el llamador necesita 2 ids, no 3, porque las alertas son por rubro.
    mockedClassify.mockImplementation(async (items, itemNames) =>
      items.map(() => itemNames[0]),
    );
    const supabase = fakeSupabase({ assignError: null });

    const ids = await classifyApprovedExpenses(supabase, 'u1', [
      { id: 't1', description: 'Chocolatina', categoryName: 'MERCADO', monthYear: '2026-09' },
      { id: 't2', description: 'Gomitas', categoryName: 'MERCADO', monthYear: '2026-09' },
      { id: 't3', description: 'Gasolina', categoryName: 'TRANSPORTE', monthYear: '2026-09' },
    ]);

    expect(ids.sort()).toEqual(['item-dulces', 'item-gasolina']);
  });

  it('no incluye los gastos que no se pudieron clasificar', async () => {
    // Ningún ítem del presupuesto pertenece a SIN_RUBROS: ni siquiera se
    // llama al clasificador para ese grupo.
    const supabase = fakeSupabase({});

    const ids = await classifyApprovedExpenses(supabase, 'u1', [
      { id: 't1', description: 'Algo rarísimo', categoryName: 'SIN_RUBROS', monthYear: '2026-09' },
    ]);

    expect(ids).toEqual([]);
    expect(mockedClassify).not.toHaveBeenCalled();
  });

  it('si el RPC de asignación falla, ese rubro no se reporta como asignado', async () => {
    // Reportarlo dispararía una alerta por un gasto que no quedó en el rubro.
    mockedClassify.mockImplementation(async (items, itemNames) =>
      items.map(() => itemNames[0]),
    );
    const supabase = fakeSupabase({ assignError: { message: 'boom' } });

    const ids = await classifyApprovedExpenses(supabase, 'u1', [
      { id: 't1', description: 'Chocolatina', categoryName: 'MERCADO', monthYear: '2026-09' },
    ]);

    expect(ids).toEqual([]);
  });
});
