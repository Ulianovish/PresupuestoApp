// Helpers puros para interpretar la foto de un comprobante: qué descripción
// ponerle al gasto (lo que escribió el usuario le gana a lo que leyó la
// visión) y qué fecha es creíble. Sin dependencias de base ni de red.

import { parseCopAmount } from '@/lib/money/parse-cop';
import { normalizar } from '@/lib/whatsapp/agent/tools';

/**
 * Bancos, billeteras y medios de pago comunes en Colombia. Sirven para
 * reconocer "con la Bancolombia" como mención de cuenta aunque el usuario no
 * tenga una cuenta con ese nombre (no se resuelve la cuenta acá, solo se
 * saca del concepto).
 */
const MEDIOS_DE_PAGO = new Set([
  'nequi',
  'daviplata',
  'davivienda',
  'bancolombia',
  'bbva',
  'nu',
  'lulo',
  'rappipay',
  'rappi',
  'movii',
  'dale',
  'falabella',
  'colpatria',
  'scotiabank',
  'itau',
  'occidente',
  'popular',
  'avvillas',
  'efectivo',
  'tarjeta',
  'debito',
  'credito',
  'banco',
  'cuenta',
  'ahorros',
  'transfiya',
  'pse',
]);

/** Palabras que introducen el medio de pago: "con", "desde", "por", "vía". */
const CONECTORES = new Set(['con', 'desde', 'por', 'via', 'x', 'en']);
const ARTICULOS = new Set(['la', 'el', 'mi', 'mis', 'los', 'las', 'un', 'una']);
/** Verbos de pago que acompañan la mención de cuenta ("pagué con Nequi"). */
const VERBOS_PAGO = new Set(['pague', 'pago', 'pagado', 'pagada']);
/**
 * Muletillas que sobran al principio o al final una vez sacada la cuenta:
 * "fue con la Nequi" → "fue", "Compré huevos" → "huevos".
 */
const MULETILLAS = new Set([
  ...VERBOS_PAGO,
  ...CONECTORES,
  ...ARTICULOS,
  'fue',
  'fueron',
  'es',
  'era',
  'compre',
  'gaste',
  'de',
  'del',
  'y',
]);

/** Token normalizado y sin puntuación, para comparar contra los conjuntos. */
function clave(token: string): string {
  return normalizar(token).replace(/[^\p{L}\p{N}]/gu, '');
}

/** ¿El token nombra una cuenta (del usuario o un medio de pago conocido)? */
function esCuenta(k: string, palabrasDeCuentas: Set<string>): boolean {
  return MEDIOS_DE_PAGO.has(k) || palabrasDeCuentas.has(k);
}

/**
 * Saca del texto del usuario lo que NO es el concepto del gasto: la mención de
 * la cuenta ("con nequi", "pagué con la Davivienda Crédito"), los montos
 * ("9.000", "20k") y las muletillas de los bordes. Devuelve null si no queda
 * nada (el texto solo decía la cuenta), para caer a lo que leyó la visión.
 *
 * "Huevos con nequi" → "Huevos"; "Cena afuera" → "Cena afuera";
 * "Almuerzo con Juan" → "Almuerzo con Juan" (Juan no es una cuenta).
 */
export function conceptoDesdeTexto(
  texto: string | null | undefined,
  accounts: string[],
): string | null {
  const tokens = (texto || '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const palabrasDeCuentas = new Set(
    accounts
      .flatMap(a => normalizar(a).split(/\s+/))
      .map(clave)
      .filter(p => p.length >= 2 && !MULETILLAS.has(p)),
  );

  const quitar = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    if (!CONECTORES.has(clave(tokens[i]))) continue;
    let j = i + 1;
    while (j < tokens.length && ARTICULOS.has(clave(tokens[j]))) j++;
    if (j >= tokens.length || !esCuenta(clave(tokens[j]), palabrasDeCuentas))
      continue;
    // "con la Davivienda Crédito", "con tarjeta de crédito": se sigue
    // comiendo mientras siga hablando de la cuenta.
    let fin = j + 1;
    while (fin < tokens.length) {
      const k = clave(tokens[fin]);
      if (esCuenta(k, palabrasDeCuentas)) fin++;
      else if (
        (k === 'de' || k === 'del') &&
        fin + 1 < tokens.length &&
        esCuenta(clave(tokens[fin + 1]), palabrasDeCuentas)
      )
        fin += 2;
      else break;
    }
    const inicio = i > 0 && VERBOS_PAGO.has(clave(tokens[i - 1])) ? i - 1 : i;
    for (let x = inicio; x < fin; x++) quitar.add(x);
    i = fin - 1;
  }

  const restantes = tokens.filter(
    (t, i) => !quitar.has(i) && !(/\d/.test(t) && parseCopAmount(t) != null),
  );
  while (restantes.length && MULETILLAS.has(clave(restantes[0])))
    restantes.shift();
  while (
    restantes.length &&
    MULETILLAS.has(clave(restantes[restantes.length - 1]))
  )
    restantes.pop();

  const concepto = restantes
    .join(' ')
    .replace(/[\s,.;:-]+$/, '')
    .trim();
  if (!concepto) return null;
  return concepto.charAt(0).toUpperCase() + concepto.slice(1);
}

/**
 * Descripción del gasto de una transferencia leída de una foto, en orden: lo
 * que escribió el usuario junto a la foto, el concepto que leyó la visión, el
 * destinatario impreso y, si no hay nada, "Transferencia". El usuario sabe
 * qué compró; la foto solo sabe a quién le pagó (y el nombre de una persona
 * no sirve para clasificar el rubro).
 */
export function describirTransferencia(
  texto: string | null | undefined,
  vision: { concept: string | null; recipient: string | null },
  accounts: string[],
): string {
  return (
    conceptoDesdeTexto(texto, accounts) ??
    conceptoDesdeTexto(vision.concept, accounts) ??
    (vision.recipient?.trim() || null) ??
    'Transferencia'
  );
}

/** Días hacia atrás que se le creen a una fecha leída de un comprobante. */
const DIAS_MAXIMOS_ATRAS = 60;

function diaUtc(ymd: string): number {
  const [a, m, d] = ymd.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
}

/**
 * La visión a veces lee mal la fecha (un año viejo, o una fecha de
 * vencimiento en el futuro) y el gasto quedaba en un mes que nadie mira. Si
 * la fecha está a más de 60 días en el pasado o en el futuro, se usa hoy y se
 * devuelve la descartada para avisarle al usuario. `hoy` es YYYY-MM-DD de
 * Bogotá (`todayBogota`).
 */
export function sanearFechaComprobante(
  fecha: string | null,
  hoy: string,
): { fecha: string; descartada: string | null } {
  if (!fecha) return { fecha: hoy, descartada: null };
  const diferencia = diaUtc(hoy) - diaUtc(fecha);
  if (diferencia < 0 || diferencia > DIAS_MAXIMOS_ATRAS) {
    return { fecha: hoy, descartada: fecha };
  }
  return { fecha, descartada: null };
}

const MESES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** "2025-04-09" → "9 abr 2025". */
export function formatFechaCorta(ymd: string): string {
  const [a, m, d] = ymd.split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
}

/** Aviso para el mensaje de confirmación cuando se descartó la fecha leída. */
export function avisoFechaDescartada(descartada: string | null): string {
  return descartada
    ? `(La fecha del comprobante parecía ${formatFechaCorta(descartada)}; la puse hoy. Editala si no.)`
    : '';
}
