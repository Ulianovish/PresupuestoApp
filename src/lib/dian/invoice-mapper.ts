import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

export interface UpsertExpenseArgs {
  p_user_id: string;
  p_description: string;
  p_amount: number;
  p_transaction_date: string;
  p_category_name: string;
  p_account_name: string;
  p_place: string;
}

/**
 * Mapea un ítem de factura a los argumentos del RPC `upsert_monthly_expense`.
 * El monto usa `total_with_tax` (valor de línea CON IVA/INC, como en el recibo);
 * si no viene, cae a `total_price` (base sin impuesto).
 */
export function mapInvoiceItemToExpenseArgs(
  item: StoredInvoiceItem,
  invoice: ElectronicInvoice,
  userId: string,
  accountName: string,
): UpsertExpenseArgs {
  return {
    p_user_id: userId,
    p_description: item.description,
    p_amount: item.total_with_tax ?? item.total_price,
    p_transaction_date: invoice.invoice_date ?? '',
    p_category_name: item.category,
    p_account_name: accountName,
    p_place: invoice.supplier_name ?? '',
  };
}
