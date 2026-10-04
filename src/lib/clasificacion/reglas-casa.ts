/**
 * Reglas de la casa: palabras que SIEMPRE mandan un gasto al mismo ítem,
 * sin preguntarle al modelo ni mirar el historial.
 *
 * El historial aprende de lo que el usuario asignó antes, pero arrastra lo
 * que se asignó mal antes de que existiera el ítem (el pan vivía en "Lacena"
 * y las galletas en "Dulces"). Una regla explícita gana sobre los dos: es una
 * decisión declarada, no una inferencia.
 *
 * El match es por PALABRA COMPLETA, sin tildes ni mayúsculas. Por substring,
 * "pan" se comería "Pantalón", "Pantalla" y "Panela".
 */

export interface ReglaCasa {
  /** Nombre del ítem de presupuesto al que va el gasto. */
  item: string;
  /** Palabras que disparan la regla (ya sin tildes y en minúscula). */
  palabras: string[];
}

export const REGLAS_CASA: ReglaCasa[] = [
  {
    item: 'Parva',
    palabras: [
      'pan',
      'panes',
      'pandebono',
      'pandebonos',
      'galleta',
      'galletas',
      'bunuelo',
      'bunuelos',
      'croissant',
      'croissants',
      'parva',
    ],
  },
];

/** Minúsculas, sin tildes y partido en palabras (los números cuentan aparte). */
export function palabrasDe(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Ítem que impone una regla para esa descripción, o null si ninguna aplica.
 * La primera regla que coincide manda.
 */
export function itemPorRegla(
  descripcion: string | null | undefined,
  reglas: ReglaCasa[] = REGLAS_CASA,
): string | null {
  if (!descripcion) return null;
  const palabras = new Set(palabrasDe(descripcion));
  if (palabras.size === 0) return null;

  for (const regla of reglas) {
    if (regla.palabras.some(p => palabras.has(p))) return regla.item;
  }
  return null;
}

/**
 * Aplica las reglas a un lote de descripciones contra los ítems disponibles.
 * Devuelve el nombre del ítem TAL COMO está escrito en `itemNames` (el de la
 * regla puede diferir en tildes o mayúsculas), o null si no hay regla o si el
 * ítem de la regla no existe en ese mes: ahí sigue el camino normal.
 */
export function resolverPorReglas(
  descripciones: Array<string | null | undefined>,
  itemNames: string[],
  reglas: ReglaCasa[] = REGLAS_CASA,
): Array<string | null> {
  const porNombre = new Map(
    itemNames.map(n => [palabrasDe(n).join(' '), n] as const),
  );
  return descripciones.map(d => {
    const item = itemPorRegla(d, reglas);
    if (!item) return null;
    return porNombre.get(palabrasDe(item).join(' ')) ?? null;
  });
}
