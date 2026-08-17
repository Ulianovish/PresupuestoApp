import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(async () => ['MERCADO']),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { createAdminClient } from '@/lib/supabase/server';

import { createInvoiceDirect } from './invoices';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

/** Arma un mock de Supabase que distingue `categories` (lectura) de `electronic_invoices` (insert). */
function makeSupabaseMock(opts: {
  categoryNames?: string[];
  rpc: ReturnType<typeof vi.fn>;
  insert?: ReturnType<typeof vi.fn>;
}) {
  const insert = opts.insert ?? vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === 'categories') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi
          .fn()
          .mockResolvedValue({ data: (opts.categoryNames ?? []).map(name => ({ name })) }),
      };
    }
    return { insert };
  });
  return { rpc: opts.rpc, from, insert };
}

describe('createInvoiceDirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clasifica los ítems del presupuesto, igual que hacía la aprobación', async () => {
    // El riesgo del cambio: classifyApprovedExpenses corría al aprobar. Si el
    // registro directo no lo llama, cada factura entra entera sin clasificar.
    const rpc = vi.fn().mockResolvedValue({ data: 'tx-1', error: null });
    const { from, insert } = makeSupabaseMock({ categoryNames: ['MERCADO'], rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    let clasificado = false;
    const res = await createInvoiceDirect(
      'user-1',
      {
        source: 'vision_receipt',
        cufe: null,
        supplier: 'ÉXITO',
        date: '2026-08-17',
        total: 5000,
        items: [{ description: 'arroz', amount: 5000 }],
      },
      'Nequi',
      {
        classify: async () => {
          clasificado = true;
        },
      },
    );

    expect(res.ok).toBe(true);
    expect(res.itemsFound).toBe(1);
    expect(clasificado).toBe(true);
    expect(categorizeInvoiceItems).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('upsert_monthly_expense', {
      p_user_id: 'user-1',
      p_description: 'arroz',
      p_amount: 5000,
      p_transaction_date: '2026-08-17',
      p_category_name: 'MERCADO',
      p_account_name: 'Nequi',
      p_place: 'ÉXITO',
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        source: 'vision_receipt',
        status: 'approved',
        selected_account_name: 'Nequi',
      }),
    );
  });

  it('devuelve ok:false si el RPC falla, y no llega a clasificar', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const { from, insert } = makeSupabaseMock({ categoryNames: [], rpc });
    mockedAdmin.mockReturnValue({ rpc, from });

    let clasificado = false;
    const res = await createInvoiceDirect(
      'user-1',
      {
        source: 'vision_receipt',
        cufe: null,
        supplier: null,
        date: '2026-08-17',
        total: null,
        items: [{ description: 'algo', amount: 1000 }],
      },
      'Efectivo',
      {
        classify: async () => {
          clasificado = true;
        },
      },
    );

    expect(res.ok).toBe(false);
    expect(res.error).toBe('boom');
    expect(clasificado).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});
