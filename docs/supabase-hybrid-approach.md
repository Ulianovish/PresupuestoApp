# Enfoque Híbrido para Supabase Backend - Monorepo

## 🎯 Estrategia General

Implementaremos un **enfoque híbrido** que combina lo mejor de ambos mundos:
- **RLS (Row Level Security)** para operaciones de lectura optimizadas
- **Server Actions** para operaciones de escritura y lógica compleja
- **Monorepo** para mantener todo integrado y simplificar el desarrollo

## 🏗️ Arquitectura del Enfoque Híbrido

### Principios Fundamentales

1. **Lecturas Client-Side**: Utilizamos RLS para consultas optimizadas y real-time
2. **Escrituras Server-Side**: Server Actions para validación y lógica de negocio
3. **Seguridad Multicapa**: Combinamos RLS + validación server-side
4. **Performance Optimizada**: Caché inteligente y queries eficientes
5. **Monorepo Integrado**: Todo en un solo repositorio para desarrollo ágil

### Flujo de Datos

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client UI     │    │  Server Actions │    │   Supabase DB   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Reads     │◄┼────┼─┤    RLS      │◄┼────┤ │  Policies   │ │
│ │  (SWR/React)│ │    │ │  (Client)   │ │    │ │ (anon key)  │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Writes    │─┼────┼─┤  Validation │─┼────┤ │Service Role │ │
│ │(Server Acts)│ │    │ │    +Zod     │ │    │ │(full access)│ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Estructura del Monorepo

### Nueva Estructura Propuesta

```
Presupuesto/
├── src/
│   ├── app/                    # Next.js App Router (existente)
│   │   ├── dashboard/
│   │   ├── presupuesto/
│   │   └── globals.css
│   ├── components/             # Atomic Design (existente)
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   └── templates/
│   ├── lib/                    # Utilidades
│   │   ├── supabase/          # 🆕 Configuración Supabase
│   │   │   ├── client.ts      # Cliente para componentes
│   │   │   ├── server.ts      # Cliente para Server Actions
│   │   │   ├── middleware.ts  # Middleware para auth
│   │   │   └── types.ts       # Tipos generados
│   │   ├── actions/           # 🆕 Server Actions
│   │   │   ├── budget-actions.ts
│   │   │   ├── category-actions.ts
│   │   │   └── auth-actions.ts
│   │   ├── validations/       # 🆕 Esquemas Zod
│   │   │   ├── budget.ts
│   │   │   ├── category.ts
│   │   │   └── user.ts
│   │   └── utils.ts           # Utilidades existentes
│   ├── hooks/                 # Custom hooks
│   │   ├── useBudgetData.ts   # 🆕 SWR para budget
│   │   ├── useRealtimeBudget.ts # 🆕 Real-time updates
│   │   └── useLocalStorage.ts # Existente
│   └── types/                 # Tipos TypeScript
│       ├── supabase.ts        # 🆕 Tipos DB generados
│       └── budget.ts          # Tipos de negocio
├── docs/                      # 🆕 Documentación
│   ├── supabase-hybrid-approach.md
│   ├── database-schema.md
│   └── api-reference.md
├── supabase/                  # 🆕 Configuración Supabase
│   ├── config.toml            # Configuración local
│   ├── seed.sql               # Datos iniciales
│   └── migrations/            # Migraciones DB
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       └── 003_functions.sql
├── .env.local                 # 🆕 Variables de entorno
├── .env.example               # 🆕 Ejemplo de variables
└── package.json               # Dependencias actualizadas
```

## 🔄 Patrones de Implementación

### 1. Configuración de Supabase

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerClient = () => {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
}
```

### 2. Validaciones con Zod

```typescript
// lib/validations/budget.ts
import { z } from 'zod'

// Enum values para validaciones (deben coincidir con los IDs de lookup tables)
export const CLASSIFICATION_IDS = ['fijo', 'variable', 'discrecional'] as const
export const CONTROL_IDS = ['necesario', 'discrecional'] as const
export const TRANSACTION_TYPE_IDS = ['income', 'expense', 'transfer'] as const
export const BUDGET_STATUS_IDS = ['active', 'closed', 'archived'] as const
export const CURRENCY_IDS = ['COP', 'USD', 'EUR'] as const

export const BudgetItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1, 'Descripción es requerida'),
  budgeted_amount: z.number().positive('Monto debe ser positivo'),
  actual_amount: z.number().default(0),
  classification_id: z.enum(CLASSIFICATION_IDS, {
    errorMap: () => ({ message: 'Clasificación inválida' })
  }),
  control_id: z.enum(CONTROL_IDS, {
    errorMap: () => ({ message: 'Control inválido' })
  }),
  category_id: z.string().uuid('ID de categoría inválido'),
  budget_template_id: z.string().uuid('ID de plantilla inválido'),
  due_date: z.date().optional(),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
})

export const BudgetTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Formato debe ser YYYY-MM'),
  total_income: z.number().default(0),
  total_expenses: z.number().default(0),
  status_id: z.enum(BUDGET_STATUS_IDS, {
    errorMap: () => ({ message: 'Estado inválido' })
  }).default('active'),
})

export const CategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  parent_id: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color debe ser hex válido').default('#3B82F6'),
  icon: z.string().optional(),
  order_index: z.number().default(0),
  is_active: z.boolean().default(true),
})

export const TransactionSchema = z.object({
  id: z.string().uuid().optional(),
  budget_item_id: z.string().uuid('ID de item de presupuesto inválido'),
  amount: z.number().positive('Monto debe ser positivo'),
  transaction_date: z.date(),
  description: z.string().optional(),
  receipt_url: z.string().url('URL de recibo inválida').optional(),
  transaction_type_id: z.enum(TRANSACTION_TYPE_IDS, {
    errorMap: () => ({ message: 'Tipo de transacción inválido' })
  }).default('expense'),
  metadata: z.record(z.any()).default({}),
})

export const AccountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  account_type: z.enum(['bank', 'cash', 'credit', 'investment'], {
    errorMap: () => ({ message: 'Tipo de cuenta inválido' })
  }),
  balance: z.number().default(0),
  currency_id: z.enum(CURRENCY_IDS, {
    errorMap: () => ({ message: 'Moneda inválida' })
  }).default('COP'),
  is_active: z.boolean().default(true),
})

export const DebtSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Nombre es requerido'),
  total_amount: z.number().positive('Monto total debe ser positivo'),
  remaining_amount: z.number().min(0, 'Monto restante no puede ser negativo'),
  interest_rate: z.number().min(0, 'Tasa de interés no puede ser negativa').default(0),
  minimum_payment: z.number().positive('Pago mínimo debe ser positivo'),
  due_date: z.date().optional(),
  status_id: z.enum(BUDGET_STATUS_IDS, {
    errorMap: () => ({ message: 'Estado inválido' })
  }).default('active'),
})

export const ProfileSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().min(1, 'Nombre completo es requerido'),
  avatar_url: z.string().url('URL de avatar inválida').optional(),
  currency_id: z.enum(CURRENCY_IDS, {
    errorMap: () => ({ message: 'Moneda inválida' })
  }).default('COP'),
  timezone: z.string().default('America/Bogota'),
  preferences: z.record(z.any()).default({}),
})

// Tipos inferidos
export type BudgetItemInput = z.infer<typeof BudgetItemSchema>
export type BudgetTemplateInput = z.infer<typeof BudgetTemplateSchema>
export type CategoryInput = z.infer<typeof CategorySchema>
export type TransactionInput = z.infer<typeof TransactionSchema>
export type AccountInput = z.infer<typeof AccountSchema>
export type DebtInput = z.infer<typeof DebtSchema>
export type ProfileInput = z.infer<typeof ProfileSchema>

// Tipos para lookup tables
export type ClassificationId = typeof CLASSIFICATION_IDS[number]
export type ControlId = typeof CONTROL_IDS[number]
export type TransactionTypeId = typeof TRANSACTION_TYPE_IDS[number]
export type BudgetStatusId = typeof BUDGET_STATUS_IDS[number]
export type CurrencyId = typeof CURRENCY_IDS[number]
```

### 3. Server Actions

```typescript
// lib/actions/budget-actions.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { BudgetItemSchema, BudgetItemInput } from '@/lib/validations/budget'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createBudgetItem(formData: FormData) {
  const supabase = createServerClient()
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Validar datos
  const rawData = {
    description: formData.get('description') as string,
    budgeted_amount: parseFloat(formData.get('budgeted_amount') as string),
    actual_amount: parseFloat(formData.get('actual_amount') as string) || 0,
    classification_id: formData.get('classification_id') as string,
    control_id: formData.get('control_id') as string,
    category_id: formData.get('category_id') as string,
    budget_template_id: formData.get('budget_template_id') as string,
    due_date: formData.get('due_date') ? new Date(formData.get('due_date') as string) : undefined,
    notes: formData.get('notes') as string,
    is_recurring: formData.get('is_recurring') === 'true',
  }

  const validatedData = BudgetItemSchema.parse(rawData)

  // Crear item en la base de datos
  const { data: budgetItem, error } = await supabase
    .from('budget_items')
    .insert({
      ...validatedData,
      user_id: user.id,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Error creando item: ${error.message}`)
  }

  // Revalidar página
  revalidatePath('/presupuesto')
  return { success: true, data: budgetItem }
}

export async function updateBudgetItem(id: string, formData: FormData) {
  const supabase = createServerClient()
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Validar datos
  const rawData = {
    id,
    description: formData.get('description') as string,
    budgeted_amount: parseFloat(formData.get('budgeted_amount') as string),
    actual_amount: parseFloat(formData.get('actual_amount') as string) || 0,
    classification_id: formData.get('classification_id') as string,
    control_id: formData.get('control_id') as string,
    category_id: formData.get('category_id') as string,
    budget_template_id: formData.get('budget_template_id') as string,
    due_date: formData.get('due_date') ? new Date(formData.get('due_date') as string) : undefined,
    notes: formData.get('notes') as string,
    is_recurring: formData.get('is_recurring') === 'true',
  }

  const validatedData = BudgetItemSchema.parse(rawData)

  // Actualizar item (RLS se encarga de verificar ownership)
  const { data: budgetItem, error } = await supabase
    .from('budget_items')
    .update(validatedData)
    .eq('id', id)
    .eq('user_id', user.id) // Double-check ownership
    .select()
    .single()

  if (error) {
    throw new Error(`Error actualizando item: ${error.message}`)
  }

  // Revalidar página
  revalidatePath('/presupuesto')
  return { success: true, data: budgetItem }
}

export async function deleteBudgetItem(id: string) {
  const supabase = createServerClient()
  
  // Verificar autenticación
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/login')
  }

  // Eliminar item
  const { error } = await supabase
    .from('budget_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(`Error eliminando item: ${error.message}`)
  }

  // Revalidar página
  revalidatePath('/presupuesto')
  return { success: true }
}
```

### 4. Hooks para Lecturas (Client-Side)

```typescript
// hooks/useBudgetData.ts
'use client'

import { createClient } from '@/lib/supabase/client'
import useSWR from 'swr'

export interface BudgetItem {
  id: string
  description: string
  budgeted_amount: number
  actual_amount: number
  classification_id: string
  control_id: string
  category_id: string
  due_date?: Date
  notes?: string
  is_recurring: boolean
  // Datos relacionados (joins)
  category?: {
    name: string
    color: string
    icon?: string
  }
  classification?: {
    name: string
    description: string
    color: string
  }
  control?: {
    name: string
    description: string
    color: string
  }
}

export function useBudgetData(monthYear: string) {
  const supabase = createClient()
  
  const { data, error, isLoading, mutate } = useSWR(
    ['budget-items', monthYear],
    async () => {
      const { data: budgetItems, error } = await supabase
        .from('budget_items')
        .select(`
          *,
          category:categories(
            name,
            color,
            icon
          ),
          classification:classifications(
            name,
            description,
            color
          ),
          control:controls(
            name,
            description,
            color
          ),
          budget_template:budget_templates(
            name,
            month_year,
            status:budget_statuses(
              name,
              color
            )
          )
        `)
        .eq('budget_template.month_year', monthYear)
        .order('created_at', { ascending: false })

      if (error) throw error
      return budgetItems as BudgetItem[]
    }
  )

  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Calcular resumen con datos normalizados
  const summary = data ? {
    totalBudgeted: data.reduce((sum, item) => sum + item.budgeted_amount, 0),
    totalActual: data.reduce((sum, item) => sum + item.actual_amount, 0),
    totalRemaining: data.reduce((sum, item) => sum + (item.budgeted_amount - item.actual_amount), 0),
    overBudgetCount: data.filter(item => item.actual_amount > item.budgeted_amount).length,
    // Resumen por clasificación
    byClassification: data.reduce((acc, item) => {
      const key = item.classification?.name || 'Sin clasificar'
      if (!acc[key]) {
        acc[key] = { budgeted: 0, actual: 0, count: 0, color: item.classification?.color || '#6B7280' }
      }
      acc[key].budgeted += item.budgeted_amount
      acc[key].actual += item.actual_amount
      acc[key].count++
      return acc
    }, {} as Record<string, { budgeted: number; actual: number; count: number; color: string }>),
    // Resumen por control
    byControl: data.reduce((acc, item) => {
      const key = item.control?.name || 'Sin control'
      if (!acc[key]) {
        acc[key] = { budgeted: 0, actual: 0, count: 0, color: item.control?.color || '#6B7280' }
      }
      acc[key].budgeted += item.budgeted_amount
      acc[key].actual += item.actual_amount
      acc[key].count++
      return acc
    }, {} as Record<string, { budgeted: number; actual: number; count: number; color: string }>),
  } : null

  return {
    budgetItems: data || [],
    summary,
    isLoading,
    error,
    mutate,
    formatCurrency,
  }
}

// Hook para obtener datos de lookup tables
export function useLookupData() {
  const supabase = createClient()
  
  const { data: classifications, error: classificationsError } = useSWR(
    'classifications',
    async () => {
      const { data, error } = await supabase
        .from('classifications')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data
    }
  )

  const { data: controls, error: controlsError } = useSWR(
    'controls',
    async () => {
      const { data, error } = await supabase
        .from('controls')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data
    }
  )

  const { data: budgetStatuses, error: statusesError } = useSWR(
    'budget-statuses',
    async () => {
      const { data, error } = await supabase
        .from('budget_statuses')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data
    }
  )

  const { data: transactionTypes, error: typesError } = useSWR(
    'transaction-types',
    async () => {
      const { data, error } = await supabase
        .from('transaction_types')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data
    }
  )

  const { data: currencies, error: currenciesError } = useSWR(
    'currencies',
    async () => {
      const { data, error } = await supabase
        .from('currencies')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true })
      
      if (error) throw error
      return data
    }
  )

  return {
    classifications: classifications || [],
    controls: controls || [],
    budgetStatuses: budgetStatuses || [],
    transactionTypes: transactionTypes || [],
    currencies: currencies || [],
    isLoading: !classifications || !controls || !budgetStatuses || !transactionTypes || !currencies,
    error: classificationsError || controlsError || statusesError || typesError || currenciesError,
  }
}
```

### 5. Real-time Updates

```typescript
// hooks/useRealtimeBudget.ts
'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { BudgetItem } from './useBudgetData'

export function useRealtimeBudget(monthYear: string, initialData: BudgetItem[] = []) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialData)
  const supabase = createClient()

  useEffect(() => {
    // Configurar canal de real-time
    const channel = supabase
      .channel('budget-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'budget_items',
          filter: `month_year=eq.${monthYear}`
        }, 
        (payload) => {
          setBudgetItems(current => [...current, payload.new as BudgetItem])
        }
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'budget_items',
          filter: `month_year=eq.${monthYear}`
        }, 
        (payload) => {
          setBudgetItems(current => 
            current.map(item => 
              item.id === payload.new.id ? payload.new as BudgetItem : item
            )
          )
        }
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'budget_items',
          filter: `month_year=eq.${monthYear}`
        }, 
        (payload) => {
          setBudgetItems(current => 
            current.filter(item => item.id !== payload.old.id)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [monthYear, supabase])

  return budgetItems
}
```

### 6. Componentes de Formulario con Lookup Tables

```typescript
// components/molecules/BudgetItemForm.tsx
'use client'

import { useLookupData } from '@/hooks/useBudgetData'
import { createBudgetItem } from '@/lib/actions/budget-actions'
import { BudgetItemSchema } from '@/lib/validations/budget'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

interface BudgetItemFormProps {
  budgetTemplateId: string
  onSuccess?: () => void
}

export default function BudgetItemForm({ budgetTemplateId, onSuccess }: BudgetItemFormProps) {
  const { classifications, controls, isLoading: lookupsLoading } = useLookupData()
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm<BudgetItemInput>({
    resolver: zodResolver(BudgetItemSchema),
    defaultValues: {
      budget_template_id: budgetTemplateId,
      classification_id: 'fijo',
      control_id: 'necesario',
      is_recurring: false,
    }
  })

  const onSubmit = async (data: BudgetItemInput) => {
    try {
      const formData = new FormData()
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value.toString())
        }
      })

      await createBudgetItem(formData)
      reset()
      onSuccess?.()
    } catch (error) {
      console.error('Error creating budget item:', error)
    }
  }

  if (lookupsLoading) return <div>Cargando opciones...</div>

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Descripción
        </label>
        <input
          {...register('description')}
          type="text"
          id="description"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Ej: Cuota del apartamento"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="budgeted_amount" className="block text-sm font-medium">
            Monto Presupuestado
          </label>
          <input
            {...register('budgeted_amount', { valueAsNumber: true })}
            type="number"
            id="budgeted_amount"
            step="0.01"
            min="0"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {errors.budgeted_amount && (
            <p className="mt-1 text-sm text-red-600">{errors.budgeted_amount.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="actual_amount" className="block text-sm font-medium">
            Monto Real
          </label>
          <input
            {...register('actual_amount', { valueAsNumber: true })}
            type="number"
            id="actual_amount"
            step="0.01"
            min="0"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          {errors.actual_amount && (
            <p className="mt-1 text-sm text-red-600">{errors.actual_amount.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="classification_id" className="block text-sm font-medium">
            Clasificación
          </label>
          <select
            {...register('classification_id')}
            id="classification_id"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            {classifications.map((classification) => (
              <option key={classification.id} value={classification.id}>
                {classification.name}
              </option>
            ))}
          </select>
          {errors.classification_id && (
            <p className="mt-1 text-sm text-red-600">{errors.classification_id.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="control_id" className="block text-sm font-medium">
            Control
          </label>
          <select
            {...register('control_id')}
            id="control_id"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          >
            {controls.map((control) => (
              <option key={control.id} value={control.id}>
                {control.name}
              </option>
            ))}
          </select>
          {errors.control_id && (
            <p className="mt-1 text-sm text-red-600">{errors.control_id.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center">
          <input
            {...register('is_recurring')}
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 shadow-sm"
          />
          <span className="ml-2 text-sm text-gray-700">¿Es un gasto recurrente?</span>
        </label>
      </div>

      <div>
        <label htmlFor="due_date" className="block text-sm font-medium">
          Fecha de Vencimiento
        </label>
        <input
          {...register('due_date', { valueAsDate: true })}
          type="date"
          id="due_date"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
        />
        {errors.due_date && (
          <p className="mt-1 text-sm text-red-600">{errors.due_date.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notas (opcional)
        </label>
        <textarea
          {...register('notes')}
          id="notes"
          rows={3}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          placeholder="Notas adicionales sobre este gasto..."
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Guardando...' : 'Crear Item de Presupuesto'}
      </button>
    </form>
  )
}
```

### 7. Componente de Visualización con Colores Dinámicos

```typescript
// components/atoms/ClassificationBadge.tsx
'use client'

interface ClassificationBadgeProps {
  classification: {
    id: string
    name: string
    color: string
    description?: string
  }
}

export default function ClassificationBadge({ classification }: ClassificationBadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${classification.color}20`, // 20% opacity
        color: classification.color,
        borderColor: classification.color,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      title={classification.description}
    >
      {classification.name}
    </span>
  )
}

// components/molecules/BudgetItemCard.tsx
'use client'

import ClassificationBadge from '@/components/atoms/ClassificationBadge'
import { BudgetItem } from '@/hooks/useBudgetData'

interface BudgetItemCardProps {
  item: BudgetItem
  onEdit?: () => void
  onDelete?: () => void
}

export default function BudgetItemCard({ item, onEdit, onDelete }: BudgetItemCardProps) {
  const isOverBudget = item.actual_amount > item.budgeted_amount
  const remaining = item.budgeted_amount - item.actual_amount
  const percentage = (item.actual_amount / item.budgeted_amount) * 100

  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{item.description}</h3>
        <div className="flex space-x-2">
          {item.classification && (
            <ClassificationBadge classification={item.classification} />
          )}
          {item.control && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: `${item.control.color}15`,
                color: item.control.color,
              }}
            >
              {item.control.name}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Presupuestado</p>
          <p className="text-lg font-semibold text-green-600">
            ${item.budgeted_amount.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Gastado</p>
          <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-600' : 'text-blue-600'}`}>
            ${item.actual_amount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm text-gray-600">Progreso</span>
          <span className={`text-sm font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between items-center">
        <p className={`text-sm ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {remaining >= 0 ? 'Restante' : 'Sobrepasado'}: ${Math.abs(remaining).toLocaleString()}
        </p>
        <div className="flex space-x-2">
          <button
            onClick={onEdit}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Editar
          </button>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}
```

## 📊 Esquema de Base de Datos Normalizado

### Tablas de Lookup/Normalización

```sql
-- Estados de presupuesto
CREATE TABLE budget_statuses (
  id TEXT PRIMARY KEY, -- 'active', 'closed', 'archived'
  name TEXT NOT NULL, -- 'Activo', 'Cerrado', 'Archivado'
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0
);

-- Clasificaciones de items
CREATE TABLE classifications (
  id TEXT PRIMARY KEY, -- 'fijo', 'variable', 'discrecional'
  name TEXT NOT NULL, -- 'Fijo', 'Variable', 'Discrecional'
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0
);

-- Tipos de control
CREATE TABLE controls (
  id TEXT PRIMARY KEY, -- 'necesario', 'discrecional'
  name TEXT NOT NULL, -- 'Necesario', 'Discrecional'
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0
);

-- Tipos de transacción
CREATE TABLE transaction_types (
  id TEXT PRIMARY KEY, -- 'income', 'expense', 'transfer'
  name TEXT NOT NULL, -- 'Ingreso', 'Gasto', 'Transferencia'
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0
);

-- Monedas soportadas
CREATE TABLE currencies (
  id TEXT PRIMARY KEY, -- 'COP', 'USD', 'EUR'
  name TEXT NOT NULL, -- 'Peso Colombiano', 'Dólar', 'Euro'
  symbol TEXT NOT NULL, -- '$', '$', '€'
  format_pattern TEXT DEFAULT '#,##0.00',
  is_active BOOLEAN DEFAULT TRUE,
  order_index INTEGER DEFAULT 0
);
```

### Tablas Principales

```sql
-- Perfiles de usuario extendidos
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  currency_id TEXT REFERENCES currencies(id) DEFAULT 'COP',
  timezone TEXT DEFAULT 'America/Bogota',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías jerárquicas para presupuesto
CREATE TABLE categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plantillas de presupuesto mensual
CREATE TABLE budget_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  month_year TEXT NOT NULL, -- 'YYYY-MM'
  total_income DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  status_id TEXT REFERENCES budget_statuses(id) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- Items de presupuesto detallados
CREATE TABLE budget_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_template_id UUID REFERENCES budget_templates(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  budgeted_amount DECIMAL(12,2) NOT NULL,
  actual_amount DECIMAL(12,2) DEFAULT 0,
  classification_id TEXT REFERENCES classifications(id) NOT NULL,
  control_id TEXT REFERENCES controls(id) NOT NULL,
  due_date DATE,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transacciones detalladas
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_item_id UUID REFERENCES budget_items(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  transaction_type_id TEXT REFERENCES transaction_types(id) DEFAULT 'expense',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cuentas bancarias/efectivo
CREATE TABLE accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL, -- 'bank', 'cash', 'credit', 'investment'
  balance DECIMAL(12,2) DEFAULT 0,
  currency_id TEXT REFERENCES currencies(id) DEFAULT 'COP',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deudas
CREATE TABLE debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  remaining_amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  minimum_payment DECIMAL(12,2) NOT NULL,
  due_date DATE,
  status_id TEXT REFERENCES budget_statuses(id) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos de deudas
CREATE TABLE debt_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  remaining_balance DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_budget_items_user_template ON budget_items(user_id, budget_template_id);
CREATE INDEX idx_budget_items_category ON budget_items(category_id);
CREATE INDEX idx_budget_items_classification ON budget_items(classification_id);
CREATE INDEX idx_budget_items_control ON budget_items(control_id);
CREATE INDEX idx_transactions_budget_item ON transactions(budget_item_id);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type_id);
CREATE INDEX idx_categories_user_active ON categories(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_debts_user_status ON debts(user_id, status_id);
CREATE INDEX idx_accounts_user_active ON accounts(user_id, is_active) WHERE is_active = TRUE;
```

### Datos Seed para Tablas Lookup

```sql
-- Seed data para budget_statuses
INSERT INTO budget_statuses (id, name, description, color, order_index) VALUES
('active', 'Activo', 'Presupuesto activo en uso', '#10B981', 0),
('closed', 'Cerrado', 'Presupuesto cerrado del mes', '#6B7280', 1),
('archived', 'Archivado', 'Presupuesto archivado para referencia', '#9CA3AF', 2);

-- Seed data para classifications
INSERT INTO classifications (id, name, description, color, order_index) VALUES
('fijo', 'Fijo', 'Gastos fijos que no cambian mes a mes', '#3B82F6', 0),
('variable', 'Variable', 'Gastos que varían según el consumo', '#8B5CF6', 1),
('discrecional', 'Discrecional', 'Gastos opcionales o de lujo', '#F59E0B', 2);

-- Seed data para controls
INSERT INTO controls (id, name, description, color, order_index) VALUES
('necesario', 'Necesario', 'Gastos esenciales para vivir', '#EF4444', 0),
('discrecional', 'Discrecional', 'Gastos opcionales que se pueden evitar', '#10B981', 1);

-- Seed data para transaction_types
INSERT INTO transaction_types (id, name, description, color, order_index) VALUES
('income', 'Ingreso', 'Dinero que entra', '#10B981', 0),
('expense', 'Gasto', 'Dinero que sale', '#EF4444', 1),
('transfer', 'Transferencia', 'Movimiento entre cuentas', '#6B7280', 2);

-- Seed data para currencies
INSERT INTO currencies (id, name, symbol, format_pattern, order_index) VALUES
('COP', 'Peso Colombiano', '$', '#,##0', 0),
('USD', 'Dólar Americano', '$', '#,##0.00', 1),
('EUR', 'Euro', '€', '#,##0.00', 2);
```

### Ventajas de la Normalización

#### 1. **Flexibilidad y Escalabilidad**
```sql
-- Agregar nuevas clasificaciones sin cambiar el esquema
INSERT INTO classifications (id, name, description, color) VALUES 
('eventual', 'Eventual', 'Gastos que ocurren ocasionalmente', '#F97316');

-- Modificar colores/descripciones sin tocar datos principales
UPDATE classifications SET color = '#DC2626' WHERE id = 'fijo';
```

#### 2. **Internacionalización**
```sql
-- Tabla de traducciones (futuro)
CREATE TABLE classification_translations (
  classification_id TEXT REFERENCES classifications(id),
  language_code TEXT,
  name TEXT,
  description TEXT,
  PRIMARY KEY (classification_id, language_code)
);
```

#### 3. **Metadata Rica**
```sql
-- Colores personalizados para UI
SELECT c.*, cl.color as classification_color, ct.color as control_color
FROM budget_items bi
JOIN classifications cl ON bi.classification_id = cl.id
JOIN controls ct ON bi.control_id = ct.id;
```

#### 4. **Ordenamiento Personalizado**
```sql
-- Ordenar por order_index personalizado
SELECT * FROM classifications ORDER BY order_index, name;
```

#### 5. **Activación/Desactivación**
```sql
-- Desactivar temporalmente sin perder datos
UPDATE classifications SET is_active = false WHERE id = 'discrecional';

-- Solo mostrar activos en la UI
SELECT * FROM classifications WHERE is_active = true;
```

### Políticas RLS

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
CREATE POLICY "Users can view and edit own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Políticas para categories
CREATE POLICY "Users can view own categories" ON categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categories" ON categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para budget_templates
CREATE POLICY "Users can view own budget templates" ON budget_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own budget templates" ON budget_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget templates" ON budget_templates
  FOR UPDATE USING (auth.uid() = user_id);

-- Políticas para budget_items
CREATE POLICY "Users can view own budget items" ON budget_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own budget items" ON budget_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budget items" ON budget_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own budget items" ON budget_items
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para transactions
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
  FOR DELETE USING (auth.uid() = user_id);
```

## 🛠️ Dependencias Necesarias

### Nuevas Dependencias

```json
{
  "dependencies": {
    "@supabase/ssr": "^0.1.0",
    "@supabase/supabase-js": "^2.38.0",
    "swr": "^2.2.4",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "supabase": "^1.120.0"
  }
}
```

### Scripts de Package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push",
    "db:generate-types": "supabase gen types typescript --local --schema public > src/types/supabase.ts"
  }
}
```

## 🔐 Variables de Entorno

### .env.local

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database (para desarrollo local)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Auth (opcional para configuraciones avanzadas)
NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL=http://localhost:3001/auth/callback
```

### .env.example

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database URL (for local development)
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Auth Configuration
NEXT_PUBLIC_SUPABASE_AUTH_REDIRECT_URL=http://localhost:3001/auth/callback
```

## 📈 Ventajas del Enfoque Monorepo

### 1. **Desarrollo Simplificado**
- Un solo repositorio para gestionar
- Dependencias centralizadas
- Configuración unificada (ESLint, Prettier, TypeScript)
- Hot-reload entre cambios de backend y frontend

### 2. **Tipos Compartidos**
- Tipos TypeScript generados automáticamente desde la DB
- Sincronización automática entre validaciones y tipos
- IntelliSense completo en todo el proyecto

### 3. **Deployment Unificado**
- Un solo comando para deploy
- Variables de entorno centralizadas
- Menos complejidad en CI/CD

### 4. **Debugging Mejorado**
- Stack traces completos
- Desarrollo end-to-end sin switching de repos
- Mejor experiencia de desarrollo

## 🚀 Próximos Pasos

### Fase 1: Configuración Base (2 días)
1. ✅ Crear documentación
2. ⏳ Configurar proyecto Supabase
3. ⏳ Instalar dependencias
4. ⏳ Configurar variables de entorno

### Fase 2: Schema y Migraciones (3 días)
1. ⏳ Implementar schema de base de datos
2. ⏳ Crear políticas RLS
3. ⏳ Configurar datos seed
4. ⏳ Generar tipos TypeScript

### Fase 3: Server Actions (4 días)
1. ⏳ Implementar validaciones Zod
2. ⏳ Crear Server Actions base
3. ⏳ Configurar middleware de auth
4. ⏳ Testing de acciones

### Fase 4: Client Integration (3 días)
1. ⏳ Implementar hooks SWR
2. ⏳ Configurar real-time
3. ⏳ Refactorizar componentes existentes
4. ⏳ Testing end-to-end

### Fase 5: Optimización (2 días)
1. ⏳ Performance tuning
2. ⏳ Caching strategies
3. ⏳ Error handling
4. ⏳ Monitoring y logging

---

**Fecha de creación**: 2025-01-12
**Versión**: 1.0
**Autor**: Equipo de Desarrollo
**Enfoque**: Monorepo + Híbrido (RLS + Server Actions) 