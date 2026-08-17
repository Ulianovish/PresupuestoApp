// Correcciones y consultas del agente de WhatsApp. `applyCorrection` es pura
// para poder testear la interpretación sin base.

import { createAdminClient } from '@/lib/supabase/server';
import type { LastEntity } from '@/lib/whatsapp/agent/state';
import { MAX_AMOUNT } from '@/lib/whatsapp/agent/tools';

export interface CorrectionPatch {
  amount?: number;
  description?: string;
  accountName?: string;
  category?: string;
  date?: string;
}

export type CorrectionResult =
  | { ok: true; patch: CorrectionPatch }
  | { ok: false; error: string };

/** Interpreta un monto escrito a mano: "30 mil", "30k", "30000". */
function parseMonto(valor: string): number | null {
  const t = valor.toLowerCase().replace(/\$/g, '').trim();
  const conMil = t.match(/^([\d.,]+)\s*(k|mil)$/);
  if (conMil) {
    const base = Number(conMil[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(base) && base > 0 ? Math.round(base * 1000) : null;
  }
  const n = Number(t.replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function applyCorrection(
  entity: LastEntity,
  campo: string,
  valor: string,
): CorrectionResult {
  if (campo === 'monto') {
    const monto = parseMonto(valor);
    if (monto === null)
      return { ok: false, error: `No pude interpretar "${valor}" como monto.` };
    // Mismo tope que `validateGasto` (tools.ts): un monto absurdo no puede
    // colarse por la puerta de la corrección cuando el alta lo rechaza.
    if (monto > MAX_AMOUNT) {
      return {
        ok: false,
        error: `El monto ${monto} supera el tope de ${MAX_AMOUNT}. Confirmá el valor con el usuario.`,
      };
    }
    return { ok: true, patch: { amount: monto } };
  }
  if (campo === 'descripcion') {
    const d = valor.trim();
    if (!d)
      return { ok: false, error: 'La descripción no puede quedar vacía.' };
    return { ok: true, patch: { description: d } };
  }
  if (campo === 'cuenta') return { ok: true, patch: { accountName: valor } };
  if (campo === 'categoria') return { ok: true, patch: { category: valor } };
  if (campo === 'fecha') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      return { ok: false, error: 'La fecha debe venir en formato YYYY-MM-DD.' };
    }
    return { ok: true, patch: { date: valor } };
  }
  return { ok: false, error: `No sé corregir el campo "${campo}".` };
}

/**
 * Aplica la corrección en la base. Si se corrige la categoría, el vínculo con
 * el ítem de presupuesto se marca 'manual': la reclasificación por IA respeta
 * lo manual y así no revierte lo que el usuario acaba de corregir.
 */
export async function correctLastExpense(
  userId: string,
  entity: LastEntity,
  campo: string,
  valor: string,
): Promise<{ ok: boolean; error?: string }> {
  const r = applyCorrection(entity, campo, valor);
  if (!r.ok) return { ok: false, error: r.error };

  const supabase = createAdminClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (r.patch.amount !== undefined) update.amount = r.patch.amount;
  if (r.patch.description !== undefined)
    update.description = r.patch.description;
  if (r.patch.category !== undefined) {
    update.category_name = r.patch.category;
    update.budget_item_source = 'manual';
  }
  if (r.patch.date !== undefined) {
    update.transaction_date = r.patch.date;
    update.month_year = r.patch.date.slice(0, 7);
  }

  if (r.patch.accountName !== undefined) {
    const { data: cuenta } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('name', r.patch.accountName)
      .maybeSingle();
    if (!cuenta)
      return {
        ok: false,
        error: `No encontré la cuenta ${r.patch.accountName}.`,
      };
    update.account_id = (cuenta as { id: string }).id;
  }

  // `.select('id')` es lo que permite distinguir "actualizó 0 filas" de un
  // error real: Supabase NO devuelve `error` cuando el `.eq()` no matchea
  // ninguna fila (p. ej. el usuario borró el gasto desde la app entre que se
  // registró y que lo corrigió por chat — `lastEntity` no vence, así que esto
  // puede pasar días después). Sin este chequeo, se reportaba éxito y encima
  // se guardaba en `last_entity` una corrección que nunca se aplicó.
  const { data, error } = await supabase
    .from('transactions')
    .update(update)
    .eq('id', entity.transactionId)
    .eq('user_id', userId)
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: 'Ese gasto ya no existe (puede que lo hayas borrado en la app).',
    };
  }
  return { ok: true };
}

/** Suma gastos del período. Solo lectura. */
export async function queryExpenseTotal(
  userId: string,
  q: { categoria?: string; desde?: string; hasta?: string },
): Promise<{ total: number; categoria?: string }> {
  const supabase = createAdminClient();
  let query = supabase
    .from('transactions')
    .select('amount, category_name, transaction_date')
    .eq('user_id', userId);

  if (q.categoria) query = query.eq('category_name', q.categoria);
  if (q.desde) query = query.gte('transaction_date', q.desde);
  if (q.hasta) query = query.lte('transaction_date', q.hasta);

  const { data } = await query;
  const total = (data ?? []).reduce(
    (s: number, r: { amount: number | null }) => s + Number(r.amount ?? 0),
    0,
  );
  return { total, categoria: q.categoria };
}
