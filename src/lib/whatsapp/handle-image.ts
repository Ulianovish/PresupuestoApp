// Orquestador de mensajes con imagen (corre en after). Descarga la media, la
// analiza con visión y enruta: transferencia → gasto directo; recibo →
// registro directo (o pregunta la cuenta si no se puede resolver).

import { resolverCuenta } from '@/lib/whatsapp/agent/tools';
import { formatCOP } from '@/lib/whatsapp/format';
import type { VisionResult } from '@/lib/whatsapp/vision';

/** Compara texto libre contra nombres de cuenta ignorando mayúsculas y tildes. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase();
}

/**
 * Busca en el texto libre la palabra más distintiva de cada cuenta (p. ej.
 * "Davivienda" en "Davivienda Crédito"), para que "con la Davivienda" ande
 * sin que el usuario tenga que escribir el nombre exacto. Con las ~23 cuentas
 * reales del usuario varias comparten palabra (8 variantes de "Nu"): si más
 * de una cuenta matchea, es ambigua y se trata como no resuelta.
 */
function resolverPorTexto(texto: string, accounts: string[]): string | null {
  const t = normalizar(texto || '');
  if (!t) return null;

  const candidatas = accounts.filter(a =>
    normalizar(a)
      .split(/\s+/)
      .some(palabra => palabra.length >= 4 && t.includes(palabra)),
  );
  if (candidatas.length !== 1) return null;

  // La candidata ya es una cuenta real (viene de `accounts`); se pasa por
  // `resolverCuenta` para canonicalizar con la misma lógica que usa el resto
  // del agente (y no duplicar el criterio de "qué es una cuenta válida").
  const resolucion = resolverCuenta(candidatas[0], accounts);
  return resolucion.kind === 'ok' ? resolucion.cuenta : null;
}

/**
 * Resuelve con qué cuenta se pagó, en orden: lo que escribió el usuario junto
 * a la imagen, después lo que detectó la visión. El texto le gana a la
 * visión porque el usuario sabe más que la foto. Null = hay que preguntarle.
 *
 * Se apoya en `resolverCuenta` (misma que usa el resto del agente): una
 * ambigüedad real entre cuentas del usuario (p. ej. "Davivienda" y
 * "DAVIVIENDA" coexistiendo, o varias cuentas que comparten palabra) se
 * trata como "no resuelto", nunca se elige una candidata al azar.
 */
export function resolveAccountFromMessage(
  texto: string,
  visionAccount: string | null,
  accounts: string[],
): string | null {
  const porTexto = resolverPorTexto(texto, accounts);
  if (porTexto) return porTexto;

  if (visionAccount) {
    const resolucion = resolverCuenta(visionAccount, accounts);
    if (resolucion.kind === 'ok') return resolucion.cuenta;
  }
  return null;
}

export interface ReceiptDraftInput {
  supplier: string | null;
  date: string;
  items: Array<{ description: string; amount: number }>;
  total: number | null;
}

export interface ImageDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  downloadMedia: (url: string) => Promise<{ base64: string; mime: string } | null>;
  analyzeImage: (base64: string, mime: string) => Promise<VisionResult>;
  createDirectExpense: (
    userId: string,
    phone: string,
    input: { amount: number; description: string; accountName: string; date: string },
  ) => Promise<{ ok: boolean; category: string; error?: string }>;
  /** Cuentas activas del usuario, para resolver con cuál se pagó una factura. */
  accounts: string[];
  /**
   * Persiste la factura leída como borrador (`pending_review`) en
   * `electronic_invoices`. Se llama SIEMPRE que la visión lee un recibo,
   * resuelva o no la cuenta en este mismo mensaje: así la factura sobrevive
   * al TTL de la conversación y a una segunda foto que llegue antes de la
   * respuesta — antes solo vivía en `pending`, que vence y se pisa.
   */
  createReceiptDraft: (
    userId: string,
    input: ReceiptDraftInput,
  ) => Promise<{ ok: boolean; itemsFound: number; invoiceId?: string; error?: string }>;
  /** Guarda el id de la factura ya persistida, esperando que el usuario diga con qué cuenta pagó. */
  savePending: (invoiceId: string) => Promise<void>;
  /** Registra la factura ya persistida y resuelta (sin aprobación manual). */
  registerInvoice: (
    invoiceId: string,
    accountName: string,
  ) => Promise<{ ok: boolean; itemsFound: number; totalItems: number; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string;
}

export interface ImageContext {
  userId: string;
  phone: string;
  mediaUrl: string;
  /** Texto que acompañó la imagen (p. ej. "con la Davivienda"). */
  body: string;
  /**
   * Id de la factura que ya estaba esperando cuenta ANTES de esta foto, si
   * la había. Sirve para avisar en vez de pisarla en silencio si esta foto
   * también necesita preguntar.
   */
  existingPendingId: string | null;
}

export async function handleImageMessage(
  ctx: ImageContext,
  deps: ImageDeps,
): Promise<void> {
  const media = await deps.downloadMedia(ctx.mediaUrl);
  if (!media) {
    await deps.sendMessage(
      ctx.phone,
      '❌ No pude descargar la imagen. Inténtalo de nuevo en un momento.',
    );
    return;
  }

  const result = await deps.analyzeImage(media.base64, media.mime);

  if (result.kind === 'transfer') {
    const accountName =
      result.account ?? (await deps.resolveDefaultAccount(ctx.phone));
    const res = await deps.createDirectExpense(ctx.userId, ctx.phone, {
      amount: result.amount,
      description: result.description ?? 'Transferencia',
      accountName,
      date: result.date ?? deps.today(),
    });
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Registré ${formatCOP(result.amount)} en ${res.category} (${accountName}). Si algo está mal, edítalo en la app.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude registrar el gasto: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  if (result.kind === 'receipt') {
    // Persistir SIEMPRE, antes de decidir si hay que preguntar: si no se
    // guarda acá, la factura solo existiría en `pending` (vence a los 30 min,
    // y una segunda foto lo pisa) y podría desaparecer sin que el usuario se
    // entere de que "ya está guardada" fue mentira.
    const draft = await deps.createReceiptDraft(ctx.userId, {
      supplier: result.supplier,
      date: result.date ?? deps.today(),
      items: result.items,
      total: result.total,
    });
    if (!draft.ok || !draft.invoiceId) {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude guardar la factura: ${draft.error ?? 'error desconocido'}.`,
      );
      return;
    }

    const supplierTexto = result.supplier ? ` de ${result.supplier}` : '';
    const totalTexto = result.total != null ? ` por ${formatCOP(result.total)}` : '';
    const cuenta = resolveAccountFromMessage(ctx.body, null, deps.accounts);

    if (!cuenta) {
      if (ctx.existingPendingId) {
        // No pisar en silencio: la factura anterior sigue existiendo como
        // borrador en la app (nunca se pierde), pero el agente deja de
        // preguntar por ella en el chat en cuanto pregunta por esta nueva.
        await deps.sendMessage(
          ctx.phone,
          '📝 Ya tenías otra factura esperando cuenta; quedó guardada como borrador en la app, la podés completar ahí cuando quieras.',
        );
      }
      await deps.savePending(draft.invoiceId);
      await deps.sendMessage(
        ctx.phone,
        `🧾 Leí tu factura${supplierTexto}${totalTexto} (${result.items.length} ítems). ¿Con qué cuenta la pagaste?`,
      );
      return;
    }

    const res = await deps.registerInvoice(draft.invoiceId, cuenta);
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Registré tu factura${supplierTexto}${totalTexto} (${res.itemsFound} ítems) en ${cuenta}.`,
      );
    } else if (res.itemsFound > 0) {
      // Fallo a mitad de camino: esos ítems YA son transacciones reales. Decir
      // "no pude guardar la factura" empujaría a reenviar la foto y duplicarlos.
      await deps.sendMessage(
        ctx.phone,
        `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura${supplierTexto} en ${cuenta}; el resto falló. Revisala en la app, no reenvíes la foto.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  if (result.kind === 'service_error') {
    // No es culpa de la foto: pedirle al usuario que la mejore lo manda a
    // perseguir un problema que no existe.
    await deps.sendMessage(
      ctx.phone,
      '⚠️ El lector de imágenes está fallando ahora mismo (no es tu foto). Reenvíala en un minuto, o escribe el gasto (ej. "20k taxi").',
    );
    return;
  }

  await deps.sendMessage(
    ctx.phone,
    'No pude leer la imagen 🤔. Reenvíala más clara, o escribe el gasto (ej. "20k taxi") o pega el CUFE.',
  );
}
