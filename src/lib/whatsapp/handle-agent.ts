// Orquestador del agente para mensajes de un usuario YA vinculado. Corre en
// background (after) y manda las respuestas por el transporte saliente. Deps
// inyectadas para testear sin red ni DB.
//
// Solo maneja 'cufe': `classifyText` nunca produce 'quick_expense' (ese
// enrutado por texto se sacó por acertar mal en silencio, ver classify.ts),
// así que esa rama quedaba inalcanzable y se eliminó junto con sus deps.
//
// El CUFE ya persiste la factura como `pending_review` (la crea el motor de
// procesamiento, ver `saveProcessedInvoice`), así que a diferencia de la vía
// de imagen no hace falta crear el borrador acá: solo resolver la cuenta y,
// o bien registrar con `createInvoiceDirect`, o bien guardar el `pending` y
// preguntar — el mismo criterio y los mismos textos que usa
// `handle-image.ts` para que las dos vías respondan igual.

import { extractCufe } from '@/lib/whatsapp/classify';
import { formatCOP } from '@/lib/whatsapp/format';
import { resolveAccountFromMessage } from '@/lib/whatsapp/handle-image';

export type CufeOutcome =
  | {
      ok: true;
      itemsFound: number;
      /** Id de la factura ya persistida como `pending_review`. */
      invoiceId: string;
      supplier?: string | null;
      total?: number | null;
    }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'error'; message: string };

export interface AgentDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  processCufe: (userId: string, cufe: string) => Promise<CufeOutcome>;
  /** Cuentas activas del usuario, para resolver con cuál se pagó la factura. */
  accounts: string[];
  /** Guarda el id de la factura ya persistida, esperando que el usuario diga con qué cuenta pagó. */
  savePending: (invoiceId: string) => Promise<void>;
  /** Registra la factura ya persistida y resuelta (sin aprobación manual). */
  registerInvoice: (
    invoiceId: string,
    accountName: string,
  ) => Promise<{ ok: boolean; itemsFound: number; totalItems: number; error?: string }>;
}

export interface AgentContext {
  userId: string;
  phone: string;
  body: string;
  /**
   * Id de la factura que ya estaba esperando cuenta ANTES de este CUFE, si
   * la había. Sirve para avisar en vez de pisarla en silencio si este CUFE
   * también necesita preguntar (mismo criterio que `handle-image.ts`).
   */
  existingPendingId: string | null;
}

export async function handleAgentMessage(
  decision: 'cufe',
  ctx: AgentContext,
  deps: AgentDeps,
): Promise<void> {
  const cufe = extractCufe(ctx.body);
  if (!cufe) {
    await deps.sendMessage(
      ctx.phone,
      'No encontré un CUFE válido en tu mensaje 🤔. Pega el CUFE (96 caracteres) o el texto/QR completo de la factura.',
    );
    return;
  }
  const out = await deps.processCufe(ctx.userId, cufe);

  if (out.ok) {
    const supplierTexto = out.supplier ? ` de ${out.supplier}` : '';
    const totalTexto = out.total != null ? ` por ${formatCOP(out.total)}` : '';
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
      await deps.savePending(out.invoiceId);
      await deps.sendMessage(
        ctx.phone,
        `🧾 Leí tu factura${supplierTexto}${totalTexto} (${out.itemsFound} ítems). ¿Con qué cuenta la pagaste?`,
      );
      return;
    }

    const res = await deps.registerInvoice(out.invoiceId, cuenta);
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Registré tu factura${supplierTexto}${totalTexto} (${res.itemsFound} ítems) en ${cuenta}.`,
      );
    } else if (res.itemsFound > 0) {
      // Fallo a mitad de camino: esos ítems YA son transacciones reales. Decir
      // "no pude guardar la factura" empujaría a reenviar el CUFE y duplicarlos.
      await deps.sendMessage(
        ctx.phone,
        `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura${supplierTexto} en ${cuenta}; el resto falló. Revisala en la app, no vuelvas a mandar el CUFE.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  if (out.reason === 'duplicate') {
    await deps.sendMessage(ctx.phone, 'Esa factura ya la había procesado. 👍');
  } else {
    await deps.sendMessage(
      ctx.phone,
      // El mensaje del motor suele venir ya con punto final; no duplicarlo.
      `❌ No pude procesar la factura: ${out.message.replace(/\.?$/, '.')} Puedes reintentar más tarde.`,
    );
  }
}
