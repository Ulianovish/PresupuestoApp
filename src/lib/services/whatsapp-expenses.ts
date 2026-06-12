// Creación de gastos directos desde WhatsApp (texto libre). Usa service-role
// (sin sesión) con el userId ya resuelto por el vínculo del número.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { resolveUserCategoryNames } from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase/server';

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
