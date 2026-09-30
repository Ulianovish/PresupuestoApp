/**
 * Manejadores de los pasos del wizard de /bienvenida (S11), con las
 * dependencias inyectadas para probar cada rama sin React: el componente
 * OnboardingWizard solo conecta el estado y los toasts.
 */

import { unstable_rethrow } from 'next/navigation';

import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';
import type { ExpenseFormData } from '@/lib/services/expenses';
import { todayBogota } from '@/lib/whatsapp/format';

import { inRule503020, suggest503020, type KitItem } from './budget-503020';

export type WizardNotify = (message: string, type: 'success' | 'error') => void;

type ResultadoAccion = { ok: boolean; error?: string };

export const FINISH_ERROR_MESSAGE =
  'No pudimos terminar la bienvenida. Intenta de nuevo.';
const INCOME_ERROR_MESSAGE = 'No pudimos guardar tu ingreso. Intenta de nuevo.';
const BUDGET_ERROR_MESSAGE =
  'No pudimos guardar tu presupuesto. Intenta de nuevo.';
const EXPENSE_ERROR_MESSAGE = 'No pudimos guardar el gasto. Intenta de nuevo.';
const EXPENSE_SAVED_MESSAGE = '¡Listo! Guardamos tu primer gasto.';

/**
 * Terminar la bienvenida. `completeOnboardingAction` redirige desde el
 * servidor: en el cliente eso llega como un rechazo NEXT_REDIRECT que Next
 * solo convierte en navegación si nadie lo atrapa. Por eso los errores de
 * Next se relanzan (`unstable_rethrow`) y solo los demás (red, servidor)
 * muestran el toast. Devuelve false si falló y se puede reintentar.
 */
export async function finishOnboarding(deps: {
  complete: () => Promise<void>;
  notify: WizardNotify;
}): Promise<boolean> {
  try {
    await deps.complete();
    return true;
  } catch (e) {
    unstable_rethrow(e);
    deps.notify(FINISH_ERROR_MESSAGE, 'error');
    return false;
  }
}

export type IngresoGuardado = { monto: number; fuente: string };

/** true si el ingreso ya guardado coincide con lo que hay en el formulario. */
export function ingresoSinCambios(
  guardado: IngresoGuardado | null,
  monto: number,
  fuente: string,
): boolean {
  return (
    guardado !== null &&
    guardado.monto === monto &&
    guardado.fuente === fuente.trim()
  );
}

/**
 * Paso 1. Si el ingreso ya se guardó con los mismos valores (la persona
 * volvió con «Atrás») no llama la acción. Si cambió, la llama de nuevo: la
 * acción actualiza el 'Ingreso mensual' de hoy en vez de insertar otro.
 * Devuelve lo guardado, o null si falló (ya avisó).
 */
export async function saveIncomeStep(deps: {
  monto: number;
  fuente: string;
  guardado: IngresoGuardado | null;
  save: (input: IngresoGuardado) => Promise<ResultadoAccion>;
  notify: WizardNotify;
}): Promise<IngresoGuardado | null> {
  if (ingresoSinCambios(deps.guardado, deps.monto, deps.fuente)) {
    return deps.guardado;
  }
  const input = { monto: deps.monto, fuente: deps.fuente.trim() };
  try {
    const r = await deps.save(input);
    if (!r.ok) {
      deps.notify(r.error ?? INCOME_ERROR_MESSAGE, 'error');
      return null;
    }
    return input;
  } catch {
    deps.notify(INCOME_ERROR_MESSAGE, 'error');
    return null;
  }
}

/**
 * Rubros cuyo monto en `montos` difiere de `cargados` (lo que se cargó o se
 * guardó por última vez). Un rubro que no estaba en `cargados` cuenta como
 * cambiado.
 */
export function montosCambiados(
  cargados: Record<string, number>,
  montos: Record<string, number>,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(montos).filter(([id, monto]) => cargados[id] !== monto),
  );
}

/**
 * Paso 2: guarda solo los montos que cambiaron respecto a `cargados`, para no
 * pisar montos editados en otra pestaña ni los decimales de los rubros que
 * llegaron redondeados y no se tocaron. Sin cambios no llama la acción.
 * Devuelve false si falló (ya avisó).
 */
export async function saveBudgetStep(deps: {
  montos: Record<string, number>;
  cargados: Record<string, number>;
  save: (montos: Record<string, number>) => Promise<ResultadoAccion>;
  notify: WizardNotify;
}): Promise<boolean> {
  const cambios = montosCambiados(deps.cargados, deps.montos);
  if (Object.keys(cambios).length === 0) return true;
  try {
    const r = await deps.save(cambios);
    if (!r.ok) {
      deps.notify(r.error ?? BUDGET_ERROR_MESSAGE, 'error');
      return false;
    }
    return true;
  } catch {
    deps.notify(BUDGET_ERROR_MESSAGE, 'error');
    return false;
  }
}

/**
 * «Sugerir con 50/30/20»: pone el monto sugerido en los rubros de la regla y
 * conserva lo que ya tenían los de 'Impuestos' o clasificaciones desconocidas
 * (suggest503020 los devuelve en 0).
 */
export function applySuggestion(
  prev: Record<string, number>,
  ingreso: number,
  items: KitItem[],
): { montos: Record<string, number>; ahorroSinAsignar: number } {
  const sugerencia = suggest503020(ingreso, items);
  const montos = { ...prev };
  for (const item of items) {
    if (inRule503020(item.classificationName)) {
      montos[item.id] = sugerencia.amounts[item.id] ?? 0;
    }
  }
  return { montos, ahorroSinAsignar: sugerencia.ahorroSinAsignar };
}

/** Gasto del paso 3: cuenta por defecto (§2.6) y fecha de hoy en Bogotá. */
export function buildFirstExpense(input: {
  monto: number;
  descripcion: string;
  categoria: string;
}): ExpenseFormData {
  return {
    description: input.descripcion.trim(),
    amount: input.monto,
    transaction_date: todayBogota(),
    category_name: input.categoria,
    account_name: DEFAULT_ACCOUNT_NAME,
  };
}

/**
 * Paso 3 con gasto: lo crea, lo marca como guardado (`onSaved`) y termina.
 * Si ya estaba guardado (terminar falló antes) no lo vuelve a crear: solo
 * reintenta terminar. Lo que lance `finish` (el NEXT_REDIRECT) se propaga.
 */
export async function saveExpenseAndFinish(deps: {
  gastoGuardado: boolean;
  expense: ExpenseFormData;
  create: (expense: ExpenseFormData) => Promise<unknown>;
  onSaved: () => void;
  finish: () => Promise<unknown>;
  notify: WizardNotify;
}): Promise<void> {
  if (!deps.gastoGuardado) {
    try {
      await deps.create(deps.expense);
    } catch {
      deps.notify(EXPENSE_ERROR_MESSAGE, 'error');
      return;
    }
    deps.onSaved();
    deps.notify(EXPENSE_SAVED_MESSAGE, 'success');
  }
  await deps.finish();
}
