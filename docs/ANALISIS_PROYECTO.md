# Análisis Completo del Proyecto PresupuestoApp 2025

## 📊 Resumen General

**PresupuestoApp** es una aplicación de gestión financiera personal desarrollada con Next.js 15 y Supabase, diseñada para ayudar a los usuarios a gestionar presupuestos mensuales, gastos, ingresos y deudas.

### Tecnologías Principales

- **Framework**: Next.js 15.3.5 (con Turbopack)
- **React**: v19.0.0
- **Base de datos**: Supabase (PostgreSQL)
- **UI**: Tailwind CSS + Radix UI + shadcn/ui
- **Formularios**: React Hook Form + Zod
- **Validación**: Zod v4.0.5
- **Estado**: SWR para fetching de datos
- **Notificaciones**: Sonner (toast)

---

## 🗄️ Estructura de la Base de Datos en Supabase

### Tablas de Catálogo (Lookup Tables)

#### 1. `budget_statuses`
Estados posibles de los presupuestos
- **Campos**: id, name, description, color, is_active, created_at
- **RLS**: Habilitado
- **Relaciones**: Referenciado por `budget_items.status_id`

#### 2. `classifications`
Clasificaciones de gastos: Fijo, Variable, Discrecional
- **Campos**: id, name, description, color, is_active, created_at
- **RLS**: Habilitado
- **Relaciones**: Referenciado por `budget_items.classification_id`

#### 3. `controls`
Controles de gastos: Necesario, Discrecional
- **Campos**: id, name, description, color, is_active, created_at
- **RLS**: Habilitado
- **Relaciones**: Referenciado por `budget_items.control_id`

#### 4. `transaction_types`
Tipos de transacciones: Ingreso, Gasto, Transferencia
- **Campos**: id, name, description, color, is_active, created_at
- **RLS**: Habilitado
- **Relaciones**: Referenciado por `transactions.type_id`

#### 5. `currencies`
Monedas disponibles en el sistema
- **Campos**: id, name, code, symbol, is_active, created_at
- **RLS**: Habilitado

### Tablas de Usuario

#### 6. `profiles`
Perfiles de usuario extendidos (vinculados con auth.users)
- **Campos**: id, email, full_name, avatar_url, created_at, updated_at
- **RLS**: Habilitado
- **FK**: `id` → `auth.users.id`
- **Relaciones**: Es referenciado por todas las tablas principales

#### 7. `categories`
Categorías de gastos personalizadas por usuario
- **Campos**: id, name, description, color, icon, is_active, created_at, user_id
- **RLS**: Habilitado
- **FK**: `user_id` → `auth.users.id`
- **Relaciones**: Referenciado por `budget_items.category_id`

#### 8. `accounts`
Cuentas bancarias y métodos de pago de los usuarios
- **Campos**: id, user_id, name, type, is_active, created_at, updated_at
- **RLS**: Habilitado
- **FK**: `user_id` → `profiles.id`
- **Relaciones**: Referenciado por `transactions.account_id`
- **Valores típicos**: Nequi, TC Falabella, Efectivo, Banco Santander

### Tablas Principales de Negocio

#### 9. `budget_templates`
Plantillas de presupuesto reutilizables por mes
- **Campos**: id, user_id, name, description, is_active, created_at, updated_at, month_year
- **RLS**: Habilitado
- **FK**: `user_id` → `profiles.id`
- **month_year**: Formato YYYY-MM (ej: "2025-07")
- **Relaciones**: Referenciado por `budget_items.template_id`

#### 10. `budget_items`
Elementos individuales de presupuesto
- **Campos principales**:
  - id, user_id, template_id, category_id, classification_id, control_id, status_id
  - name, description, due_date
  - budgeted_amount (presupuestado)
  - spent_amount (monto total acumulado gastado)
  - real_amount (monto real de la transacción específica)
  - is_active, created_at, updated_at
- **RLS**: Habilitado
- **FKs múltiples**:
  - `user_id` → `profiles.id`
  - `template_id` → `budget_templates.id`
  - `category_id` → `categories.id`
  - `classification_id` → `classifications.id`
  - `control_id` → `controls.id`
  - `status_id` → `budget_statuses.id`

#### 11. `transactions`
Transacciones registradas por los usuarios
- **Campos principales**:
  - id, user_id, budget_item_id, type_id, account_id, electronic_invoice_id
  - amount, description, transaction_date, month_year
  - place (lugar donde se realizó el gasto)
  - category_name (nombre directo de la categoría)
  - created_at, updated_at
- **RLS**: Habilitado
- **month_year**: Formato YYYY-MM para agrupación mensual
- **FKs múltiples**:
  - `user_id` → `profiles.id`
  - `budget_item_id` → `budget_items.id`
  - `type_id` → `transaction_types.id`
  - `account_id` → `accounts.id`
  - `electronic_invoice_id` → `electronic_invoices.id`

#### 12. `ingresos`
Tabla para gestionar los ingresos de los usuarios
- **Campos**:
  - id, user_id, descripcion, fuente, monto, fecha
  - tipo (default: 'ingreso')
  - es_activo, created_at, updated_at
- **RLS**: Habilitado
- **FK**: `user_id` → `profiles.id`

#### 13. `deudas`
Tabla para gestionar las deudas de los usuarios
- **Campos**:
  - id, user_id, descripcion, acreedor, monto, fecha_vencimiento
  - pagada (indica si la deuda fue pagada completamente)
  - tipo (default: 'deuda')
  - es_activo, created_at, updated_at
- **RLS**: Habilitado
- **FK**: `user_id` → `profiles.id`

#### 14. `electronic_invoices`
Almacena facturas electrónicas procesadas desde códigos QR de la DIAN
- **Campos**:
  - id, user_id, cufe_code (único), supplier_name, supplier_nit
  - invoice_date, total_amount
  - extracted_data (JSONB con items, impuestos, totales)
  - pdf_url, processed_at, created_at, updated_at
- **RLS**: Habilitado
- **FK**: `user_id` → `auth.users.id`
- **Relaciones**: Referenciado por `transactions.electronic_invoice_id`

### Extensiones de PostgreSQL Instaladas

- **uuid-ossp**: Generación de UUIDs
- **pg_stat_statements**: Estadísticas de SQL
- **pgcrypto**: Funciones criptográficas
- **pg_graphql**: Soporte de GraphQL
- **supabase_vault**: Vault de Supabase

---

## 🔌 Implementación de Supabase en el Proyecto

### Configuración de Clientes

El proyecto utiliza tres tipos de clientes de Supabase según el contexto:

#### 1. Cliente del Navegador
**Ubicación**: `src/lib/supabase/client.ts`

```typescript
export const createClient = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
};
```

- **Uso**: Client Components
- **Contexto**: Operaciones de lectura y real-time
- **Autenticación**: Usa el Anon Key público
- **Acceso**: Solo a recursos permitidos por RLS

#### 2. Cliente del Servidor
**Ubicación**: `src/lib/supabase/server.ts`

```typescript
export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options) { ... },
        remove(name: string, options) { ... },
      },
    },
  );
};
```

- **Uso**: Server Components y Server Actions
- **Contexto**: Renderizado del servidor
- **Autenticación**: Maneja cookies para sesiones
- **Ventajas**: SEO, seguridad, performance

#### 3. Cliente Admin
**Ubicación**: `src/lib/supabase/server.ts`

```typescript
export const createAdminClient = () => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get() { return undefined; },
        set() {},
        remove() {},
      },
    },
  );
};
```

- **Uso**: Operaciones administrativas
- **Contexto**: Bypass de RLS, operaciones elevadas
- **Autenticación**: Service Role Key (PRIVADO)
- **⚠️ Precaución**: Solo usar cuando sea absolutamente necesario

### Variables de Entorno

```env
# Configuración de Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hlgmurtmqlzmjarmryzp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave_publica>
SUPABASE_SERVICE_ROLE_KEY=<clave_privada_admin>

# URL de la aplicación
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## 🛠️ Servicios y Comunicación con Supabase

### 1. Servicio de Presupuestos
**Ubicación**: `src/lib/services/budget.ts`

#### Funciones Principales

##### Lectura de Datos
- `getBudgetByMonth(monthYear: string)`: Obtiene presupuesto mensual
  - Usa RPC: `get_budget_by_month`
  - Parámetros: `p_user_id`, `p_month_year`
  - Retorna: Estructura completa con categorías e items

- `getCategories()`: Lista categorías activas del usuario
- `getClassifications()`: Lista clasificaciones activas
- `getControls()`: Lista controles activos

##### Escritura de Datos
- `createMonthlyBudget(monthYear, templateName?)`: Crea/actualiza template
  - Usa RPC: `upsert_monthly_budget`

- `createBudgetItem(templateId, categoryId, item)`: Crea nuevo item
  - Usa API Proxy: `POST /api/budget`

- `updateBudgetItem(itemId, updates)`: Actualiza item existente
  - Usa API Proxy: `PATCH /api/budget/{itemId}`

- `deleteBudgetItem(itemId)`: Elimina item
  - Usa API Proxy: `DELETE /api/budget/{itemId}`

##### Utilidades
- `formatCurrency(amount)`: Formatea montos en COP
- `getAvailableMonths()`: Retorna lista de meses 2025

#### Interfaces TypeScript

```typescript
export interface BudgetItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
}

export interface BudgetCategory {
  id: string;
  nombre: string;
  totalPresupuestado: number;
  totalReal: number;
  items: BudgetItem[];
  expanded: boolean;
}

export interface MonthlyBudgetData {
  template_id: string;
  template_name: string;
  categories: BudgetCategory[];
  total_presupuestado: number;
  total_real: number;
}
```

### 2. Servicio de Gastos
**Ubicación**: `src/lib/services/expenses.ts`

#### Funciones Principales

##### Lectura de Datos
- `getExpensesByMonth(monthYear)`: Lista transacciones del mes
  - Usa RPC: `get_expenses_by_month`

- `getExpensesSummaryByMonth(monthYear)`: Resumen por categoría
  - Usa RPC: `get_expenses_summary_by_month`

- `getMonthlyExpenseData(monthYear)`: Datos completos (transacciones + resumen)

- `getUserAccounts()`: Lista cuentas del usuario
  - Query directa a tabla `accounts`

- `getAvailableExpenseMonths()`: Meses con gastos registrados
  - Usa RPC: `get_available_expense_months`

##### Escritura de Datos
- `createExpenseTransaction(expenseData)`: Crea nuevo gasto
  - Usa RPC: `upsert_monthly_expense`

- `updateExpenseTransaction(transactionId, expenseData)`: Actualiza gasto
  - Usa API Proxy: `PATCH /api/expenses/{transactionId}`

- `deleteExpenseTransaction(transactionId)`: Elimina gasto
  - Usa API Proxy: `DELETE /api/expenses/{transactionId}`

##### Utilidades
- `formatCurrency(amount)`: Formatea en COP
- `formatMonthName(monthYear)`: Formato legible (ej: "Enero 2025")
- `hasExpenseDataForMonth(monthYear)`: Verifica si hay datos

#### Constantes

```typescript
export const EXPENSE_CATEGORIES = [
  'VIVIENDA',
  'DEUDAS',
  'TRANSPORTE',
  'MERCADO',
  'OTROS',
] as const;

export const ACCOUNT_TYPES = [
  'Nequi',
  'TC Falabella',
  'Efectivo',
  'Banco Santander',
] as const;
```

### 3. Servicio de Ingresos y Deudas
**Ubicación**: `src/lib/services/ingresos-deudas.ts`

#### Funciones para Ingresos

- `obtenerIngresos()`: Lista todos los ingresos activos
  - Query directa con filtro `es_activo = true`
  - Ordenado por fecha descendente

- `crearIngreso(nuevoIngreso)`: Crea nuevo ingreso
  - Insert directo en tabla `ingresos`

- `actualizarIngreso(id, datosActualizados)`: Actualiza ingreso
  - Update directo

- `eliminarIngreso(id)`: Elimina ingreso (soft delete)
  - Marca `es_activo = false`

#### Funciones para Deudas

- `obtenerDeudas()`: Lista todas las deudas activas
  - Query directa con filtro `es_activo = true`
  - Ordenado por fecha de vencimiento ascendente

- `crearDeuda(nuevaDeuda)`: Crea nueva deuda
  - Insert directo con `pagada = false`

- `actualizarDeuda(id, datosActualizados)`: Actualiza deuda
  - Update directo

- `marcarDeudaComoPagada(id)`: Marca deuda como pagada
  - Wrapper de `actualizarDeuda` con `pagada = true`

- `eliminarDeuda(id)`: Elimina deuda (soft delete)

#### Funciones de Resumen

- `obtenerResumenFinanciero()`: Calcula totales y balance
  - Carga ingresos y deudas en paralelo
  - Calcula: totalIngresos, totalDeudas, balanceNeto, contadores

- `inicializarDatosEjemplo()`: Crea datos de ejemplo
  - Solo si el usuario no tiene datos previos
  - Incluye 6 ingresos y 2 deudas de ejemplo

#### Utilidades

- `formatearMoneda(amount)`: Formatea en COP
- `estaProximaAVencer(fechaVencimiento)`: Verifica si vence en 7 días
- `obtenerColorMonto(monto, esIngreso)`: Retorna clase CSS de color

---

## 🔄 Patrones de Comunicación con Supabase

El proyecto implementa **tres patrones** para comunicarse con Supabase:

### 1. Queries Directas
Usado para operaciones CRUD simples

```typescript
// Lectura
const { data, error } = await supabase
  .from('categories')
  .select('*')
  .eq('user_id', userId)
  .eq('is_active', true)
  .order('name');

// Creación
const { data, error } = await supabase
  .from('ingresos')
  .insert([{ user_id, descripcion, monto, ... }])
  .select()
  .single();

// Actualización
const { data, error } = await supabase
  .from('deudas')
  .update({ pagada: true })
  .eq('id', deudaId)
  .select()
  .single();

// Eliminación (soft delete)
const { error } = await supabase
  .from('ingresos')
  .update({ es_activo: false })
  .eq('id', ingresoId);
```

**Ventajas**:
- Simple y directo
- Type-safe con TypeScript
- Ideal para operaciones individuales

**Casos de uso**:
- Listar categorías, cuentas, catálogos
- CRUD de ingresos y deudas
- Operaciones simples de lectura/escritura

### 2. RPC (Remote Procedure Calls)
Llamadas a funciones almacenadas en PostgreSQL

```typescript
// Obtener presupuesto mensual
const { data, error } = await supabase.rpc('get_budget_by_month', {
  p_user_id: user.id,
  p_month_year: '2025-01',
});

// Crear presupuesto mensual
const { data, error } = await supabase.rpc('upsert_monthly_budget', {
  p_user_id: user.id,
  p_month_year: '2025-01',
  p_template_name: 'Presupuesto Enero',
});

// Obtener gastos del mes
const { data, error } = await supabase.rpc('get_expenses_by_month', {
  p_user_id: user.id,
  p_month_year: '2025-01',
});
```

**Ventajas**:
- Lógica compleja en la base de datos
- Mejor performance (menos round-trips)
- Transacciones atómicas
- Reutilizable desde diferentes clientes

**Casos de uso**:
- Obtener datos agregados con joins complejos
- Operaciones que requieren múltiples pasos
- Cálculos y transformaciones de datos
- Validaciones complejas

**Funciones RPC documentadas**:
- `get_budget_by_month(p_user_id, p_month_year)`
- `upsert_monthly_budget(p_user_id, p_month_year, p_template_name)`
- `get_expenses_by_month(p_user_id, p_month_year)`
- `get_expenses_summary_by_month(p_user_id, p_month_year)`
- `upsert_monthly_expense(...)`
- `get_available_expense_months(p_user_id)`

### 3. API Proxy (Next.js API Routes)
Rutas API intermedias para operaciones sensibles

```typescript
// Cliente (frontend)
const response = await fetch('/api/budget', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    template_id: templateId,
    category_id: categoryId,
    descripcion: item.descripcion,
    // ...
  }),
});

const result = await response.json();
```

```typescript
// Servidor (API Route - /api/budget/route.ts)
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();

  // Validaciones
  // Lógica de negocio
  // Llamadas a Supabase

  return Response.json({ success: true, data });
}
```

**Ventajas**:
- Evita problemas de CORS
- Centraliza lógica de negocio
- Validaciones en el servidor
- Oculta detalles de implementación
- Rate limiting y seguridad adicional

**Casos de uso**:
- Operaciones CRUD de `budget_items`
- Operaciones CRUD de `transactions`
- Cualquier operación que requiera validación compleja
- Integraciones con APIs externas

**Endpoints documentados**:
- `POST /api/budget` - Crear budget item
- `PATCH /api/budget/{itemId}` - Actualizar budget item
- `DELETE /api/budget/{itemId}` - Eliminar budget item
- `PATCH /api/expenses/{transactionId}` - Actualizar gasto
- `DELETE /api/expenses/{transactionId}` - Eliminar gasto

---

## 📁 Estructura del Proyecto

```
PresupuestoApp/
├── .claude/                    # Configuración de Claude Code
│   └── settings.local.json
├── .github/                    # GitHub workflows
├── .husky/                     # Git hooks
├── docs/                       # Documentación del proyecto
├── public/                     # Assets estáticos
├── scripts/                    # Scripts de utilidad
├── supabase/                   # Configuración de Supabase
│   └── migrations/            # Migraciones SQL
└── src/
    ├── app/                   # App Router de Next.js
    │   ├── api/              # API Routes (proxies)
    │   ├── auth/             # Autenticación (login, signup)
    │   ├── dashboard/        # Dashboard principal
    │   ├── gastos/           # Gestión de gastos mensuales
    │   ├── ingresos-deudas/  # Ingresos y deudas
    │   ├── presupuesto/      # Presupuesto mensual
    │   ├── test/             # Páginas de prueba
    │   ├── layout.tsx        # Layout principal
    │   └── page.tsx          # Página home
    ├── components/            # Componentes React (Atomic Design)
    │   ├── atoms/            # Componentes atómicos
    │   ├── molecules/        # Componentes moleculares
    │   ├── organisms/        # Componentes organismos
    │   ├── pages/            # Componentes de página completa
    │   ├── templates/        # Templates de página
    │   └── ui/               # shadcn/ui components
    ├── contexts/              # React Context providers
    ├── hooks/                 # Custom React hooks
    ├── lib/
    │   ├── actions/          # Server Actions
    │   │   ├── auth.ts       # Acciones de autenticación
    │   │   └── categories.ts # Acciones de categorías
    │   ├── services/         # Servicios de Supabase
    │   │   ├── budget.ts     # Servicio de presupuestos
    │   │   ├── expenses.ts   # Servicio de gastos
    │   │   └── ingresos-deudas.ts # Servicio de ingresos/deudas
    │   ├── supabase/         # Clientes de Supabase
    │   │   ├── client.ts     # Cliente del navegador
    │   │   └── server.ts     # Cliente del servidor
    │   ├── validations/      # Schemas de Zod
    │   │   └── schemas.ts    # Validaciones
    │   └── utils.ts          # Utilidades generales
    ├── scripts/               # Scripts internos
    └── types/                 # TypeScript types
        └── database.ts        # Tipos generados de Supabase
```

### Patrones de Arquitectura

#### Atomic Design
Los componentes están organizados siguiendo el patrón Atomic Design:

- **Atoms**: Componentes básicos (botones, inputs, labels)
- **Molecules**: Combinaciones simples de atoms (form fields, cards)
- **Organisms**: Secciones complejas (headers, forms completos, tablas)
- **Templates**: Layouts de página
- **Pages**: Páginas completas con datos

#### Server vs Client Components
- **Server Components**: Por defecto, para mejor performance y SEO
- **Client Components**: Solo cuando se necesita interactividad (`'use client'`)

---

## 🎯 Características Clave del Sistema

### 1. Autenticación y Seguridad

#### Autenticación
- **Proveedor**: Supabase Auth
- **Métodos**: Email/Password
- **Gestión de sesiones**: Cookies HTTP-only
- **Middleware**: Protección de rutas en `middleware.ts`

#### Row Level Security (RLS)
Todas las tablas tienen RLS habilitado:
- Los usuarios solo acceden a sus propios datos
- Políticas a nivel de base de datos
- Seguridad por defecto

```sql
-- Ejemplo de política RLS
CREATE POLICY "Users can view own budget items"
  ON budget_items FOR SELECT
  USING (auth.uid() = user_id);
```

### 2. Soft Deletes

El sistema usa eliminación lógica en lugar de física:
- Campos: `is_active` (tablas en inglés) o `es_activo` (tablas en español)
- Los registros nunca se eliminan físicamente
- Permite recuperación y auditoría

### 3. Timestamps Automáticos

Todas las tablas principales incluyen:
- `created_at`: Timestamp de creación
- `updated_at`: Timestamp de última modificación
- Actualizados automáticamente por triggers de PostgreSQL

### 4. Organización Mensual

Los datos se organizan por mes usando el campo `month_year`:
- **Formato**: `YYYY-MM` (ej: "2025-01", "2025-12")
- **Tablas afectadas**: `budget_templates`, `transactions`
- **Ventaja**: Fácil filtrado y agrupación por periodo

### 5. Soporte Multi-Moneda

Aunque actualmente usa COP (Peso Colombiano), el sistema está preparado para:
- Tabla `currencies` con múltiples monedas
- Campos de montos como `numeric` para precisión decimal
- Funciones de formateo parametrizables

### 6. Integración con DIAN (Colombia)

#### Facturas Electrónicas
- Tabla `electronic_invoices` para almacenar facturas
- Campo `cufe_code`: Código único de factura electrónica
- Campo `extracted_data`: JSONB con datos estructurados
- Relación con `transactions` para asociar gastos

#### Casos de uso
- Escaneo de códigos QR de facturas
- Extracción automática de datos
- Vinculación de gastos con facturas legales

### 7. Categorías y Clasificaciones

#### Sistema Flexible
- **Categorías**: Personalizables por usuario (ej: VIVIENDA, TRANSPORTE)
- **Clasificaciones**: Fijo, Variable, Discrecional
- **Controles**: Necesario, Discrecional
- **Estados**: Pendiente, Pagado, etc.

#### Ventajas
- Adaptable a diferentes estilos de presupuesto
- Reportes y análisis granulares
- Flexibilidad sin perder estructura

---

## 📊 Flujos de Datos Principales

### Flujo 1: Creación de Presupuesto Mensual

1. Usuario selecciona mes (ej: "2025-01")
2. Sistema verifica si existe template para ese mes
3. Si no existe:
   - Llama a `createMonthlyBudget(monthYear)`
   - RPC `upsert_monthly_budget` crea template en DB
4. Si existe:
   - Llama a `getBudgetByMonth(monthYear)`
   - RPC `get_budget_by_month` retorna datos completos
5. Frontend renderiza categorías e items de presupuesto

### Flujo 2: Registro de Gasto

1. Usuario ingresa datos del gasto en formulario
2. Validación con Zod schema
3. Llamada a `createExpenseTransaction(expenseData)`
4. RPC `upsert_monthly_expense`:
   - Crea/actualiza transacción
   - Actualiza `month_year` automáticamente
   - Vincula con cuenta y tipo de transacción
5. Frontend revalida datos y actualiza UI

### Flujo 3: Gestión de Ingresos y Deudas

#### Ingresos
1. Usuario crea ingreso con descripción, fuente, monto
2. `crearIngreso()` inserta en tabla `ingresos`
3. `obtenerResumenFinanciero()` recalcula totales
4. Dashboard muestra balance actualizado

#### Deudas
1. Usuario registra deuda con acreedor, monto, vencimiento
2. `crearDeuda()` inserta con `pagada = false`
3. Sistema calcula días hasta vencimiento
4. Alertas si `estaProximaAVencer()` retorna true
5. Usuario puede `marcarDeudaComoPagada()`

---

## 🚀 Scripts y Comandos

### Desarrollo
```bash
npm run dev              # Servidor de desarrollo (puerto 3001)
npm run build            # Build de producción
npm run start            # Servidor de producción
```

### Calidad de Código
```bash
npm run lint             # Ejecutar ESLint
npm run lint:fix         # Fix automático de ESLint
npm run format           # Formatear código con Prettier
npm run format:check     # Verificar formato
npm run type-check       # Verificar tipos TypeScript
```

### Base de Datos
```bash
npm run db:types         # Generar tipos TypeScript desde Supabase
npm run db:reset         # Resetear base de datos local
npm run db:migrate       # Push de migraciones
npm run db:seed          # Seed de datos
```

### Supabase Local
```bash
npm run supabase:start   # Iniciar Supabase local
npm run supabase:stop    # Detener Supabase local
npm run supabase:status  # Ver status de servicios
```

---

## 🔧 Configuración y Herramientas

### Linting y Formateo
- **ESLint**: Configurado con reglas de Next.js
- **Prettier**: Formateo consistente de código
- **Husky**: Git hooks pre-commit
- **lint-staged**: Solo lint de archivos staged

### TypeScript
- Modo estricto habilitado
- Tipos generados automáticamente desde Supabase
- Inferencia de tipos completa en queries

### Tailwind CSS
- Versión 4 (latest)
- Configuración con PostCSS
- Plugins: tw-animate-css para animaciones
- Integración con shadcn/ui

---

## 📝 Mejores Prácticas Implementadas

### 1. Seguridad
- ✅ Variables de entorno para credenciales
- ✅ RLS habilitado en todas las tablas
- ✅ Service Role Key solo en servidor
- ✅ Validación de datos con Zod
- ✅ Sanitización en API routes

### 2. Performance
- ✅ Server Components por defecto
- ✅ Parallel data fetching con Promise.all
- ✅ SWR para caching y revalidación
- ✅ Turbopack para dev server
- ✅ Índices en columnas frecuentes (month_year, user_id)

### 3. Mantenibilidad
- ✅ Estructura de carpetas clara (Atomic Design)
- ✅ Separación de concerns (services, actions, components)
- ✅ Tipos TypeScript generados automáticamente
- ✅ Documentación de funciones
- ✅ Convenciones de nombres consistentes

### 4. UX
- ✅ Notificaciones con toast (Sonner)
- ✅ Estados de carga
- ✅ Manejo de errores user-friendly
- ✅ Formularios con validación en tiempo real
- ✅ Diseño responsive

---

## 🐛 Áreas de Mejora Identificadas

### 1. Testing
- ❌ No hay tests unitarios
- ❌ No hay tests de integración
- 💡 Recomendación: Implementar Vitest + Testing Library

### 2. Documentación de RPC Functions
- ⚠️ Las funciones RPC están en la BD pero no documentadas en código
- 💡 Recomendación: Documentar parámetros y retornos esperados

### 3. Manejo de Errores
- ⚠️ Algunos errores solo se loggean en consola
- 💡 Recomendación: Sistema centralizado de error tracking (Sentry)

### 4. Validaciones
- ⚠️ Algunas validaciones solo en frontend
- 💡 Recomendación: Duplicar validaciones críticas en API routes

### 5. Migraciones
- ⚠️ Archivos SQL sueltos en raíz del proyecto
- 💡 Recomendación: Consolidar en `supabase/migrations/`

---

## 📚 Recursos y Referencias

### Documentación Oficial
- [Next.js 15 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### Dependencias Clave
- `@supabase/ssr`: SSR integration para Next.js
- `@supabase/supabase-js`: Cliente JavaScript de Supabase
- `react-hook-form`: Manejo de formularios
- `zod`: Validación de schemas
- `swr`: Data fetching y caching
- `sonner`: Toast notifications

---

## 🎓 Conclusiones

PresupuestoApp es una aplicación bien estructurada que:

✅ **Fortalezas**:
- Arquitectura moderna con Next.js 15 y Supabase
- Separación clara de responsabilidades
- Seguridad por defecto con RLS
- UI consistente con Tailwind y shadcn/ui
- TypeScript para type-safety

⚠️ **Áreas de oportunidad**:
- Agregar testing automatizado
- Mejorar documentación de funciones RPC
- Consolidar archivos de migración
- Implementar error tracking

🚀 **Próximos pasos sugeridos**:
1. Documentar todas las funciones RPC en `supabase/`
2. Implementar tests unitarios para servicios críticos
3. Agregar Storybook para documentar componentes
4. Considerar internacionalización (i18n) si se planea expansión
5. Implementar analytics para entender uso de features

---

**Última actualización**: 30 de diciembre de 2025
**Versión del proyecto**: 0.1.0
