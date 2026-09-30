/**
 * Elección pura de catálogos (clasificación, control, estado) para rubros
 * nuevos. Sin Supabase: se testea sola. El lector contra la base vive en
 * item-defaults-supabase.ts.
 */

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';

export interface CatalogRow {
  id: string;
  name: string;
}

export interface CatalogPick {
  id: string;
  name: string;
  /** true si el nombre preferido no existía y se tomó la primera fila. */
  usedFallback: boolean;
}

export interface ItemDefaultNames {
  classification: string;
  control: string;
}

/** Nombre de la categoría cuyos rubros usan los valores de deuda. */
const DEUDAS_CATEGORY_NAME = 'DEUDAS';

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Devuelve la fila cuyo nombre es `preferredName` (exacto primero; si no,
 * ignorando mayúsculas, tildes y espacios de borde). Si no existe, la primera
 * fila con `usedFallback: true`. Las filas deben venir ya filtradas a activas
 * y ordenadas por nombre: "la primera" es la primera activa por nombre.
 * Catálogo vacío → null.
 */
export function pickCatalogId(
  rows: readonly CatalogRow[],
  preferredName: string,
): CatalogPick | null {
  if (rows.length === 0) return null;

  const wanted = normalizeName(preferredName);
  const match =
    rows.find(row => row.name === preferredName) ??
    rows.find(row => normalizeName(row.name) === wanted);

  if (match) return { id: match.id, name: match.name, usedFallback: false };

  const first = rows[0];
  return { id: first.id, name: first.name, usedFallback: true };
}

/**
 * Nombres de clasificación y control para un rubro nuevo de la categoría
 * indicada: DEUDAS usa DEUDA_ITEM_*, cualquier otra (o ninguna) DEFAULT_ITEM_*.
 */
export function itemDefaultNamesFor(
  categoryName?: string | null,
): ItemDefaultNames {
  const isDeudas =
    !!categoryName &&
    normalizeName(categoryName) === normalizeName(DEUDAS_CATEGORY_NAME);

  return isDeudas
    ? {
        classification: DEUDA_ITEM_CLASSIFICATION,
        control: DEUDA_ITEM_CONTROL,
      }
    : {
        classification: DEFAULT_ITEM_CLASSIFICATION,
        control: DEFAULT_ITEM_CONTROL,
      };
}
