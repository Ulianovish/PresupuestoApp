# S07 — Sin datos del dueño en el código — Plan de implementación

> **Alineado con contratos v2 (§5).** §5.2 (limpieza S07) y §5.3 (flujo APP: S07 → S08 → S10 → S13 → S11 → S12) prevalecen sobre §2.6 y §4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún usuario nuevo vea ni reciba datos del dueño: fuera la siembra de ingresos/deudas de ejemplo, el presupuesto mock del sidebar, la lista fija de cuentas y la migración de julio 2025 (scripts, paneles sin uso y el botón `'2025-07'` de `ExpenseHeader`); `/gastos` arranca con las categorías y cuentas reales del usuario.

**Architecture:** Se borra código (siembra, mock, `ACCOUNT_TYPES`) y la lógica nueva de valores por defecto del formulario de gastos vive en un módulo puro `src/lib/expense-form-defaults.ts` con tests; `/gastos` y `ExpenseModal` solo lo consumen. La carga de ingresos/deudas se extrae a `cargarIngresosDeudas()` para poder probar, sin DOM, que un usuario sin datos no recibe inserts.

**Tech Stack:** Next.js 15 (App Router, componentes cliente), React 19, Supabase JS, TypeScript, vitest 4 (entorno `node`, sin Testing Library), bun.

## Global Constraints

- Contrato: `docs/agile/contracts.md` §2.6 con la enmienda §5.2 (v2). Nombres exactos: `DEFAULT_ACCOUNT_NAME = 'Efectivo'` en `src/lib/constants/expense-categories.ts`; texto literal **"Primero crea una categoría"**.
- `ACCOUNT_TYPES` (y su tipo derivado `AccountType`) se eliminan; no queda ninguna mención en `src/`.
- `/gastos` usa solo cuentas activas del usuario (`getUserAccounts()`, ya filtra `is_active = true`). Cuenta por defecto: `DEFAULT_ACCOUNT_NAME` si existe, si no la primera; sin cuentas, `DEFAULT_ACCOUNT_NAME` (la RPC `create_expense_transaction` la crea por nombre exacto).
- `category_name` inicial = primera categoría activa del usuario; sin categorías, el botón de guardar queda deshabilitado con el texto "Primero crea una categoría".
- Textos de UI en español colombiano, tuteo.
- Ningún dato personal en código, tests ni fixtures: cuentas inventadas (`Cuenta A`, `Tarjeta B`), UUIDs inventados. Nada de nombres de bancos, empresas ni montos reales del dueño.
- Ningún test toca una base real; el cliente de Supabase se mockea. No se accede a la base de producción.
- Ejecutar comandos en el worktree del flujo APP: `builtin cd <worktree-app> && …` (el `cd` del shell está envuelto). Nunca en `<raíz-del-repo>`.
- Verificación: `bun run test <archivo>` por tarea; al final `bun run test && bun run type-check`.
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, **siempre** con `git commit --no-verify` (el hook de husky revierte cambios). Antes de cada commit que toque `src/`, correr a mano `bunx eslint <archivos tocados>` y `bunx prettier --check <archivos tocados>` (`--write` si hace falta).
- Orden y propiedad (contratos §5.3, flujo APP, en serie en el mismo worktree): S07 es la **primera** historia del flujo (S07 → S08 → S10 → S13 → S11 → S12). No depende de ninguna. S10 toca después `Sidebar.tsx` (quita `/test`) y `src/app/gastos/page.tsx` (un `useEffect`); aquí no se toca el ítem `/test`.
- Prohibido `bun run dev` y `next build` contra `.env.local` (apunta a producción, contratos §5.0). Nunca `bun run db:types`.

## Decisión: qué muestra el sidebar sin el mock

Se **quita** la tarjeta "Total / Gastado" del sidebar de escritorio (`Sidebar.tsx:161-181`) y el monto de la barra superior móvil (`Sidebar.tsx:274-276`, se deja un `<span>` vacío del mismo ancho para no descentrar el título). Motivos:

1. Es lo más simple que no muestra datos falsos. Los totales del mes ya están, con datos reales, en `/dashboard` y `/presupuesto`.
2. El único hook con datos reales equivalentes es `useDashboardData`, que monta `useMonthlyBudget` + `useMonthlyExpenses` + `useIngresosDeudas`. El sidebar se renderiza en todas las páginas: usarlo ahí duplicaría tres cargas en cada navegación (y en `/dashboard` las haría dos veces). Crear un hook liviano nuevo es alcance extra que la historia no pide.
3. `useBudgetData` solo lo usa el sidebar (`grep` confirmado), así que queda sin uso y se borra entero, como pide el contrato.

## Archivos

- Modificar: `src/lib/services/ingresos-deudas.ts:388-470` (borrar `inicializarDatosEjemplo` y su JSDoc).
- Modificar: `src/hooks/useIngresosDeudas.ts` (import en línea 18; `cargarDatos` 82-112; `inicializarDatos` 114-137; efecto 143-146). Se agrega `export async function cargarIngresosDeudas()`.
- Crear (test): `src/hooks/useIngresosDeudas.test.ts`.
- Borrar: `src/hooks/useBudgetData.ts`.
- Modificar: `src/components/organisms/Sidebar/Sidebar.tsx` (líneas 5-6, 35, 59, 161-181, 274-276).
- Crear (test): `src/components/organisms/Sidebar/Sidebar.test.ts`.
- Modificar: `src/lib/constants/expense-categories.ts` (agregar `DEFAULT_ACCOUNT_NAME`; borrar `ACCOUNT_TYPES` y `AccountType`).
- Crear: `src/lib/expense-form-defaults.ts`.
- Crear (test): `src/lib/expense-form-defaults.test.ts`.
- Crear (test): `src/lib/constants/expense-categories.test.ts`.
- Modificar: `src/lib/services/expenses.ts:63-72` (quitar re-export de `ACCOUNT_TYPES` y `AccountType`).
- Modificar: `src/app/gastos/page.tsx` (import `React` línea 12; import de servicios 33-45; `categoryNames` 173-174; estado del formulario 304-312; `handleSubmitExpense` 331-356; `handleCloseModal` 378-388; importación de Excel 637-641; props de `ExpenseModal` 822-836).
- Modificar: `src/components/organisms/ExpenseModal/ExpenseModal.tsx` (props nuevas `submitDisabled`, `submitDisabledLabel`; botón y aviso; comentario `@example`).
- Modificar (solo comentarios): `src/components/molecules/ExpenseFormFields/ExpenseFormFields.tsx:13-18`, `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx:42-44`.
- Borrar (contratos §5.2): `src/scripts/migrate-july-data.ts`, `src/scripts/migrate-july-expenses.ts`, `src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx`, `src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx`.
- Modificar: `src/components/organisms/ExpenseHeader/ExpenseHeader.tsx` (cabecera 1-19, import 23, props 28-48, botón 95-107).
- Modificar (solo comentarios `@example`): `src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx:8,18`, `src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx:8,16`.
- Modificar: `.vercelignore` (quitar las dos rutas de `src/scripts/` que dejan de existir).
- Crear (test): `src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts`.

Usos encontrados con `grep -rn "inicializarDatosEjemplo\|useBudgetData\|ACCOUNT_TYPES\|AccountType\b" src` antes de escribir el plan (todos cubiertos arriba):

```
src/app/gastos/page.tsx:34,310,384,407,641,829        ACCOUNT_TYPES
src/components/molecules/ExpenseFormFields/ExpenseFormFields.tsx:16   (comentario)
src/components/organisms/ExpenseModal/ExpenseModal.tsx:22             (comentario)
src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx:43 (comentario)
src/components/organisms/Sidebar/Sidebar.tsx:35,59   useBudgetData
src/hooks/useBudgetData.ts
src/hooks/useIngresosDeudas.ts:18,128                inicializarDatosEjemplo
src/lib/constants/expense-categories.ts:16,26        ACCOUNT_TYPES, AccountType
src/lib/services/expenses.ts:67,71                   re-export ACCOUNT_TYPES, AccountType
src/lib/services/ingresos-deudas.ts:391              inicializarDatosEjemplo
```

Usos de la migración de julio (`grep -rn "migrate-july\|migrateJulyData\|checkMigrationStatus\|ExpenseMigrationPanel\|BudgetMigrationPanel\|onShowMigration" src .vercelignore`), también cubiertos (Task 5): nadie importa los scripts ni los paneles; solo aparecen en sus propios archivos, en los `@example` de las dos plantillas y en la prop `onShowMigration` de `ExpenseHeader`, que `/gastos` no le pasa.

```
.vercelignore:15,16                                                    rutas de los scripts
src/components/organisms/ExpenseHeader/ExpenseHeader.tsx:5,9,16,33,44,96  onShowMigration / botón '2025-07'
src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx:18  (comentario)
src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx:16    (comentario)
src/scripts/migrate-july-data.ts, src/scripts/migrate-july-expenses.ts
src/components/organisms/{Expense,Budget}MigrationPanel/*.tsx
```

## Criterios de aceptación

- [x] `inicializarDatosEjemplo` no existe en `src/` y `useIngresosDeudas` solo carga datos. Test: un usuario sin ingresos ni deudas no dispara ningún `insert` al cargar (`src/hooks/useIngresosDeudas.test.ts`).
- [x] El sidebar no importa `useBudgetData`, no muestra montos y `src/hooks/useBudgetData.ts` no existe (`Sidebar.test.ts`).
- [x] `ACCOUNT_TYPES` y `AccountType` eliminados; `DEFAULT_ACCOUNT_NAME = 'Efectivo'` exportado (`expense-categories.test.ts`).
- [x] `/gastos` ofrece solo las cuentas activas del usuario (más la del gasto en edición si ya no está activa); por defecto `Efectivo` si existe, si no la primera; sin cuentas, `Efectivo` (`expense-form-defaults.test.ts`).
- [x] `category_name` inicial = primera categoría del usuario; sin categorías, el botón de guardar está deshabilitado y dice "Primero crea una categoría", con enlace a Ajustes; el submit también lo rechaza.
- [x] La importación de Excel sin columna de cuenta usa la cuenta por defecto del usuario, no una lista fija.
- [x] (§5.2) No existen `src/scripts/migrate-july-data.ts`, `src/scripts/migrate-july-expenses.ts`, `ExpenseMigrationPanel` ni `BudgetMigrationPanel`; `ExpenseHeader` ya no tiene el botón "Migrar Julio" ligado a `'2025-07'` ni la prop `onShowMigration` (`ExpenseHeader.test.ts`). Un `grep` confirma que nada los importaba antes de borrarlos.
- [x] `bun run test && bun run type-check` en verde; `grep -rn "ACCOUNT_TYPES\|inicializarDatosEjemplo\|useBudgetData\|migrate-july\|MigrationPanel\|onShowMigration" src` sin resultados.

---

### Task 1: Quitar la siembra de ingresos y deudas de ejemplo

**Files:**
- Modify: `src/lib/services/ingresos-deudas.ts:388-470`
- Modify: `src/hooks/useIngresosDeudas.ts:10-25,82-146`
- Test: `src/hooks/useIngresosDeudas.test.ts`

**Interfaces:**
- Consumes: `obtenerIngresos(): Promise<Ingreso[]>`, `obtenerDeudas(): Promise<Deuda[]>`, `obtenerResumenFinanciero(): Promise<ResumenFinanciero>` de `@/lib/services/ingresos-deudas` (sin cambios).
- Produces: `export async function cargarIngresosDeudas(): Promise<{ ingresos: Ingreso[]; deudas: Deuda[]; resumen: ResumenFinanciero }>` en `src/hooks/useIngresosDeudas.ts`. El hook `useIngresosDeudas()` conserva su interfaz pública `UseIngresosDeudasReturn` sin cambios.

- [x] **Step 1: Escribir el test que falla**

Crear `src/hooks/useIngresosDeudas.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `ingresos-deudas.ts` importa la instancia `supabase` creada a nivel de
// módulo en `@/lib/supabase/client`, así que los `vi.fn()` se fijan con
// `vi.hoisted` antes de que se evalúe el mock.
const { mockFrom, mockInsert, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => {
  const client = { from: mockFrom, auth: { getUser: mockGetUser } };
  return { supabase: client, createClient: () => client };
});

import * as servicio from '@/lib/services/ingresos-deudas';

import { cargarIngresosDeudas } from './useIngresosDeudas';

/**
 * Tabla vacía: `select().eq().order()` devuelve `[]`. Cualquier `insert`
 * queda registrado en `mockInsert` para poder afirmar que no hubo ninguno.
 */
function tablaVacia(tabla: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.insert = vi.fn((filas: unknown) => {
    mockInsert(tabla, filas);
    return chain;
  });
  return chain;
}

describe('cargarIngresosDeudas', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    });
    mockFrom.mockImplementation((tabla: string) => tablaVacia(tabla));
  });

  it('un usuario sin ingresos ni deudas no recibe inserts al cargar', async () => {
    const r = await cargarIngresosDeudas();

    expect(r.ingresos).toEqual([]);
    expect(r.deudas).toEqual([]);
    expect(r.resumen).toEqual({
      totalIngresos: 0,
      totalDeudas: 0,
      balanceNeto: 0,
      cantidadIngresos: 0,
      cantidadDeudas: 0,
      deudasPendientes: 0,
    });
    expect(mockFrom).toHaveBeenCalledWith('ingresos');
    expect(mockFrom).toHaveBeenCalledWith('deudas');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('el servicio ya no exporta una siembra de datos de ejemplo', () => {
    expect(Object.keys(servicio)).not.toContain('inicializarDatosEjemplo');
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/hooks/useIngresosDeudas.test.ts`
Expected: FAIL. El primer test con `TypeError: cargarIngresosDeudas is not a function` (o `(0 , cargarIngresosDeudas) is not a function`); el segundo con `expected [ …, 'inicializarDatosEjemplo', … ] to not include 'inicializarDatosEjemplo'`.

- [x] **Step 3: Borrar `inicializarDatosEjemplo` del servicio**

En `src/lib/services/ingresos-deudas.ts`, borrar completo el bloque que va desde el comentario

```ts
/**
 * Inicializar datos de ejemplo para un nuevo usuario
 */
export async function inicializarDatosEjemplo(): Promise<void> {
```

hasta su cierre (la línea `}` que sigue a `    // No lanzar error para no bloquear la aplicación` / `  }`), es decir, las líneas 388-470 actuales. Lo que queda justo después de `obtenerResumenFinanciero` es el separador:

```ts
// ============================================
// UTILIDADES
// ============================================
```

No se toca nada más del archivo (`crearIngreso` y `crearDeuda` siguen existiendo: los usan los formularios de `/ingresos` y `/deudas`).

- [x] **Step 4: Dejar el hook solo cargando**

En `src/hooks/useIngresosDeudas.ts`:

1. En el import de `@/lib/services/ingresos-deudas` (líneas 10-25), quitar la línea `  inicializarDatosEjemplo,`. El import queda:

```ts
import {
  obtenerIngresos,
  obtenerDeudas,
  crearIngreso,
  crearDeuda,
  actualizarDeuda,
  eliminarDeuda,
  obtenerResumenFinanciero,
  formatearMoneda,
  type Ingreso,
  type Deuda,
  type NuevoIngreso,
  type NuevaDeuda,
  type ResumenFinanciero,
} from '@/lib/services/ingresos-deudas';
```

2. Justo antes del bloque `// ============================================` / `// INTERFACE DEL HOOK`, agregar:

```ts
// ============================================
// CARGA (sin efectos secundarios)
// ============================================

/**
 * Lee ingresos, deudas y el resumen del usuario autenticado. Solo lee:
 * un usuario sin datos se queda sin datos (nunca se le siembra nada).
 */
export async function cargarIngresosDeudas(): Promise<{
  ingresos: Ingreso[];
  deudas: Deuda[];
  resumen: ResumenFinanciero;
}> {
  const [ingresos, deudas, resumen] = await Promise.all([
    obtenerIngresos(),
    obtenerDeudas(),
    obtenerResumenFinanciero(),
  ]);
  return { ingresos, deudas, resumen };
}
```

3. Reemplazar el cuerpo de `cargarDatos` (líneas 82-112) por:

```ts
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { ingresos: ingresosData, deudas: deudasData, resumen: resumenData } =
        await cargarIngresosDeudas();

      setIngresos(ingresosData);
      setDeudas(deudasData);
      setResumen(resumenData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error al cargar datos:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);
```

4. Borrar completo el bloque `// FUNCIÓN PARA INICIALIZAR DATOS` con `const inicializarDatos = useCallback(…, [cargarDatos, ingresos.length, deudas.length]);` (líneas 114-137, incluidos sus comentarios separadores).

5. Reemplazar el efecto de montaje (líneas 143-146) por:

```ts
  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);
```

- [x] **Step 5: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/hooks/useIngresosDeudas.test.ts`
Expected: PASS (2 tests).

- [x] **Step 6: Verificar tipos y que no quedan llamadas**

Run: `builtin cd <raíz-del-repo> && bun run type-check && grep -rn --exclude='*.test.ts' "inicializarDatosEjemplo\|inicializarDatos\b" src`
Expected: `tsc --noEmit` sin errores; el `grep` no imprime nada (sale con código 1). Los tests se excluyen porque `useIngresosDeudas.test.ts` nombra la función para afirmar que no existe.

- [x] **Step 7: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/services/ingresos-deudas.ts src/hooks/useIngresosDeudas.ts src/hooks/useIngresosDeudas.test.ts && git commit -m "$(cat <<'EOF'
fix(multiusuario): un usuario sin ingresos ni deudas ya no recibe datos de ejemplo

Se elimina inicializarDatosEjemplo, que insertaba los ingresos y deudas del
dueño a cualquier cuenta vacía. useIngresosDeudas solo lee, a través de
cargarIngresosDeudas, y el test confirma que no hay inserts.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Sidebar sin presupuesto mock

**Files:**
- Modify: `src/components/organisms/Sidebar/Sidebar.tsx:5-6,35,59,161-181,274-276`
- Delete: `src/hooks/useBudgetData.ts`
- Test: `src/components/organisms/Sidebar/Sidebar.test.ts`

**Interfaces:**
- Consumes: nada de la Task 1.
- Produces: `Sidebar` conserva sus props (`collapsed?`, `onToggle?`). El hook `useBudgetData` y sus tipos `BudgetItem`/`BudgetSummary` de `src/hooks/useBudgetData.ts` dejan de existir (no tienen otros usuarios).

- [x] **Step 1: Escribir el test que falla**

Crear `src/components/organisms/Sidebar/Sidebar.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// El entorno de vitest es `node` (sin DOM ni Testing Library): se verifica
// el código fuente. vitest corre desde la raíz del repo.
const raiz = process.cwd();
const sidebar = readFileSync(
  resolve(raiz, 'src/components/organisms/Sidebar/Sidebar.tsx'),
  'utf8',
);

describe('Sidebar sin presupuesto de ejemplo', () => {
  it('no usa el hook del presupuesto mock', () => {
    expect(sidebar).not.toContain('useBudgetData');
  });

  it('no muestra montos de presupuesto', () => {
    expect(sidebar).not.toContain('formatCurrency');
    expect(sidebar).not.toContain('summary.');
  });

  it('el hook del mock ya no existe', () => {
    expect(existsSync(resolve(raiz, 'src/hooks/useBudgetData.ts'))).toBe(
      false,
    );
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/components/organisms/Sidebar/Sidebar.test.ts`
Expected: FAIL en los 3 tests (`expected '…useBudgetData…' not to contain 'useBudgetData'`, idem `formatCurrency`, y `expected true to be false`).

- [x] **Step 3: Quitar el mock del Sidebar**

En `src/components/organisms/Sidebar/Sidebar.tsx`:

1. Comentario de cabecera, líneas 4-6. Reemplazar:

```ts
 * Navegación principal en una barra lateral fija a la izquierda (escritorio):
 * logo, usuario, enlaces con icono, resumen de presupuesto, selector de año y
 * acceso a ajustes/cerrar sesión. La sección activa queda resaltada.
```

por:

```ts
 * Navegación principal en una barra lateral fija a la izquierda (escritorio):
 * logo, usuario, enlaces con icono, selectores de mes y año y acceso a
 * ajustes/cerrar sesión. La sección activa queda resaltada. No muestra
 * montos: los totales reales están en el dashboard y en presupuesto.
```

2. Borrar la línea 35: `import { useBudgetData } from '@/hooks/useBudgetData';`

3. Borrar la línea 59: `  const { summary, formatCurrency, isLoading } = useBudgetData();`

4. Borrar completo el bloque de las líneas 161-181:

```tsx
        {/* Resumen de presupuesto */}
        <div className="mx-3 mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-300">
              <Wallet className="h-3.5 w-3.5 text-blue-400" />
              Total
            </span>
            <span className="font-semibold text-white">
              {isLoading ? '...' : formatCurrency(summary.totalBudget)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-gray-300">
              <TrendingUp className="h-3.5 w-3.5 text-green-400" />
              Gastado
            </span>
            <span className="font-semibold text-white">
              {isLoading ? '...' : formatCurrency(summary.totalSpent)}
            </span>
          </div>
        </div>
```

(`Wallet` y `TrendingUp` siguen importados: los usan `NAV_ITEMS` para Gastos e Ingresos.)

5. En la barra superior móvil, reemplazar:

```tsx
          <span className="text-xs text-gray-300">
            {isLoading ? '...' : formatCurrency(summary.totalSpent)}
          </span>
```

por un espaciador del ancho del botón de menú, para que el título siga centrado:

```tsx
          {/* Espaciador del ancho del botón de menú: mantiene el título centrado */}
          <span className="w-[38px]" aria-hidden="true" />
```

- [x] **Step 4: Borrar el hook del mock**

Run: `builtin cd <raíz-del-repo> && git rm src/hooks/useBudgetData.ts`
Expected: `rm 'src/hooks/useBudgetData.ts'`.

- [x] **Step 5: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/components/organisms/Sidebar/Sidebar.test.ts && bun run type-check && grep -rn --exclude='*.test.ts' "useBudgetData" src`
Expected: PASS (3 tests); `tsc` sin errores; el `grep` no imprime nada.

- [x] **Step 6: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/components/organisms/Sidebar/Sidebar.tsx src/components/organisms/Sidebar/Sidebar.test.ts && git commit -m "$(cat <<'EOF'
fix(multiusuario): el sidebar deja de mostrar un presupuesto inventado

La tarjeta Total/Gastado y el monto de la barra móvil salían de un mock con
cifras del dueño (useBudgetData). Se quitan y se borra el hook, que no tenía
otros usuarios; los totales reales siguen en dashboard y presupuesto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Valores por defecto del formulario de gastos (módulo puro)

**Files:**
- Modify: `src/lib/constants/expense-categories.ts` (agregar `DEFAULT_ACCOUNT_NAME`; `ACCOUNT_TYPES` se borra en la Task 4)
- Create: `src/lib/expense-form-defaults.ts`
- Test: `src/lib/expense-form-defaults.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces (los usa la Task 4):
  - `export const DEFAULT_ACCOUNT_NAME = 'Efectivo'` en `src/lib/constants/expense-categories.ts`.
  - En `src/lib/expense-form-defaults.ts`:
    - `export const NO_CATEGORIES_LABEL = 'Primero crea una categoría'`
    - `export function pickDefaultAccount(accountNames: readonly string[]): string`
    - `export function pickDefaultCategory(categoryNames: readonly string[]): string`
    - `export function buildAccountOptions(accountNames: readonly string[], current?: string): string[]`
    - `export interface ExpenseFormDefaultsInput { categoryNames: readonly string[]; accountNames: readonly string[] }`
    - `export function withFormDefaults<T extends { category_name: string; account_name: string }>(form: T, input: ExpenseFormDefaultsInput): T` — devuelve **la misma referencia** si no cambia nada (evita re-renders en bucle).

- [x] **Step 1: Escribir el test que falla**

Crear `src/lib/expense-form-defaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';

import {
  buildAccountOptions,
  NO_CATEGORIES_LABEL,
  pickDefaultAccount,
  pickDefaultCategory,
  withFormDefaults,
} from './expense-form-defaults';

describe('DEFAULT_ACCOUNT_NAME', () => {
  it('es Efectivo', () => {
    expect(DEFAULT_ACCOUNT_NAME).toBe('Efectivo');
  });
});

describe('NO_CATEGORIES_LABEL', () => {
  it('es el texto del contrato', () => {
    expect(NO_CATEGORIES_LABEL).toBe('Primero crea una categoría');
  });
});

describe('pickDefaultAccount', () => {
  it('prefiere Efectivo si el usuario la tiene', () => {
    expect(pickDefaultAccount(['Cuenta A', 'Efectivo', 'Tarjeta B'])).toBe(
      'Efectivo',
    );
  });

  it('reconoce Efectivo sin importar mayúsculas y devuelve el nombre del usuario', () => {
    // La RPC busca la cuenta por nombre exacto: devolver 'Efectivo' aquí
    // crearía una cuenta duplicada.
    expect(pickDefaultAccount(['Cuenta A', 'efectivo'])).toBe('efectivo');
  });

  it('sin Efectivo, usa la primera cuenta del usuario', () => {
    expect(pickDefaultAccount(['Tarjeta B', 'Cuenta A'])).toBe('Tarjeta B');
  });

  it('sin cuentas, usa Efectivo (la RPC la crea al guardar)', () => {
    expect(pickDefaultAccount([])).toBe('Efectivo');
  });
});

describe('pickDefaultCategory', () => {
  it('usa la primera categoría del usuario', () => {
    expect(pickDefaultCategory(['HOGAR', 'COMIDA'])).toBe('HOGAR');
  });

  it('sin categorías, queda vacía', () => {
    expect(pickDefaultCategory([])).toBe('');
  });
});

describe('buildAccountOptions', () => {
  it('ofrece solo las cuentas del usuario', () => {
    expect(buildAccountOptions(['Cuenta A', 'Tarjeta B'])).toEqual([
      'Cuenta A',
      'Tarjeta B',
    ]);
  });

  it('sin cuentas, ofrece solo Efectivo', () => {
    expect(buildAccountOptions([])).toEqual(['Efectivo']);
  });

  it('agrega la cuenta actual si ya no está activa (edición de un gasto viejo)', () => {
    expect(buildAccountOptions(['Cuenta A'], 'Cuenta vieja')).toEqual([
      'Cuenta A',
      'Cuenta vieja',
    ]);
  });

  it('no duplica la cuenta actual ni agrega una vacía', () => {
    expect(buildAccountOptions(['Cuenta A'], 'Cuenta A')).toEqual([
      'Cuenta A',
    ]);
    expect(buildAccountOptions(['Cuenta A'], '')).toEqual(['Cuenta A']);
  });
});

describe('withFormDefaults', () => {
  const vacio = { description: '', category_name: '', account_name: '' };

  it('completa categoría y cuenta vacías con los valores por defecto', () => {
    expect(
      withFormDefaults(vacio, {
        categoryNames: ['HOGAR', 'COMIDA'],
        accountNames: ['Cuenta A', 'Efectivo'],
      }),
    ).toEqual({ description: '', category_name: 'HOGAR', account_name: 'Efectivo' });
  });

  it('respeta lo que el usuario ya eligió y devuelve el mismo objeto', () => {
    const form = { ...vacio, category_name: 'COMIDA', account_name: 'Cuenta A' };
    const r = withFormDefaults(form, {
      categoryNames: ['HOGAR', 'COMIDA'],
      accountNames: ['Cuenta A', 'Efectivo'],
    });
    expect(r).toBe(form);
  });

  it('reemplaza una cuenta que no está entre las opciones del usuario', () => {
    // Pasa cuando el formulario arrancó con Efectivo antes de cargar las
    // cuentas y el usuario no tiene Efectivo.
    const form = { ...vacio, category_name: 'HOGAR', account_name: 'Efectivo' };
    expect(
      withFormDefaults(form, {
        categoryNames: ['HOGAR'],
        accountNames: ['Tarjeta B'],
      }).account_name,
    ).toBe('Tarjeta B');
  });

  it('reemplaza una categoría que el usuario no tiene', () => {
    const form = { ...vacio, category_name: 'OTRA', account_name: 'Efectivo' };
    expect(
      withFormDefaults(form, { categoryNames: ['HOGAR'], accountNames: [] })
        .category_name,
    ).toBe('HOGAR');
  });

  it('sin categorías, la categoría queda vacía y la cuenta en Efectivo', () => {
    expect(
      withFormDefaults(vacio, { categoryNames: [], accountNames: [] }),
    ).toEqual({ description: '', category_name: '', account_name: 'Efectivo' });
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/expense-form-defaults.test.ts`
Expected: FAIL con `Failed to resolve import "./expense-form-defaults"` (o `Cannot find module`).

- [x] **Step 3: Agregar `DEFAULT_ACCOUNT_NAME`**

En `src/lib/constants/expense-categories.ts`, justo después del cierre de `EXPENSE_CATEGORIES` (`] as const;` de la línea 13) y antes de `// Tipos de cuenta predefinidos`, agregar:

```ts

// Cuenta por defecto de un gasto. Si el usuario no tiene una cuenta con este
// nombre, la RPC que guarda el gasto la crea.
export const DEFAULT_ACCOUNT_NAME = 'Efectivo';
```

(`ACCOUNT_TYPES` todavía no se borra: `/gastos` lo usa hasta la Task 4.)

- [x] **Step 4: Crear el módulo**

Crear `src/lib/expense-form-defaults.ts`:

```ts
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
  const efectivo = accountNames.find(
    n => n.trim().toLowerCase() === objetivo,
  );
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
```

- [x] **Step 5: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/expense-form-defaults.test.ts && bun run type-check`
Expected: PASS (17 tests); `tsc` sin errores.

- [x] **Step 6: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/constants/expense-categories.ts src/lib/expense-form-defaults.ts src/lib/expense-form-defaults.test.ts && git commit -m "$(cat <<'EOF'
feat(gastos): valores por defecto del formulario a partir de los datos del usuario

DEFAULT_ACCOUNT_NAME = 'Efectivo' y un módulo puro con pickDefaultAccount,
pickDefaultCategory, buildAccountOptions y withFormDefaults, con tests.
Todavía no se usa en /gastos.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: /gastos con las cuentas y categorías del usuario; fuera `ACCOUNT_TYPES`

**Files:**
- Modify: `src/lib/constants/expense-categories.ts` (borrar `ACCOUNT_TYPES` y `AccountType`)
- Modify: `src/lib/services/expenses.ts:63-72`
- Modify: `src/app/gastos/page.tsx` (líneas indicadas en cada paso)
- Modify: `src/components/organisms/ExpenseModal/ExpenseModal.tsx`
- Modify (comentarios): `src/components/molecules/ExpenseFormFields/ExpenseFormFields.tsx:13-18`, `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx:42-44`
- Test: `src/lib/constants/expense-categories.test.ts`

**Interfaces:**
- Consumes (Task 3): `DEFAULT_ACCOUNT_NAME`, `NO_CATEGORIES_LABEL`, `pickDefaultAccount`, `buildAccountOptions`, `withFormDefaults` con las firmas de la Task 3.
- Produces: `ExpenseModal` acepta dos props opcionales nuevas: `submitDisabled?: boolean` y `submitDisabledLabel?: string`. Los demás usuarios de `ExpenseModal` no cambian (las props son opcionales).

- [x] **Step 1: Escribir el test que falla**

Crear `src/lib/constants/expense-categories.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import * as constantes from './expense-categories';

describe('constantes de gastos', () => {
  it('no trae una lista fija de cuentas', () => {
    expect(constantes).not.toHaveProperty('ACCOUNT_TYPES');
  });

  it('exporta la cuenta por defecto', () => {
    expect(constantes.DEFAULT_ACCOUNT_NAME).toBe('Efectivo');
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/constants/expense-categories.test.ts`
Expected: FAIL en `no trae una lista fija de cuentas` con `expected { …, ACCOUNT_TYPES: [...] } to not have property "ACCOUNT_TYPES"`; el segundo test pasa.

- [x] **Step 3: Borrar `ACCOUNT_TYPES` y `AccountType`**

En `src/lib/constants/expense-categories.ts`, borrar:

```ts
// Tipos de cuenta predefinidos
export const ACCOUNT_TYPES = [
  'Nequi',
  'TC Falabella',
  'Efectivo',
  'Banco Santander',
  'TC NU',
  'Ahorros Nu',
] as const;
```

y la última línea:

```ts
export type AccountType = (typeof ACCOUNT_TYPES)[number];
```

El archivo queda así:

```ts
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
```

- [x] **Step 4: Quitar el re-export en el servicio de gastos**

En `src/lib/services/expenses.ts`, reemplazar:

```ts
// Categorías y tipos de cuenta: definidos en un módulo puro (sin side-effects)
// y re-exportados aquí para conservar la API pública de este servicio.
export {
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
} from '@/lib/constants/expense-categories';
export type {
  ExpenseCategory,
  AccountType,
} from '@/lib/constants/expense-categories';
```

por:

```ts
// Categorías: definidas en un módulo puro (sin side-effects) y re-exportadas
// aquí para conservar la API pública de este servicio. Las cuentas salen de
// la tabla `accounts` del usuario (getUserAccounts), no de una lista fija.
export { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
export type { ExpenseCategory } from '@/lib/constants/expense-categories';
```

- [x] **Step 5: Correr el test de constantes**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/constants/expense-categories.test.ts`
Expected: PASS (2 tests). (`type-check` todavía falla por `/gastos`; se arregla en los pasos siguientes.)

- [x] **Step 6: `ExpenseModal` con botón deshabilitable**

En `src/components/organisms/ExpenseModal/ExpenseModal.tsx`:

1. En el comentario de cabecera, reemplazar las líneas del `@example`:

```ts
 *   expenseCategories={EXPENSE_CATEGORIES}
 *   accountTypes={ACCOUNT_TYPES}
```

por:

```ts
 *   expenseCategories={categoryNames}
 *   accountTypes={buildAccountOptions(accountNames, form.account_name)}
 *   submitDisabled={categoryNames.length === 0}
 *   submitDisabledLabel={NO_CATEGORIES_LABEL}
```

y agregar, después de ` * @param onClose - Función para cerrar el modal`:

```ts
 * @param submitDisabled - Deshabilita el botón de guardar
 * @param submitDisabledLabel - Texto del botón mientras está deshabilitado
```

2. Agregar el import de `Link` como primer import de terceros, justo después de `import React, { useState } from 'react';` y su línea en blanco:

```ts
import React, { useState } from 'react';

import Link from 'next/link';

import Button from '@/components/atoms/Button/Button';
```

3. En `interface ExpenseModalProps`, después de `creditAccounts?: string[];`, agregar:

```ts
  /** Deshabilita el botón de guardar (p. ej. el usuario no tiene categorías). */
  submitDisabled?: boolean;
  /** Texto del botón de guardar mientras está deshabilitado. */
  submitDisabledLabel?: string;
```

4. En la desestructuración de props, después de `onCufeSaved,`, agregar:

```ts
  submitDisabled = false,
  submitDisabledLabel,
```

5. Reemplazar el bloque de botones:

```tsx
            {/* Botones de acción */}
            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-600 text-slate-300"
              >
                Cancelar
              </Button>
              <Button type="submit" variant="gradient">
                {isEditing ? 'Actualizar' : 'Agregar'} Gasto
              </Button>
            </div>
```

por:

```tsx
            {submitDisabled && (
              <p className="pt-4 text-sm text-amber-300">
                Aún no tienes categorías para clasificar el gasto.{' '}
                <Link href="/settings" className="underline">
                  Créala en Ajustes
                </Link>
                .
              </p>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-600 text-slate-300"
              >
                Cancelar
              </Button>
              <Button type="submit" variant="gradient" disabled={submitDisabled}>
                {submitDisabled && submitDisabledLabel
                  ? submitDisabledLabel
                  : `${isEditing ? 'Actualizar' : 'Agregar'} Gasto`}
              </Button>
            </div>
```

- [x] **Step 7: Comentarios que nombraban `ACCOUNT_TYPES`**

En `src/components/molecules/ExpenseFormFields/ExpenseFormFields.tsx`, en el `@example` del encabezado, reemplazar:

```ts
 *   expenseCategories={EXPENSE_CATEGORIES}
 *   accountTypes={ACCOUNT_TYPES}
```

por:

```ts
 *   expenseCategories={categoryNames}
 *   accountTypes={buildAccountOptions(accountNames, form.account_name)}
```

En `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx`, reemplazar:

```ts
  // Cuentas reales del usuario (tabla `accounts`), no la lista fija de
  // ACCOUNT_TYPES: con esa, rescatar una factura la registraría con una
  // cuenta que puede no existir para el usuario.
```

por:

```ts
  // Cuentas reales del usuario (tabla `accounts`), no una lista fija: con
  // esa, rescatar una factura la registraría con una cuenta que puede no
  // existir para el usuario.
```

- [x] **Step 8: `/gastos` — imports y categorías memorizadas**

En `src/app/gastos/page.tsx`:

1. Línea 12, agregar `useMemo`:

```ts
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
```

2. Después de `import { createBudgetItemInMonth } from '@/lib/actions/categories';` agregar:

```ts
import {
  buildAccountOptions,
  NO_CATEGORIES_LABEL,
  pickDefaultAccount,
  withFormDefaults,
} from '@/lib/expense-form-defaults';
```

3. En el import de `@/lib/services/expenses` (líneas 33-45), borrar la línea `  ACCOUNT_TYPES,`. Queda:

```ts
import {
  createExpenseTransaction,
  classifyExpensesOnServer,
  updateExpenseTransaction,
  formatCurrency,
  formatMonthName,
  ExpenseTransaction,
  getBudgetItemsForMonth,
  assignExpenseToBudgetItem,
  getUserAccounts,
  type BudgetItemRef,
} from '@/lib/services/expenses';
```

4. Reemplazar (líneas 172-174):

```ts
  // Cargar categorías dinámicas desde la BD
  const { categories: budgetCategories } = useCategories();
  const categoryNames = budgetCategories.map(c => c.name.toUpperCase());
```

por:

```ts
  // Cargar categorías dinámicas desde la BD. Memorizadas: el efecto que
  // completa los valores por defecto del formulario depende de ellas.
  const { categories: budgetCategories } = useCategories();
  const categoryNames = useMemo(
    () => budgetCategories.map(c => c.name.toUpperCase()),
    [budgetCategories],
  );
  const hasCategories = categoryNames.length > 0;
```

- [x] **Step 9: `/gastos` — estado inicial y valores por defecto**

Reemplazar el bloque del estado del formulario (líneas 303-312):

```ts
  // Estado del formulario
  const [form, setForm] = useState<FormData>({
    description: '',
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    category_name: '',
    account_name: ACCOUNT_TYPES[0],
    place: '',
  });
```

por:

```ts
  // Formulario en blanco, con la primera categoría del usuario y su cuenta
  // por defecto ("Efectivo" si la tiene, si no la primera).
  const blankForm = (): FormData =>
    withFormDefaults(
      {
        description: '',
        amount: 0,
        transaction_date: new Date().toISOString().slice(0, 10),
        category_name: '',
        account_name: '',
        place: '',
        purchase_total: null,
        installments: null,
      },
      { categoryNames, accountNames },
    );

  // Estado del formulario
  const [form, setForm] = useState<FormData>(blankForm);

  // Las categorías y cuentas llegan después del primer render: al cargarse,
  // completar los valores por defecto sin pisar lo que el usuario ya eligió.
  // En edición no se toca nada: el gasto trae sus propios valores.
  useEffect(() => {
    if (isEditing) return;
    setForm(prev => withFormDefaults(prev, { categoryNames, accountNames }));
  }, [categoryNames, accountNames, isEditing]);
```

- [x] **Step 10: `/gastos` — guardar y cerrar**

1. En `handleSubmitExpense`, después del bloque

```ts
    if (form.amount <= 0) {
      console.warn('❌ El monto debe ser mayor a 0');
      return;
    }
```

agregar:

```ts

    // Sin categoría no se guarda (el botón ya está deshabilitado; esto cubre
    // un envío con Enter).
    if (!form.category_name) {
      toast.error(NO_CATEGORIES_LABEL);
      return;
    }
```

2. En el mismo `handleSubmitExpense`, reemplazar el reseteo:

```ts
      // Resetear formulario
      setForm({
        description: '',
        amount: 0,
        transaction_date: new Date().toISOString().slice(0, 10),
        category_name: categoryNames[0] || '',
        account_name: ACCOUNT_TYPES[0],
        place: '',
        purchase_total: null,
        installments: null,
      });
```

por:

```ts
      // Resetear formulario
      setForm(blankForm());
```

3. Reemplazar `handleCloseModal` completo:

```ts
  const handleCloseModal = () => {
    setForm({
      description: '',
      amount: 0,
      transaction_date: new Date().toISOString().slice(0, 10),
      category_name: categoryNames[0] || '',
      account_name: ACCOUNT_TYPES[0],
      place: '',
    });
    closeModal();
  };
```

por:

```ts
  const handleCloseModal = () => {
    setForm(blankForm());
    closeModal();
  };
```

- [x] **Step 11: `/gastos` — importación de Excel y props del modal**

1. En `processExcelFile`, reemplazar:

```ts
          const accountName =
            accountCol && row[accountCol]
              ? String(row[accountCol]).trim()
              : ACCOUNT_TYPES[0];
```

por:

```ts
          const accountName =
            accountCol && row[accountCol]
              ? String(row[accountCol]).trim()
              : pickDefaultAccount(accountNames);
```

2. En el `<ExpenseModal … />`, reemplazar:

```tsx
          accountTypes={Array.from(
            new Set([...accountNames, ...ACCOUNT_TYPES]),
          )}
```

por:

```tsx
          accountTypes={buildAccountOptions(accountNames, form.account_name)}
          submitDisabled={!hasCategories}
          submitDisabledLabel={NO_CATEGORIES_LABEL}
```

- [x] **Step 12: Verificar tipos, tests y que no queda la lista fija**

Run: `builtin cd <raíz-del-repo> && bun run type-check && bun run test src/lib/constants/expense-categories.test.ts src/lib/expense-form-defaults.test.ts && grep -rn --exclude='*.test.ts' "ACCOUNT_TYPES\|AccountType\b" src`
Expected: `tsc` sin errores; PASS (19 tests); el `grep` no imprime nada.

Nota para eslint (`react-hooks/exhaustive-deps`): `blankForm` no va en ningún array de dependencias; solo se llama en manejadores de eventos y como inicializador de `useState`.

- [x] **Step 13: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/constants/expense-categories.ts src/lib/constants/expense-categories.test.ts src/lib/services/expenses.ts src/app/gastos/page.tsx src/components/organisms/ExpenseModal/ExpenseModal.tsx src/components/molecules/ExpenseFormFields/ExpenseFormFields.tsx src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx && git commit -m "$(cat <<'EOF'
fix(gastos): /gastos usa las cuentas y categorías del usuario, no las del dueño

Se elimina ACCOUNT_TYPES (las cuentas del dueño): guardar un gasto con él le
creaba "Nequi" a cualquier usuario. El formulario arranca con la primera
categoría del usuario y su cuenta por defecto (Efectivo si la tiene, si no la
primera); sin categorías, el botón de guardar queda deshabilitado con
"Primero crea una categoría" y un enlace a Ajustes. La importación de Excel
sin columna de cuenta usa la misma cuenta por defecto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fuera la migración de julio 2025 (contratos §5.2)

**Files:**
- Delete: `src/scripts/migrate-july-data.ts`, `src/scripts/migrate-july-expenses.ts`
- Delete: `src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx`, `src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx`
- Modify: `src/components/organisms/ExpenseHeader/ExpenseHeader.tsx` (cabecera 1-19, import 23, props 28-48, botón 95-107)
- Modify (comentarios): `src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx:8,18`, `src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx:8,16`
- Modify: `.vercelignore:14-16`
- Test: `src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces: `ExpenseHeader` pierde la prop opcional `onShowMigration` (nadie se la pasa: `/gastos` usa `onRefresh`, `onImportExcel`, `onAutoRecategorize`, `isLoading`, `isImporting`, `isRecategorizing`). La prop `migrationPanel` de las plantillas **se queda**: `/gastos` la usa para `PendingInvoicesPanel` y `UnclassifiedExpensesPanel`; solo cambia su comentario. `BudgetStatusPanels.tsx` también menciona `'2025-07'`, pero lo reescribe entero S10; aquí no se toca.

- [x] **Step 1: Confirmar que nada importa lo que se va a borrar**

Run: `builtin cd <raíz-del-repo> && grep -rn --exclude='*.test.ts' "migrate-july\|migrateJulyData\|checkMigrationStatus\|ExpenseMigrationPanel\|BudgetMigrationPanel\|onShowMigration" src .vercelignore`
Expected: solo coincidencias dentro de los 4 archivos que se borran, en `ExpenseHeader.tsx` (prop `onShowMigration`), en los `@example` de `ExpensePageTemplate.tsx:18` y `BudgetPageTemplate.tsx:16`, y en `.vercelignore:15-16`. **Ningún `import`** de esos módulos fuera de sí mismos. Si aparece un `import` en otro archivo, detente y repórtalo (no borres nada).

- [x] **Step 2: Escribir el test que falla**

Crear `src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (vitest corre en `node`, sin DOM): se verifica el código
// fuente. vitest corre desde la raíz del repo.
const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

describe('sin la migración de julio 2025 (contratos §5.2)', () => {
  it.each([
    'src/scripts/migrate-july-data.ts',
    'src/scripts/migrate-july-expenses.ts',
    'src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx',
    'src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx',
  ])('%s ya no existe', ruta => {
    expect(existsSync(resolve(raiz, ruta))).toBe(false);
  });

  it('ExpenseHeader no tiene el botón atado a 2025-07', () => {
    const header = leer(
      'src/components/organisms/ExpenseHeader/ExpenseHeader.tsx',
    );
    expect(header).not.toContain('2025-07');
    expect(header).not.toContain('onShowMigration');
    expect(header).not.toContain('Migrar Julio');
  });

  it('las plantillas ya no citan los paneles borrados', () => {
    for (const ruta of [
      'src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx',
      'src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx',
    ]) {
      const fuente = leer(ruta);
      expect(fuente).not.toContain('ExpenseMigrationPanel');
      expect(fuente).not.toContain('BudgetMigrationPanel');
    }
  });
});
```

- [x] **Step 3: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts`
Expected: FAIL en los 6 tests (4 × `expected true to be false`, `expected '…2025-07…' not to contain '2025-07'` y `expected '…ExpenseMigrationPanel…' not to contain 'ExpenseMigrationPanel'`).

- [x] **Step 4: Borrar scripts y paneles**

Run: `builtin cd <raíz-del-repo> && git rm src/scripts/migrate-july-data.ts src/scripts/migrate-july-expenses.ts src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx`
Expected: cuatro líneas `rm '…'`. Las carpetas `src/scripts/`, `ExpenseMigrationPanel/` y `BudgetMigrationPanel/` quedan vacías y git deja de verlas.

- [x] **Step 5: `ExpenseHeader` sin el botón de julio**

En `src/components/organisms/ExpenseHeader/ExpenseHeader.tsx`:

1. Reemplazar el comentario de cabecera completo (líneas 1-19) por:

```ts
/**
 * ExpenseHeader - Organism Level
 *
 * Header principal de la página de gastos con título, mes seleccionado y
 * botones de importar Excel, auto-categorizar y actualizar.
 *
 * @param selectedMonth - Mes seleccionado actualmente
 * @param onRefresh - Función para actualizar los datos
 * @param isLoading - Estado de carga
 *
 * @example
 * <ExpenseHeader
 *   selectedMonth="2026-09"
 *   onRefresh={refreshExpenses}
 *   isLoading={loading}
 * />
 */
```

2. En el import de iconos, quitar `Database`:

```ts
import { RefreshCw, Upload, Tags } from 'lucide-react';
```

3. En `interface ExpenseHeaderProps`, borrar la línea `  onShowMigration?: () => void;`.

4. En la desestructuración de props, borrar la línea `  onShowMigration,`.

5. Borrar completo el bloque (y la línea en blanco que lo sigue):

```tsx
        {/* Botón de migración julio */}
        {selectedMonth === '2025-07' && onShowMigration && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowMigration}
            disabled={isLoading}
            className="flex items-center gap-2 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
          >
            <Database className="w-4 h-4" />
            Migrar Julio
          </Button>
        )}
```

(`selectedMonth` sigue en uso: lo muestra el subtítulo con `formatMonthName`.)

- [x] **Step 6: Comentarios de las plantillas y `.vercelignore`**

En `src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx`, reemplazar:

```ts
 * @param migrationPanel - Panel de migración de datos (opcional)
```

por:

```ts
 * @param migrationPanel - Paneles extra sobre la tabla (opcional; p. ej. facturas pendientes)
```

y reemplazar:

```ts
 *   migrationPanel={<ExpenseMigrationPanel />}
```

por:

```ts
 *   migrationPanel={<PendingInvoicesPanel />}
```

En `src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx`, reemplazar:

```ts
 * @param migrationPanel - Panel de migración de datos (opcional)
```

por:

```ts
 * @param migrationPanel - Panel extra sobre la tabla (opcional)
```

y borrar la línea:

```ts
 *   migrationPanel={<BudgetMigrationPanel />}
```

En `.vercelignore`, borrar estas tres líneas (y la línea en blanco que las sigue):

```
# Scripts de migración (no necesarios en producción)
/src/scripts/migrate-july-data.ts
/src/scripts/migrate-july-expenses.ts
```

- [x] **Step 7: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts && bun run type-check && grep -rn --exclude='*.test.ts' "migrate-july\|migrateJulyData\|checkMigrationStatus\|ExpenseMigrationPanel\|BudgetMigrationPanel\|onShowMigration" src .vercelignore`
Expected: PASS (6 tests); `tsc` sin errores; el `grep` no imprime nada (sale con código 1).

- [x] **Step 8: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/components/organisms/ExpenseHeader/ExpenseHeader.tsx src/components/organisms/ExpenseHeader/ExpenseHeader.test.ts src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx .vercelignore && git commit -m "$(cat <<'EOF'
fix(multiusuario): fuera la migración de datos de julio 2025 del dueño

Se borran los scripts migrate-july-* (gastos y presupuesto de ejemplo del
dueño), los paneles ExpenseMigrationPanel y BudgetMigrationPanel, que no se
usaban, y el botón "Migrar Julio" de ExpenseHeader. Nada los importaba.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(Los `git rm` del Step 4 ya dejaron los borrados en el índice.)

---

### Task 6: Verificación final

**Files:** ninguno (solo verificación).

**Interfaces:** ninguna.

- [x] **Step 1: Suite completa y tipos**

Run: `builtin cd <raíz-del-repo> && bun run test && bun run type-check`
Expected: todos los tests en verde (incluidos los 5 archivos nuevos) y `tsc` sin errores.

- [x] **Step 2: Nada del dueño queda en los puntos de la historia**

Run: `builtin cd <raíz-del-repo> && grep -rn --exclude='*.test.ts' "inicializarDatosEjemplo\|useBudgetData\|ACCOUNT_TYPES\|mockBudgetItems\|mockIncomeData\|migrate-july\|MigrationPanel\|onShowMigration" src`
Expected: no imprime nada (sale con código 1).

- [x] **Step 3: Lint de los archivos tocados**

Run: `builtin cd <raíz-del-repo> && bunx eslint src/app/gastos/page.tsx src/components/organisms/ExpenseModal/ExpenseModal.tsx src/components/organisms/Sidebar/Sidebar.tsx src/components/organisms/ExpenseHeader/ExpenseHeader.tsx src/hooks/useIngresosDeudas.ts src/lib/expense-form-defaults.ts src/lib/constants/expense-categories.ts src/lib/services/expenses.ts src/lib/services/ingresos-deudas.ts`
Expected: sin errores (advertencias preexistentes del archivo se aceptan si no vienen de líneas nuevas).

- [ ] **Step 4: Prueba manual (solo humano, opcional; nunca producción)**

El implementador **no** corre `bun run dev` ni `next build`: `.env.local` apunta a producción (contratos §5.0). La prueba la hace el humano en un entorno con base de desarrollo (o en S14), con una cuenta de prueba **sin datos**:
1. Entrar a `/ingresos` y `/deudas`: siguen vacías después de recargar (no aparecen ingresos ni deudas de ejemplo).
2. Sidebar de escritorio: no hay tarjeta "Total / Gastado". Barra móvil: el título "Presupuesto" sigue centrado y no hay monto.
3. `/gastos` → "Agregar gasto": el selector de cuenta ofrece solo "Efectivo"; el botón dice "Primero crea una categoría", está deshabilitado y hay un enlace a Ajustes.
4. Crear una categoría en Ajustes, volver a `/gastos`: la categoría aparece seleccionada y el botón dice "Agregar Gasto". Guardar un gasto: en Ajustes aparece la cuenta "Efectivo" (creada por la RPC) y ninguna cuenta de otra persona.

No hay commit en esta tarea.

---

## Autorrevisión

- **Cobertura de criterios de la épica (S07):** siembra eliminada + test sin inserts → Task 1; mock fuera del sidebar → Task 2; `ACCOUNT_TYPES` eliminado y `/gastos` con cuentas del usuario y `DEFAULT_ACCOUNT_NAME` → Tasks 3 y 4; `category_name` inicial = primera categoría y guardar deshabilitado con "Primero crea una categoría" (etiqueta del botón) más aviso con enlace a `/settings` → Tasks 3 y 4; scripts `migrate-july-*`, paneles sin uso y botón `'2025-07'` de `ExpenseHeader` → Task 5. Contrato §2.6 + §5.2 completos, incluido "si el hook queda sin uso, se borra" (Task 2, Step 4).
- **Marcadores:** ninguno; todo el código de cada paso está escrito.
- **Consistencia de nombres:** `DEFAULT_ACCOUNT_NAME`, `NO_CATEGORIES_LABEL`, `pickDefaultAccount`, `pickDefaultCategory`, `buildAccountOptions`, `withFormDefaults`, `ExpenseFormDefaultsInput`, `cargarIngresosDeudas`, `submitDisabled`, `submitDisabledLabel` se usan igual en todas las tareas. S07 abre el flujo APP (§5.3) y no depende de ninguna historia. Después: S08 (su grep final ya no espera `migrate-july-data.ts`), S10 (quita `/test` de `Sidebar.tsx`, agrega un `useEffect` a `gastos/page.tsx` y reescribe `BudgetStatusPanels.tsx`, donde queda el otro `'2025-07'`) y S11 (usa `DEFAULT_ACCOUNT_NAME` en la bienvenida).
