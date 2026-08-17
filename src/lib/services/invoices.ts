// Servicio para gestionar facturas electrónicas DIAN (tabla electronic_invoices)

import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';
import { mapInvoiceItemToExpenseArgs } from '@/lib/dian/invoice-mapper';
import { resolveItemNameToId } from '@/lib/services/expenses-rollup';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { PendingInvoice } from '@/lib/whatsapp/agent/state';
import type { Database } from '@/types/database';
import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

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
  let query = supabase.from('categories').select('name').eq('is_active', true);
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

  const createdExpenses: Array<{
    id: string;
    description: string;
    categoryName: string;
    monthYear: string;
  }> = [];
  let created = 0;
  for (const item of items) {
    const args = mapInvoiceItemToExpenseArgs(item, typed, userId, accountName);
    const { data: transactionId, error: rpcError } = await supabase.rpc(
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
    if (transactionId) {
      createdExpenses.push({
        id: transactionId as string,
        description: args.p_description,
        categoryName: args.p_category_name,
        monthYear: (args.p_transaction_date || '').slice(0, 7),
      });
    }
    created++;
  }

  // Clasificación best-effort: asigna cada gasto creado a un ítem del presupuesto.
  await classifyApprovedExpenses(supabase, userId, createdExpenses);

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

/**
 * Registra una factura directamente, sin aprobación manual. Reemplaza el par
 * `approveInvoice` + pantalla: la cuenta ahora la pregunta el agente de
 * WhatsApp (`resolveAccountFromMessage`), que era la única razón de ese paso.
 *
 * Usa `createAdminClient` porque corre en background (`after()` del webhook),
 * sin sesión de navegador — mismo patrón que `createDirectExpense` en
 * `whatsapp-expenses.ts`. `classifyApprovedExpenses` se sigue llamando: es lo
 * que asigna el ítem de presupuesto de cada línea; sin esto la factura entera
 * entra "sin clasificar".
 */
export async function createInvoiceDirect(
  userId: string,
  invoice: PendingInvoice,
  accountName: string,
  deps: { classify?: typeof classifyApprovedExpenses } = {},
): Promise<{ ok: boolean; itemsFound: number; error?: string }> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const categorias = await categorizeInvoiceItems(
    invoice.items.map(it => ({ description: it.description })),
    categoryNames,
  );

  const createdExpenses: Array<{
    id: string;
    description: string;
    categoryName: string;
    monthYear: string;
  }> = [];
  for (let i = 0; i < invoice.items.length; i++) {
    const it = invoice.items[i];
    const categoria = categorias[i] ?? 'OTROS';
    const { data, error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: userId,
      p_description: it.description,
      p_amount: it.amount,
      p_transaction_date: invoice.date,
      p_category_name: categoria,
      p_account_name: accountName,
      p_place: invoice.supplier ?? 'WhatsApp',
    });
    if (error) return { ok: false, itemsFound: 0, error: error.message };
    if (typeof data === 'string') {
      createdExpenses.push({
        id: data,
        description: it.description,
        categoryName: categoria,
        monthYear: invoice.date.slice(0, 7),
      });
    }
  }

  const storedItems: StoredInvoiceItem[] = invoice.items.map((it, i) => ({
    description: it.description,
    quantity: 1,
    unit_price: it.amount,
    total_price: it.amount,
    total_with_tax: it.amount,
    suggested_category: categorias[i] ?? 'OTROS',
    category: categorias[i] ?? 'OTROS',
  }));

  await supabase.from('electronic_invoices').insert({
    user_id: userId,
    cufe_code: invoice.cufe,
    source: invoice.source,
    supplier_name: invoice.supplier,
    invoice_date: invoice.date,
    total_amount: invoice.total ?? invoice.items.reduce((s, it) => s + it.amount, 0),
    items: storedItems,
    status: 'approved',
    selected_account_name: accountName,
    processed_at: new Date().toISOString(),
  });

  const clasificar = deps.classify ?? classifyApprovedExpenses;
  await clasificar(supabase, userId, createdExpenses);

  return { ok: true, itemsFound: invoice.items.length };
}

/**
 * Clasifica (por IA) los gastos recién creados de una factura y los asigna al
 * ítem del presupuesto correspondiente. Server-side: usa el cliente tipado y el
 * userId conocido (no depende de la sesión del navegador). Best-effort: agrupa
 * por mes y por categoría del gasto, acota la IA a los ítems de esa categoría, y
 * solo asigna cuando hay match. Nunca relanza (si falla, el gasto queda sin
 * clasificar y aparece en el panel rojo del presupuesto).
 */
export async function classifyApprovedExpenses(
  supabase: DBClient,
  userId: string,
  expenses: Array<{
    id: string;
    description: string;
    categoryName: string;
    monthYear: string;
  }>,
): Promise<void> {
  try {
    if (expenses.length === 0) return;

    // Agrupar por mes (una factura suele ser un solo mes, pero por si acaso)
    const byMonth = new Map<string, typeof expenses>();
    for (const e of expenses) {
      const arr = byMonth.get(e.monthYear) ?? [];
      arr.push(e);
      byMonth.set(e.monthYear, arr);
    }

    for (const [monthYear, monthExpenses] of byMonth) {
      const { data: itemsRaw } = await supabase.rpc(
        'get_budget_items_for_month',
        { p_user_id: userId, p_month_year: monthYear },
      );
      const items = ((itemsRaw as unknown[]) || []).map(row => {
        const r = row as {
          item_id: string;
          item_name: string;
          category_name: string;
        };
        return {
          id: r.item_id,
          name: r.item_name,
          category_name: r.category_name,
        };
      });
      if (items.length === 0) continue;

      // Agrupar por categoría del gasto y clasificar cada grupo en un lote
      const byCategory = new Map<string, typeof monthExpenses>();
      for (const e of monthExpenses) {
        const arr = byCategory.get(e.categoryName) ?? [];
        arr.push(e);
        byCategory.set(e.categoryName, arr);
      }

      for (const [categoryName, catExpenses] of byCategory) {
        const inCategory = items.filter(i => i.category_name === categoryName);
        if (inCategory.length === 0) continue;

        const names = await classifyExpensesToItems(
          catExpenses.map(e => ({ description: e.description })),
          inCategory.map(i => i.name),
        );

        for (let i = 0; i < catExpenses.length; i++) {
          const itemId = resolveItemNameToId(names[i], inCategory);
          if (itemId) {
            await supabase.rpc('assign_expense_budget_item', {
              p_user_id: userId,
              p_transaction_id: catExpenses[i].id,
              p_budget_item_id: itemId,
              p_source: 'ai',
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error clasificando gastos de factura aprobada:', error);
    // best-effort: no relanzar
  }
}
