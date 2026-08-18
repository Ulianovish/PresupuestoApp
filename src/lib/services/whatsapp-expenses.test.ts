import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(async () => ['MERCADO']),
}));
vi.mock('@/lib/dian/expense-item-classifier', () => ({
  classifyExpensesToItems: vi.fn(async () => ['Carnes']),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { createAdminClient } from '@/lib/supabase/server';

import {
  createDirectExpense,
  createVisionReceiptDraft,
  pickBudgetItemId,
  resolveDefaultAccount,
} from './whatsapp-expenses';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

describe('resolveDefaultAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa default_account_name del número si existe', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { default_account_name: 'Nequi' } }),
    }));
    mockedAdmin.mockReturnValue({ from });
    expect(await resolveDefaultAccount('+573001234567')).toBe('Nequi');
  });

  it('cae a Efectivo si no hay default', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: { default_account_name: null } }),
    }));
    mockedAdmin.mockReturnValue({ from });
    expect(await resolveDefaultAccount('+573001234567')).toBe('Efectivo');
  });
});

describe('createDirectExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  it('categoriza con IA y llama upsert_monthly_expense con los args correctos', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const catFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ name: 'MERCADO' }] }),
    }));
    mockedAdmin.mockReturnValue({ rpc, from: catFrom });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 20000,
      description: 'mercado',
      accountName: 'Nequi',
      date: '2026-06-11',
    });

    expect(res.ok).toBe(true);
    expect(res.category).toBe('MERCADO');
    expect(categorizeInvoiceItems).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('upsert_monthly_expense', {
      p_user_id: 'user-1',
      p_description: 'mercado',
      p_amount: 20000,
      p_transaction_date: '2026-06-11',
      p_category_name: 'MERCADO',
      p_account_name: 'Nequi',
      p_place: 'WhatsApp',
    });
  });

  it('devuelve ok:false si el RPC falla', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const catFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    }));
    mockedAdmin.mockReturnValue({ rpc, from: catFrom });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 1000,
      description: 'x',
      accountName: 'Efectivo',
      date: '2026-06-11',
    });

    expect(res.ok).toBe(false);
  });

  const budgetItemsRows = [
    { item_id: 'i1', item_name: 'Carnes', category_name: 'MERCADO' },
    { item_id: 'i2', item_name: 'Aseo', category_name: 'MERCADO' },
  ];

  function mockAdminWithRpc(
    rpcImpl: (
      name: string,
      args: unknown,
    ) => Promise<{ data?: unknown; error?: unknown }>,
  ) {
    const rpc = vi.fn(rpcImpl);
    const catFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ name: 'MERCADO' }] }),
    }));
    mockedAdmin.mockReturnValue({ rpc, from: catFrom });
    return rpc;
  }

  it('captura el id del gasto y asigna el ítem del presupuesto', async () => {
    const rpc = mockAdminWithRpc(async name => {
      if (name === 'upsert_monthly_expense')
        return { data: 'tx-123', error: null };
      if (name === 'get_budget_items_for_month')
        return { data: budgetItemsRows, error: null };
      if (name === 'assign_expense_budget_item') return { error: null };
      throw new Error(`rpc inesperado: ${name}`);
    });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 20000,
      description: 'pernil',
      accountName: 'Nequi',
      date: '2026-06-11',
    });

    expect(res.transactionId).toBe('tx-123');
    expect(res.budgetItemId).toBe('i1');
    expect(rpc).toHaveBeenCalledWith('assign_expense_budget_item', {
      p_user_id: 'user-1',
      p_transaction_id: 'tx-123',
      p_budget_item_id: 'i1',
      p_source: 'ai',
    });
  });

  it('si falla la asignación del ítem, budgetItemId vuelve null pero el gasto queda guardado', async () => {
    const rpc = mockAdminWithRpc(async name => {
      if (name === 'upsert_monthly_expense')
        return { data: 'tx-123', error: null };
      if (name === 'get_budget_items_for_month')
        return { data: budgetItemsRows, error: null };
      if (name === 'assign_expense_budget_item')
        return { error: { message: 'boom' } };
      throw new Error(`rpc inesperado: ${name}`);
    });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 20000,
      description: 'pernil',
      accountName: 'Nequi',
      date: '2026-06-11',
    });

    expect(rpc).toHaveBeenCalledWith('assign_expense_budget_item', {
      p_user_id: 'user-1',
      p_transaction_id: 'tx-123',
      p_budget_item_id: 'i1',
      p_source: 'ai',
    });
    expect(res.ok).toBe(true);
    expect(res.transactionId).toBe('tx-123');
    expect(res.budgetItemId).toBeNull();
  });

  it('si la asignación del ítem lanza (p.ej. timeout), budgetItemId vuelve null pero el gasto queda guardado', async () => {
    const rpc = mockAdminWithRpc(async name => {
      if (name === 'upsert_monthly_expense')
        return { data: 'tx-123', error: null };
      if (name === 'get_budget_items_for_month')
        return { data: budgetItemsRows, error: null };
      if (name === 'assign_expense_budget_item')
        throw new Error('timeout de red');
      throw new Error(`rpc inesperado: ${name}`);
    });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 20000,
      description: 'pernil',
      accountName: 'Nequi',
      date: '2026-06-11',
    });

    expect(rpc).toHaveBeenCalledWith('assign_expense_budget_item', {
      p_user_id: 'user-1',
      p_transaction_id: 'tx-123',
      p_budget_item_id: 'i1',
      p_source: 'ai',
    });
    expect(res.ok).toBe(true);
    expect(res.transactionId).toBe('tx-123');
    expect(res.budgetItemId).toBeNull();
  });
});

describe('createVisionReceiptDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('categoriza ítems e inserta un borrador con source vision_receipt', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'inv-1' }, error: null });
    const insert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnThis(), single });
    const catFrom = vi.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ name: 'MERCADO' }] }),
        };
      }
      if (table === 'electronic_invoices') return { insert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from: catFrom });

    const res = await createVisionReceiptDraft('user-1', {
      supplier: 'D1',
      date: '2026-06-12',
      items: [
        { description: 'Arroz', amount: 6000 },
        { description: 'Leche', amount: 5000 },
      ],
      total: 11000,
    });

    expect(res.ok).toBe(true);
    expect(res.itemsFound).toBe(2);
    expect(res.invoiceId).toBe('inv-1');
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe('user-1');
    expect(row.source).toBe('vision_receipt');
    expect(row.cufe_code).toBeNull();
    expect(row.status).toBe('pending_review');
    expect(row.supplier_name).toBe('D1');
    expect(row.total_amount).toBe(11000);
    expect(row.items).toHaveLength(2);
    expect(row.items[0].description).toBe('Arroz');
    expect(row.items[0].total_price).toBe(6000);
    expect(row.items[0].total_with_tax).toBe(6000);
    expect(row.items[0].category).toBe('MERCADO');
  });

  it('devuelve ok:false si el insert falla', async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'boom' } });
    const insert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnThis(), single });
    const catFrom = vi.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      return { insert };
    });
    mockedAdmin.mockReturnValue({ from: catFrom });

    const res = await createVisionReceiptDraft('user-1', {
      supplier: null,
      date: '2026-06-12',
      items: [{ description: 'x', amount: 100 }],
      total: 100,
    });
    expect(res.ok).toBe(false);
  });
});

describe('pickBudgetItemId', () => {
  const ITEMS = [
    { id: 'i1', name: 'Carnes', category_name: 'MERCADO' },
    { id: 'i2', name: 'Aseo', category_name: 'MERCADO' },
    { id: 'i3', name: 'Gasolina', category_name: 'TRANSPORTE' },
  ];

  it('elige el ítem dentro de la categoría del gasto', async () => {
    const clasificar = async () => ['Carnes'];
    const id = await pickBudgetItemId('pernil', 'MERCADO', ITEMS, clasificar);
    expect(id).toBe('i1');
  });

  it('solo le ofrece al clasificador los ítems de esa categoría', async () => {
    let ofrecidos: string[] = [];
    const clasificar = async (_: unknown, nombres: string[]) => {
      ofrecidos = nombres;
      return ['Carnes'];
    };
    await pickBudgetItemId('pernil', 'MERCADO', ITEMS, clasificar);
    expect(ofrecidos).toEqual(['Carnes', 'Aseo']);
    expect(ofrecidos).not.toContain('Gasolina');
  });

  it('devuelve null si la categoría no tiene ítems: no se adivina', async () => {
    const clasificar = async () => ['Carnes'];
    const id = await pickBudgetItemId('algo', 'VIVIENDA', ITEMS, clasificar);
    expect(id).toBeNull();
  });

  it('devuelve null si el clasificador no reconoce nada', async () => {
    const clasificar = async () => [null];
    const id = await pickBudgetItemId('xyz', 'MERCADO', ITEMS, clasificar);
    expect(id).toBeNull();
  });
});
