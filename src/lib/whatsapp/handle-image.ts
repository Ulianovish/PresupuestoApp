// Orquestador de mensajes con imagen (corre en after). Descarga la media, la
// analiza con visión y enruta: transferencia → gasto directo; recibo →
// registro directo (o pregunta la cuenta si no se puede resolver).

import { normalizar, resolverCuenta } from '@/lib/whatsapp/agent/tools';
import { formatCOP } from '@/lib/whatsapp/format';
import type { VisionResult } from '@/lib/whatsapp/vision';

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
  ) => Promise<{
    ok: boolean;
    category: string;
    error?: string;
    /** Rubro de presupuesto asignado, si lo hubo (ver `onExpenseCreated`). */
    budgetItemId?: string | null;
  }>;
  /**
   * Se llama tras registrar el gasto, con el rubro que tocó (misma firma que
   * `tools.ts`). Esta rama no tiene el acumulador `alertasPendientes` del
   * agente: devuelve los mensajes de alerta para que se peguen al único
   * mensaje que esta rama manda con `sendMessage`.
   */
  onExpenseCreated: (e: {
    categoria: string;
    budgetItemIds: string[];
  }) => Promise<string[]>;
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
  ) => Promise<{
    ok: boolean;
    itemsFound: number;
    totalItems: number;
    /** Suma de lo que EFECTIVAMENTE quedó registrado (ver `createInvoiceDirect`). */
    totalAmount?: number;
    /** Rubros que tocó la factura (ver `onExpenseCreated`), para disparar alertas. */
    budgetItemIds?: string[];
    error?: string;
  }>;
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
    // `result.account` es texto crudo de la visión y NO se puede pasar tal cual
    // al RPC: `upsert_monthly_expense` CREA la cuenta si el nombre no matchea
    // exacto, así que un "Nequi" leído contra un "NEQUI" real inventaba una
    // cuenta nueva en silencio que después aparecía en el prompt de todos los
    // mensajes. Se canonicaliza igual que la rama de recibo (el texto del
    // usuario le gana a la visión) y, si no resuelve, se usa la por defecto.
    const accountName =
      resolveAccountFromMessage(ctx.body, result.account, deps.accounts) ??
      (await deps.resolveDefaultAccount(ctx.phone));
    const res = await deps.createDirectExpense(ctx.userId, ctx.phone, {
      amount: result.amount,
      description: result.description ?? 'Transferencia',
      accountName,
      date: result.date ?? deps.today(),
    });
    if (res.ok) {
      // Best-effort: el gasto YA está guardado (mismo criterio que executeTool).
      // La alerta se pega al mismo mensaje, no va como uno aparte: acá no hay
      // acumulador porque esta rama responde por su cuenta.
      let alertas: string[] = [];
      try {
        alertas = await deps.onExpenseCreated({
          categoria: res.category,
          budgetItemIds: res.budgetItemId ? [res.budgetItemId] : [],
        });
      } catch (errAlerta) {
        console.error('handleImage(transfer): onExpenseCreated falló:', errAlerta);
      }
      const base = `✅ Registré ${formatCOP(result.amount)} en ${res.category} (${accountName}). Si algo está mal, edítalo en la app.`;
      await deps.sendMessage(
        ctx.phone,
        alertas.length > 0 ? `${base}\n\n${alertas.join('\n\n')}` : base,
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
      // El total que se confirma es el REGISTRADO (suma de los ítems que
      // entraron en transactions), no el que leyó la visión en la cabecera:
      // con descuentos o redondeos difieren y el usuario veía en la app un
      // número distinto del que le confirmó el bot.
      const totalRegistradoTexto =
        res.totalAmount != null ? ` por ${formatCOP(res.totalAmount)}` : totalTexto;
      // Best-effort, mismo criterio que `registrar_factura` en tools.ts: los
      // gastos de la factura YA están escritos, una alerta que falle no puede
      // convertir esto en un "no pude registrar". Se pega al mismo mensaje.
      const rubros = res.budgetItemIds ?? [];
      let alertas: string[] = [];
      if (rubros.length > 0) {
        try {
          alertas = await deps.onExpenseCreated({
            categoria: 'FACTURA',
            budgetItemIds: rubros,
          });
        } catch (errAlerta) {
          console.error('handleImage(receipt): onExpenseCreated falló:', errAlerta);
        }
      }
      const base = `✅ Registré tu factura${supplierTexto}${totalRegistradoTexto} (${res.itemsFound} ítems) en ${cuenta}.`;
      await deps.sendMessage(
        ctx.phone,
        alertas.length > 0 ? `${base}\n\n${alertas.join('\n\n')}` : base,
      );
    } else if (res.itemsFound > 0) {
      // Fallo a mitad de camino: esos ítems YA son transacciones reales. Decir
      // "no pude guardar la factura" empujaría a reenviar la foto y duplicarlos.
      // El panel "Facturas sin completar" no tiene botón para esto (solo para
      // pending_review): la acción real es cargar el resto a mano en Gastos.
      await deps.sendMessage(
        ctx.phone,
        `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura${supplierTexto} en ${cuenta} (esos ya están en tus gastos, no se perdieron). Los que faltan, cargalos a mano en Gastos; no reenvíes la foto, duplicaría los que ya quedaron.`,
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
