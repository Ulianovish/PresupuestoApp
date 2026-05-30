import { describe, it, expect } from 'vitest';

import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

import { mapInvoiceItemToExpenseArgs } from './invoice-mapper';

const invoice = {
  invoice_date: '2026-05-15',
  supplier_name: 'Supermercado XYZ',
} as ElectronicInvoice;

const item = {
  description: 'Arroz 1kg',
  quantity: 2,
  unit_price: 2500,
  total_price: 5000,
  suggested_category: 'MERCADO',
  category: 'MERCADO',
} as StoredInvoiceItem;

describe('mapInvoiceItemToExpenseArgs', () => {
  it('cae a total_price (base) cuando no hay total_with_tax', () => {
    const args = mapInvoiceItemToExpenseArgs(
      item,
      invoice,
      'user-1',
      'TC Falabella',
    );
    expect(args).toEqual({
      p_user_id: 'user-1',
      p_description: 'Arroz 1kg',
      p_amount: 5000,
      p_transaction_date: '2026-05-15',
      p_category_name: 'MERCADO',
      p_account_name: 'TC Falabella',
      p_place: 'Supermercado XYZ',
    });
  });

  it('prefiere total_with_tax (con IVA) cuando está presente', () => {
    const withTax = { ...item, total_with_tax: 5950 } as StoredInvoiceItem;
    const args = mapInvoiceItemToExpenseArgs(
      withTax,
      invoice,
      'user-1',
      'Nequi',
    );
    expect(args.p_amount).toBe(5950);
  });
});
