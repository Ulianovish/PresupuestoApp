// Orquestador del agente para mensajes de un usuario YA vinculado. Corre en
// background (after) y manda las respuestas por el transporte saliente. Deps
// inyectadas para testear sin red ni DB.
//
// Solo maneja 'cufe': `classifyText` nunca produce 'quick_expense' (ese
// enrutado por texto se sacó por acertar mal en silencio, ver classify.ts),
// así que esa rama quedaba inalcanzable y se eliminó junto con sus deps.

import { extractCufe } from '@/lib/whatsapp/classify';

export type CufeOutcome =
  | { ok: true; itemsFound: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'error'; message: string };

export interface AgentDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  processCufe: (userId: string, cufe: string) => Promise<CufeOutcome>;
}

export interface AgentContext {
  userId: string;
  phone: string;
  body: string;
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
    await deps.sendMessage(
      ctx.phone,
      `✅ Tu factura quedó lista para revisar y completar en la app (${out.itemsFound} ítems).`,
    );
  } else if (out.reason === 'duplicate') {
    await deps.sendMessage(ctx.phone, 'Esa factura ya la había procesado. 👍');
  } else {
    await deps.sendMessage(
      ctx.phone,
      // El mensaje del motor suele venir ya con punto final; no duplicarlo.
      `❌ No pude procesar la factura: ${out.message.replace(/\.?$/, '.')} Puedes reintentar más tarde.`,
    );
  }
}
