// Servicio para gestionar facturas electrónicas DIAN (tabla electronic_invoices)

import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
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
 * Resumen de una factura pendiente, para mostrarla en el prompt del agente
 * ("HAY UNA FACTURA ESPERANDO CUENTA..."). Se busca por id porque `pending`
 * en la conversación solo guarda el id, no la factura entera (ver
 * `Pending` en `agent/state.ts`) — así sobrevive al TTL de 30 min y a una
 * segunda foto que llegue antes de que el usuario conteste.
 */
export async function getPendingInvoiceSummary(
  userId: string,
  invoiceId: string,
): Promise<PendingInvoice | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;

  const inv = data as ElectronicInvoice;
  return {
    source: inv.source === 'dian_cufe' ? 'dian_cufe' : 'vision_receipt',
    cufe: inv.cufe_code,
    supplier: inv.supplier_name,
    date: inv.invoice_date ?? '',
    total: inv.total_amount,
    items: (inv.items || []).map(it => ({
      description: it.description,
      amount: it.total_with_tax ?? it.total_price,
    })),
  };
}

/**
 * Registra una factura ya persistida (por `createVisionReceiptDraft` o el
 * flujo CUFE), sin aprobación manual. Reemplaza el par `approveInvoice` +
 * pantalla: la cuenta ahora la pregunta el agente de WhatsApp
 * (`resolveAccountFromMessage`), que era la única razón de ese paso.
 *
 * A propósito NO recibe los datos de la factura sueltos: los lee de la fila
 * por `invoiceId`, la misma que `createVisionReceiptDraft` dejó en
 * `pending_review` con los ítems ya categorizados. Eso es lo que hace que la
 * factura sobreviva aunque venza el TTL de la conversación o llegue una
 * segunda foto antes de que el usuario responda — antes `pending` era el
 * único lugar donde vivía y se perdía en ambos casos.
 *
 * Si la fila ya no está en `pending_review` (se registró antes, o quedó en
 * error), no se reintenta a ciegas: evita duplicar ítems que ya son
 * transacciones reales — p. ej. si el modelo llama `registrar_factura` dos
 * veces en la misma vuelta.
 *
 * Si un ítem falla a mitad de camino, los gastos ya creados NO se revierten
 * (son transacciones reales vía `upsert_monthly_expense`, que no dedupe) y el
 * resultado lo dice: `itemsFound` es el conteo real, nunca cero solo porque
 * el último ítem falló. Decirle al usuario "no se guardó nada" cuando sí se
 * guardó una parte lo empuja a reenviar la foto y duplicar esos ítems.
 *
 * Usa `createAdminClient` porque corre en background (`after()` del
 * webhook), sin sesión de navegador — mismo patrón que `createDirectExpense`
 * en `whatsapp-expenses.ts`. `classifyApprovedExpenses` se sigue llamando
 * (best-effort, con lo que sí se creó): es lo que asigna el ítem de
 * presupuesto de cada línea; sin esto la factura entera entra "sin
 * clasificar".
 */
export async function createInvoiceDirect(
  userId: string,
  invoiceId: string,
  accountName: string,
  deps: { classify?: typeof classifyApprovedExpenses } = {},
): Promise<{ ok: boolean; itemsFound: number; totalItems: number; error?: string }> {
  const supabase = createAdminClient();
  const clasificar = deps.classify ?? classifyApprovedExpenses;

  const { data: invoiceRow, error: fetchError } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError || !invoiceRow) {
    return {
      ok: false,
      itemsFound: 0,
      totalItems: 0,
      error: 'Factura no encontrada.',
    };
  }

  const typed = invoiceRow as ElectronicInvoice;
  if (typed.status !== 'pending_review') {
    return {
      ok: false,
      itemsFound: 0,
      totalItems: typed.items?.length ?? 0,
      error: `La factura ya está en estado "${typed.status}"; no se vuelve a registrar.`,
    };
  }

  const items = typed.items || [];
  const fecha = typed.invoice_date ?? '';
  const createdExpenses: Array<{
    id: string;
    description: string;
    categoryName: string;
    monthYear: string;
  }> = [];

  for (const item of items) {
    const { data, error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: userId,
      p_description: item.description,
      p_amount: item.total_with_tax ?? item.total_price,
      p_transaction_date: fecha,
      p_category_name: item.category,
      p_account_name: accountName,
      p_place: typed.supplier_name ?? 'WhatsApp',
    });

    if (error) {
      // Corte a mitad de camino: lo ya creado son transacciones reales, no se
      // revierte. Se clasifica lo que sí se pudo (best-effort) y se marca la
      // fila en error con el conteo real, para que el llamador no le mienta
      // al usuario diciendo que no se guardó nada.
      if (createdExpenses.length > 0) {
        await clasificar(supabase, userId, createdExpenses);
      }
      const mensaje = `Registro parcial: ${createdExpenses.length} de ${items.length} ítems ("${item.description}" falló: ${error.message}).`;
      const { error: updateError } = await supabase
        .from('electronic_invoices')
        .update({ status: 'error', error_message: mensaje })
        .eq('id', invoiceId);
      if (updateError) {
        console.error(
          'createInvoiceDirect: no se pudo marcar la factura en error:',
          updateError.message,
        );
      }
      return {
        ok: false,
        itemsFound: createdExpenses.length,
        totalItems: items.length,
        error: mensaje,
      };
    }

    if (typeof data === 'string') {
      createdExpenses.push({
        id: data,
        description: item.description,
        categoryName: item.category,
        monthYear: fecha.slice(0, 7),
      });
    }
  }

  await clasificar(supabase, userId, createdExpenses);

  const { error: updateError } = await supabase
    .from('electronic_invoices')
    .update({
      status: 'approved',
      selected_account_name: accountName,
      approved_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
  if (updateError) {
    // Los gastos YA están guardados: que no se haya podido marcar la fila
    // como aprobada no puede convertirse en un "no pude guardar la factura"
    // que empuje al usuario a reenviar la foto y duplicar los gastos.
    console.error(
      'createInvoiceDirect: no se pudo marcar la factura como aprobada:',
      updateError.message,
    );
  }

  return { ok: true, itemsFound: items.length, totalItems: items.length };
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
