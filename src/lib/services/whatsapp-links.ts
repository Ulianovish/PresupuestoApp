// Servicio de vinculación número↔usuario. Usa el cliente service-role porque el
// webhook corre sin sesión; la seguridad la dan el código de un solo uso (único
// entre los pendientes), el límite de intentos fallidos por número y la firma
// de Twilio validada antes de llegar aquí.

import { randomInt } from 'crypto';

import type { LinkConDocumento } from '@/lib/dian/nits-busqueda';
import { createAdminClient } from '@/lib/supabase/server';

const CODE_TTL_MINUTES = 10;

/** Intentos de INSERT cuando el código choca con otro pendiente (23505). */
export const MAX_CODE_ATTEMPTS = 5;

/** Código aleatorio de 6 dígitos (con ceros a la izquierda). */
export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface CreateLinkCodeOptions {
  /** Reloj inyectable (tests). */
  now?: () => Date;
  /** Generador inyectable (tests). */
  generateCode?: () => string;
}

/**
 * Crea un código de vinculación para el usuario y lo persiste. Devuelve el código.
 *
 * Con varios usuarios, dos códigos pendientes iguales harían que `VINCULAR n`
 * canjeara el de otra persona: el índice único parcial
 * `whatsapp_link_codes_code_pending_uq` lo impide y aquí, si el INSERT choca
 * (23505), se prueba con otro código (máximo MAX_CODE_ATTEMPTS). Antes se
 * borran los códigos vencidos y sin usar del propio usuario: ya no sirven y
 * ocupan lugar en el índice.
 */
export async function createLinkCode(
  userId: string,
  options: CreateLinkCodeOptions = {},
): Promise<string> {
  const now = options.now ?? (() => new Date());
  const generateCode = options.generateCode ?? generateSixDigitCode;
  const supabase = createAdminClient();
  const ahora = now();

  const { error: limpiezaError } = await supabase
    .from('whatsapp_link_codes')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null)
    .lte('expires_at', ahora.toISOString());
  if (limpiezaError) {
    // No bloquea: un código vencido de más no impide crear uno nuevo.
    console.error(
      'createLinkCode: no se pudieron limpiar códigos vencidos:',
      limpiezaError.code,
    );
  }

  const expiresAt = new Date(
    ahora.getTime() + CODE_TTL_MINUTES * 60_000,
  ).toISOString();

  for (let intento = 1; intento <= MAX_CODE_ATTEMPTS; intento++) {
    const code = generateCode();
    const { error } = await supabase
      .from('whatsapp_link_codes')
      .insert({ code, user_id: userId, expires_at: expiresAt });
    if (!error) {
      return code;
    }
    if (error.code !== '23505') {
      throw new Error(`No se pudo crear el código: ${error.message}`);
    }
  }
  throw new Error(
    `No se pudo crear el código: ${MAX_CODE_ATTEMPTS} choques seguidos con otros códigos pendientes`,
  );
}

export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' | 'link_failed' };

/**
 * Canjea un código y vincula el número.
 *
 * - `invalid_or_expired`: el código no existe, ya se usó o venció. Es lo único
 *   que cuenta como intento fallido para el límite por número.
 * - `link_failed`: falló la base (el UPDATE, borrar la conversación ajena o el
 *   upsert). No es culpa de quien escribe, así que no suma al límite, y si el
 *   código ya se había consumido se libera (best-effort) para reintentarlo.
 *
 * El canje es un UPDATE condicional (sin usar y vigente) en un único
 * statement: un código se canjea una sola vez aunque lleguen dos peticiones a
 * la vez, y el índice único parcial de códigos pendientes garantiza que afecte
 * como mucho una fila. El upsert por `phone_e164` mueve el número de
 * presupuesto al re-vincular.
 *
 * Si el número tenía conversación con OTRO usuario, esa fila se borra ANTES de
 * vincular: trae turnos y pendientes del dueño anterior que el agente leería
 * como propios. Si no se puede borrar, no se vincula.
 */
export async function redeemLinkCode(
  code: string,
  phoneE164: string,
  now: () => Date = () => new Date(),
): Promise<RedeemResult> {
  const supabase = createAdminClient();
  const nowIso = now().toISOString();

  const { data: rows, error } = await supabase
    .from('whatsapp_link_codes')
    .update({ used_at: nowIso })
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('user_id');
  if (error) {
    console.error('redeemLinkCode: error canjeando el código:', error.code);
    return { ok: false, reason: 'link_failed' };
  }

  const row = rows?.[0];
  if (!row) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const userId = (row as { user_id: string }).user_id;

  // Si algo falla después de consumir el código, se devuelve a pendiente para
  // que la persona pueda reintentar el mismo VINCULAR: el error fue de la base,
  // no suyo. Solo si lo marcó este canje (used_at = nowIso). Best-effort.
  const liberarCodigo = async () => {
    const { error: liberarError } = await supabase
      .from('whatsapp_link_codes')
      .update({ used_at: null })
      .eq('code', code)
      .eq('user_id', userId)
      .eq('used_at', nowIso);
    if (liberarError) {
      console.error(
        'redeemLinkCode: no se pudo liberar el código:',
        liberarError.code,
      );
    }
  };

  // El documento (cédula/NIT para la DIAN) es de la persona del número en SU
  // presupuesto: si el número pasa a otro usuario, no se hereda el del dueño
  // anterior. Solo se conserva si se sabe que el dueño es el mismo; ante la
  // duda (número nuevo o lectura fallida) arranca vacío.
  const { data: previo } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  const mismoDueno = (previo as { user_id: string } | null)?.user_id === userId;

  // La conversación se decide por SU user_id y no por el vínculo previo: un
  // número vinculado no llega a este flujo, así que cambia de dueño después de
  // desvincularse, cuando la fila de whatsapp_links del anterior ya no existe.
  const { error: conversacionError } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('phone_e164', phoneE164)
    .neq('user_id', userId);
  if (conversacionError) {
    console.error(
      'redeemLinkCode: no se pudo borrar la conversación del dueño anterior:',
      conversacionError.code,
    );
    await liberarCodigo();
    return { ok: false, reason: 'link_failed' };
  }

  const { error: upsertError } = await supabase.from('whatsapp_links').upsert(
    {
      phone_e164: phoneE164,
      user_id: userId,
      ...(!mismoDueno && { documento: null }),
    },
    { onConflict: 'phone_e164' },
  );
  if (upsertError) {
    // Reportamos fallo para que el usuario no crea que quedó vinculado; el
    // código se libera para que pueda reintentar el mismo.
    console.error(
      'redeemLinkCode: no se pudo guardar el vínculo:',
      upsertError.code,
    );
    await liberarCodigo();
    return { ok: false, reason: 'link_failed' };
  }

  return { ok: true, userId };
}

/** Resuelve el presupuesto (user_id) dueño de un número, o null. */
export async function getLinkByPhone(
  phoneE164: string,
): Promise<{ userId: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  return data ? { userId: (data as { user_id: string }).user_id } : null;
}

/**
 * Número y documento (cédula/NIT para buscar facturas en la DIAN) de cada
 * número vinculado al usuario, del más viejo al más nuevo. Sin `client` usa
 * service-role (webhook); el route web le pasa el de la cookie (RLS de dueño).
 *
 * Best-effort: si la consulta falla (red, o la migración de `documento` aún
 * sin aplicar) devuelve [] y la búsqueda sigue con los NIT del QR y los
 * genéricos. Nunca loguea los documentos, solo el error.
 */
export async function listarDocumentosDeUsuario(
  userId: string,
  client: Pick<
    ReturnType<typeof createAdminClient>,
    'from'
  > = createAdminClient(),
): Promise<LinkConDocumento[]> {
  try {
    const { data, error } = await client
      .from('whatsapp_links')
      .select('phone_e164, documento')
      .eq('user_id', userId)
      .order('linked_at', { ascending: true });
    if (error) {
      console.error(
        'listarDocumentosDeUsuario: no se pudieron leer los documentos:',
        error.message,
      );
      return [];
    }
    return ((data ?? []) as LinkConDocumento[]).map(l => ({
      phone_e164: l.phone_e164,
      documento: l.documento ?? null,
    }));
  } catch (err) {
    console.error(
      'listarDocumentosDeUsuario: no se pudieron leer los documentos:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

/** VINCULAR fallidos permitidos por número dentro de la ventana. */
export const LINK_MAX_FAILED_ATTEMPTS = 5;
/** Ventana del límite de intentos, en minutos. */
export const LINK_ATTEMPTS_WINDOW_MINUTES = 15;

/** Inicio (ISO) de la ventana del límite: `now` menos 15 minutos. */
export function linkAttemptsWindowStart(now: Date): string {
  return new Date(
    now.getTime() - LINK_ATTEMPTS_WINDOW_MINUTES * 60_000,
  ).toISOString();
}

/** Con 5 fallos en la ventana el número ya no puede intentar. */
export function isOverLinkAttemptLimit(failedAttempts: number): boolean {
  return failedAttempts >= LINK_MAX_FAILED_ATTEMPTS;
}

/**
 * Resultado de reservar un intento de VINCULAR. `attemptId` es null si la
 * reserva no se pudo guardar (fail-open): no hay nada que liberar.
 */
export type LinkAttemptReservation =
  | { allowed: false }
  | { allowed: true; attemptId: number | null };

function logIntentos(funcion: string, err: unknown) {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? (err as { code: unknown }).code
      : err instanceof Error
        ? err.name
        : 'error desconocido';
  console.error(`${funcion}: fallo en whatsapp_link_attempts:`, code);
}

/**
 * Reserva un intento de VINCULAR del número ANTES de canjear el código.
 *
 * 1. Borra (best-effort) TODAS las filas anteriores a la ventana, de cualquier
 *    número: solo se usan los últimos 15 minutos y así la tabla no crece sin
 *    límite, ni con números que no vuelven a escribir.
 * 2. Inserta la fila del intento.
 * 3. Cuenta las filas del número en la ventana, esta incluida. Si pasan de 5,
 *    borra la propia y rechaza (los intentos bloqueados no se registran).
 *
 * Como cada petición inserta antes de contar, en una ráfaga en paralelo la
 * k-ésima en contar ya ve las k reservas anteriores: como mucho 5 pasan. El
 * llamador libera la reserva (`releaseLinkAttempt`) si el canje salió bien o
 * falló por la base; si el código no existía o venció, la fila queda como el
 * fallo.
 *
 * Fail-open (§5.1): ante cualquier error deja intentar (el código puede llegar
 * a producción antes de la migración, H8). Solo se loguea el código del error,
 * nunca el número.
 */
export async function reserveLinkAttempt(
  phoneE164: string,
  now: () => Date = () => new Date(),
): Promise<LinkAttemptReservation> {
  let attemptId: number | null = null;
  try {
    const supabase = createAdminClient();
    const ahora = now();
    const desde = linkAttemptsWindowStart(ahora);

    const { error: purgaError } = await supabase
      .from('whatsapp_link_attempts')
      .delete()
      .lt('created_at', desde);
    if (purgaError) logIntentos('reserveLinkAttempt', purgaError);

    const { data, error: insertError } = await supabase
      .from('whatsapp_link_attempts')
      .insert({ phone_e164: phoneE164, created_at: ahora.toISOString() })
      .select('id')
      .single();
    if (insertError || !data) {
      logIntentos('reserveLinkAttempt', insertError);
      return { allowed: true, attemptId: null };
    }
    attemptId = (data as { id: number }).id;

    const { count, error: conteoError } = await supabase
      .from('whatsapp_link_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('phone_e164', phoneE164)
      .gte('created_at', desde);
    if (conteoError) {
      logIntentos('reserveLinkAttempt', conteoError);
      return { allowed: true, attemptId };
    }

    // `count` incluye este intento: bloquea si los ANTERIORES ya son 5.
    if (isOverLinkAttemptLimit((count ?? 0) - 1)) {
      await releaseLinkAttempt(attemptId);
      return { allowed: false };
    }
    return { allowed: true, attemptId };
  } catch (err) {
    logIntentos('reserveLinkAttempt', err);
    return { allowed: true, attemptId };
  }
}

/**
 * Borra un intento reservado que no terminó siendo un fallo del usuario.
 * Nunca lanza.
 */
export async function releaseLinkAttempt(attemptId: number): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('whatsapp_link_attempts')
      .delete()
      .eq('id', attemptId);
    if (error) logIntentos('releaseLinkAttempt', error);
  } catch (err) {
    logIntentos('releaseLinkAttempt', err);
  }
}
