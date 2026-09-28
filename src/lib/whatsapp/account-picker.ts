// Lógica pura de la lista "¿con qué cuenta fue?" de WhatsApp: qué 6 cuentas
// mostrar, cómo se arman las variables de la plantilla `twilio/list-picker` y
// cómo se reconoce la respuesta (un toque en la lista o el nombre escrito).
// No toca DB ni red: la orquestación vive en `account-prompt.ts`.

import {
  candidatasPorTexto,
  normalizar,
  resolverCuenta,
} from '@/lib/whatsapp/agent/tools';

export interface CuentaActiva {
  id: string;
  name: string;
  /** 'bank' | 'credit' | 'cash' (lo que deja `upsert_monthly_expense`), o null. */
  type: string | null;
  createdAt: string | null;
}

/** Uso de una cuenta en los últimos 90 días (ver `whatsapp_account_usage`). */
export interface UsoCuenta {
  accountId: string;
  /** Gastos registrados DESDE ESTE número (una factura cuenta como uno). */
  usosTelefono: number;
  /** Gastos de todo el usuario (los dos números y la app). */
  usosUsuario: number;
  /** Fecha del último gasto con esa cuenta (YYYY-MM-DD), sin límite de días. */
  ultimoUso: string | null;
}

/** La plantilla tiene exactamente 6 ítems: todos sus campos son variables. */
export const OPCIONES_LISTA = 6;
const MAX_TITULO = 24;
const MAX_DESCRIPCION = 72;
const MAX_CUERPO = 1024;

function desc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? 1 : -1;
}

/**
 * Ordena las cuentas activas para la lista: primero las `candidatas` (lo que
 * matcheó el texto del usuario, p. ej. "nequi" → las dos Nequi), después las
 * que más usa ESTE número, después el ranking de todo el usuario y al final
 * las que no se usaron, por uso más reciente y por creación. Cada persona
 * tiene su número, así que la lista de cada uno arranca por SUS cuentas.
 */
export function rankearCuentas(
  cuentas: CuentaActiva[],
  uso: UsoCuenta[],
  candidatas: string[] = [],
): CuentaActiva[] {
  const porId = new Map(uso.map(u => [u.accountId, u]));
  const vacio = { usosTelefono: 0, usosUsuario: 0, ultimoUso: null };
  return [...cuentas].sort((a, b) => {
    const ca = candidatas.includes(a.name) ? 0 : 1;
    const cb = candidatas.includes(b.name) ? 0 : 1;
    if (ca !== cb) return ca - cb;
    const ua = porId.get(a.id) ?? vacio;
    const ub = porId.get(b.id) ?? vacio;
    if (ua.usosTelefono !== ub.usosTelefono)
      return ub.usosTelefono - ua.usosTelefono;
    if (ua.usosUsuario !== ub.usosUsuario)
      return ub.usosUsuario - ua.usosUsuario;
    return (
      desc(ua.ultimoUso, ub.ultimoUso) ||
      desc(a.createdAt, b.createdAt) ||
      a.name.localeCompare(b.name, 'es')
    );
  });
}

function cortar(texto: string, max: number): string {
  const chars = [...texto];
  return chars.length <= max ? texto : `${chars.slice(0, max - 1).join('')}…`;
}

/** WhatsApp corta el título de un ítem en 24 caracteres. */
export function truncarTitulo(nombre: string): string {
  return cortar(nombre, MAX_TITULO);
}

function descripcionCuenta(type: string | null): string {
  if (type === 'credit') return 'Tarjeta de crédito';
  if (type === 'cash') return 'Efectivo';
  if (type === 'bank') return 'Cuenta bancaria';
  // No se sabe si Twilio acepta una variable vacía: mejor un guion.
  return '-';
}

const PREFIJO_ID = 'cta';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const RE_ID = new RegExp(`^${PREFIJO_ID}:(${UUID}):(${UUID})$`, 'i');

/**
 * Id de un ítem de la lista. Lleva la pregunta y la cuenta: con eso el toque
 * se resuelve sin estado de conversación (puede haber varias listas abiertas
 * a la vez y cada una sabe a qué gasto o factura apunta).
 */
export function armarIdOpcion(promptId: string, accountId: string): string {
  return `${PREFIJO_ID}:${promptId}:${accountId}`;
}

/** Valida estricto el `ListId` que manda Twilio: cualquier otra cosa → null. */
export function parsearIdOpcion(
  listId: string,
): { promptId: string; accountId: string } | null {
  const m = RE_ID.exec(listId || '');
  if (!m) return null;
  return { promptId: m[1].toLowerCase(), accountId: m[2].toLowerCase() };
}

/**
 * Variables de la plantilla `elegir_cuenta_6`: `{{1}}` es el cuerpo y cada
 * ítem i (0..5) usa `{{2+3i}}` id, `{{3+3i}}` título y `{{4+3i}}` descripción.
 * Null si no hay 6 cuentas: no se sabe si Twilio acepta variables vacías, así
 * que con menos opciones se pregunta por texto.
 */
export function armarVariablesLista(
  cuerpo: string,
  promptId: string,
  cuentas: CuentaActiva[],
): Record<string, string> | null {
  if (cuentas.length < OPCIONES_LISTA) return null;
  const vars: Record<string, string> = { '1': cortar(cuerpo, MAX_CUERPO) };
  cuentas.slice(0, OPCIONES_LISTA).forEach((c, i) => {
    vars[String(2 + 3 * i)] = armarIdOpcion(promptId, c.id);
    vars[String(3 + 3 * i)] = truncarTitulo(c.name);
    vars[String(4 + 3 * i)] = cortar(
      descripcionCuenta(c.type),
      MAX_DESCRIPCION,
    );
  });
  return vars;
}

/** Pregunta por texto cuando no se puede mandar la lista. */
export function textoPreguntaCuenta(
  cuerpo: string,
  cuentas: CuentaActiva[],
): string {
  const opciones = cuentas.map(c => c.name).join(', ');
  return opciones
    ? `${cuerpo}\nTus cuentas: ${opciones}. Respondé con el nombre.`
    : cuerpo;
}

/**
 * Palabras que pueden acompañar un nombre de cuenta sin cambiar el sentido
 * ("con la Nequi", "fue en efectivo"). Cualquier otra palabra que no sea de
 * una cuenta hace que el mensaje NO sea una respuesta de cuenta: "cuánto llevo
 * en efectivo" es una consulta, no una elección.
 */
const RELLENO = new Set([
  'a',
  'al',
  'con',
  'cuenta',
  'de',
  'del',
  'desde',
  'el',
  'en',
  'era',
  'es',
  'fue',
  'la',
  'las',
  'lo',
  'los',
  'mi',
  'pague',
  'por',
  'tarjeta',
  'y',
]);

function palabras(texto: string): string[] {
  return normalizar(texto)
    .replace(/[.,;:!¡]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Filtro barato (sin DB) de si un mensaje PUEDE ser la respuesta a "¿con qué
 * cuenta fue?": corto (hasta 4 palabras), sin números (un monto es un gasto
 * nuevo: "40k huevos") y sin signos de pregunta.
 */
export function pareceRespuestaDeCuenta(texto: string): boolean {
  const t = (texto || '').trim();
  if (!t || /\d/.test(t) || /[?¿]/.test(t)) return false;
  const n = palabras(t).length;
  return n > 0 && n <= 4;
}

export type RespuestaCuenta =
  | { kind: 'ok'; cuenta: string }
  | { kind: 'ambigua'; candidatas: string[] }
  | { kind: 'no-es-cuenta' };

/**
 * Interpreta un mensaje escrito como respuesta a la lista de cuentas. Solo
 * acepta mensajes hechos de palabras de cuentas y relleno; el nombre se
 * resuelve con la misma lógica que el resto del bot (`resolverCuenta` y, si no
 * alcanza, las palabras distintivas de `candidatasPorTexto`).
 */
export function interpretarRespuestaCuenta(
  texto: string,
  accounts: string[],
): RespuestaCuenta {
  if (!pareceRespuestaDeCuenta(texto)) return { kind: 'no-es-cuenta' };

  const deCuentas = new Set(accounts.flatMap(a => palabras(a)));
  const todas = palabras(texto);
  if (todas.some(p => !deCuentas.has(p) && !RELLENO.has(p))) {
    return { kind: 'no-es-cuenta' };
  }
  const nucleo = todas.filter(p => !RELLENO.has(p) || deCuentas.has(p));
  if (nucleo.length === 0) return { kind: 'no-es-cuenta' };

  const exacta = resolverCuenta(nucleo.join(' '), accounts);
  if (exacta.kind === 'ok') return { kind: 'ok', cuenta: exacta.cuenta };
  if (exacta.kind === 'ambigua') {
    return { kind: 'ambigua', candidatas: exacta.candidatas };
  }

  const candidatas = candidatasPorTexto(nucleo.join(' '), accounts);
  if (candidatas.length === 1) return { kind: 'ok', cuenta: candidatas[0] };
  if (candidatas.length > 1) return { kind: 'ambigua', candidatas };
  return { kind: 'no-es-cuenta' };
}
