import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/server';
import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

import { createInvoiceDirect, getPendingInvoiceSummary } from './invoices';


const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

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

  it('factura inexistente → ok:false sin tocar el RPC', async () => {
    const rpc = vi.fn();
    const { from } = makeSupabaseMock({ row: null, rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    const res = await createInvoiceDirect('user-1', 'inv-inexistente', 'Nequi');

    expect(res.ok).toBe(false);
    expect(res.itemsFound).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
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
