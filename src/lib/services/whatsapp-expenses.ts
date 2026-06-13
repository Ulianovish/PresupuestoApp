// Creación de gastos directos desde WhatsApp (texto libre). Usa service-role
// (sin sesión) con el userId ya resuelto por el vínculo del número.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { resolveUserCategoryNames } from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase/server';
import type { StoredInvoiceItem } from '@/types/invoices';

const FALLBACK_ACCOUNT = 'Efectivo';

/** Cuenta por defecto del número (columna en whatsapp_links) o 'Efectivo'. */
export async function resolveDefaultAccount(phoneE164: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_links')
    .select('default_account_name')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  const acc = (data as { default_account_name: string | null } | null)
    ?.default_account_name;
  return acc && acc.trim() ? acc : FALLBACK_ACCOUNT;
}

export interface DirectExpenseInput {
  amount: number;
  description: string;
  accountName: string;
  date: string; // YYYY-MM-DD
}

export interface DirectExpenseResult {
  ok: boolean;
  category: string;
  error?: string;
}

/**
 * Crea un gasto directo: categoriza la descripción con IA (categorías del
 * usuario) y lo inserta vía el RPC existente upsert_monthly_expense.
 */
export async function createDirectExpense(
  userId: string,
  _phoneE164: string,
  input: DirectExpenseInput,
): Promise<DirectExpenseResult> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const [category] = await categorizeInvoiceItems(
    [{ description: input.description }],
    categoryNames,
  );
  const finalCategory = category ?? 'OTROS';

  const { error } = await supabase.rpc('upsert_monthly_expense', {
    p_user_id: userId,
    p_description: input.description,
    p_amount: input.amount,
    p_transaction_date: input.date,
    p_category_name: finalCategory,
    p_account_name: input.accountName,
    p_place: 'WhatsApp',
  });

  if (error) {
    return { ok: false, category: finalCategory, error: error.message };
  }
  return { ok: true, category: finalCategory };
}

export interface VisionReceiptInput {
  supplier: string | null;
  date: string; // YYYY-MM-DD (resuelta por el llamador)
  items: Array<{ description: string; amount: number }>;
  total: number | null;
}

export interface VisionReceiptResult {
  ok: boolean;
  itemsFound: number;
  error?: string;
}

/**
 * Crea un borrador de factura a partir de una foto leída por visión (sin CUFE).
 * Categoriza los ítems con IA y los guarda en electronic_invoices con
 * source='vision_receipt' y status='pending_review' → aparece en la bandeja y se
 * aprueba con el flujo existente.
 */
export async function createVisionReceiptDraft(
  userId: string,
  input: VisionReceiptInput,
): Promise<VisionReceiptResult> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const categories = await categorizeInvoiceItems(
    input.items.map(it => ({ description: it.description })),
    categoryNames,
  );

  const storedItems: StoredInvoiceItem[] = input.items.map((it, idx) => ({
    description: it.description,
    quantity: 1,
    unit_price: it.amount,
    total_price: it.amount,
    total_with_tax: it.amount,
    suggested_category: categories[idx] ?? 'OTROS',
    category: categories[idx] ?? 'OTROS',
  }));

  const totalAmount =
    input.total ?? storedItems.reduce((sum, it) => sum + it.total_price, 0);

  const { error } = await supabase.from('electronic_invoices').insert({
    user_id: userId,
    cufe_code: null,
    source: 'vision_receipt',
    supplier_name: input.supplier,
    invoice_date: input.date,
    total_amount: totalAmount,
    items: storedItems,
    status: 'pending_review',
    processed_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, itemsFound: 0, error: error.message };
  }
  return { ok: true, itemsFound: storedItems.length };
}
