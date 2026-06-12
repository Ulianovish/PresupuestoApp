import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(async () => ['MERCADO']),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { createAdminClient } from '@/lib/supabase/server';

import { createDirectExpense, resolveDefaultAccount } from './whatsapp-expenses';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

describe('resolveDefaultAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa default_account_name del número si existe', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { default_account_name: 'Nequi' } }),
    }));
    mockedAdmin.mockReturnValue({ from });
    expect(await resolveDefaultAccount('+573001234567')).toBe('Nequi');
  });

  it('cae a Efectivo si no hay default', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { default_account_name: null } }),
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
});
