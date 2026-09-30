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

/**
 * Tras cargar el kit se recarga el presupuesto salvo que haya habido error:
 * con `seeded: false` y sin error el usuario ya tenía categorías y el toast
 * promete mostrárselas.
 */
export function shouldReloadAfterStarterKit(result: StarterKitResult): boolean {
  return !result.error;
}

export const STARTER_KIT_RELOAD_ERROR_MESSAGE =
  'Cargamos las categorías pero no pudimos refrescar; recarga la página';

/**
 * Secuencia del botón "Cargar categorías sugeridas" de /presupuesto, con las
 * dependencias inyectadas para poder probar cada rama: llama la acción, avisa
 * con `starterKitToast` y recarga si `shouldReloadAfterStarterKit`. Nunca
 * lanza: si la acción lanza (p. ej. la red) avisa con el error del kit, y si
 * la recarga lanza pide recargar la página.
 */
export async function loadStarterKitAndNotify(deps: {
  ensureStarterKit: () => Promise<StarterKitResult>;
  reload: () => Promise<void>;
  notify: (message: string, type: StarterKitToast['type']) => void;
  viewedMonth: string;
  currentMonth: string;
}): Promise<void> {
  let result: StarterKitResult;
  try {
    result = await deps.ensureStarterKit();
  } catch {
    deps.notify(STARTER_KIT_ERROR_MESSAGE, 'error');
    return;
  }

  const aviso = starterKitToast(result, deps.viewedMonth, deps.currentMonth);
  deps.notify(aviso.message, aviso.type);

  if (!shouldReloadAfterStarterKit(result)) return;
  try {
    await deps.reload();
  } catch {
    deps.notify(STARTER_KIT_RELOAD_ERROR_MESSAGE, 'error');
  }
}
