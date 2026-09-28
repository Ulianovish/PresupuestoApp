// Servicio para gestionar facturas electrónicas DIAN (tabla electronic_invoices)

import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
import {
  clasificarGastos,
  type GastoAClasificar,
} from '@/lib/services/expense-classification';
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

/**
 * Prefijo del `error_message` que deja `createInvoiceDirect` cuando se cortó a
 * mitad de camino y algunos ítems YA son transacciones reales.
 *
 * Es la marca que hace reconocible ese estado desde afuera: una fila así no se
 * puede reintentar (volver a recorrer los ítems duplicaría los ya creados), a
 * diferencia de una fila en error por un scrape fallido.
 */
const PREFIJO_REGISTRO_PARCIAL = 'Registro parcial:';

/** ¿Esta factura quedó a medias con gastos ya creados? (ver `PREFIJO_REGISTRO_PARCIAL`). */
export function esRegistroParcial(errorMessage: string | null): boolean {
  return (errorMessage ?? '').startsWith(PREFIJO_REGISTRO_PARCIAL);
}

/**
 * Extrae cuántos ítems quedaron registrados y cuántos eran, del `error_message`
 * que deja `createInvoiceDirect` en un registro parcial (mismo formato que
 * escribe esa función: "Registro parcial: N de M ítems (...)"). Null si el
 * mensaje no tiene ese formato.
 */
export function parseRegistroParcial(
  errorMessage: string | null,
): { itemsFound: number; totalItems: number } | null {
  if (!esRegistroParcial(errorMessage)) return null;
  const match = (errorMessage ?? '').match(/(\d+) de (\d+) ítems/);
  if (!match) return null;
  return { itemsFound: Number(match[1]), totalItems: Number(match[2]) };
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
    // Solo si SIGUE esperando cuenta: si se completó desde la app (o quedó en
    // error), el prompt seguía anunciando "HAY UNA FACTURA ESPERANDO CUENTA"
    // por una factura que ya no espera nada.
    .eq('status', 'pending_review')
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
 * flujo CUFE), sin aprobación manual: la cuenta la pregunta el agente de
 * WhatsApp (`resolveAccountFromMessage`), y ese era el único paso que
 * justificaba una pantalla de aprobación. También la usa la vista de rescate
 * ("Facturas sin completar") cuando el usuario nunca contestó la cuenta por
 * WhatsApp y la completa desde la app.
 *
 * A propósito NO recibe los datos de la factura sueltos: los lee de la fila
 * por `invoiceId`, la misma que `createVisionReceiptDraft` dejó en
 * `pending_review` con los ítems ya categorizados. Eso es lo que hace que la
 * factura sobreviva aunque venza el TTL de la conversación o llegue una
 * segunda foto antes de que el usuario responda — antes `pending` era el
 * único lugar donde vivía y se perdía en ambos casos.
 *
 * Si la fila ya no está en `pending_review` (se registró antes, o quedó en
 * error tras un fallo parcial), no se reintenta a ciegas: evita duplicar
 * ítems que ya son transacciones reales — p. ej. si el modelo llama
 * `registrar_factura` dos veces en la misma vuelta.
 *
 * Si un ítem falla a mitad de camino, los gastos ya creados NO se revierten
 * (son transacciones reales vía `upsert_monthly_expense`, que no dedupe) y el
 * resultado lo dice: `itemsFound` es el conteo real, nunca cero solo porque
 * el último ítem falló. Decirle al usuario "no se guardó nada" cuando sí se
 * guardó una parte lo empuja a reenviar la foto y duplicar esos ítems. Por
 * eso la fila solo vuelve a `pending_review` (reintentable) cuando
 * `itemsFound` sigue en cero; si ya se creó algo, queda en `error` para que
 * no se vuelva a intentar sola.
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
  deps: {
    classify?: typeof classifyApprovedExpenses;
    /**
     * Categoría elegida por el usuario para una línea, por índice. Sustituye a
     * la que sugirió la IA: p. ej. un chocolate que quedó en MERCADO pero es
     * un regalo. Se usa tanto al crear el gasto como al clasificarlo, para que
     * el ítem de presupuesto se busque dentro de la categoría correcta.
     */
    categoryOverrides?: Record<number, string>;
    /**
     * Número de WhatsApp que registró la factura (queda en
     * `transactions.registered_phone`). Sin él (la app) no se marca.
     */
    registeredPhone?: string;
  } = {},
): Promise<{
  ok: boolean;
  itemsFound: number;
  totalItems: number;
  /**
   * Suma de lo que EFECTIVAMENTE se escribió en `transactions` (los
   * `total_with_tax` de los ítems creados), que es lo que hay que confirmarle
   * al usuario. El `total_amount` de la cabecera puede diferir por descuentos
   * o redondeos: el bot decía "$312.400" y en la app aparecían "$298.000".
   */
  totalAmount: number;
  /** Rubros que la clasificación asignó (sin duplicados), para disparar alertas. */
  budgetItemIds: string[];
  /**
   * Mes DE LA FACTURA (`invoice_date`), no el de hoy: las alertas de
   * presupuesto son por mes, así que el llamador tiene que compararlas contra
   * este mes y no contra el actual. En los retornos tempranos de error
   * `budgetItemIds` siempre viene vacío, así que este valor no se usa — queda
   * en `''` en vez de inventar un mes que no se conoce.
   */
  monthYear: string;
  error?: string;
}> {
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
      totalAmount: 0,
      budgetItemIds: [],
      monthYear: '',
      error: 'Factura no encontrada.',
    };
  }

  const typed = invoiceRow as ElectronicInvoice;
  if (typed.status !== 'pending_review') {
    return {
      ok: false,
      itemsFound: 0,
      totalItems: typed.items?.length ?? 0,
      totalAmount: 0,
      budgetItemIds: [],
      monthYear: '',
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
  // Se acumula sobre lo que de verdad se escribió, ítem por ítem: si el
  // registro se corta a la mitad, el total refleja esa mitad y no la cabecera.
  let totalRegistrado = 0;

  for (const [idx, item] of items.entries()) {
    const monto = item.total_with_tax ?? item.total_price;
    const categoria = deps.categoryOverrides?.[idx] ?? item.category;
    const { data, error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: userId,
      p_description: item.description,
      p_amount: monto,
      p_transaction_date: fecha,
      p_category_name: categoria,
      p_account_name: accountName,
      p_place: typed.supplier_name ?? 'WhatsApp',
    });

    if (error) {
      // Corte a mitad de camino: lo ya creado son transacciones reales, no se
      // revierte. Se clasifica lo que sí se pudo (best-effort).
      await marcarGastosDeFactura(
        supabase,
        userId,
        createdExpenses.map(e => e.id),
        invoiceId,
        deps.registeredPhone,
      );
      const budgetItemIds =
        createdExpenses.length > 0
          ? await clasificar(supabase, userId, createdExpenses)
          : [];
      // Si no se creó ningún gasto todavía no hay riesgo de duplicar: la fila
      // vuelve a pending_review para que la vista de rescate pueda
      // reintentarla. Si ya se creó aunque sea uno, sí queda en error —
      // reintentar duplicaría los ítems que ya son transacciones reales.
      const sinGastosCreados = createdExpenses.length === 0;
      const mensaje = sinGastosCreados
        ? `No se pudo registrar ningún ítem ("${item.description}" falló: ${error.message}). Se puede reintentar.`
        : `${PREFIJO_REGISTRO_PARCIAL} ${createdExpenses.length} de ${items.length} ítems ("${item.description}" falló: ${error.message}).`;
      const { error: updateError } = await supabase
        .from('electronic_invoices')
        .update({
          status: sinGastosCreados ? 'pending_review' : 'error',
          error_message: mensaje,
        })
        .eq('id', invoiceId);
      if (updateError) {
        console.error(
          'createInvoiceDirect: no se pudo actualizar el estado de la factura tras el fallo:',
          updateError.message,
        );
      }
      return {
        ok: false,
        itemsFound: createdExpenses.length,
        totalItems: items.length,
        totalAmount: totalRegistrado,
        budgetItemIds,
        // El mes de la factura, no el de hoy (ver el campo en la firma):
        // estos ítems YA son transacciones reales y también deben poder
        // disparar sus alertas.
        monthYear: fecha.slice(0, 7),
        error: mensaje,
      };
    }

    if (typeof data === 'string') {
      createdExpenses.push({
        id: data,
        description: item.description,
        categoryName: categoria,
        monthYear: fecha.slice(0, 7),
      });
      totalRegistrado += Number(monto ?? 0);
    }
  }

  await marcarGastosDeFactura(
    supabase,
    userId,
    createdExpenses.map(e => e.id),
    invoiceId,
    deps.registeredPhone,
  );
  const budgetItemIds = await clasificar(supabase, userId, createdExpenses);

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

  return {
    ok: true,
    itemsFound: items.length,
    totalItems: items.length,
    totalAmount: totalRegistrado,
    budgetItemIds,
    // El mes de la factura, no el de hoy (ver el campo en la firma).
    monthYear: fecha.slice(0, 7),
  };
}

/**
 * Marca los gastos de una factura con su `electronic_invoice_id` (así una
 * factura cuenta como UN gasto en el ranking de cuentas del bot y un cambio de
 * cuenta posterior encuentra sus ítems) y con el número que la registró.
 *
 * Dos UPDATE separados a propósito: si la columna `registered_phone` todavía
 * no existe (migración sin aplicar), la marca de la factura sale igual.
 * Best-effort: los gastos YA están escritos, esto nunca puede tumbar el
 * registro.
 */
async function marcarGastosDeFactura(
  supabase: DBClient,
  userId: string,
  ids: string[],
  invoiceId: string,
  registeredPhone?: string,
): Promise<void> {
  if (ids.length === 0) return;
  const cambios: Array<Record<string, string>> = [
    { electronic_invoice_id: invoiceId },
  ];
  if (registeredPhone) cambios.push({ registered_phone: registeredPhone });
  for (const cambio of cambios) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update(cambio)
        .eq('user_id', userId)
        .in('id', ids);
      if (error) {
        console.error('marcarGastosDeFactura:', error.message);
      }
    } catch (err) {
      console.error('marcarGastosDeFactura:', err);
    }
  }
}

/**
 * Clasifica (por IA) los gastos recién creados de una factura y los asigna al
 * ítem del presupuesto correspondiente. Server-side: usa el cliente tipado y el
 * userId conocido (no depende de la sesión del navegador). Best-effort: agrupa
 * por mes y por categoría del gasto, acota la IA a los ítems de esa categoría, y
 * solo asigna cuando hay match. Nunca relanza (si falla, el gasto queda sin
 * clasificar y aparece en el panel rojo del presupuesto).
 *
 * Devuelve los `budget_item_id` que efectivamente quedaron asignados (sin
 * duplicados), para que el llamador pueda disparar las alertas de presupuesto
 * de esos rubros. Un id solo cuenta como asignado si el RPC de asignación lo
 * confirmó: reportar un rubro que no quedó escrito dispararía una alerta
 * sobre un gasto que en realidad no está en ese rubro.
 */
export async function classifyApprovedExpenses(
  supabase: DBClient,
  userId: string,
  expenses: GastoAClasificar[],
): Promise<string[]> {
  // Mismo camino que la ruta /api/expenses/classify. `clasificarGastos` nunca
  // relanza y solo reporta lo que el RPC confirmó; acá solo se deduplican los
  // rubros porque las alertas son por rubro.
  const { asignados } = await clasificarGastos(supabase, userId, expenses);
  return [...new Set(asignados.map(a => a.budgetItemId))];
}
