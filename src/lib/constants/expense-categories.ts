// Constantes puras (sin side-effects) compartidas por cliente y servidor.
// Se extraen aquí para que módulos de servidor (p. ej. routes) puedan importarlas
// sin arrastrar el cliente de Supabase que se crea a nivel de módulo en
// `@/lib/services/expenses`.

// Categorías predefinidas para gastos
export const EXPENSE_CATEGORIES = [
  'VIVIENDA',
  'DEUDAS',
  'TRANSPORTE',
  'MERCADO',
  'OTROS',
] as const;

// Cuenta por defecto de un gasto. Si el usuario no tiene una cuenta con este
// nombre, la RPC que guarda el gasto la crea.
export const DEFAULT_ACCOUNT_NAME = 'Efectivo';

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
