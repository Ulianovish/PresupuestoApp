import { z } from 'zod';

// ============================================
// CONSTANTES DE VALIDACIÓN
// ============================================

// IDs de clasificaciones (deben coincidir con la base de datos)
export const CLASSIFICATION_IDS = {
  FIJO: 'fijo',
  VARIABLE: 'variable',
  DISCRECIONAL: 'discrecional'
} as const;

// IDs de controles (deben coincidir con la base de datos)
export const CONTROL_IDS = {
  NECESARIO: 'necesario',
  DISCRECIONAL: 'discrecional'
} as const;

// IDs de tipos de transacción (deben coincidir con la base de datos)
export const TRANSACTION_TYPE_IDS = {
  INGRESO: 'ingreso',
  GASTO: 'gasto',
  TRANSFERENCIA: 'transferencia'
} as const;

// IDs de estados de presupuesto (deben coincidir con la base de datos)
export const BUDGET_STATUS_IDS = {
  ACTIVO: 'activo',
  INACTIVO: 'inactivo',
  COMPLETADO: 'completado',
  CANCELADO: 'cancelado'
} as const;

// ============================================
// ESQUEMAS BASE
// ============================================

// Esquema para UUID
export const UUIDSchema = z.string().uuid({ message: 'Debe ser un UUID válido' });

// Esquema para montos monetarios
export const MoneySchema = z.number()
  .nonnegative({ message: 'El monto debe ser positivo' })
  .finite({ message: 'El monto debe ser un número válido' })
  .refine((val) => val <= 999999999.99, {
    message: 'El monto no puede exceder $999,999,999.99'
  });

// Esquema para fechas
export const DateSchema = z.string().refine((date) => {
  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
}, { message: 'Debe ser una fecha válida' });

// Esquema para colores hexadecimales
export const ColorSchema = z.string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'Debe ser un color hexadecimal válido (#RRGGBB o #RGB)'
  });

// ============================================
// ESQUEMAS DE LOOKUP TABLES
// ============================================

// Esquema para estados de presupuesto
export const BudgetStatusSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable(),
  color: ColorSchema.nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// Esquema para clasificaciones
export const ClassificationSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable(),
  color: ColorSchema.nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// Esquema para controles
export const ControlSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable(),
  color: ColorSchema.nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// Esquema para tipos de transacción
export const TransactionTypeSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable(),
  color: ColorSchema.nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// Esquema para monedas
export const CurrencySchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  code: z.string().length(3, 'El código debe tener 3 caracteres').toUpperCase(),
  symbol: z.string().min(1, 'El símbolo es requerido').max(10, 'Máximo 10 caracteres'),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// Esquema para categorías
export const CategorySchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').nullable(),
  color: ColorSchema.nullable(),
  icon: z.string().max(50, 'Máximo 50 caracteres').nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime()
});

// ============================================
// ESQUEMAS PRINCIPALES
// ============================================

// Esquema para perfil de usuario
export const ProfileSchema = z.object({
  id: UUIDSchema,
  email: z.string().email('Debe ser un email válido').max(255, 'Máximo 255 caracteres'),
  full_name: z.string().max(255, 'Máximo 255 caracteres').nullable(),
  avatar_url: z.string().url('Debe ser una URL válida').max(500, 'Máximo 500 caracteres').nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Esquema para plantillas de presupuesto
export const BudgetTemplateSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(255, 'Máximo 255 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').nullable(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Esquema para elementos de presupuesto
export const BudgetItemSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  template_id: UUIDSchema.nullable(),
  category_id: UUIDSchema,
  classification_id: UUIDSchema,
  control_id: UUIDSchema,
  status_id: UUIDSchema,
  name: z.string().min(1, 'El nombre es requerido').max(255, 'Máximo 255 caracteres'),
  description: z.string().max(1000, 'Máximo 1000 caracteres').nullable(),
  budgeted_amount: MoneySchema,
  spent_amount: MoneySchema.default(0),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// Esquema para transacciones
export const TransactionSchema = z.object({
  id: UUIDSchema,
  user_id: UUIDSchema,
  budget_item_id: UUIDSchema,
  type_id: UUIDSchema,
  amount: MoneySchema,
  description: z.string().max(1000, 'Máximo 1000 caracteres').nullable(),
  transaction_date: DateSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

// ============================================
// ESQUEMAS DE AUTENTICACIÓN
// ============================================

// Esquema para login
export const loginSchema = z.object({
  email: z.string()
    .min(1, 'El email es requerido')
    .email('Debe ser un email válido')
    .max(255, 'Máximo 255 caracteres'),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'Máximo 128 caracteres')
});

// Esquema para registro
export const registerSchema = z.object({
  email: z.string()
    .min(1, 'El email es requerido')
    .email('Debe ser un email válido')
    .max(255, 'Máximo 255 caracteres'),
  password: z.string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(128, 'Máximo 128 caracteres'),
  confirmPassword: z.string()
    .min(6, 'Confirma tu contraseña')
    .max(128, 'Máximo 128 caracteres'),
  fullName: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(255, 'Máximo 255 caracteres')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword']
});

// ============================================
// ESQUEMAS PARA FORMULARIOS (INSERT/UPDATE)
// ============================================

// Esquema para crear perfil
export const CreateProfileSchema = ProfileSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
}).extend({
  id: UUIDSchema // ID viene del auth de Supabase
});

// Esquema para actualizar perfil
export const UpdateProfileSchema = ProfileSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
}).partial();

// Esquema para crear plantilla de presupuesto
export const CreateBudgetTemplateSchema = BudgetTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
});

// Esquema para actualizar plantilla de presupuesto
export const UpdateBudgetTemplateSchema = BudgetTemplateSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true
}).partial();

// Esquema para crear elemento de presupuesto
export const CreateBudgetItemSchema = BudgetItemSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
}).extend({
  // Validaciones personalizadas
  budgeted_amount: MoneySchema.refine((val) => val > 0, {
    message: 'El monto presupuestado debe ser mayor a cero'
  })
});

// Esquema para actualizar elemento de presupuesto
export const UpdateBudgetItemSchema = BudgetItemSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true
}).partial().extend({
  // Validar que el monto gastado no supere el presupuestado
  spent_amount: MoneySchema.optional()
}).refine((data) => {
  if (data.spent_amount && data.budgeted_amount) {
    return data.spent_amount <= data.budgeted_amount;
  }
  return true;
}, {
  message: 'El monto gastado no puede superar el presupuestado',
  path: ['spent_amount']
});

// Esquema para crear transacción
export const CreateTransactionSchema = TransactionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true
}).extend({
  // Validaciones personalizadas
  amount: MoneySchema.refine((val) => val > 0, {
    message: 'El monto debe ser mayor a cero'
  })
});

// Esquema para actualizar transacción
export const UpdateTransactionSchema = TransactionSchema.omit({
  id: true,
  user_id: true,
  created_at: true,
  updated_at: true
}).partial();

// ============================================
// ESQUEMAS PARA RESPUESTAS CON RELACIONES
// ============================================

// Esquema para elemento de presupuesto con relaciones
export const BudgetItemWithRelationsSchema = BudgetItemSchema.extend({
  category: CategorySchema,
  classification: ClassificationSchema,
  control: ControlSchema,
  status: BudgetStatusSchema,
  template: BudgetTemplateSchema.nullable(),
  transactions: z.array(TransactionSchema).default([])
});

// Esquema para transacción con relaciones
export const TransactionWithRelationsSchema = TransactionSchema.extend({
  budget_item: BudgetItemSchema,
  type: TransactionTypeSchema
});

// ============================================
// ESQUEMAS PARA CONSULTAS Y FILTROS
// ============================================

// Esquema para filtros de elementos de presupuesto
export const BudgetItemFiltersSchema = z.object({
  category_id: UUIDSchema.optional(),
  classification_id: UUIDSchema.optional(),
  control_id: UUIDSchema.optional(),
  status_id: UUIDSchema.optional(),
  template_id: UUIDSchema.optional(),
  is_active: z.boolean().optional(),
  min_amount: MoneySchema.optional(),
  max_amount: MoneySchema.optional(),
  search: z.string().max(255).optional()
});

// Esquema para filtros de transacciones
export const TransactionFiltersSchema = z.object({
  budget_item_id: UUIDSchema.optional(),
  type_id: UUIDSchema.optional(),
  min_amount: MoneySchema.optional(),
  max_amount: MoneySchema.optional(),
  start_date: DateSchema.optional(),
  end_date: DateSchema.optional(),
  search: z.string().max(255).optional()
});

// Esquema para paginación
export const PaginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(10),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc')
});

// ============================================
// ESQUEMAS PARA RESÚMENES Y ESTADÍSTICAS
// ============================================

// Esquema para resumen de presupuesto
export const BudgetSummarySchema = z.object({
  total_budgeted: MoneySchema,
  total_spent: MoneySchema,
  total_remaining: MoneySchema,
  percentage_spent: z.number().min(0).max(100),
  by_category: z.array(z.object({
    category_id: UUIDSchema,
    category_name: z.string(),
    budgeted: MoneySchema,
    spent: MoneySchema,
    remaining: MoneySchema
  })),
  by_classification: z.array(z.object({
    classification_id: UUIDSchema,
    classification_name: z.string(),
    budgeted: MoneySchema,
    spent: MoneySchema,
    remaining: MoneySchema
  })),
  by_control: z.array(z.object({
    control_id: UUIDSchema,
    control_name: z.string(),
    budgeted: MoneySchema,
    spent: MoneySchema,
    remaining: MoneySchema
  }))
});

// ============================================
// TIPOS TYPESCRIPT DERIVADOS
// ============================================

// Tipos para las tablas de lookup
export type BudgetStatus = z.infer<typeof BudgetStatusSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type Control = z.infer<typeof ControlSchema>;
export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Category = z.infer<typeof CategorySchema>;

// Tipos para las tablas principales
export type Profile = z.infer<typeof ProfileSchema>;
export type BudgetTemplate = z.infer<typeof BudgetTemplateSchema>;
export type BudgetItem = z.infer<typeof BudgetItemSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;

// Tipos para formularios
export type CreateProfile = z.infer<typeof CreateProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;
export type CreateBudgetTemplate = z.infer<typeof CreateBudgetTemplateSchema>;
export type UpdateBudgetTemplate = z.infer<typeof UpdateBudgetTemplateSchema>;
export type CreateBudgetItem = z.infer<typeof CreateBudgetItemSchema>;
export type UpdateBudgetItem = z.infer<typeof UpdateBudgetItemSchema>;
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type UpdateTransaction = z.infer<typeof UpdateTransactionSchema>;

// Tipos para respuestas con relaciones
export type BudgetItemWithRelations = z.infer<typeof BudgetItemWithRelationsSchema>;
export type TransactionWithRelations = z.infer<typeof TransactionWithRelationsSchema>;

// Tipos para filtros y consultas
export type BudgetItemFilters = z.infer<typeof BudgetItemFiltersSchema>;
export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;

// Tipos para resúmenes
export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;

// Tipos para autenticación
export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>; 