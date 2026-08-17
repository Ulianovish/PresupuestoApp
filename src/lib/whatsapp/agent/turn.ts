// Orquesta un turno del agente: lee estado, corre el bucle, responde y guarda.
// Si el Gateway falla —o si ni siquiera se pudo armar el contexto (DB abajo)—
// cae a `parseQuickExpense` para no dejar al usuario sin nada: un gasto
// simple se sigue registrando con el LLM caído.

import { createInvoiceDirect, resolveUserCategoryNames } from '@/lib/services/invoices';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import { createAdminClient } from '@/lib/supabase/server';
import { formatCOP } from '@/lib/whatsapp/format';
import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

import { callGatewayReal, runAgent } from './run';
import { readState, writeState } from './state';
import { executeTool, type ToolDeps } from './tools';

import type { ConversationState, Turn } from './state';

// Cuenta de último recurso cuando ni siquiera se pudo resolver la cuenta por
// defecto del usuario (p. ej. `resolveDefaultAccount` fue justo lo que
// falló). Mismo valor que FALLBACK_ACCOUNT en whatsapp-expenses.ts.
const CUENTA_DE_EMERGENCIA = 'Efectivo';

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

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
    date: hoyBogota(),
  });
  return res.ok
    ? `✅ Anotado ${formatCOP(rapido.amount)} en ${res.category} (${cuentaDefecto}) · ${rapido.description}. Si algo está mal, edítalo en la app.`
    : '❌ No pude registrar el gasto. Intentá de nuevo en un momento.';
}

/** Manda la respuesta y guarda el turno, más allá de qué camino la generó. */
async function responderYGuardar(
  ctx: TurnCtx,
  turnosPrevios: Turn[],
  texto: string,
): Promise<void> {
  await sendWhatsAppMessage(ctx.phone, texto);
  await writeState(ctx.phone, ctx.userId, {
    turns: [
      ...turnosPrevios,
      { role: 'user', content: ctx.body },
      { role: 'assistant', content: texto },
    ],
  });
}

export async function handleAgentTurn(ctx: TurnCtx): Promise<void> {
  let estado: ConversationState;
  let cuentas: string[];
  let categorias: string[];
  let cuentaDefecto: string;

  try {
    estado = await readState(ctx.phone);
    [cuentas, categorias, cuentaDefecto] = await Promise.all([
      listarCuentas(ctx.userId),
      resolveUserCategoryNames(createAdminClient(), ctx.userId),
      resolveDefaultAccount(ctx.phone),
    ]);
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

  const deps: ToolDeps = {
    accounts: cuentas,
    defaultAccount: cuentaDefecto,
    today: hoyBogota,
    createExpense: async input => createDirectExpense(ctx.userId, ctx.phone, input),
    registerInvoice: async (accountName: string) => {
      const inv = estado.pending?.invoice;
      if (!inv) return { ok: false, itemsFound: 0, error: 'no hay factura pendiente' };
      const res = await createInvoiceDirect(ctx.userId, inv, accountName);
      // Limpiar el pendiente pase lo que pase: si falló, reintentar con la misma
      // factura vieja confundiría más de lo que ayuda.
      await writeState(ctx.phone, ctx.userId, { pending: null });
      return res;
    },
    // Stub: la Task 10 implementa la corrección del último gasto.
    correctLast: async () => ({
      ok: false,
      error: 'todavía no implementado',
    }),
    // Stub: la Task 10 implementa la consulta de gastos.
    queryExpenses: async () => ({ total: 0 }),
    onExpenseCreated: async () => {},
  };

  const respuesta = await runAgent(
    ctx.body,
    {
      accounts: cuentas,
      categories: categorias,
      defaultAccount: cuentaDefecto,
      today: hoyBogota(),
      pendingInvoice: estado.pending?.invoice ?? null,
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
  if ('kind' in respuesta) {
    const texto = await intentarModoDegradado(ctx, cuentaDefecto);
    await responderYGuardar(ctx, estado.turns, texto);
    return;
  }

  const texto = respuesta.text || 'Listo.';
  await responderYGuardar(ctx, estado.turns, texto);
}
