/**
 * Reutiliza lo que el USUARIO ya decidió antes para clasificar un gasto nuevo.
 *
 * El clasificador por IA no conoce las convenciones de la casa (bebidas y
 * mecato van a GASTOS HORMIGA y no a MERCADO; la ropa de la niña a ALICE; la
 * transferencia a "Luisa Fernanda Gomez Franco" es el arriendo...). El usuario
 * ya las enseñó cada vez que corrigió una asignación a mano: antes de llamar al
 * LLM se busca un gasto anterior con la misma descripción (normalizada) que el
 * usuario haya asignado a mano ('manual'), y si existe se reutiliza su
 * categoría y el ítem con el MISMO NOMBRE en el mes destino (los ítems son
 * por mes: el id cambia, el nombre no).
 *
 * Solo se confía en 'manual'. Las sugerencias aceptadas ('historial') salen de
 * una manual previa, así que no aportan información nueva y sí podrían
 * perpetuar un error viejo más allá de la ventana de meses.
 *
 * Todo lo que no toca la base es puro y testeable; `cargarHistorialManual`
 * hace UNA consulta por lote y es best-effort.
 */

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import {
  normalizarNombre,
  type BudgetItemRef,
} from '@/lib/services/expenses-rollup';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Fila tal como la devuelve la consulta de `cargarHistorialManual`. */
export interface FilaHistorial {
  description: string | null;
  category_name: string | null;
  transaction_date: string;
  budget_items: {
    name: string | null;
    categories: { name: string | null } | null;
  } | null;
}

export interface EntradaHistorial {
  /** Descripción original (para los ejemplos del prompt). */
  descripcion: string;
  /** Descripción normalizada: la clave de búsqueda. */
  clave: string;
  /** Categoría que eligió el usuario. */
  categoria: string;
  /**
   * Nombre del ítem, solo si es de esa misma categoría. Si el usuario corrigió
   * la categoría pero el ítem quedó de otra (p. ej. "Chocolate" pasado a
   * GASTOS HORMIGA con el ítem viejo "Dulces" de MERCADO), el ítem no refleja
   * su decisión y no se reutiliza.
   */
  itemNombre: string | null;
  fecha: string;
}

export type IndiceHistorial = Map<string, EntradaHistorial>;

/** Categorías "no sé": un gasto en ellas puede tomar la categoría del historial. */
const CATEGORIAS_COMODIN = new Set(['otros', '']);

/** Meses hacia atrás que se miran por defecto. */
const MESES_HISTORIAL = 12;
/** Tope de filas: la consulta es por lote y tiene que seguir siendo barata. */
const LIMITE_FILAS = 1000;

const BANCOS = [
  'bancolombia',
  'bold',
  'nequi',
  'daviplata',
  'davivienda',
  'davibank',
  'breb',
  'bre b',
].join('|');

/**
 * Prefijos de transferencias/pagos que no dicen nada del gasto: lo que
 * identifica al gasto es el destinatario que viene después. Se aplican sobre
 * el texto ya normalizado (sin puntuación).
 */
const PREFIJOS: RegExp[] = [
  new RegExp(`^(?:a la )?llave(?: (?:${BANCOS}))?\\s+`),
  /^(?:transferencia|transf|envio|enviado|pago)\s+(?:a|de|desde|para)\s+/,
  /^pago en qr bre ?b\b\s*/,
  // "banco davibank s a 3165766461 de luisa ...", "nequi 3115230857 de carlos ..."
  /^(?:[a-z]+ ){0,5}\d{6,} de\s+/,
];

/**
 * Normaliza una descripción para buscarla en el historial: minúsculas, sin
 * tildes ni puntuación, espacios colapsados, sin prefijos bancarios ni
 * "cuota N de M". Un handle "@susana7309" queda como "susana". Si no queda
 * nada útil (p. ej. solo el prefijo), devuelve '' y no se matchea.
 */
export function normalizarDescripcion(desc: string | null | undefined): string {
  let s = (desc ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // "@susana7309" → "susana" (un "@ 3.250" de conversión no es un handle)
    .replace(/@([a-z]+)\d*/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Los prefijos pueden venir encadenados ("transferencia a llave nequi ...").
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const antes = s;
    for (const re of PREFIJOS) s = s.replace(re, '').trim();
    if (s === antes) break;
  }
  s = s.replace(/\s*\bcuota \d+ de \d+$/, '').trim();

  return s.length >= 3 ? s : '';
}

/** Convierte filas de la base en entradas (más reciente primero, como vienen). */
export function construirHistorial(filas: FilaHistorial[]): EntradaHistorial[] {
  const entradas: EntradaHistorial[] = [];
  for (const f of filas) {
    const descripcion = (f.description ?? '').replace(/\s+/g, ' ').trim();
    const clave = normalizarDescripcion(descripcion);
    const categoria = (f.category_name ?? '').trim();
    if (!clave || !categoria) continue;

    const item = f.budget_items;
    const itemCategoria = item?.categories?.name ?? null;
    const itemNombre =
      item?.name &&
      itemCategoria &&
      normalizarNombre(itemCategoria) === normalizarNombre(categoria)
        ? item.name
        : null;

    entradas.push({
      descripcion,
      clave,
      categoria,
      itemNombre,
      fecha: f.transaction_date,
    });
  }
  return entradas;
}

/** Índice por clave; ante repetidos gana la asignación más reciente. */
export function indexarHistorial(
  entradas: EntradaHistorial[],
): IndiceHistorial {
  const ordenadas = [...entradas].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );
  const indice: IndiceHistorial = new Map();
  for (const e of ordenadas) {
    if (!indice.has(e.clave)) indice.set(e.clave, e);
  }
  return indice;
}

/** Búsqueda exacta por descripción normalizada. */
export function buscarEnHistorial(
  descripcion: string,
  indice: IndiceHistorial,
): EntradaHistorial | null {
  const clave = normalizarDescripcion(descripcion);
  if (!clave) return null;
  return indice.get(clave) ?? null;
}

/**
 * Ítem del mes destino según el historial. Aplica si la categoría actual del
 * gasto es la misma del historial, o si es un comodín (OTROS / vacía): una
 * categoría que el usuario eligió distinta a la del historial se respeta.
 * `cambiaCategoria` avisa al llamador que también debe actualizar la
 * categoría del gasto, para que no quede un ítem de VIVIENDA en un gasto OTROS.
 */
export function itemDesdeHistorial(
  descripcion: string,
  categoriaGasto: string,
  indice: IndiceHistorial,
  items: BudgetItemRef[],
): { itemId: string; categoria: string; cambiaCategoria: boolean } | null {
  const hit = buscarEnHistorial(descripcion, indice);
  if (!hit || !hit.itemNombre) return null;

  const catGasto = normalizarNombre(categoriaGasto);
  const catHist = normalizarNombre(hit.categoria);
  if (catGasto !== catHist && !CATEGORIAS_COMODIN.has(catGasto)) return null;

  const nombre = normalizarNombre(hit.itemNombre);
  const item = items.find(
    i =>
      normalizarNombre(i.name) === nombre &&
      normalizarNombre(i.category_name) === catHist,
  );
  if (!item) return null;

  return {
    itemId: item.id,
    categoria: item.category_name,
    cambiaCategoria: catGasto !== catHist,
  };
}

/** Primer día del mes, `meses` atrás, como YYYY-MM-DD. */
function desdeHaceMeses(hoy: Date, meses: number): string {
  const d = new Date(
    Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - meses, 1),
  );
  return d.toISOString().slice(0, 10);
}

/**
 * Carga las asignaciones MANUALES recientes del usuario (una consulta). El
 * `user_id` se filtra explícito porque en WhatsApp corre con service-role.
 * Best-effort: ante cualquier error devuelve [] y se sigue con la IA.
 */
export async function cargarHistorialManual(
  // Sin tipar a propósito: `transactions` en database.ts está desactualizado
  // (no tiene category_name / budget_item_source ni relaciones).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  opts: { meses?: number; hoy?: Date } = {},
): Promise<EntradaHistorial[]> {
  try {
    const desde = desdeHaceMeses(
      opts.hoy ?? new Date(),
      opts.meses ?? MESES_HISTORIAL,
    );
    const { data, error } = await supabase
      .from('transactions')
      .select(
        'description, category_name, transaction_date, budget_items(name, categories(name))',
      )
      .eq('user_id', userId)
      .eq('budget_item_source', 'manual')
      .gte('transaction_date', desde)
      .order('transaction_date', { ascending: false })
      .limit(LIMITE_FILAS);
    if (error) throw new Error(error.message);
    return construirHistorial((data ?? []) as unknown as FilaHistorial[]);
  } catch (error) {
    console.warn('[historial] no se pudo cargar el historial manual:', error);
    return [];
  }
}

type Categorizador = (
  items: Array<{ description: string }>,
  categories: string[],
) => Promise<string[]>;

/**
 * Categoriza ítems reutilizando primero el historial del usuario; solo lo que
 * no está en el historial va al LLM. La categoría del historial se devuelve
 * con la grafía de la lista del usuario y solo si todavía existe.
 */
export async function categorizarConHistorial(
  items: Array<{ description: string }>,
  categorias: string[],
  entradas: EntradaHistorial[],
  _opts: { supplier?: string | null } = {},
  categorizar: Categorizador = categorizeInvoiceItems,
): Promise<string[]> {
  const indice = indexarHistorial(entradas);
  const porNombre = new Map(categorias.map(c => [normalizarNombre(c), c]));

  const resultado: Array<string | null> = items.map(it => {
    const hit = buscarEnHistorial(it.description, indice);
    return hit
      ? (porNombre.get(normalizarNombre(hit.categoria)) ?? null)
      : null;
  });

  const pendientes = items
    .map((it, i) => ({ it, i }))
    .filter(({ i }) => resultado[i] === null);
  if (pendientes.length > 0) {
    const cats = await categorizar(
      pendientes.map(p => p.it),
      categorias,
    );
    pendientes.forEach(({ i }, k) => {
      resultado[i] = cats[k] ?? 'OTROS';
    });
  }
  return resultado as string[];
}
