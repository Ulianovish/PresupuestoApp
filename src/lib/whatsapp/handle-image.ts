// Orquestador de mensajes con imagen (corre en after). Descarga la media, la
// analiza con visión y enruta: transferencia → gasto directo; recibo →
// registro directo (o pregunta la cuenta si no se puede resolver).

import type { PendingInvoice } from '@/lib/whatsapp/agent/state';
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
  /** Guarda la factura leída, esperando que el usuario diga con qué cuenta pagó. */
  savePending: (inv: PendingInvoice) => Promise<void>;
  /** Registra la factura ya resuelta (sin aprobación manual). */
  registerInvoice: (
    inv: PendingInvoice,
    accountName: string,
  ) => Promise<{ ok: boolean; itemsFound: number; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string;
}

export interface ImageContext {
  userId: string;
  phone: string;
  mediaUrl: string;
  /** Texto que acompañó la imagen (p. ej. "con la Davivienda"). */
  body: string;
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
    const invoice: PendingInvoice = {
      source: 'vision_receipt',
      cufe: null,
      supplier: result.supplier,
      date: result.date ?? deps.today(),
      total: result.total,
      items: result.items,
    };

    const cuenta = resolveAccountFromMessage(ctx.body, null, deps.accounts);
    if (!cuenta) {
      await deps.savePending(invoice);
      await deps.sendMessage(
        ctx.phone,
        `🧾 Leí tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${result.items.length} ítems). ¿Con qué cuenta la pagaste?`,
      );
      return;
    }

    const res = await deps.registerInvoice(invoice, cuenta);
    await deps.sendMessage(
      ctx.phone,
      res.ok
        ? `✅ Registré tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${res.itemsFound} ítems) en ${cuenta}.`
        : `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
    );
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
