// Servicio para gestionar facturas electrónicas DIAN (tabla electronic_invoices)


import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
import { mapInvoiceItemToExpenseArgs } from '@/lib/dian/invoice-mapper';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import type {
  ElectronicInvoice,
  StoredInvoiceItem,
} from '@/types/invoices';

import type { SupabaseClient } from '@supabase/supabase-js';

type DBClient = SupabaseClient<Database>;

/** Busca una factura por CUFE (guarda anti-reprocesamiento). */
export async function getInvoiceByCufe(
  userId: string,
  cufe: string,
  client?: DBClient,
): Promise<ElectronicInvoice | null> {
  const supabase = client ?? (await createClient());
  const { data } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('user_id', userId)
    .eq('cufe_code', cufe)
    .maybeSingle();
  return (data as ElectronicInvoice) ?? null;
}

/** Crea la fila en estado processing. Devuelve el id. */
export async function createProcessingInvoice(
  userId: string,
  cufe: string,
  client?: DBClient,
): Promise<string | null> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase
    .from('electronic_invoices')
    .insert({ user_id: userId, cufe_code: cufe, status: 'processing' })
    .select('id')
    .single();
  if (error) {
    console.error('Error creando factura en processing:', error);
    return null;
  }
  return (data as { id: string }).id;
}

/** Reinicia una fila existente (processing/error) a processing para reintentar. */
export async function resetInvoiceToProcessing(
  invoiceId: string,
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
  await supabase
    .from('electronic_invoices')
    .update({ status: 'processing', error_message: null, processed_at: null })
    .eq('id', invoiceId);
}

/** Persiste el avance del procesamiento para que la UI lo muestre por polling. */
export async function updateInvoiceProgress(
  invoiceId: string,
  percent: number,
  message: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('electronic_invoices')
    .update({ progress_percent: percent, progress_message: message })
    .eq('id', invoiceId);
}

/**
 * Devuelve las categorías activas del usuario (mismas que el tab de presupuesto).
 * Si no hay o falla la consulta, cae a EXPENSE_CATEGORIES.
 */
export async function resolveUserCategoryNames(
  client?: DBClient,
  userId?: string,
): Promise<string[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from('categories')
    .select('name')
    .eq('is_active', true);
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data } = await query.order('name');
  if (data && data.length > 0) {
    return data.map(c => c.name as string);
  }
  return [...EXPENSE_CATEGORIES];
}

/** Marca la factura como error con un mensaje. */
export async function markInvoiceError(
  invoiceId: string,
  message: string,
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
  await supabase
    .from('electronic_invoices')
    .update({ status: 'error', error_message: message })
    .eq('id', invoiceId);
}

/** Guarda los datos extraídos + items categorizados y pasa a pending_review. */
export async function saveProcessedInvoice(
  invoiceId: string,
  data: {
    supplierName: string;
    supplierNit: string;
    invoiceDate: string;
    currency: string;
    subtotal: number;
    totalAmount: number;
    items: StoredInvoiceItem[];
    processingTimeMs: number;
  },
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
  await supabase
    .from('electronic_invoices')
    .update({
      supplier_name: data.supplierName,
      supplier_nit: data.supplierNit,
      invoice_date: data.invoiceDate,
      currency: data.currency,
      subtotal: data.subtotal,
      total_amount: data.totalAmount,
      items: data.items,
      processing_time_ms: data.processingTimeMs,
      status: 'pending_review',
      processed_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

/** Lista facturas activas del usuario (processing, pending_review o error). */
export async function listDraftInvoices(
  userId: string,
): Promise<ElectronicInvoice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['processing', 'pending_review', 'error'])
    .order('created_at', { ascending: false });
  return (data as ElectronicInvoice[]) ?? [];
}

/**
 * Aprueba una factura: crea un gasto por ítem vía upsert_monthly_expense y
 * marca la factura como approved.
 */
export async function approveInvoice(
  userId: string,
  invoiceId: string,
  accountName: string,
  categoryOverrides?: Record<number, string>,
): Promise<{ success: boolean; created: number; error?: string }> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();

  if (error || !invoice) {
    return { success: false, created: 0, error: 'Factura no encontrada' };
  }
  if ((invoice as ElectronicInvoice).status !== 'pending_review') {
    return {
      success: false,
      created: 0,
      error: 'La factura no está pendiente de revisión',
    };
  }

  const typed = invoice as ElectronicInvoice;
  const items = (typed.items || []).map((it, idx) => ({
    ...it,
    category: categoryOverrides?.[idx] ?? it.category,
  }));

  let created = 0;
  for (const item of items) {
    const args = mapInvoiceItemToExpenseArgs(item, typed, userId, accountName);
    const { error: rpcError } = await supabase.rpc(
      'upsert_monthly_expense',
      args,
    );
    if (rpcError) {
      return {
        success: false,
        created,
        error: `Error creando gasto "${item.description}": ${rpcError.message}`,
      };
    }
    created++;
  }

  await supabase
    .from('electronic_invoices')
    .update({
      status: 'approved',
      selected_account_name: accountName,
      items,
      approved_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  return { success: true, created };
}
