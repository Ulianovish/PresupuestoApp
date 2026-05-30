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

// Tipos de cuenta predefinidos
export const ACCOUNT_TYPES = [
  'Nequi',
  'TC Falabella',
  'Efectivo',
  'Banco Santander',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type AccountType = (typeof ACCOUNT_TYPES)[number];
