/**
 * Resuelve los ids de clasificación, control y estado de un rubro nuevo
 * contra Supabase. La elección (por nombre, con respaldo al primero activo)
 * es pura y vive en catalog-defaults.ts.
 */

import { DEFAULT_ITEM_STATUS } from '@/lib/constants/budget-defaults';
import type { Database } from '@/types/database';

import {
  pickCatalogId,
  type CatalogPick,
  type CatalogRow,
  type ItemDefaultNames,
} from './catalog-defaults';

import type { SupabaseClient } from '@supabase/supabase-js';

type DBClient = SupabaseClient<Database>;

export interface BudgetItemDefaultIds {
  classificationId: string;
  controlId: string;
  statusId: string;
}

export type ResolveDefaultsResult =
  | { ok: true; ids: BudgetItemDefaultIds }
  | { ok: false };

function pickWithWarning(
  rows: readonly CatalogRow[],
  preferredName: string,
  label: string,
): CatalogPick | null {
  const pick = pickCatalogId(rows, preferredName);
  if (pick?.usedFallback) {
    console.warn(
      `[budget-defaults] No existe ${label} "${preferredName}"; se usa "${pick.name}".`,
    );
  }
  return pick;
}

export async function resolveBudgetItemDefaults(
  supabase: DBClient,
  names: ItemDefaultNames,
): Promise<ResolveDefaultsResult> {
  const [classificationResult, controlResult, statusResult] = await Promise.all(
    [
      supabase
        .from('classifications')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('controls')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('budget_statuses')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ],
  );

  if (classificationResult.error || controlResult.error || statusResult.error) {
    console.error('Error obteniendo catálogos del rubro:', {
      classifications: classificationResult.error,
      controls: controlResult.error,
      statuses: statusResult.error,
    });
    return { ok: false };
  }

  const classification = pickWithWarning(
    classificationResult.data ?? [],
    names.classification,
    'la clasificación',
  );
  const control = pickWithWarning(
    controlResult.data ?? [],
    names.control,
    'el control',
  );
  const status = pickWithWarning(
    statusResult.data ?? [],
    DEFAULT_ITEM_STATUS,
    'el estado',
  );

  if (!classification || !control || !status) {
    console.error('Catálogo activo vacío para el rubro:', {
      classifications: !!classification,
      controls: !!control,
      statuses: !!status,
    });
    return { ok: false };
  }

  return {
    ok: true,
    ids: {
      classificationId: classification.id,
      controlId: control.id,
      statusId: status.id,
    },
  };
}
