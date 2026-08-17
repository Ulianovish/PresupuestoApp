// Estado de conversación del agente. La lógica de vencimiento (`applyTtl`) es
// pura para poder testearla sin base, siguiendo el patrón de
// `expenses-rollup.ts`.

import { createAdminClient } from '@/lib/supabase/server';

export type Turn = { role: 'user' | 'assistant'; content: string };

/**
 * Vista de una factura pendiente, para mostrarla en el prompt del agente.
 * NO es lo que se persiste en `pending` (ver `Pending`) — se reconstruye por
 * `invoiceId` desde `electronic_invoices` (`getPendingInvoiceSummary`).
 */
export interface PendingInvoice {
  source: 'dian_cufe' | 'vision_receipt';
  cufe: string | null;
  supplier: string | null;
  date: string;
  total: number | null;
  items: Array<{ description: string; amount: number }>;
}

/**
 * Solo guarda el id de la factura, no la factura entera: la fila real vive en
 * `electronic_invoices` (status `pending_review`, la crea
 * `createVisionReceiptDraft`) desde el momento en que la visión la lee. Así
 * la factura sobrevive aunque venza el TTL de 30 min de esta conversación o
 * llegue una segunda foto antes de que el usuario conteste con qué cuenta
 * pagó — antes se perdía porque `pending` era el único lugar donde vivía.
 */
export type Pending = {
  kind: 'invoice_account';
  invoiceId: string;
  /**
   * Momento en que se creó el pendiente (ISO). El TTL se mide contra esto y NO
   * contra `updated_at` de la fila: `writeState` pisa `updated_at` en cada
   * turno, así que un pendiente nunca vencía mientras el usuario siguiera
   * escribiendo cualquier cosa. Lo estampa `writeState` cuando el pendiente
   * entra sin él (las filas viejas caen a `updated_at`).
   */
  createdAt?: string;
};

export interface LastEntity {
  kind: 'expense';
  transactionId: string;
  amount: number;
  description: string;
  accountName: string;
  category: string;
  date: string;
}

export interface ConversationState {
  turns: Turn[];
  pending: Pending | null;
  lastEntity: LastEntity | null;
}

interface StateRow {
  turns?: Turn[] | null;
  pending?: Pending | null;
  last_entity?: LastEntity | null;
  updated_at?: string | null;
}

/** Turnos que se recuerdan. Suficiente para "no, eran 30 mil" sin inflar tokens. */
export const MAX_TURNS = 6;
const TTL_MS = 30 * 60 * 1000;

/**
 * Aplica el vencimiento a una fila cruda.
 *
 * `turns` y `pending` vencen a los 30 min: un "sí, esa" tres horas más tarde
 * casi seguro habla de otra cosa, y actuar sobre un `pending` viejo escribiría
 * un gasto que el usuario no pidió. `lastEntity` NO vence: "corregí lo último"
 * sigue teniendo sentido al otro día, y solo se pisa con un gasto nuevo.
 *
 * Cada uno se mide contra SU propio reloj: los turnos contra `updated_at` (la
 * conversación sigue viva mientras se escriba), el pendiente contra el momento
 * en que se creó. Midiendo el pendiente contra `updated_at` no vencía nunca:
 * cada mensaje lo refrescaba, y la factura de hace horas seguía secuestrando
 * el prompt.
 */
export function applyTtl(row: StateRow | null, nowMs: number): ConversationState {
  if (!row) return { turns: [], pending: null, lastEntity: null };

  const updatedMs = row.updated_at ? Date.parse(row.updated_at) : 0;
  const turnosVencidos = !updatedMs || nowMs - updatedMs > TTL_MS;

  const pending = row.pending ?? null;
  // Sin `createdAt` (filas escritas antes de este cambio) se cae a
  // `updated_at`: el comportamiento viejo, nunca algo más permisivo.
  const pendingMs = pending?.createdAt
    ? Date.parse(pending.createdAt)
    : updatedMs;
  const pendingVencido = !pendingMs || nowMs - pendingMs > TTL_MS;

  return {
    turns: turnosVencidos ? [] : (row.turns ?? []),
    pending: pendingVencido ? null : pending,
    lastEntity: row.last_entity ?? null,
  };
}

export async function readState(phone: string): Promise<ConversationState> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('turns, pending, last_entity, updated_at')
    .eq('phone_e164', phone)
    .maybeSingle();
  return applyTtl(data as StateRow | null, Date.now());
}

/**
 * Guarda el estado. Los campos ausentes en `patch` no se tocan, salvo `pending`,
 * que se puede limpiar pasando `null` explícito (es lo que hace falta al
 * resolver una pregunta pendiente).
 *
 * Un `pending` nuevo se estampa acá con `createdAt` (ver `Pending`): así el
 * TTL de 30 min lo mide contra su propia creación y ningún llamador se puede
 * olvidar de ponerlo. Si el pendiente ya lo trae, se respeta — refrescarlo en
 * cada guardado sería volver al bug de que nunca vence.
 */
export async function writeState(
  phone: string,
  userId: string,
  patch: Partial<Pick<ConversationState, 'turns' | 'pending' | 'lastEntity'>>,
): Promise<void> {
  const supabase = createAdminClient();
  const fila: Record<string, unknown> = {
    phone_e164: phone,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.turns !== undefined) fila.turns = patch.turns.slice(-MAX_TURNS);
  if (patch.pending !== undefined) {
    fila.pending = patch.pending
      ? {
          ...patch.pending,
          createdAt: patch.pending.createdAt ?? new Date().toISOString(),
        }
      : null;
  }
  if (patch.lastEntity !== undefined) fila.last_entity = patch.lastEntity;

  const { error } = await supabase
    .from('whatsapp_conversations')
    .upsert(fila, { onConflict: 'phone_e164' });
  if (error) console.error('writeState falló:', error.message);
}
