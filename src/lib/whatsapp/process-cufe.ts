// Procesa un CUFE para WhatsApp: dedup + scrape (o retoma una factura que ya
// se scrapeó y quedó esperando cuenta) y mapea el resultado a `CufeOutcome`.
// Extraído del webhook (que solo hacía `await after(...)`) para poder
// testear la lógica de dedup/degradación sin Twilio ni NextRequest de por
// medio — mismo criterio que separó `handle-image.ts`/`handle-agent.ts` del
// route.

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
} from '@/lib/dian/process-invoice';
import {
  getPendingInvoiceSummary,
  resolveUserCategoryNames,
} from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase/server';
import type { CufeOutcome } from '@/lib/whatsapp/handle-agent';

/**
 * `getPendingInvoiceSummary` con degradación: el CUFE ya se scrapeó y
 * persistió con éxito antes de esta lectura, así que un blip de red hacia
 * Supabase acá no puede convertir ese éxito en "tuve un problema interno" —
 * el usuario igual tiene que recibir la pregunta de la cuenta, solo que sin
 * proveedor/total en el texto.
 */
async function safeReadSupplierTotal(
  userId: string,
  invoiceId: string,
): Promise<{ supplier: string | null; total: number | null }> {
  try {
    const resumen = await getPendingInvoiceSummary(userId, invoiceId);
    return { supplier: resumen?.supplier ?? null, total: resumen?.total ?? null };
  } catch (err) {
    console.error(
      'processCufeForWhatsApp: no se pudo releer proveedor/total (se sigue sin ellos):',
      err,
    );
    return { supplier: null, total: null };
  }
}

/** Procesa un CUFE para WhatsApp con service-role; mapea el resultado a CufeOutcome. */
export async function processCufeForWhatsApp(
  userId: string,
  cufe: string,
): Promise<CufeOutcome> {
  const admin = createAdminClient();
  const prep = await prepareInvoiceProcessing(userId, cufe, admin);
  if (prep.kind === 'duplicate') return { ok: false, reason: 'duplicate' };
  if (prep.kind === 'error') return { ok: false, reason: 'error', message: prep.message };

  if (prep.kind === 'awaiting_account') {
    // Reenvío del mismo CUFE mientras la factura seguía en pending_review:
    // ya se scrapeó antes, nadie contestó la cuenta todavía. No es un
    // duplicado real (nada que "ya se procesó" del todo) — se retoma sin
    // volver a scrapear, en vez de decir "ya la había procesado" y dejar al
    // usuario sin salida.
    const { supplier, total } = await safeReadSupplierTotal(userId, prep.invoice.id);
    return {
      ok: true,
      itemsFound: (prep.invoice.items || []).length,
      invoiceId: prep.invoice.id,
      supplier,
      total,
    };
  }

  const categoryNames = await resolveUserCategoryNames(admin, userId);
  const run = await runInvoiceProcessing(prep.invoiceId, cufe, {
    categoryNames,
    client: admin,
  });
  if (!run.ok) return { ok: false, reason: 'error', message: run.message };

  // La factura ya quedó persistida como `pending_review` (la creó
  // `saveProcessedInvoice`); se relee para poder confirmarle al usuario el
  // proveedor y el total, igual que hace la vía de imagen con la lectura de
  // la visión. `handleAgentMessage` necesita el id para resolver la cuenta o
  // guardar el `pending`, no la factura entera.
  const { supplier, total } = await safeReadSupplierTotal(userId, prep.invoiceId);
  return {
    ok: true,
    itemsFound: run.itemsFound,
    invoiceId: prep.invoiceId,
    supplier,
    total,
  };
}
