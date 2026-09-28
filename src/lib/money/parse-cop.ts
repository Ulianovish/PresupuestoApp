// Parser único de montos en pesos colombianos escritos por una persona (o
// copiados de una factura/extracto). Formato colombiano: "." de miles y ","
// de decimales ("$ 563.091,09"). Antes cada entrada (WhatsApp, el agente, el
// input web, la importación CSV) tenía su propio parser y daban resultados
// distintos para el mismo texto (563091 vs 56309109 vs 1.9 para "1.900.000").
// Módulo puro y sin dependencias: se usa tanto en servidor como en cliente.

/**
 * Sufijos que multiplican la base, del más largo al más corto para que la
 * alternancia del regex no corte "millones" en "mil".
 *
 * La "m" suelta NO está: "gasolina 5m" o "5m de tela" son metros (o un typo),
 * y el parser degradado de WhatsApp (sin LLM) los registraba como
 * $5.000.000. Para millones: "mm", "mill", "millón/millones", "palo(s)".
 */
const SUFIJOS: Array<[string, number]> = [
  ['millones', 1_000_000],
  ['millón', 1_000_000],
  ['millon', 1_000_000],
  ['palos', 1_000_000],
  ['lucas', 1_000],
  ['mill', 1_000_000],
  ['palo', 1_000_000],
  ['luca', 1_000],
  ['mil', 1_000],
  ['mm', 1_000_000],
  ['k', 1_000],
];

const MULTIPLICADOR = new Map(SUFIJOS);
const SUFIJO_RE = new RegExp(`^(.*?)(${SUFIJOS.map(([s]) => s).join('|')})$`);

/**
 * ¿Es `word` un sufijo de monto escrito como palabra aparte ("20 mil",
 * "2 millones")? La "m" suelta no es sufijo: "5 m de tela" son metros.
 */
export function isCopAmountSuffix(word: string): boolean {
  return MULTIPLICADOR.has((word || '').toLowerCase());
}

/** Grupos de miles bien formados: el primero de 1–3 dígitos, el resto de 3. */
function gruposDeMilesValidos(grupos: string[]): boolean {
  if (!/^\d{1,3}$/.test(grupos[0])) return false;
  return grupos.slice(1).every(g => /^\d{3}$/.test(g));
}

/** Parte entera con separador de miles `sep` (o sin separador). */
function parteEntera(s: string, sep: '.' | ','): string | null {
  if (!s.includes(sep)) return /^\d+$/.test(s) ? s : null;
  const grupos = s.split(sep);
  return gruposDeMilesValidos(grupos) ? grupos.join('') : null;
}

/**
 * Interpreta la parte numérica (sin sufijo ni adornos). Reglas:
 * - Con "." y "," a la vez: el ÚLTIMO es el decimal y el otro es de miles.
 * - Un solo tipo de separador que aparece más de una vez: es de miles.
 * - Aparece una vez seguido de exactamente 3 dígitos: es de miles ("5.630").
 * - Aparece una vez seguido de 1–2 dígitos: es decimal ("563091.09", "0,50").
 * - Cualquier otra forma ("1.23.456", "1.2345", "15.") es ambigua → null.
 */
function parseNumero(s: string): number | null {
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const puntos = s.split('.').length - 1;
  const comas = s.split(',').length - 1;

  if (puntos > 0 && comas > 0) {
    const decimal = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    const miles = decimal === '.' ? ',' : '.';
    if ((decimal === '.' ? puntos : comas) !== 1) return null;
    const [entera, frac] = s.split(decimal);
    if (!/^\d+$/.test(frac)) return null;
    const e = parteEntera(entera, miles);
    return e === null ? null : Number(`${e}.${frac}`);
  }

  if (puntos + comas === 0) return Number(s);

  const sep = puntos > 0 ? '.' : ',';
  if (puntos + comas > 1) {
    const e = parteEntera(s, sep);
    return e === null ? null : Number(e);
  }

  const [entera, frac] = s.split(sep);
  if (frac.length === 3) {
    const e = parteEntera(s, sep);
    return e === null ? null : Number(e);
  }
  if (frac.length === 1 || frac.length === 2)
    return Number(`${entera}.${frac}`);
  return null;
}

/**
 * Convierte un monto escrito en pesos a un entero de pesos, o null si no es un
 * monto positivo. Acepta "$ 563.091,09", "1.900.000", "40k", "1,5mm",
 * "30 mil", "2 palos", "20 lucas", "COP 45.000", "+45.000".
 *
 * El resultado se redondea a pesos enteros con Math.round ("0,50" → 1). Cero,
 * negativos y texto no numérico devuelven null.
 */
export function parseCopAmount(input: string): number | null {
  if (typeof input !== 'string') return null;
  let t = input
    .toLowerCase()
    .replace(/cop/g, '')
    .replace(/\$/g, '')
    .replace(/\s+/g, '');
  if (t.startsWith('+')) t = t.slice(1);
  if (!t) return null;

  let multiplicador = 1;
  const conSufijo = t.match(SUFIJO_RE);
  if (conSufijo) {
    t = conSufijo[1];
    multiplicador = MULTIPLICADOR.get(conSufijo[2]) ?? 1;
  }

  const n = parseNumero(t);
  if (n === null || !Number.isFinite(n)) return null;
  const pesos = Math.round(n * multiplicador);
  return pesos > 0 ? pesos : null;
}

/**
 * Como `parseCopAmount` pero ignorando el signo: los extractos bancarios traen
 * los gastos en negativo ("-45.000", "$ -45.000", "45.000,00-" o "(45.000)").
 * Para la importación de archivos, donde el signo no distingue gasto de
 * ingreso.
 */
export function parseCopAmountAbs(input: string): number | null {
  if (typeof input !== 'string') return null;
  const sinSigno = input
    .replace(/[$\s]/g, '')
    .replace(/^-/, '')
    .replace(/-$/, '')
    .replace(/^\((.*)\)$/, '$1');
  return parseCopAmount(sinSigno);
}

/**
 * Monto de una celda de un archivo importado (Excel/CSV): el número de pesos,
 * `'vacio'` si no hay monto (celda vacía o cero: se omite en silencio) o
 * `'ilegible'` si hay algo escrito que no se entiende como monto — esas filas
 * se cuentan aparte para avisarle al usuario en vez de perderlas sin decir
 * nada.
 */
export function montoDeCelda(celda: unknown): number | 'vacio' | 'ilegible' {
  if (celda === null || celda === undefined) return 'vacio';
  if (typeof celda === 'number') {
    if (!Number.isFinite(celda)) return 'ilegible';
    const pesos = Math.round(Math.abs(celda));
    return pesos > 0 ? pesos : 'vacio';
  }
  const texto = String(celda).trim();
  if (!texto) return 'vacio';
  const monto = parseCopAmountAbs(texto);
  if (monto !== null) return monto;
  // "0", "0,00", "-", "$ 0": cero escrito de alguna forma.
  return /^[\s$()+\-0.,]*$/.test(texto) ? 'vacio' : 'ilegible';
}
