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

import { pegarAlertas } from '@/lib/whatsapp/alerts';
import { extractCufe } from '@/lib/whatsapp/classify';
import { formatCOP, todayBogota } from '@/lib/whatsapp/format';
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
  /**
   * La factura quedó registrada a medias en un intento anterior: parte de sus
   * ítems ya son gastos reales (`itemsFound` de `totalItems`). Reprocesarla
   * los duplicaría; los que faltan hay que cargarlos a mano en Gastos.
   */
  | { ok: false; reason: 'partial'; itemsFound: number; totalItems: number }
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
  ) => Promise<{
    ok: boolean;
    itemsFound: number;
    totalItems: number;
    /** Suma de lo que EFECTIVAMENTE quedó registrado (ver `createInvoiceDirect`). */
    totalAmount?: number;
    /** Rubros que tocó la factura (ver `onExpenseCreated`), para disparar alertas. */
    budgetItemIds?: string[];
    /** Mes DE LA FACTURA (ver `createInvoiceDirect`), no el de hoy. */
    monthYear?: string;
    error?: string;
  }>;
  /**
   * Se llama tras registrar la factura, con los rubros que tocó (misma firma
   * que `tools.ts` y `handle-image.ts`). Esta rama tampoco tiene el
   * acumulador `alertasPendientes` del agente: devuelve los mensajes de
   * alerta para que se peguen al único mensaje que esta rama manda con
   * `sendMessage`.
   *
   * `monthYear` es el mes DE LA FACTURA, nunca el de hoy: ver
   * `dispararAlertasWhatsapp`.
   */
  onExpenseCreated: (e: {
    categoria: string;
    budgetItemIds: string[];
    monthYear: string;
  }) => Promise<string[]>;
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
    // Un CUFE no trae cuenta detectada por visión: solo puede resolverse por
    // el texto que el usuario escribió junto al código.
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
    // Mes DE LA FACTURA (createInvoiceDirect lo devuelve junto a los rubros),
    // no el de hoy: ver el comentario en `dispararAlertasWhatsapp`. Fallback a
    // hoy solo defensivo (mock de test sin `monthYear`); en producción
    // `registerInvoice` siempre lo manda.
    const monthYear = res.monthYear ?? todayBogota().slice(0, 7);
    // Dispara el enganche si hay rubros, tragándose cualquier falla
    // (best-effort): ni el camino feliz ni el parcial pueden convertir un
    // gasto ya escrito en un error. Los ítems de un registro parcial YA son
    // transacciones reales con rubro asignado, así que quedarse a medias no
    // los excluye de las alertas.
    const avisarRubros = async (rubros: string[]): Promise<string[]> => {
      if (rubros.length === 0) return [];
      try {
        return await deps.onExpenseCreated({
          categoria: 'FACTURA',
          budgetItemIds: rubros,
          monthYear,
        });
      } catch (errAlerta) {
        console.error(
          'handleAgentMessage(cufe): onExpenseCreated falló:',
          errAlerta,
        );
        return [];
      }
    };
    if (res.ok) {
      // El total que se confirma es el REGISTRADO (suma de los ítems que
      // entraron en transactions), no el de la cabecera de la factura: con
      // descuentos o redondeos difieren y el usuario veía en la app un número
      // distinto del que le confirmó el bot.
      const totalRegistradoTexto =
        res.totalAmount != null
          ? ` por ${formatCOP(res.totalAmount)}`
          : totalTexto;
      // Best-effort, mismo criterio que `registrar_factura` en tools.ts: los
      // gastos de la factura YA están escritos, una alerta que falle no puede
      // convertir esto en un "no pude guardar". Se pega al mismo mensaje.
      const alertas = await avisarRubros(res.budgetItemIds ?? []);
      const base = `✅ Registré tu factura${supplierTexto}${totalRegistradoTexto} (${res.itemsFound} ítems) en ${cuenta}.`;
      await deps.sendMessage(ctx.phone, pegarAlertas(base, alertas));
    } else if (res.itemsFound > 0) {
      // Fallo a mitad de camino: esos ítems YA son transacciones reales. Decir
      // "no pude guardar la factura" empujaría a reenviar el CUFE y duplicarlos.
      // El panel "Facturas sin completar" no tiene botón para esto (solo para
      // pending_review): la acción real es cargar el resto a mano en Gastos.
      // Esos ítems también quedan con rubro asignado: la alerta también avisa.
      const alertas = await avisarRubros(res.budgetItemIds ?? []);
      const base = `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura${supplierTexto} en ${cuenta} (esos ya están en tus gastos, no se perdieron). Los que faltan, cargalos a mano en Gastos; no vuelvas a mandar el CUFE, duplicaría los que ya quedaron.`;
      await deps.sendMessage(ctx.phone, pegarAlertas(base, alertas));
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
  } else if (out.reason === 'partial') {
    // El panel "Facturas sin completar" no tiene botón para esto (solo para
    // pending_review): la acción real es cargar el resto a mano en Gastos.
    await deps.sendMessage(
      ctx.phone,
      `⚠️ Esa factura quedó registrada a medias: ${out.itemsFound} de ${out.totalItems} ítems ya son gastos tuyos (no se perdieron). No la vuelvo a procesar porque duplicaría esos; los que faltan, cargalos a mano en Gastos.`,
    );
  } else {
    await deps.sendMessage(
      ctx.phone,
      // El mensaje del motor suele venir ya con punto final; no duplicarlo.
      `❌ No pude procesar la factura: ${out.message.replace(/\.?$/, '.')} Puedes reintentar más tarde.`,
    );
  }
}
