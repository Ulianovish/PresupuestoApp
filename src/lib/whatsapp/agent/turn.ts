// Orquesta un turno del agente: lee estado, corre el bucle, responde y guarda.
// Si el Gateway falla —o si ni siquiera se pudo armar el contexto (DB abajo)—
// cae a `parseQuickExpense` para no dejar al usuario sin nada: un gasto
// simple se sigue registrando con el LLM caído.

import {
  createInvoiceDirect,
  getPendingInvoiceSummary,
  resolveUserCategoryNames,
} from '@/lib/services/invoices';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import {
  applyCorrection,
  correctLastExpense,
  queryExpenseTotal,
} from '@/lib/services/whatsapp-queries';
import { createAdminClient } from '@/lib/supabase/server';
import { formatCOP, todayBogota } from '@/lib/whatsapp/format';
import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

import { callGatewayReal, runAgent } from './run';
import { readState, writeState } from './state';
import { executeTool, type ToolDeps } from './tools';

import type {
  ConversationState,
  LastEntity,
  PendingInvoice,
  Turn,
} from './state';

// Cuenta de último recurso cuando ni siquiera se pudo resolver la cuenta por
// defecto del usuario (p. ej. `resolveDefaultAccount` fue justo lo que
// falló). Mismo valor que FALLBACK_ACCOUNT en whatsapp-expenses.ts.
const CUENTA_DE_EMERGENCIA = 'Efectivo';

/**
 * Aviso para cuando el Gateway se cae DESPUÉS de que una herramienta ya
 * escribió. No se puede reintentar nada (ni por el modo degradado ni pidiéndole
 * al usuario que reenvíe): lo escrito son transacciones reales y volver a
 * pasar el mismo mensaje las duplicaría.
 */
const AVISO_CORTE_CON_ESCRITURAS =
  '⚠️ Registré lo que me pediste, pero se me cortó la conversación antes de terminar. Revisá en la app si algo quedó a medias — no me lo reenvíes, se duplicaría.';

/** Cuentas activas del usuario. Compartida con el flujo de imágenes del webhook. */
export async function listarCuentas(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('accounts')
    .select('name')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data ?? []).map((r: { name: string }) => r.name);
}

interface TurnCtx {
  userId: string;
  phone: string;
  body: string;
}

/**
 * Modo degradado: si `parseQuickExpense` reconoce el mensaje, registra el
 * gasto igual y responde con el mismo formato que `handle-agent.ts` usa para
 * quick_expense (monto formateado + descripción). Incluir la descripción
 * importa: `parseQuickExpense` es el parser que acierta mal en silencio
 * ("2 empanadas 5000" -> $2), y solo viéndola el usuario puede pescar el
 * error justo en el camino donde ese parser volvió a decidir.
 */
async function intentarModoDegradado(
  ctx: TurnCtx,
  cuentaDefecto: string,
): Promise<string> {
  const rapido = parseQuickExpense(ctx.body);
  if (!rapido) {
    return '⚠️ Mi asistente está fallando ahora mismo (no es tu mensaje). Probá en un minuto, o escribí el gasto simple: "20k taxi".';
  }
  const res = await createDirectExpense(ctx.userId, ctx.phone, {
    amount: rapido.amount,
    description: rapido.description,
    accountName: cuentaDefecto,
    date: todayBogota(),
  });
  return res.ok
    ? `✅ Anotado ${formatCOP(rapido.amount)} en ${res.category} (${cuentaDefecto}) · ${rapido.description}. Si algo está mal, edítalo en la app.`
    : '❌ No pude registrar el gasto. Intentá de nuevo en un momento.';
}

/**
 * Manda la respuesta y guarda el turno, más allá de qué camino la generó.
 *
 * `lastEntity` es opcional y solo se incluye en el patch cuando el turno
 * efectivamente lo tocó (gasto nuevo o corrección aplicada): así el camino
 * feliz sin cambios de entidad no pisa el `last_entity` ya guardado con el
 * mismo valor innecesariamente.
 */
async function responderYGuardar(
  ctx: TurnCtx,
  turnosPrevios: Turn[],
  texto: string,
  lastEntity?: LastEntity | null,
): Promise<void> {
  await sendWhatsAppMessage(ctx.phone, texto);
  await writeState(ctx.phone, ctx.userId, {
    turns: [
      ...turnosPrevios,
      { role: 'user', content: ctx.body },
      { role: 'assistant', content: texto },
    ],
    ...(lastEntity !== undefined ? { lastEntity } : {}),
  });
}

export async function handleAgentTurn(ctx: TurnCtx): Promise<void> {
  let estado: ConversationState;
  let cuentas: string[];
  let categorias: string[];
  let cuentaDefecto: string;
  // Vista de la factura pendiente para el prompt ("HAY UNA FACTURA
  // ESPERANDO CUENTA..."). `estado.pending` solo guarda el id (ver
  // `agent/state.ts`); la factura real vive en `electronic_invoices` desde
  // que la visión la leyó, así que hay que ir a buscarla.
  let facturaPendiente: PendingInvoice | null = null;

  try {
    estado = await readState(ctx.phone);
    [cuentas, categorias, cuentaDefecto] = await Promise.all([
      listarCuentas(ctx.userId),
      resolveUserCategoryNames(createAdminClient(), ctx.userId),
      resolveDefaultAccount(ctx.phone),
    ]);
    if (estado.pending) {
      facturaPendiente = await getPendingInvoiceSummary(
        ctx.userId,
        estado.pending.invoiceId,
      );
    }
  } catch (err) {
    // Una falla de base al armar el contexto no puede dejar al usuario sin
    // nada: el mismo modo degradado que cubre al Gateway caído cubre esto.
    // Sin `estado` ni `cuentaDefecto` resueltos, se arranca de cero y se usa
    // la cuenta de emergencia.
    console.error('handleAgentTurn: falló al armar el contexto:', err);
    const texto = await intentarModoDegradado(ctx, CUENTA_DE_EMERGENCIA);
    await responderYGuardar(ctx, [], texto);
    return;
  }

  // Se prende cuando `createExpense` o `correctLast` tocan `estado.lastEntity`,
  // para que solo esos turnos lo incluyan en el patch final (ver
  // `responderYGuardar`).
  let lastEntityDirty = false;

  const deps: ToolDeps = {
    accounts: cuentas,
    categories: categorias,
    defaultAccount: cuentaDefecto,
    today: todayBogota,
    createExpense: async input => {
      const res = await createDirectExpense(ctx.userId, ctx.phone, input);
      // El último gasto registrado queda disponible para "no, eran 30 mil":
      // si el mensaje trae varios gastos, el último en guardarse gana, que es
      // el comportamiento esperado de "lo último".
      if (res.ok && res.transactionId) {
        estado = {
          ...estado,
          lastEntity: {
            kind: 'expense',
            transactionId: res.transactionId,
            amount: input.amount,
            description: input.description,
            accountName: input.accountName,
            category: res.category,
            date: input.date,
          },
        };
        lastEntityDirty = true;
      }
      return res;
    },
    registerInvoice: async (accountName: string) => {
      const invoiceId = estado.pending?.invoiceId;
      if (!invoiceId) {
        return {
          ok: false,
          itemsFound: 0,
          totalItems: 0,
          error: 'no hay factura pendiente',
        };
      }
      // Anular el pendiente EN MEMORIA ya, no solo en la base: si el modelo
      // llama registrar_factura dos veces en la misma vuelta (o en vueltas
      // sucesivas del mismo turno), la segunda no puede volver a encontrar
      // la factura y registrarla de nuevo. `createInvoiceDirect` además
      // rechaza una fila que ya no esté en pending_review, como refuerzo
      // por si la llamada viniera de otro turno concurrente.
      //
      // `lastEntity: null` en la misma movida: registrar una factura NO deja
      // un "último gasto" corregible (una factura son N transacciones, no
      // una). Si se dejara el gasto de texto anterior, un "no, esa fue con la
      // Nequi" justo después de la factura corregiría una transacción vieja y
      // ajena, y encima contestaría "Corregido". Con null, `corregir_ultimo`
      // responde honestamente que no hay nada reciente que corregir.
      estado = { ...estado, pending: null, lastEntity: null };
      lastEntityDirty = true;
      await writeState(ctx.phone, ctx.userId, { pending: null });
      return createInvoiceDirect(ctx.userId, invoiceId, accountName);
    },
    correctLast: async (campo: string, valor: string) => {
      if (!estado.lastEntity) {
        return {
          ok: false,
          error: 'No tengo un gasto reciente para corregir.',
        };
      }
      const res = await correctLastExpense(
        ctx.userId,
        estado.lastEntity,
        campo,
        valor,
      );
      if (res.ok) {
        // Recalcular el patch (puro, ya validado por `correctLastExpense`) para
        // mantener `estado.lastEntity` al día: sin esto, una segunda corrección
        // en la misma conversación vería el valor viejo en el prompt.
        const r = applyCorrection(estado.lastEntity, campo, valor);
        if (r.ok) {
          estado = {
            ...estado,
            lastEntity: { ...estado.lastEntity, ...r.patch },
          };
          lastEntityDirty = true;
        }
      }
      return res;
    },
    queryExpenses: async q => queryExpenseTotal(ctx.userId, q),
    onExpenseCreated: async () => {},
  };

  const respuesta = await runAgent(
    ctx.body,
    {
      accounts: cuentas,
      categories: categorias,
      defaultAccount: cuentaDefecto,
      today: todayBogota(),
      pendingInvoice: facturaPendiente,
      lastEntity: estado.lastEntity,
      turns: estado.turns,
    },
    {
      callGateway: callGatewayReal,
      executeTool: (name, input) => executeTool(name, input, deps),
    },
  );

  // Gateway caído: no es culpa del usuario. Se intenta el parser viejo antes de
  // rendirse — con el LLM abajo, "20k taxi" se sigue registrando.
  //
  // Salvo que alguna herramienta YA haya escrito antes de que el Gateway se
  // cayera: ahí el modo degradado le pasaría el MISMO mensaje a
  // `parseQuickExpense` y registraría el gasto por segunda vez. Con escrituras
  // hechas se responde la verdad y no se toca nada más.
  if ('kind' in respuesta) {
    const texto = respuesta.huboEscrituras
      ? AVISO_CORTE_CON_ESCRITURAS
      : await intentarModoDegradado(ctx, cuentaDefecto);
    await responderYGuardar(
      ctx,
      estado.turns,
      texto,
      lastEntityDirty ? estado.lastEntity : undefined,
    );
    return;
  }

  const texto = respuesta.text || 'Listo.';
  await responderYGuardar(
    ctx,
    estado.turns,
    texto,
    lastEntityDirty ? estado.lastEntity : undefined,
  );
}
