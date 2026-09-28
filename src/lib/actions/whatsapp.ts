'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { ERROR_DOCUMENTO, validarDocumento } from '@/lib/dian/nits-busqueda';
import { createLinkCode } from '@/lib/services/whatsapp-links';
import { createClient } from '@/lib/supabase/server';
import { enmascararTelefono } from '@/lib/whatsapp/format';

export type GenerateCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/** Genera un código de vinculación de WhatsApp para el usuario autenticado. */
export async function generateWhatsAppLinkCodeAction(): Promise<GenerateCodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }
  const code = await createLinkCode(user.id);
  return { ok: true, code };
}

export interface DocumentoDianLink {
  id: string;
  /** Número enmascarado ("+57 300 ••• 4567"): el completo no viaja al navegador. */
  telefono: string;
  documento: string | null;
}

export type ListarDocumentosDianResult =
  | { ok: true; links: DocumentoDianLink[] }
  | { ok: false; error: string };

/**
 * Números vinculados del usuario con la cédula/NIT que tienen cargada para
 * buscar facturas en la DIAN (sección de Ajustes). Cliente de la cookie: RLS
 * deja ver solo los propios.
 */
export async function listarDocumentosDianAction(): Promise<ListarDocumentosDianResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data, error } = await supabase
    .from('whatsapp_links')
    .select('id, phone_e164, documento')
    .eq('user_id', user.id)
    .order('linked_at', { ascending: true });
  if (error) {
    // Solo el código: el mensaje/detalle de Postgres puede traer la fila.
    console.error(
      'listarDocumentosDianAction: error leyendo números:',
      error.code,
    );
    return { ok: false, error: 'No se pudieron cargar tus números.' };
  }

  const filas = (data ?? []) as Array<{
    id: string;
    phone_e164: string;
    documento: string | null;
  }>;
  return {
    ok: true,
    links: filas.map(l => ({
      id: l.id,
      telefono: enmascararTelefono(l.phone_e164),
      documento: l.documento ?? null,
    })),
  };
}

export type GuardarDocumentoDianResult =
  | { ok: true; documento: string | null }
  | { ok: false; error: string };

const linkIdSchema = z.string().uuid();

/**
 * Guarda (o borra, si viene vacío) la cédula/NIT de un número vinculado del
 * usuario. Con el cliente de la cookie: la política de UPDATE y el GRANT por
 * columna solo dejan tocar `documento` de los links propios; el filtro por
 * `user_id` es además explícito. Nunca loguea el documento.
 */
export async function guardarDocumentoDianAction(input: {
  linkId: string;
  documento: string;
}): Promise<GuardarDocumentoDianResult> {
  if (!linkIdSchema.safeParse(input.linkId).success) {
    return { ok: false, error: 'Número inválido.' };
  }
  const validacion = validarDocumento(input.documento);
  if (!validacion.ok) {
    return { ok: false, error: validacion.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data, error } = await supabase
    .from('whatsapp_links')
    .update({ documento: validacion.documento })
    .eq('id', input.linkId)
    .eq('user_id', user.id)
    .select('id');
  if (error) {
    // Solo el código: el detalle de un CHECK fallido trae la fila entera.
    console.error('guardarDocumentoDianAction: error guardando:', error.code);
    if (error.code === '23514') {
      return { ok: false, error: ERROR_DOCUMENTO };
    }
    return { ok: false, error: 'No se pudo guardar el documento.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No encontramos ese número entre los tuyos.' };
  }

  revalidatePath('/settings');
  return { ok: true, documento: validacion.documento };
}
