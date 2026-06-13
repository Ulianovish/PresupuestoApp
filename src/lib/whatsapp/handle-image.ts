// Orquestador de mensajes con imagen (corre en after). Descarga la media, la
// analiza con visión y enruta: transferencia → gasto directo; recibo → borrador.
// Deps inyectadas para testear sin red ni DB.

import type { VisionResult } from '@/lib/whatsapp/vision';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
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
  createVisionReceiptDraft: (
    userId: string,
    input: {
      supplier: string | null;
      date: string;
      items: Array<{ description: string; amount: number }>;
      total: number | null;
    },
  ) => Promise<{ ok: boolean; itemsFound: number; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string;
}

export interface ImageContext {
  userId: string;
  phone: string;
  mediaUrl: string;
  mediaType: string;
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
    const res = await deps.createVisionReceiptDraft(ctx.userId, {
      supplier: result.supplier,
      date: result.date ?? deps.today(),
      items: result.items,
      total: result.total,
    });
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Leí tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${res.itemsFound} ítems). Queda lista para revisar y aprobar en la app.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  await deps.sendMessage(
    ctx.phone,
    'No pude leer la imagen 🤔. Reenvíala más clara, o escribe el gasto (ej. "20k taxi") o pega el CUFE.',
  );
}
