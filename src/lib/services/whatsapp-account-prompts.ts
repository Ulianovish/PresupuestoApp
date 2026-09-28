// Persistencia de la pregunta "¿con qué cuenta fue?" del bot de WhatsApp
// (tabla `whatsapp_account_prompts`) y de lo que se toca al contestarla.
// Service-role: corre en el webhook, sin sesión. La lógica vive en
// `lib/whatsapp/account-prompt.ts`; acá solo hay lecturas y escrituras.

import { createAdminClient } from '@/lib/supabase/server';
import type { CuentaActiva, UsoCuenta } from '@/lib/whatsapp/account-picker';
import type { PromptCuenta, TargetKind } from '@/lib/whatsapp/account-prompt';

/** Las preguntas abiertas se pueden contestar escribiendo el nombre hasta 24 h después. */
const VENTANA_RESPUESTA_MS = 24 * 60 * 60 * 1000;

interface PromptRow {
  id: string;
  user_id: string;
  phone_e164: string;
  target_kind: TargetKind;
  target_ids: string[];
  created_at: string;
  resolved_at: string | null;
  resolved_account_id: string | null;
}

function aPrompt(r: PromptRow): PromptCuenta {
  return {
    id: r.id,
    userId: r.user_id,
    phone: r.phone_e164,
    targetKind: r.target_kind,
    targetIds: r.target_ids ?? [],
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    resolvedAccountId: r.resolved_account_id,
  };
}

const COLUMNAS =
  'id, user_id, phone_e164, target_kind, target_ids, created_at, resolved_at, resolved_account_id';

export async function listarCuentasActivas(
  userId: string,
): Promise<CuentaActiva[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, created_at')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (r: {
      id: string;
      name: string;
      type: string | null;
      created_at: string | null;
    }) => ({ id: r.id, name: r.name, type: r.type, createdAt: r.created_at }),
  );
}

/** Uso por cuenta (RPC `whatsapp_account_usage`, últimos 90 días). */
export async function cargarUsoCuentas(
  userId: string,
  phone: string,
): Promise<UsoCuenta[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('whatsapp_account_usage', {
    p_user_id: userId,
    p_phone: phone,
  });
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as Array<{
      account_id: string;
      uses_phone: number | string;
      uses_user: number | string;
      last_used: string | null;
    }>
  ).map(r => ({
    accountId: r.account_id,
    usosTelefono: Number(r.uses_phone) || 0,
    usosUsuario: Number(r.uses_user) || 0,
    ultimoUso: r.last_used,
  }));
}

export async function crearPromptCuenta(p: {
  userId: string;
  phone: string;
  targetKind: TargetKind;
  targetIds: string[];
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_account_prompts')
    .insert({
      user_id: p.userId,
      phone_e164: p.phone,
      target_kind: p.targetKind,
      target_ids: p.targetIds,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function cargarPromptCuenta(
  promptId: string,
  phone: string,
): Promise<PromptCuenta | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_account_prompts')
    .select(COLUMNAS)
    .eq('id', promptId)
    .eq('phone_e164', phone)
    .maybeSingle();
  return data ? aPrompt(data as PromptRow) : null;
}

export async function ultimoPromptAbierto(
  phone: string,
): Promise<PromptCuenta | null> {
  const supabase = createAdminClient();
  const desde = new Date(Date.now() - VENTANA_RESPUESTA_MS).toISOString();
  const { data } = await supabase
    .from('whatsapp_account_prompts')
    .select(COLUMNAS)
    .eq('phone_e164', phone)
    .is('resolved_at', null)
    .gt('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? aPrompt(data as PromptRow) : null;
}

/** UPDATE condicional: solo gana si la pregunta seguía abierta. */
export async function reclamarPromptCuenta(
  promptId: string,
  accountId: string,
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('whatsapp_account_prompts')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_account_id: accountId,
    })
    .eq('id', promptId)
    .is('resolved_at', null)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function liberarPromptCuenta(promptId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('whatsapp_account_prompts')
    .update({ resolved_at: null, resolved_account_id: null })
    .eq('id', promptId);
  if (error) console.error('liberarPromptCuenta falló:', error.message);
}

export async function corregirResolucionPrompt(
  promptId: string,
  accountId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('whatsapp_account_prompts')
    .update({ resolved_account_id: accountId })
    .eq('id', promptId);
  if (error) console.error('corregirResolucionPrompt falló:', error.message);
}

/**
 * Cierra las preguntas abiertas de una factura que se registró por otro
 * camino (el agente, con el nombre escrito largo). Sin cuenta: un toque
 * posterior en su lista se trata como corrección. Best-effort.
 */
export async function cerrarPromptsDeFactura(invoiceId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('whatsapp_account_prompts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('target_kind', 'invoice')
    .contains('target_ids', [invoiceId])
    .is('resolved_at', null);
  if (error) console.error('cerrarPromptsDeFactura falló:', error.message);
}

export async function moverTransaccionesDeCuenta(
  userId: string,
  ids: string[],
  accountId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('transactions')
    .update({ account_id: accountId, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('id', ids);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Cambia la cuenta de los gastos de una factura ya registrada (y la de la factura). */
export async function moverFacturaDeCuenta(
  userId: string,
  invoiceId: string,
  cuenta: { id: string; name: string },
): Promise<{ ok: boolean; movidos: number; error?: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({ account_id: cuenta.id, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('electronic_invoice_id', invoiceId)
    .select('id');
  if (error) return { ok: false, movidos: 0, error: error.message };
  const movidos = (data ?? []).length;
  if (movidos > 0) {
    const { error: errFactura } = await supabase
      .from('electronic_invoices')
      .update({ selected_account_name: cuenta.name })
      .eq('id', invoiceId)
      .eq('user_id', userId);
    if (errFactura) {
      console.error(
        'moverFacturaDeCuenta: la factura no se actualizó:',
        errFactura.message,
      );
    }
  }
  return { ok: true, movidos };
}

export async function estadoFactura(
  userId: string,
  invoiceId: string,
): Promise<{ status: string; cuenta: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('electronic_invoices')
    .select('status, selected_account_name')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  const r = data as { status: string; selected_account_name: string | null };
  return { status: r.status, cuenta: r.selected_account_name };
}
