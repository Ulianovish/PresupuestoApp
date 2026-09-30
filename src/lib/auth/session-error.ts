import { isAuthSessionMissingError } from '@supabase/supabase-js';

/**
 * `getUser()` sin cookie de sesión devuelve `AuthSessionMissingError`: es lo
 * normal para un visitante sin sesión, no un fallo, así que no se registra.
 * Se usa la detección del SDK y, además, se acepta por nombre un objeto plano
 * (el error puede llegar sin ser una instancia de la clase).
 */
export function esFaltaDeSesion(error: unknown): boolean {
  return (
    isAuthSessionMissingError(error) ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AuthSessionMissingError')
  );
}

/** Lo que se registra de un error de Supabase Auth: nunca el mensaje. */
export interface ResumenErrorAuth {
  code: string;
  status?: number;
}

function textoNoVacio(obj: object, campo: 'code' | 'name'): string | null {
  const valor = (obj as Record<string, unknown>)[campo];
  return typeof valor === 'string' && valor ? valor : null;
}

/**
 * Resume un error de Supabase Auth para el log: su `code` o, si no trae, su
 * nombre (AuthRetryableFetchError cuando Supabase no responde, aunque llegue
 * como objeto plano), más el `status` HTTP si lo hay. El mensaje nunca se
 * incluye: podría llevar el correo u otros datos personales.
 */
export function resumenErrorAuth(error: unknown): ResumenErrorAuth {
  if (typeof error !== 'object' || error === null) {
    return { code: 'sin_codigo' };
  }
  const code =
    textoNoVacio(error, 'code') ?? textoNoVacio(error, 'name') ?? 'sin_codigo';
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? { code, status } : { code };
}
