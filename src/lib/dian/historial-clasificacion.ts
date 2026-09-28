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
 * Y ni siquiera toda 'manual' es del usuario: el panel viejo "Gastos sin
 * clasificar" preseleccionaba el PRIMER ítem alfabético de la categoría y
 * "Asignar" lo guardaba como 'manual' ("Mercado" → Aseo, "Migao" → Cine). Por
 * eso (1) las descripciones genéricas o muy cortas no son clave, y (2) una
 * fila que apunta al primer ítem de una categoría con varios ítems ese mes
 * solo se cree si algo la respalda (ver `construirHistorial`).
 *
 * Todo lo que no toca la base es puro y testeable; `cargarHistorialManual`
 * hace UNA consulta por lote y es best-effort.
 */

import {
  categorizeInvoiceItems,
  type CategorizationContext,
} from '@/lib/dian/categorizer';
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
    /** id / plantilla (mes) / categoría: para saber si era el "primer ítem". */
    id?: string | null;
    template_id?: string | null;
    category_id?: string | null;
    name: string | null;
    categories: { name: string | null } | null;
  } | null;
}

/** Ítem del presupuesto tal como lo devuelve la consulta de ítems hermanos. */
export interface ItemHermano {
  id: string;
  template_id: string | null;
  category_id: string | null;
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

/** Claves más cortas que esto no se matchean ("arq", "pan"): demasiado ambiguas. */
const LARGO_MINIMO_CLAVE = 4;

/**
 * Palabras que no identifican un gasto: categorías, bancos/billeteras, medios y
 * verbos de pago, rellenos de los comprobantes ('Transferencia' es el concepto
 * por defecto de un comprobante sin concepto) y conectores. Una clave hecha
 * SOLO de estas palabras ("Mercado", "Compra Bancolombia", "Sin descripción")
 * no se matchea: "Mercado" pudo ser aseo, carne o verduras. Con algo
 * específico al lado ("Mercado D1", "Pago Tarjeta Nu") sí es clave. Ojo: acá
 * no van cosas concretas como "almuerzo" o "gasolina".
 */
const PALABRAS_GENERICAS = new Set([
  // categorías / "no sé"
  'mercado',
  'gasto',
  'gastos',
  'varios',
  'otros',
  'otro',
  'general',
  // verbos y documentos de pago
  'compra',
  'compras',
  'pago',
  'pagos',
  'transferencia',
  'transferencias',
  'transf',
  'envio',
  'enviado',
  'deposito',
  'consignacion',
  'retiro',
  'abono',
  'factura',
  'recibo',
  'comprobante',
  'sin',
  'descripcion',
  'concepto',
  // bancos, billeteras y medios
  'nequi',
  'daviplata',
  'bancolombia',
  'davivienda',
  'davibank',
  'bold',
  'breb',
  'bre',
  'pse',
  'qr',
  'banco',
  'efectivo',
  'tarjeta',
  'credito',
  'debito',
  // conectores
  'a',
  'al',
  'b',
  'con',
  'de',
  'del',
  'desde',
  'el',
  'en',
  'la',
  'las',
  'los',
  'para',
  'por',
  'y',
]);

/**
 * Normaliza una descripción para buscarla en el historial: minúsculas, sin
 * tildes ni puntuación, espacios colapsados, sin prefijos bancarios ni
 * "cuota N de M". Un handle "@susana7309" queda como "susana". Si no queda
 * nada útil (solo el prefijo, menos de 4 letras o solo palabras genéricas),
 * devuelve '' y no se matchea.
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

  if (s.length < LARGO_MINIMO_CLAVE) return '';
  if (s.split(' ').every(p => PALABRAS_GENERICAS.has(p))) return '';
  return s;
}

/**
 * Ids de los ítems que el panel viejo habría preseleccionado: el PRIMERO de
 * cada categoría de cada mes (plantilla), solo si esa categoría tenía más de
 * un ítem (con uno solo no había nada que elegir). `items` tiene que venir en
 * el orden de `get_budget_items_for_month` (por nombre, con la collation de
 * la base): el primero que aparece de cada grupo es el primero alfabético.
 */
export function primerosDeGrupo(items: ItemHermano[]): Set<string> {
  const porGrupo = new Map<string, { primero: string; cuantos: number }>();
  for (const it of items) {
    const k = `${it.template_id}|${it.category_id}`;
    const g = porGrupo.get(k);
    if (g) g.cuantos++;
    else porGrupo.set(k, { primero: it.id, cuantos: 1 });
  }
  const out = new Set<string>();
  for (const g of porGrupo.values()) if (g.cuantos > 1) out.add(g.primero);
  return out;
}

/** Palabras de 4+ letras del nombre del ítem ("Alimentación Alice" → alimentacion, alice). */
function palabrasDeItem(nombre: string): string[] {
  return normalizarNombre(nombre)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length >= LARGO_MINIMO_CLAVE && !PALABRAS_GENERICAS.has(p));
}

/**
 * ¿El nombre del ítem aparece en la descripción? ("Entradas Cineprox" → Cine,
 * "Anthropic Claude Sub" → Claude IA). Si aparece, la asignación no fue el
 * default ciego del panel: el ítem describe el gasto.
 */
function itemEnDescripcion(itemNombre: string, clave: string): boolean {
  const palabras = clave.split(' ');
  return palabrasDeItem(itemNombre).some(pi =>
    palabras.some(pd => pd.startsWith(pi)),
  );
}

/**
 * Convierte filas de la base en entradas (más reciente primero, como vienen).
 *
 * `primerosDeGrupo`: ítems que el panel viejo preseleccionaba (ver
 * `primerosDeGrupo()`). Una fila cuyo ítem es uno de esos, de la misma
 * categoría del gasto, es SOSPECHOSA: pudo ser un "Asignar" sin mirar. Se
 * descarta entera (categoría incluida: tampoco la confirmó) salvo que la
 * respalde otra fila manual NO sospechosa con la misma clave, categoría e
 * ítem, o que el nombre del ítem aparezca en la descripción.
 */
export function construirHistorial(
  filas: FilaHistorial[],
  opts: { primerosDeGrupo?: Set<string> } = {},
): EntradaHistorial[] {
  const primeros = opts.primerosDeGrupo ?? new Set<string>();
  const candidatas: Array<{ entrada: EntradaHistorial; sospechosa: boolean }> =
    [];
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

    candidatas.push({
      entrada: {
        descripcion,
        clave,
        categoria,
        itemNombre,
        fecha: f.transaction_date,
      },
      // Sospechosa solo si el ítem es de la categoría del gasto: el panel
      // viejo preseleccionaba dentro de esa categoría. Un ítem de otra
      // categoría lo eligió el usuario.
      sospechosa: !!(itemNombre && item?.id && primeros.has(item.id)),
    });
  }

  const mismaDecision = (a: EntradaHistorial, b: EntradaHistorial) =>
    a.clave === b.clave &&
    normalizarNombre(a.categoria) === normalizarNombre(b.categoria) &&
    normalizarNombre(a.itemNombre) === normalizarNombre(b.itemNombre);

  return candidatas
    .filter(
      ({ entrada, sospechosa }) =>
        !sospechosa ||
        itemEnDescripcion(entrada.itemNombre ?? '', entrada.clave) ||
        candidatas.some(
          o => !o.sospechosa && mismaDecision(o.entrada, entrada),
        ),
    )
    .map(c => c.entrada);
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
 * gasto es la misma del historial, o si la categoría se puede cambiar: vacía,
 * o marcada por el llamador como ADIVINADA (`categoriaAdivinada`: la puso la
 * IA de WhatsApp/visión/facturas o las palabras clave de la importación, no
 * el usuario). Una categoría que el usuario eligió — OTROS incluido — se
 * respeta. `cambiaCategoria` avisa al llamador que también debe actualizar la
 * categoría del gasto, para que no quede un ítem de VIVIENDA en un gasto OTROS.
 */
export function itemDesdeHistorial(
  descripcion: string,
  categoriaGasto: string,
  indice: IndiceHistorial,
  items: BudgetItemRef[],
  opts: { categoriaAdivinada?: boolean } = {},
): { itemId: string; categoria: string; cambiaCategoria: boolean } | null {
  const hit = buscarEnHistorial(descripcion, indice);
  if (!hit || !hit.itemNombre) return null;

  const catGasto = normalizarNombre(categoriaGasto);
  const catHist = normalizarNombre(hit.categoria);
  const sePuedeCambiar = catGasto === '' || !!opts.categoriaAdivinada;
  if (catGasto !== catHist && !sePuedeCambiar) return null;

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

/** Tope de ítems hermanos (12 meses × los ítems de las categorías usadas). */
const LIMITE_HERMANOS = 5000;

/**
 * Ítems que el panel viejo habría preseleccionado entre los de las filas
 * (segunda consulta: los ítems activos de esos meses y categorías, en el
 * orden de `get_budget_items_for_month`). Best-effort: si falla, conjunto
 * vacío — se sigue sin ese filtro (las claves genéricas igual se descartan).
 */
async function cargarPrimerosDeGrupo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  filas: FilaHistorial[],
): Promise<Set<string>> {
  const plantillas = new Set<string>();
  const categorias = new Set<string>();
  for (const f of filas) {
    const it = f.budget_items;
    if (it?.template_id && it.category_id) {
      plantillas.add(it.template_id);
      categorias.add(it.category_id);
    }
  }
  if (plantillas.size === 0) return new Set();
  try {
    const { data, error } = await supabase
      .from('budget_items')
      .select('id, template_id, category_id')
      .in('template_id', [...plantillas])
      .in('category_id', [...categorias])
      .eq('is_active', true)
      // Mismo orden que get_budget_items_for_month (c.name, bi.name): dentro
      // de una categoría, por nombre con la collation de la base.
      .order('name')
      .limit(LIMITE_HERMANOS);
    if (error) throw new Error(error.message);
    return primerosDeGrupo((data ?? []) as ItemHermano[]);
  } catch (error) {
    console.warn(
      '[historial] no se pudieron cargar los ítems hermanos:',
      error,
    );
    return new Set();
  }
}

/**
 * Carga las asignaciones MANUALES recientes del usuario (una consulta, más
 * otra por los ítems hermanos para descartar los "Asignar" a ciegas). El
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
        'description, category_name, transaction_date, budget_items(id, template_id, category_id, name, categories(name))',
      )
      .eq('user_id', userId)
      .eq('budget_item_source', 'manual')
      .gte('transaction_date', desde)
      .order('transaction_date', { ascending: false })
      .limit(LIMITE_FILAS);
    if (error) throw new Error(error.message);
    const filas = (data ?? []) as unknown as FilaHistorial[];
    return construirHistorial(filas, {
      primerosDeGrupo: await cargarPrimerosDeGrupo(supabase, filas),
    });
  } catch (error) {
    console.warn('[historial] no se pudo cargar el historial manual:', error);
    return [];
  }
}

type Categorizador = (
  items: Array<{ description: string }>,
  categories: string[],
  context?: CategorizationContext,
) => Promise<string[]>;

/** Cuántos ejemplos few-shot van al prompt del categorizador. */
const MAX_EJEMPLOS = 15;

/**
 * Ejemplos few-shot para el prompt ("<descripción> → <CATEGORÍA>"), sacados de
 * las asignaciones manuales recientes: sin descripciones repetidas, solo de
 * categorías que el usuario todavía tiene (con su grafía) y repartidos en
 * ronda entre categorías, para que no se llenen todos con MERCADO.
 */
export function ejemplosParaPrompt(
  entradas: EntradaHistorial[],
  categorias: string[],
  max = MAX_EJEMPLOS,
): Array<{ description: string; category: string }> {
  const porNombre = new Map(categorias.map(c => [normalizarNombre(c), c]));
  const vistas = new Set<string>();
  const porCategoria = new Map<
    string,
    Array<{ description: string; category: string }>
  >();
  const recientes = [...entradas].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );
  for (const e of recientes) {
    const categoria = porNombre.get(normalizarNombre(e.categoria));
    if (!categoria || vistas.has(e.clave)) continue;
    vistas.add(e.clave);
    const arr = porCategoria.get(categoria) ?? [];
    arr.push({ description: e.descripcion, category: categoria });
    porCategoria.set(categoria, arr);
  }

  const grupos = [...porCategoria.values()];
  const out: Array<{ description: string; category: string }> = [];
  for (let ronda = 0; out.length < max; ronda++) {
    let agrego = false;
    for (const g of grupos) {
      if (ronda < g.length && out.length < max) {
        out.push(g[ronda]);
        agrego = true;
      }
    }
    if (!agrego) break;
  }
  return out;
}

/**
 * Categoriza ítems reutilizando primero el historial del usuario; solo lo que
 * no está en el historial va al LLM, con el proveedor y ejemplos few-shot del
 * mismo historial. La categoría del historial se devuelve con la grafía de la
 * lista del usuario y solo si todavía existe.
 */
export async function categorizarConHistorial(
  items: Array<{ description: string }>,
  categorias: string[],
  entradas: EntradaHistorial[],
  opts: { supplier?: string | null } = {},
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
      {
        supplier: opts.supplier ?? null,
        examples: ejemplosParaPrompt(entradas, categorias),
      },
    );
    pendientes.forEach(({ i }, k) => {
      resultado[i] = cats[k] ?? 'OTROS';
    });
  }
  return resultado as string[];
}
