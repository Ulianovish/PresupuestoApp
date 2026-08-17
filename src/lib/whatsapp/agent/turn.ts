// Orquesta un turno del agente: lee estado, corre el bucle, responde y guarda.
// Si el Gateway falla, cae a `parseQuickExpense` para no dejar al usuario sin
// nada: un gasto simple se sigue registrando con el LLM caído.

import { resolveUserCategoryNames } from '@/lib/services/invoices';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import { createAdminClient } from '@/lib/supabase/server';
import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

import { callGatewayReal, runAgent } from './run';
import { readState, writeState } from './state';
import { executeTool, type ToolDeps } from './tools';

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

async function listarCuentas(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('accounts')
    .select('name')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data ?? []).map((r: { name: string }) => r.name);
}

export async function handleAgentTurn(ctx: {
  userId: string;
  phone: string;
  body: string;
}): Promise<void> {
  const estado = await readState(ctx.phone);
  const [cuentas, categorias, cuentaDefecto] = await Promise.all([
    listarCuentas(ctx.userId),
    resolveUserCategoryNames(createAdminClient(), ctx.userId),
    resolveDefaultAccount(ctx.phone),
  ]);

  const deps: ToolDeps = {
    accounts: cuentas,
    defaultAccount: cuentaDefecto,
    today: hoyBogota,
    createExpense: async input => createDirectExpense(ctx.userId, ctx.phone, input),
    // Stub: la Task 8 implementa el registro de facturas.
    registerInvoice: async () => ({
      ok: false,
      itemsFound: 0,
      error: 'todavía no implementado',
    }),
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
    const rapido = parseQuickExpense(ctx.body);
    if (rapido) {
      const res = await createDirectExpense(ctx.userId, ctx.phone, {
        amount: rapido.amount,
        description: rapido.description,
        accountName: cuentaDefecto,
        date: hoyBogota(),
      });
      await sendWhatsAppMessage(
        ctx.phone,
        res.ok
          ? `✅ Anotado ${rapido.amount} en ${res.category} (${cuentaDefecto}).`
          : '❌ No pude registrar el gasto. Intentá de nuevo en un momento.',
      );
      return;
    }
    await sendWhatsAppMessage(
      ctx.phone,
      '⚠️ Mi asistente está fallando ahora mismo (no es tu mensaje). Probá en un minuto, o escribí el gasto simple: "20k taxi".',
    );
    return;
  }

  const texto = respuesta.text || 'Listo.';
  await sendWhatsAppMessage(ctx.phone, texto);
  await writeState(ctx.phone, ctx.userId, {
    turns: [
      ...estado.turns,
      { role: 'user', content: ctx.body },
      { role: 'assistant', content: texto },
    ],
  });
}
