// Datos que necesita el wizard de /bienvenida: los rubros del mes (con su
// categoría y clasificación, para el paso 2 y la sugerencia 50/30/20) y los
// nombres de las categorías del usuario (para el gasto del paso 3).

import type { Database } from '@/types/database';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WizardItem {
  id: string;
  name: string;
  categoryName: string;
  classificationName: string;
  budgetedAmount: number;
}

export interface WizardData {
  items: WizardItem[];
  categoryNames: string[];
}

/** Columnas de get_budget_by_month que usa el wizard. */
interface FilaPresupuesto {
  item_id: string | null;
  item_name: string | null;
  category_name: string | null;
  classification_name: string | null;
  budgeted_amount: string | number | null;
}

/**
 * Rubros del mes `monthYear` ('YYYY-MM') y categorías activas del usuario.
 * Nunca lanza: si una consulta falla, esa parte vuelve vacía (el wizard sigue
 * funcionando y el usuario puede saltar el paso).
 */
export async function loadWizardData(
  supabase: SupabaseClient<Database>,
  userId: string,
  monthYear: string,
): Promise<WizardData> {
  const [presupuesto, categorias] = await Promise.all([
    supabase.rpc('get_budget_by_month', {
      p_user_id: userId,
      p_month_year: monthYear,
    }),
    supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name'),
  ]);

  let items: WizardItem[] = [];
  if (presupuesto.error) {
    console.error(
      'loadWizardData: error leyendo el presupuesto:',
      presupuesto.error.code,
    );
  } else {
    const filas = (presupuesto.data ?? []) as FilaPresupuesto[];
    items = filas
      .filter(f => Boolean(f.item_id))
      .map(f => ({
        id: f.item_id as string,
        name: f.item_name ?? '',
        categoryName: f.category_name ?? '',
        classificationName: f.classification_name ?? '',
        budgetedAmount: Number(f.budgeted_amount) || 0,
      }));
  }

  let categoryNames: string[] = [];
  if (categorias.error) {
    console.error(
      'loadWizardData: error leyendo categorías:',
      categorias.error.code,
    );
  } else {
    categoryNames = ((categorias.data ?? []) as Array<{ name: string }>).map(
      c => c.name,
    );
  }

  return { items, categoryNames };
}
