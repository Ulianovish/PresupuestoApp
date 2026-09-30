/**
 * Estado vacío de /presupuesto (S10).
 *
 * `useMonthlyBudget` devuelve TODAS las categorías activas del usuario, tengan
 * o no rubros en el mes (ver getBudgetByMonth en src/lib/services/budget.ts).
 * Por eso "0 categorías" no es "no hay presupuesto este mes": es un usuario
 * que aún no tiene ninguna categoría y necesita crearla o cargar el kit.
 */

export type BudgetPanelState =
  | 'error'
  | 'loading'
  | 'sin-categorias'
  | 'con-datos';

export function getBudgetPanelState(input: {
  isLoading: boolean;
  error: string | null;
  categoryCount: number;
}): BudgetPanelState {
  if (input.error) return 'error';
  if (input.isLoading) return 'loading';
  if (input.categoryCount === 0) return 'sin-categorias';
  return 'con-datos';
}

export const STARTER_KIT_ERROR_MESSAGE =
  'No pudimos cargar las categorías sugeridas. Crea una categoría a mano.';

/** Lo que devuelve ensureStarterKitAction (contratos §5.2). */
export type StarterKitResult = { seeded: boolean; error?: string };

export type StarterKitToast = { message: string; type: 'success' | 'error' };

/**
 * Aviso tras llamar ensureStarterKitAction, que nunca lanza: los fallos llegan
 * en `result.error` ('no_session', el código de la RPC o 'unexpected').
 * - La RPC siembra el mes actual de Bogotá, no el que se está viendo.
 * - `seeded: false` sin error significa que el usuario ya tiene alguna
 *   categoría activa (§5.1): quien borró todas sí puede recargar el kit.
 */
export function starterKitToast(
  result: StarterKitResult,
  viewedMonth: string,
  currentMonth: string,
): StarterKitToast {
  if (result.error) {
    return { message: STARTER_KIT_ERROR_MESSAGE, type: 'error' };
  }
  if (!result.seeded) {
    return {
      message:
        'Ya tienes categorías, así que no cargamos las sugeridas. Te las mostramos ahora.',
      type: 'success',
    };
  }
  if (viewedMonth !== currentMonth) {
    return {
      message:
        'Listo: cargamos las categorías sugeridas. Sus rubros quedaron en el presupuesto del mes actual.',
      type: 'success',
    };
  }
  return {
    message:
      'Listo: cargamos las categorías sugeridas. Ajusta el monto de cada rubro cuando quieras.',
    type: 'success',
  };
}
