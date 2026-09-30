/**
 * Valores por defecto del formulario de gastos (/gastos), calculados a partir
 * de las categorías y cuentas activas del usuario. Puro: sin Supabase ni
 * React, para poder probarlo sin DOM.
 */
import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';

/** Texto del botón de guardar cuando el usuario no tiene categorías. */
export const NO_CATEGORIES_LABEL = 'Primero crea una categoría';

/**
 * Cuenta por defecto: la del usuario llamada como `DEFAULT_ACCOUNT_NAME`
 * (sin distinguir mayúsculas, devolviendo su nombre tal cual), si no la
 * primera cuenta; sin cuentas, `DEFAULT_ACCOUNT_NAME`.
 */
export function pickDefaultAccount(accountNames: readonly string[]): string {
  const objetivo = DEFAULT_ACCOUNT_NAME.toLowerCase();
  const efectivo = accountNames.find(n => n.trim().toLowerCase() === objetivo);
  return efectivo ?? accountNames[0] ?? DEFAULT_ACCOUNT_NAME;
}

/** Categoría por defecto: la primera del usuario, o '' si no tiene. */
export function pickDefaultCategory(categoryNames: readonly string[]): string {
  return categoryNames[0] ?? '';
}

/**
 * Opciones del selector de cuenta: solo las cuentas del usuario (o
 * `DEFAULT_ACCOUNT_NAME` si no tiene), más `current` si no está entre ellas
 * (p. ej. al editar un gasto cuya cuenta ya se desactivó).
 */
export function buildAccountOptions(
  accountNames: readonly string[],
  current = '',
): string[] {
  const opciones =
    accountNames.length > 0 ? [...accountNames] : [DEFAULT_ACCOUNT_NAME];
  if (current && !opciones.includes(current)) opciones.push(current);
  return opciones;
}

export interface ExpenseFormDefaultsInput {
  categoryNames: readonly string[];
  accountNames: readonly string[];
}

/**
 * Completa `category_name` y `account_name` cuando están vacíos o no
 * pertenecen al usuario. Si no hay nada que cambiar devuelve el mismo
 * objeto, para que `setForm(prev => withFormDefaults(prev, …))` no provoque
 * un re-render.
 */
export function withFormDefaults<
  T extends { category_name: string; account_name: string },
>(form: T, { categoryNames, accountNames }: ExpenseFormDefaultsInput): T {
  const category_name = categoryNames.includes(form.category_name)
    ? form.category_name
    : pickDefaultCategory(categoryNames);
  const account_name = buildAccountOptions(accountNames).includes(
    form.account_name,
  )
    ? form.account_name
    : pickDefaultAccount(accountNames);

  if (
    category_name === form.category_name &&
    account_name === form.account_name
  ) {
    return form;
  }
  return { ...form, category_name, account_name };
}
