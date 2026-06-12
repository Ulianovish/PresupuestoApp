// Orquestador del agente para mensajes de un usuario YA vinculado. Corre en
// background (after) y manda las respuestas por el transporte saliente. Deps
// inyectadas para testear sin red ni DB.

import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';

// Formateo COP inline: NO importar de '@/lib/services/expenses' (ese módulo crea
// un cliente de Supabase de navegador a nivel de módulo y rompería en servidor).
function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export type CufeOutcome =
  | { ok: true; itemsFound: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'error'; message: string };

export interface AgentDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  processCufe: (userId: string, cufe: string) => Promise<CufeOutcome>;
  createDirectExpense: (
    userId: string,
    phone: string,
    input: { amount: number; description: string; accountName: string; date: string },
  ) => Promise<{ ok: boolean; category: string; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string; // YYYY-MM-DD
}

export interface AgentContext {
  userId: string;
  phone: string;
  body: string;
}

export async function handleAgentMessage(
  decision: 'cufe' | 'quick_expense',
  ctx: AgentContext,
  deps: AgentDeps,
): Promise<void> {
  if (decision === 'cufe') {
    const cufe = ctx.body.trim();
    const out = await deps.processCufe(ctx.userId, cufe);
    if (out.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Tu factura quedó lista para revisar y aprobar en la app (${out.itemsFound} ítems).`,
      );
    } else if (out.reason === 'duplicate') {
      await deps.sendMessage(ctx.phone, 'Esa factura ya la había procesado. 👍');
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude procesar la factura: ${out.message}. Puedes reintentar más tarde.`,
      );
    }
    return;
  }

  // quick_expense
  const parsed = parseQuickExpense(ctx.body);
  if (!parsed) {
    await deps.sendMessage(
      ctx.phone,
      'No logré entender el gasto 🤔. Escríbelo como "20k taxi" o "gasté 35000 en mercado".',
    );
    return;
  }
  const accountName = await deps.resolveDefaultAccount(ctx.phone);
  const res = await deps.createDirectExpense(ctx.userId, ctx.phone, {
    amount: parsed.amount,
    description: parsed.description,
    accountName,
    date: deps.today(),
  });
  if (res.ok) {
    await deps.sendMessage(
      ctx.phone,
      `✅ Registré ${formatCOP(parsed.amount)} en ${res.category} (${accountName}) · ${parsed.description}. Si algo está mal, edítalo en la app.`,
    );
  } else {
    await deps.sendMessage(
      ctx.phone,
      `❌ No pude registrar el gasto: ${res.error ?? 'error desconocido'}.`,
    );
  }
}
