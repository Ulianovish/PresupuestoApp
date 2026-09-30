# S11 — Bienvenida: plan de implementación

> **Alineado con contratos v2 (§5).** §5.2 (`suggest503020` con 'Calidad de Vida' en el 30 % y el 20 % siempre a ahorro; `ensureStarterKitAction` nunca lanza y la crea S10) y §5.3 (flujo APP: S07 → S08 → S10 → S13 → **S11** → S12) prevalecen sobre §2.7 y §4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una persona recién registrada entra a `/bienvenida`, pasa por tres pasos saltables (ingreso mensual, montos del presupuesto con sugerencia 50/30/20, primer gasto o vinculación de WhatsApp) y termina en `/dashboard` con `profiles.onboarding_completed_at` marcado.

**Architecture:** `/bienvenida` es un server component que valida la sesión, salta al dashboard si el onboarding ya terminó, repara el kit con `ensureStarterKitAction()` y carga los rubros del mes con `loadWizardData` (RPC `get_budget_by_month` + `categories`). Un componente cliente `OnboardingWizard` lleva el estado de los tres pasos y llama acciones de servidor de `src/lib/actions/onboarding.ts` (cliente de cookie, RLS, filtro explícito por `user_id`). El cálculo 50/30/20 es una función pura (`suggest503020`). El primer gasto reusa `createExpenseTransaction` de `src/lib/services/expenses.ts` (el mismo camino que `/gastos`, que ya clasifica el gasto) con import dinámico; el WhatsApp reusa `generateWhatsAppLinkCodeAction` y `buildWhatsAppLinkUrl`.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, Supabase (`@supabase/ssr`), zod 4, vitest 4 (environment `node`), Tailwind, sonner, bun.

**Depende de (flujo APP, ya hechas en este worktree, §5.3):** S07 (`DEFAULT_ACCOUNT_NAME`), S10 (`src/lib/actions/onboarding.ts` con `ensureStarterKitAction` v2 y su test) y S13 (`buildWhatsAppLinkUrl`). La Task 2 verifica que existan; este plan no las vuelve a crear.
**De otros flujos (no están en este worktree; todo compila y los tests pasan sin ellas, con el cliente mockeado):** S09 (columnas `onboarding_completed_at`/`onboarding_dismissed_at` y RPC `ensure_starter_kit`, flujo SEG) y S04 (`/auth/confirm` redirige a `/bienvenida`; `middleware.ts` protege `/bienvenida`, flujo AUTH).

## Global Constraints

- Contratos: `docs/agile/contracts.md` §0, §1.2, §1.3, §2.7 y §2.8, con las enmiendas §5.0–§5.3 (prevalecen). Nombres exactos: `suggest503020`, `KitItem`, `ensureStarterKitAction`, `saveOnboardingIncomeAction`, `saveOnboardingBudgetAction`, `completeOnboardingAction`, `dismissChecklistAction`, `buildWhatsAppLinkUrl`.
- Textos de UI y errores en español colombiano, tuteo ("tú", nunca "vos").
- Mes actual = `todayBogota().slice(0, 7)` (`src/lib/whatsapp/format.ts`). Fecha de hoy = `todayBogota()`.
- Montos en pesos enteros (COP). En la UI se usa `CurrencyInput` (`src/components/atoms/CurrencyInput/CurrencyInput.tsx`, que ya parsea con `parse-cop`) y `formatCOP` (`src/lib/whatsapp/format.ts`) para mostrar. No se escribe otro parser ni formateador.
- Acciones de servidor: cliente de cookie `createClient()` de `src/lib/supabase/server.ts` + `auth.getUser()`; sin sesión → `{ ok: false, error: 'No autenticado' }` (o redirección donde el contrato devuelve `void`). Nunca `createAdminClient()`.
- Logs: solo `error.code`. Ningún monto, correo, teléfono ni mensaje crudo de Postgres en logs.
- Tests: cliente de Supabase mockeado; ningún test toca una base real. Datos de prueba inventados (`00000000-0000-4000-8000-000000000001`, `usuario@ejemplo.com`).
- **No acceder a la base de producción.** `.env.local` apunta a producción (§5.0): no levantar `bun run dev` ni `next build` para "probar" el wizard contra ella (guardaría ingresos, montos y gastos reales). La prueba manual de punta a punta es S14.
- `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` ya existe (S10, §5.2): nunca lanza y no llama `revalidatePath` ni `redirect` (se ejecuta durante el render de `/bienvenida`). S11 no la reescribe y la llama **sin** try/catch.
- Tipos (§5.0): `src/types/database.ts` está desactualizado; **nunca** correr `bun run db:types`. Si una tabla o columna nueva no compila, se tipa a mano en el módulo que la usa.
- Comandos: `bun run test <archivo>`, `bun run type-check`, `bunx eslint <archivos>`. Verificación final: `bun run test && bun run type-check`.
- Commits en español, `git add` de archivos concretos, terminando con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Todos los commits de este plan tocan `src/`, así que pasan por lint-staged (eslint --fix + prettier); si lint-staged falla, corrige el error que reporta y vuelve a hacer commit (no uses `--no-verify` para saltarte un error de lint).

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Crear | `src/lib/onboarding/budget-503020.ts` | `KitItem`, `suggest503020` (puro) |
| Test | `src/lib/onboarding/budget-503020.test.ts` | Grupos, redondeo, grupos vacíos, ingreso 0/negativo |
| Ya existe (S13) | `src/lib/whatsapp/link-url.ts` | `buildWhatsAppLinkUrl` (§2.8); solo se importa |
| Crear | `src/lib/onboarding/wizard-data.ts` | `WizardItem`, `WizardData`, `loadWizardData` (rubros del mes + nombres de categorías) |
| Test | `src/lib/onboarding/wizard-data.test.ts` | Mapeo de filas, filtro por usuario, errores |
| Completar (lo creó S10) | `src/lib/actions/onboarding.ts` | Agrega `saveOnboardingIncomeAction`, `saveOnboardingBudgetAction`, `completeOnboardingAction`, `dismissChecklistAction`; `ensureStarterKitAction` (S10) no se toca |
| Completar (lo creó S10) | `src/lib/actions/onboarding.test.ts` | Cliente falso con `from`; filtro `user_id`, montos inválidos, sin sesión, errores |
| Crear | `src/components/organisms/OnboardingWizard/OnboardingWizard.tsx` | Wizard cliente de 3 pasos |
| Crear | `src/app/bienvenida/page.tsx` | Server component: sesión, redirecciones, kit, datos |

No se modifica ningún otro archivo. `middleware.ts` (proteger `/bienvenida`) es de S04 (flujo AUTH, no está en este worktree); sin él, la página igual redirige a login si no hay sesión.

## Criterios de aceptación

1. `/bienvenida` sin sesión redirige a `/auth/login`; con `onboarding_completed_at` no nulo redirige a `/dashboard`; en otro caso llama `ensureStarterKitAction()` (sin try/catch: nunca lanza) y muestra el wizard.
2. Paso 1 "Tu ingreso": monto (COP) y fuente; "Guardar y seguir" inserta en `ingresos` (`user_id`, `descripcion = 'Ingreso mensual'`, `fuente`, `monto`, `fecha = todayBogota()`, `tipo = 'ingreso'`). "Saltar" pasa al paso 2 sin guardar.
3. Paso 2 "Tu presupuesto": lista los rubros del mes del usuario agrupados por categoría, con su clasificación y un `CurrencyInput` por rubro. Si hay ingreso del paso 1, botón "Sugerir con 50/30/20" que llena los montos con `suggest503020` y muestra "Sin asignar: ahorro". "Guardar y seguir" actualiza solo `budgeted_amount` de rubros del usuario. "Saltar" pasa al paso 3 sin guardar.
4. Paso 3 "Tu primer gasto": formulario corto (monto, descripción, categoría; cuenta Efectivo, fecha de hoy) que guarda con `createExpenseTransaction`, o "Mándalo por WhatsApp" que genera el código con `generateWhatsAppLinkCodeAction` y muestra el enlace `wa.me` de `buildWhatsAppLinkUrl` (sin número del bot: muestra el texto `VINCULAR <código>`). "Saltar" y "Ir a mi tablero" terminan.
5. Terminar (guardar gasto, "Ir a mi tablero" o saltar el paso 3) llama `completeOnboardingAction()`: `onboarding_completed_at = now()` del propio usuario y `redirect('/dashboard')`, aunque el UPDATE falle.
6. `suggest503020` cumple §5.2: 'Basico' 50 %; 'Estilo de Vida' | 'Caprichos' | 'Calidad de Vida' 30 %; el 20 % va **siempre** a `ahorroSinAsignar` (más el porcentaje de cualquier grupo sin ítems); 'Impuestos' y desconocidas 0; reparto igual dentro del grupo redondeado hacia abajo a múltiplos de 1.000; `income <= 0` → todo en 0.
7. Acciones con tests: filtro por `user_id`, montos inválidos (negativos, decimales, NaN, 0 en el ingreso) rechazados sin tocar la base, sin sesión rechazado, error de base → mensaje genérico en español sin datos en el log.
8. `dismissChecklistAction` existe (la crea S11; la usa S12) y `ensureStarterKitAction` existe una sola vez (la creó S10; S11 no la reescribe).
9. `bun run test && bun run type-check` en verde.

---

### Task 1: `suggest503020`

**Files:**
- Create: `src/lib/onboarding/budget-503020.ts`
- Test: `src/lib/onboarding/budget-503020.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `export type KitItem = { id: string; classificationName: string }` y `export function suggest503020(income: number, items: KitItem[]): { amounts: Record<string, number>; ahorroSinAsignar: number }`. `amounts` trae **todas** las ids de `items` (en 0 si no reciben nada).

- [x] **Step 1: Write the failing test**

Crear `src/lib/onboarding/budget-503020.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { suggest503020, type KitItem } from './budget-503020';

const item = (id: string, classificationName: string): KitItem => ({
  id,
  classificationName,
});

describe('suggest503020', () => {
  it('50 % necesidades, 30 % deseos (con Calidad de Vida) y el 20 % siempre a ahorro', () => {
    const r = suggest503020(4_000_000, [
      item('basico', 'Basico'),
      item('deseo', 'Estilo de Vida'),
      item('calidad', 'Calidad de Vida'),
    ]);

    expect(r).toEqual({
      amounts: { basico: 2_000_000, deseo: 600_000, calidad: 600_000 },
      ahorroSinAsignar: 800_000,
    });
  });

  it('reparte igual dentro del grupo y redondea hacia abajo a múltiplos de 1.000', () => {
    const r = suggest503020(1_234_567, [
      item('a', 'Basico'),
      item('b', 'Basico'),
      item('c', 'Basico'),
      item('d', 'Estilo de Vida'),
      item('e', 'Calidad de Vida'),
    ]);

    // 617.283,5 / 3 = 205.761,1 → 205.000; 370.370,1 / 2 = 185.185 → 185.000;
    // ahorro 246.913,4 → 246.000
    expect(r.amounts).toEqual({
      a: 205_000,
      b: 205_000,
      c: 205_000,
      d: 185_000,
      e: 185_000,
    });
    expect(r.ahorroSinAsignar).toBe(246_000);
  });

  it('Estilo de Vida y Caprichos comparten el 30 %', () => {
    const r = suggest503020(1_000_000, [
      item('estilo', 'Estilo de Vida'),
      item('capricho', 'Caprichos'),
    ]);

    expect(r.amounts).toEqual({ estilo: 150_000, capricho: 150_000 });
    // Necesidades (50 %) no tiene ítems; el 20 % de ahorro va siempre sin asignar.
    expect(r.ahorroSinAsignar).toBe(700_000);
  });

  it('un grupo sin ítems manda su porcentaje a ahorroSinAsignar', () => {
    const r = suggest503020(2_000_000, [item('basico', 'Basico')]);

    expect(r.amounts).toEqual({ basico: 1_000_000 });
    expect(r.ahorroSinAsignar).toBe(1_000_000);
  });

  it('Impuestos y clasificaciones desconocidas quedan en 0 y no cuentan en ningún grupo', () => {
    const r = suggest503020(1_000_000, [
      item('impuesto', 'Impuestos'),
      item('rara', 'Otra cosa'),
      item('basico', 'Basico'),
    ]);

    expect(r.amounts).toEqual({ impuesto: 0, rara: 0, basico: 500_000 });
    expect(r.ahorroSinAsignar).toBe(500_000);
  });

  it('reconoce la clasificación sin importar tildes, mayúsculas ni espacios', () => {
    const r = suggest503020(1_000_000, [
      item('a', 'Básico'),
      item('b', ' ESTILO DE VIDA '),
      item('c', 'calidad de vida'),
    ]);

    expect(r.amounts).toEqual({ a: 500_000, b: 150_000, c: 150_000 });
    expect(r.ahorroSinAsignar).toBe(200_000);
  });

  it.each([0, -500_000, Number.NaN, Number.POSITIVE_INFINITY])(
    'ingreso %s → todo en 0',
    income => {
      const r = suggest503020(income, [
        item('a', 'Basico'),
        item('b', 'Calidad de Vida'),
      ]);

      expect(r).toEqual({ amounts: { a: 0, b: 0 }, ahorroSinAsignar: 0 });
    },
  );

  it('sin ítems, todo el ingreso queda sin asignar', () => {
    expect(suggest503020(1_000_000, [])).toEqual({
      amounts: {},
      ahorroSinAsignar: 1_000_000,
    });
  });

  it('kit inicial de 12 rubros (contratos §1.3): reparte según §5.2', () => {
    const kit = [
      item('arriendo', 'Basico'),
      item('servicios', 'Basico'),
      item('internet', 'Calidad de Vida'),
      item('mercado', 'Basico'),
      item('aseo', 'Basico'),
      item('transporte', 'Basico'),
      item('vehiculo', 'Basico'),
      item('salud', 'Basico'),
      item('drogueria', 'Basico'),
      item('tarjetas', 'Basico'),
      item('creditos', 'Basico'),
      item('otros', 'Estilo de Vida'),
    ];

    const r = suggest503020(5_000_000, kit);

    expect(r.amounts.arriendo).toBe(250_000);
    expect(r.amounts.creditos).toBe(250_000);
    // Deseos: Otros (Estilo de Vida) e Internet (Calidad de Vida) comparten el 30 %.
    expect(r.amounts.otros).toBe(750_000);
    expect(r.amounts.internet).toBe(750_000);
    expect(r.ahorroSinAsignar).toBe(1_000_000);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/onboarding/budget-503020.test.ts`
Expected: FAIL — `Failed to resolve import "./budget-503020"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/onboarding/budget-503020.ts`:

```ts
// Sugerencia 50/30/20 del paso 2 de la bienvenida (contratos §2.7 con la
// enmienda §5.2: 'Calidad de Vida' cuenta como deseo y el 20 % es ahorro).
// Módulo puro y sin dependencias: se usa en el navegador (OnboardingWizard)
// y en tests.

export type KitItem = { id: string; classificationName: string };

type Grupo = 'necesidades' | 'deseos';

/**
 * Porcentaje del ingreso de cada grupo. Enteros a propósito: `ingreso * 30`
 * es exacto y `ingreso * 0.3` arrastra error de coma flotante que, al
 * redondear hacia abajo, puede quitar 1.000 pesos.
 */
const PORCENTAJE: Record<Grupo, number> = {
  necesidades: 50,
  deseos: 30,
};

/** El 20 % de ahorro no se reparte en rubros: va siempre a ahorroSinAsignar. */
const PORCENTAJE_AHORRO = 20;

/**
 * Clasificación (normalizada) → grupo. Lo que no está aquí ('impuestos' o
 * cualquier clasificación desconocida) queda en 0 y no cuenta en ningún grupo.
 */
const GRUPO_POR_CLASIFICACION: Record<string, Grupo> = {
  basico: 'necesidades',
  'estilo de vida': 'deseos',
  caprichos: 'deseos',
  'calidad de vida': 'deseos',
};

/** Los montos sugeridos son múltiplos de 1.000 COP, redondeados hacia abajo. */
const REDONDEO = 1000;

function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Reparte `income` entre los rubros según su clasificación: 50 % necesidades
 * ('Basico') y 30 % deseos ('Estilo de Vida' | 'Caprichos' | 'Calidad de
 * Vida'). El 20 % de ahorro va siempre a `ahorroSinAsignar`, junto con el
 * porcentaje de un grupo sin rubros. Dentro de cada grupo, partes iguales
 * redondeadas hacia abajo a múltiplos de 1.000. Con `income <= 0` (o no
 * finito) todo queda en 0.
 */
export function suggest503020(
  income: number,
  items: KitItem[],
): { amounts: Record<string, number>; ahorroSinAsignar: number } {
  const amounts: Record<string, number> = {};
  for (const item of items) amounts[item.id] = 0;

  if (!Number.isFinite(income) || income <= 0) {
    return { amounts, ahorroSinAsignar: 0 };
  }
  const ingreso = Math.floor(income);

  const miembros: Record<Grupo, string[]> = {
    necesidades: [],
    deseos: [],
  };
  for (const item of items) {
    const grupo = GRUPO_POR_CLASIFICACION[normalizar(item.classificationName ?? '')];
    if (grupo) miembros[grupo].push(item.id);
  }

  let porcentajeSinAsignar = PORCENTAJE_AHORRO;
  for (const grupo of Object.keys(PORCENTAJE) as Grupo[]) {
    const ids = miembros[grupo];
    if (ids.length === 0) {
      porcentajeSinAsignar += PORCENTAJE[grupo];
      continue;
    }
    const porItem =
      Math.floor(
        (ingreso * PORCENTAJE[grupo]) / (100 * ids.length * REDONDEO),
      ) * REDONDEO;
    for (const id of ids) amounts[id] = porItem;
  }

  const ahorroSinAsignar =
    Math.floor((ingreso * porcentajeSinAsignar) / (100 * REDONDEO)) * REDONDEO;

  return { amounts, ahorroSinAsignar };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/onboarding/budget-503020.test.ts`
Expected: PASS (12 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/onboarding/budget-503020.ts src/lib/onboarding/budget-503020.test.ts
git commit -m "feat(onboarding): sugerencia 50/30/20 para el presupuesto de la bienvenida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Verificar lo que dejaron S07, S10 y S13

El flujo APP corre en serie (contratos §5.3): cuando empieza S11, S07, S08, S10 y S13 ya están hechas en este worktree. Esta tarea solo comprueba que lo que S11 reusa existe; no crea ni modifica archivos.

**Files:** ninguno (solo verificación).

**Interfaces:**
- Consumes (ya existen):
  - `buildWhatsAppLinkUrl(botNumber: string | undefined, code: string): string | null` en `src/lib/whatsapp/link-url.ts` (S13, contratos §2.8).
  - `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` en `src/lib/actions/onboarding.ts`, con su test en `src/lib/actions/onboarding.test.ts` (S10, contratos §5.2). Nunca lanza.
  - `DEFAULT_ACCOUNT_NAME = 'Efectivo'` en `src/lib/constants/expense-categories.ts` (S07, §2.6).
- Produces: nada.

- [x] **Step 1: Comprobar que existen**

Run: `grep -n "export function buildWhatsAppLinkUrl" src/lib/whatsapp/link-url.ts && grep -n "export async function ensureStarterKitAction" src/lib/actions/onboarding.ts && grep -n "export const DEFAULT_ACCOUNT_NAME" src/lib/constants/expense-categories.ts && grep -c "export async function" src/lib/actions/onboarding.ts`
Expected: las tres firmas y, en la última línea, `1` (S10 dejó `onboarding.ts` solo con `ensureStarterKitAction`). Si falta alguna, detente y repórtalo: una historia anterior del flujo no está hecha. **No** las crees aquí.

- [x] **Step 2: Sus tests pasan**

Run: `bun run test src/lib/whatsapp/link-url.test.ts src/lib/actions/onboarding.test.ts`
Expected: PASS (5 tests de S13 y 7 de S10).

Sin commit en esta tarea.

---

### Task 3: `loadWizardData` (rubros del mes y categorías)

**Files:**
- Create: `src/lib/onboarding/wizard-data.ts`
- Test: `src/lib/onboarding/wizard-data.test.ts`

**Interfaces:**
- Consumes: RPC existente `get_budget_by_month(p_user_id uuid, p_month_year varchar)` (columnas usadas: `item_id`, `item_name`, `category_name`, `classification_name`, `budgeted_amount`; con S01 lleva guard `auth.uid() = p_user_id`, se le pasa el propio usuario); tabla `categories(name, user_id, is_active)`.
- Produces:
  ```ts
  export interface WizardItem { id: string; name: string; categoryName: string; classificationName: string; budgetedAmount: number }
  export interface WizardData { items: WizardItem[]; categoryNames: string[] }
  export async function loadWizardData(supabase: SupabaseClient<Database>, userId: string, monthYear: string): Promise<WizardData>
  ```
  Nunca lanza: ante error devuelve listas vacías y loguea solo `error.code`.

- [x] **Step 1: Write the failing test**

Crear `src/lib/onboarding/wizard-data.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database';

import { loadWizardData } from './wizard-data';

import type { SupabaseClient } from '@supabase/supabase-js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

function clienteFalso({
  rpcResult = { data: [], error: null } as Resultado,
  categoriasResult = { data: [], error: null } as Resultado,
} = {}) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    then: (
      resolve: (r: Resultado) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve(categoriasResult).then(resolve, reject),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  const client = {
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn(() => chain),
  };
  return {
    client,
    chain,
    supabase: client as unknown as SupabaseClient<Database>,
  };
}

const FILAS = [
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: 'c1',
    category_name: 'VIVIENDA',
    item_id: ITEM_A,
    item_name: 'Arriendo o cuota',
    classification_name: 'Basico',
    budgeted_amount: '0',
  },
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: 'c1',
    category_name: 'VIVIENDA',
    item_id: ITEM_B,
    item_name: 'Internet',
    classification_name: 'Calidad de Vida',
    budgeted_amount: 120000,
  },
  // Plantilla sin rubros: el LEFT JOIN devuelve la fila con item_id null.
  {
    template_id: 't1',
    template_name: 'Presupuesto 2026-09',
    category_id: null,
    category_name: null,
    item_id: null,
    item_name: null,
    classification_name: null,
    budgeted_amount: null,
  },
];

describe('loadWizardData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide el presupuesto del mes del propio usuario y mapea los rubros', async () => {
    const { client, supabase } = clienteFalso({
      rpcResult: { data: FILAS, error: null },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(client.rpc).toHaveBeenCalledWith('get_budget_by_month', {
      p_user_id: USER_ID,
      p_month_year: '2026-09',
    });
    expect(r.items).toEqual([
      {
        id: ITEM_A,
        name: 'Arriendo o cuota',
        categoryName: 'VIVIENDA',
        classificationName: 'Basico',
        budgetedAmount: 0,
      },
      {
        id: ITEM_B,
        name: 'Internet',
        categoryName: 'VIVIENDA',
        classificationName: 'Calidad de Vida',
        budgetedAmount: 120000,
      },
    ]);
  });

  it('devuelve los nombres de las categorías activas del usuario', async () => {
    const { client, chain, supabase } = clienteFalso({
      categoriasResult: {
        data: [{ name: 'MERCADO' }, { name: 'OTROS' }],
        error: null,
      },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(client.from).toHaveBeenCalledWith('categories');
    expect(chain.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(chain.eq).toHaveBeenCalledWith('is_active', true);
    expect(r.categoryNames).toEqual(['MERCADO', 'OTROS']);
  });

  it('si la RPC falla → sin rubros, y loguea solo el código', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { supabase } = clienteFalso({
      rpcResult: {
        data: null,
        error: { code: '42501', message: 'no autorizado usuario@ejemplo.com' },
      },
      categoriasResult: { data: [{ name: 'OTROS' }], error: null },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(r).toEqual({ items: [], categoryNames: ['OTROS'] });
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    errorSpy.mockRestore();
  });

  it('si la consulta de categorías falla → sin categorías', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { supabase } = clienteFalso({
      rpcResult: { data: FILAS, error: null },
      categoriasResult: { data: null, error: { code: '42P01' } },
    });

    const r = await loadWizardData(supabase, USER_ID, '2026-09');

    expect(r.categoryNames).toEqual([]);
    expect(r.items).toHaveLength(2);
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/onboarding/wizard-data.test.ts`
Expected: FAIL — `Failed to resolve import "./wizard-data"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/onboarding/wizard-data.ts`:

```ts
// Datos que necesita el wizard de /bienvenida: los rubros del mes (con su
// categoría y clasificación, para el paso 2 y la sugerencia 50/30/20) y los
// nombres de las categorías del usuario (para el gasto del paso 3).

import type { Database } from '@/types/database';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WizardItem {
  id: string;
  name: string;
  categoryName: string;
  classificationName: string;
  budgetedAmount: number;
}

export interface WizardData {
  items: WizardItem[];
  categoryNames: string[];
}

/** Columnas de get_budget_by_month que usa el wizard. */
interface FilaPresupuesto {
  item_id: string | null;
  item_name: string | null;
  category_name: string | null;
  classification_name: string | null;
  budgeted_amount: string | number | null;
}

/**
 * Rubros del mes `monthYear` ('YYYY-MM') y categorías activas del usuario.
 * Nunca lanza: si una consulta falla, esa parte vuelve vacía (el wizard sigue
 * funcionando y el usuario puede saltar el paso).
 */
export async function loadWizardData(
  supabase: SupabaseClient<Database>,
  userId: string,
  monthYear: string,
): Promise<WizardData> {
  const [presupuesto, categorias] = await Promise.all([
    supabase.rpc('get_budget_by_month', {
      p_user_id: userId,
      p_month_year: monthYear,
    }),
    supabase
      .from('categories')
      .select('name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name'),
  ]);

  let items: WizardItem[] = [];
  if (presupuesto.error) {
    console.error(
      'loadWizardData: error leyendo el presupuesto:',
      presupuesto.error.code,
    );
  } else {
    const filas = (presupuesto.data ?? []) as FilaPresupuesto[];
    items = filas
      .filter(f => Boolean(f.item_id))
      .map(f => ({
        id: f.item_id as string,
        name: f.item_name ?? '',
        categoryName: f.category_name ?? '',
        classificationName: f.classification_name ?? '',
        budgetedAmount: Number(f.budgeted_amount) || 0,
      }));
  }

  let categoryNames: string[] = [];
  if (categorias.error) {
    console.error(
      'loadWizardData: error leyendo categorías:',
      categorias.error.code,
    );
  } else {
    categoryNames = ((categorias.data ?? []) as Array<{ name: string }>).map(
      c => c.name,
    );
  }

  return { items, categoryNames };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/onboarding/wizard-data.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Type-check**

Run: `bun run type-check`
Expected: sin errores. (El cliente tipado con `src/types/database.ts` acepta `rpc('get_budget_by_month', …)` igual que `categories.ts` acepta `rpc('upsert_monthly_budget', …)`; si el compilador rechaza el nombre de la RPC, castea solo esa llamada: `(supabase as unknown as SupabaseClient).rpc(...)`, como `expense-classification.ts:171`, y anótalo en `deviations`.)

- [x] **Step 6: Commit**

```bash
git add src/lib/onboarding/wizard-data.ts src/lib/onboarding/wizard-data.test.ts
git commit -m "feat(onboarding): carga de rubros del mes y categorías para la bienvenida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Preparar el test de `onboarding.ts` para las acciones de la bienvenida

S10 creó `src/lib/actions/onboarding.ts` (solo `ensureStarterKitAction`, firma v2) y `src/lib/actions/onboarding.test.ts` (7 tests, con un `clienteFalso` que solo tiene `auth` y `rpc`). Las Tasks 5–7 necesitan un cliente falso con `from(...)` que registre las llamadas y mocks de `next/cache`, `next/navigation` y `todayBogota`. Esta tarea **solo cambia el encabezado del test**: no toca `onboarding.ts` ni reescribe `ensureStarterKitAction`, y el `describe('ensureStarterKitAction', …)` de S10 queda intacto.

**Files:**
- Modify: `src/lib/actions/onboarding.test.ts` (solo el encabezado, hasta antes de `describe('ensureStarterKitAction'`)

**Interfaces:**
- Consumes: `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` (S10, sin cambios).
- Produces (para las Tasks 5–7, dentro del test): `clienteFalso({ user?, results?, rpcResult? })` → `{ client, llamadas }`, superconjunto del de S10 (misma firma `{ user, rpcResult }` y mismo `client` con `auth` y `rpc`, más `from`); tipos `Resultado` y `Llamada`; constante `USER_ID`.

- [x] **Step 1: Reemplazar el encabezado del test**

En `src/lib/actions/onboarding.test.ts`, reemplazar **todo lo que está antes** de la línea `describe('ensureStarterKitAction', () => {` por:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  // Como en Next: redirect() corta la ejecución lanzando.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/whatsapp/format', () => ({ todayBogota: () => '2026-09-15' }));

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { ensureStarterKitAction } from './onboarding';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

interface Llamada {
  table: string;
  method: string;
  args: unknown[];
}

const METODOS = [
  'insert',
  'update',
  'select',
  'eq',
  'order',
  'single',
  'maybeSingle',
] as const;

/**
 * Cliente de cookie falso. Cada `from(tabla)` devuelve una cadena "thenable"
 * que registra cada método llamado y, al hacer `await`, resuelve con
 * `results[tabla]` (por defecto sin error). Conserva la firma del de S10
 * (`{ user, rpcResult }` → `{ client }`), así sus tests siguen igual.
 */
function clienteFalso({
  user = { id: USER_ID } as { id: string } | null,
  results = {} as Record<string, Resultado>,
  rpcResult = { data: true, error: null } as Resultado,
} = {}) {
  const llamadas: Llamada[] = [];
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: null, error: null };
    const chain: Record<string, unknown> = {
      then: (
        resolve: (r: Resultado) => unknown,
        reject?: (e: unknown) => unknown,
      ) => Promise.resolve(result).then(resolve, reject),
    };
    for (const metodo of METODOS) {
      chain[metodo] = vi.fn((...args: unknown[]) => {
        llamadas.push({ table, method: metodo, args });
        return chain;
      });
    }
    return chain;
  });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, llamadas };
}

```

(Si S10 dejó algún import o constante más en ese encabezado, p. ej. otro nombre para el cliente falso, reemplázalo igual: el `describe` de S10 solo usa `clienteFalso`, `mockedCreateClient` y `ensureStarterKitAction`.)

- [x] **Step 2: Guarda de render (contratos §5.2)**

Agregar al final del archivo (después del `describe` de S10, sin tocarlo):

```ts
describe('ensureStarterKitAction durante el render (§5.2)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no revalida ni redirige, ni con éxito, ni sin sesión, ni con error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    clienteFalso();
    await ensureStarterKitAction();
    clienteFalso({ user: null });
    await ensureStarterKitAction();
    clienteFalso({ rpcResult: { data: null, error: { code: 'PGRST202' } } });
    await ensureStarterKitAction();

    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
```

- [x] **Step 3: Los tests siguen en verde**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (7 tests de S10 + 1 = 8). Es un cambio de infraestructura del test más una guarda de regresión sobre código que ya cumple el contrato: no hay código nuevo que deba hacer fallar un test primero.

- [x] **Step 4: Commit**

```bash
git add src/lib/actions/onboarding.test.ts
git commit -m "test(onboarding): cliente falso con registro de llamadas para las acciones de la bienvenida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `saveOnboardingIncomeAction`

**Files:**
- Modify: `src/lib/actions/onboarding.ts`
- Test: `src/lib/actions/onboarding.test.ts`

**Interfaces:**
- Consumes: tabla `ingresos` (`supabase_ingresos_deudas.sql:10-21`: `user_id uuid NOT NULL`, `descripcion varchar(255) NOT NULL`, `fuente varchar(255) NOT NULL`, `monto numeric(12,2)`, `fecha date NOT NULL`, `tipo varchar(50) DEFAULT 'ingreso'`, `es_activo DEFAULT true`); `todayBogota()` de `@/lib/whatsapp/format`.
- Produces: `export async function saveOnboardingIncomeAction(input: { monto: number; fuente: string }): Promise<{ ok: boolean; error?: string }>`.

- [x] **Step 1: Write the failing test**

En `src/lib/actions/onboarding.test.ts`, cambiar la importación de `./onboarding` por:

```ts
import {
  ensureStarterKitAction,
  saveOnboardingIncomeAction,
} from './onboarding';
```

agregar debajo de la función `clienteFalso` (la usan las Tasks 5–7; no se agrega antes porque eslint rechaza funciones sin uso):

```ts
function llamadasDe(llamadas: Llamada[], table: string, method: string) {
  return llamadas.filter(l => l.table === table && l.method === method);
}
```

y agregar al final del archivo:

```ts
describe('saveOnboardingIncomeAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guarda el ingreso del usuario con la fecha de hoy en Bogotá', async () => {
    const { llamadas } = clienteFalso();

    const r = await saveOnboardingIncomeAction({
      monto: 3_500_000,
      fuente: '  Salario ',
    });

    expect(r).toEqual({ ok: true });
    const inserts = llamadasDe(llamadas, 'ingresos', 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].args[0]).toEqual({
      user_id: USER_ID,
      descripcion: 'Ingreso mensual',
      fuente: 'Salario',
      monto: 3_500_000,
      fecha: '2026-09-15',
      tipo: 'ingreso',
    });
  });

  it.each([0, -100_000, 1500.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'monto inválido (%s) → error sin tocar la DB',
    async monto => {
      const { client } = clienteFalso();

      const r = await saveOnboardingIncomeAction({ monto, fuente: 'Salario' });

      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/ingreso/i);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it('fuente vacía → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    const r = await saveOnboardingIncomeAction({
      monto: 1_000_000,
      fuente: '   ',
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/de dónde/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin sesión → No autenticado', async () => {
    const { client } = clienteFalso({ user: null });

    expect(
      await saveOnboardingIncomeAction({ monto: 1_000_000, fuente: 'Salario' }),
    ).toEqual({ ok: false, error: 'No autenticado' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('error de la DB → mensaje genérico y no loguea el monto', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: {
        ingresos: {
          data: null,
          error: { code: '23514', message: 'Failing row contains (3500000)' },
        },
      },
    });

    const r = await saveOnboardingIncomeAction({
      monto: 3_500_000,
      fuente: 'Salario',
    });

    expect(r).toEqual({
      ok: false,
      error: 'No pudimos guardar tu ingreso. Intenta de nuevo.',
    });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('3500000');
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: FAIL — `saveOnboardingIncomeAction is not a function` (o error de import: "does not provide an export named").

- [x] **Step 3: Write minimal implementation**

En `src/lib/actions/onboarding.ts`, dejar las importaciones así (fusionar con las que ya haya):

```ts
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { todayBogota } from '@/lib/whatsapp/format';
```

y agregar al final del archivo:

```ts
type OnboardingResult = { ok: boolean; error?: string };

const DESCRIPCION_INGRESO = 'Ingreso mensual';
const MAX_FUENTE = 255;

/**
 * Paso 1 de la bienvenida: guarda el ingreso mensual en `ingresos` con la
 * fecha de hoy (Bogotá). `monto` en pesos enteros > 0.
 */
export async function saveOnboardingIncomeAction(input: {
  monto: number;
  fuente: string;
}): Promise<OnboardingResult> {
  const monto = input?.monto;
  if (typeof monto !== 'number' || !Number.isSafeInteger(monto) || monto <= 0) {
    return { ok: false, error: 'Escribe tu ingreso en pesos, mayor a cero.' };
  }
  const fuente = typeof input.fuente === 'string' ? input.fuente.trim() : '';
  if (!fuente) {
    return { ok: false, error: 'Cuéntanos de dónde viene el ingreso.' };
  }
  if (fuente.length > MAX_FUENTE) {
    return { ok: false, error: 'La fuente del ingreso es demasiado larga.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const { error } = await supabase.from('ingresos').insert({
    user_id: user.id,
    descripcion: DESCRIPCION_INGRESO,
    fuente,
    monto,
    fecha: todayBogota(),
    tipo: 'ingreso',
  });
  if (error) {
    // Solo el código: el detalle de un CHECK fallido trae la fila (el monto).
    console.error(
      'saveOnboardingIncomeAction: error guardando el ingreso:',
      error.code,
    );
    return { ok: false, error: 'No pudimos guardar tu ingreso. Intenta de nuevo.' };
  }

  revalidatePath('/ingresos');
  return { ok: true };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (8 + 9 = 17 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/actions/onboarding.ts src/lib/actions/onboarding.test.ts
git commit -m "feat(onboarding): guardar el ingreso mensual desde la bienvenida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `saveOnboardingBudgetAction`

**Files:**
- Modify: `src/lib/actions/onboarding.ts`
- Test: `src/lib/actions/onboarding.test.ts`

**Interfaces:**
- Consumes: tabla `budget_items(id, user_id, budgeted_amount)`; política UPDATE de RLS del dueño.
- Produces: `export async function saveOnboardingBudgetAction(amounts: Record<string, number>): Promise<{ ok: boolean; error?: string }>`. Claves = ids (uuid) de `budget_items`; valores = pesos enteros ≥ 0. Objeto vacío → `{ ok: true }` sin tocar la base.

- [x] **Step 1: Write the failing test**

En `src/lib/actions/onboarding.test.ts` (`revalidatePath` ya está importado desde la Task 4), cambiar la importación de `./onboarding` por:

```ts
import {
  ensureStarterKitAction,
  saveOnboardingBudgetAction,
  saveOnboardingIncomeAction,
} from './onboarding';
```

agregar junto a `USER_ID`:

```ts
const ITEM_A = '11111111-1111-4111-8111-111111111111';
const ITEM_B = '22222222-2222-4222-8222-222222222222';
```

y al final del archivo:

```ts
describe('saveOnboardingBudgetAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('actualiza solo budgeted_amount de cada rubro, filtrando por id y user_id', async () => {
    const { llamadas } = clienteFalso();

    const r = await saveOnboardingBudgetAction({
      [ITEM_A]: 1_200_000,
      [ITEM_B]: 0,
    });

    expect(r).toEqual({ ok: true });
    const updates = llamadasDe(llamadas, 'budget_items', 'update');
    expect(updates.map(u => u.args[0])).toEqual([
      { budgeted_amount: 1_200_000 },
      { budgeted_amount: 0 },
    ]);
    const filtros = llamadasDe(llamadas, 'budget_items', 'eq').map(l => l.args);
    expect(filtros).toContainEqual(['id', ITEM_A]);
    expect(filtros).toContainEqual(['id', ITEM_B]);
    expect(filtros.filter(f => f[0] === 'user_id')).toEqual([
      ['user_id', USER_ID],
      ['user_id', USER_ID],
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/presupuesto');
  });

  it.each([-1, 1000.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'monto inválido (%s) → error sin tocar la DB',
    async monto => {
      const { client } = clienteFalso();

      const r = await saveOnboardingBudgetAction({ [ITEM_A]: monto });

      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/pesos enteros/i);
      expect(client.from).not.toHaveBeenCalled();
    },
  );

  it('id que no es uuid → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    const r = await saveOnboardingBudgetAction({ 'otro-rubro': 1000 });

    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin montos → ok sin tocar la DB', async () => {
    clienteFalso();

    expect(await saveOnboardingBudgetAction({})).toEqual({ ok: true });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin sesión → No autenticado', async () => {
    const { client } = clienteFalso({ user: null });

    expect(await saveOnboardingBudgetAction({ [ITEM_A]: 1000 })).toEqual({
      ok: false,
      error: 'No autenticado',
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('error de la DB → mensaje genérico y no revalida', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: {
        budget_items: { data: null, error: { code: '42501', message: 'x' } },
      },
    });

    const r = await saveOnboardingBudgetAction({ [ITEM_A]: 1000 });

    expect(r).toEqual({
      ok: false,
      error: 'No pudimos guardar tu presupuesto. Intenta de nuevo.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: FAIL — `saveOnboardingBudgetAction is not a function`.

- [x] **Step 3: Write minimal implementation**

En `src/lib/actions/onboarding.ts`, agregar a las importaciones:

```ts
import { z } from 'zod';
```

(entre `next/cache` y `@/lib/…`, con una línea en blanco antes y después, como en `src/lib/actions/whatsapp.ts`) y al final del archivo:

```ts
const itemIdSchema = z.string().uuid();
const MAX_RUBROS = 200;

/**
 * Paso 2 de la bienvenida: guarda el monto presupuestado de cada rubro.
 * Solo toca `budgeted_amount` y solo de rubros del usuario (filtro explícito
 * por `user_id` además de RLS). Montos en pesos enteros >= 0.
 */
export async function saveOnboardingBudgetAction(
  amounts: Record<string, number>,
): Promise<OnboardingResult> {
  if (!amounts || typeof amounts !== 'object' || Array.isArray(amounts)) {
    return { ok: false, error: 'No entendimos los montos del presupuesto.' };
  }
  const entradas = Object.entries(amounts);
  if (entradas.length > MAX_RUBROS) {
    return { ok: false, error: 'Son demasiados rubros para guardar de una vez.' };
  }
  for (const [id, monto] of entradas) {
    if (!itemIdSchema.safeParse(id).success) {
      return { ok: false, error: 'Hay un rubro que no reconocemos.' };
    }
    if (typeof monto !== 'number' || !Number.isSafeInteger(monto) || monto < 0) {
      return {
        ok: false,
        error: 'Los montos deben ser pesos enteros, sin negativos.',
      };
    }
  }
  if (entradas.length === 0) return { ok: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'No autenticado' };

  const resultados = await Promise.all(
    entradas.map(([id, monto]) =>
      supabase
        .from('budget_items')
        .update({ budgeted_amount: monto })
        .eq('id', id)
        .eq('user_id', user.id),
    ),
  );
  const fallo = resultados.find(r => r.error);
  if (fallo?.error) {
    console.error(
      'saveOnboardingBudgetAction: error guardando montos:',
      fallo.error.code,
    );
    return {
      ok: false,
      error: 'No pudimos guardar tu presupuesto. Intenta de nuevo.',
    };
  }

  revalidatePath('/presupuesto');
  return { ok: true };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (17 + 9 = 26 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/actions/onboarding.ts src/lib/actions/onboarding.test.ts
git commit -m "feat(onboarding): guardar los montos del presupuesto desde la bienvenida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `completeOnboardingAction` y `dismissChecklistAction`

> **Desviación (implementación):** `dismissChecklistAction` sigue la enmienda de contratos §5.2 posterior a este plan: devuelve `Promise<{ ok: boolean }>`, nunca lanza, y sin sesión, con el UPDATE fallido o con un error inesperado devuelve `{ ok: false }` con `console.warn` solo del code. Sus tests se ajustaron a eso (4 en vez de 2).

**Files:**
- Modify: `src/lib/actions/onboarding.ts`
- Test: `src/lib/actions/onboarding.test.ts`

**Interfaces:**
- Consumes: columnas `profiles.onboarding_completed_at` y `profiles.onboarding_dismissed_at` (S09, §1.2); política UPDATE `auth.uid() = id`.
- Produces:
  - `export async function completeOnboardingAction(): Promise<void>` — marca `onboarding_completed_at` y hace `redirect('/dashboard')` (también si el UPDATE falla); sin sesión `redirect('/auth/login')`.
  - `export async function dismissChecklistAction(): Promise<void>` — marca `onboarding_dismissed_at` y revalida `/dashboard`; sin sesión no hace nada. **S12 la consume; no la vuelve a crear.**

- [x] **Step 1: Write the failing test**

En `src/lib/actions/onboarding.test.ts`:
- Cambiar la primera línea por `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';`
- (`redirect` y `revalidatePath` ya están importados desde la Task 4.)
- Cambiar la importación de `./onboarding` por:

```ts
import {
  completeOnboardingAction,
  dismissChecklistAction,
  ensureStarterKitAction,
  saveOnboardingBudgetAction,
  saveOnboardingIncomeAction,
} from './onboarding';
```

y agregar al final del archivo:

```ts
const AHORA = '2026-09-30T15:00:00.000Z';

describe('completeOnboardingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
  });
  afterEach(() => vi.useRealTimers());

  it('marca onboarding_completed_at del propio usuario y lleva al dashboard', async () => {
    const { llamadas } = clienteFalso();

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );

    const updates = llamadasDe(llamadas, 'profiles', 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0]).toEqual({ onboarding_completed_at: AHORA });
    expect(llamadasDe(llamadas, 'profiles', 'eq')[0].args).toEqual([
      'id',
      USER_ID,
    ]);
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });

  it('sin sesión → login y no toca profiles', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/auth/login',
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('si el UPDATE falla igual lleva al dashboard (no deja al usuario atrapado)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      results: { profiles: { data: null, error: { code: '42703' } } },
    });

    await expect(completeOnboardingAction()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard',
    );
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('dismissChecklistAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(AHORA));
  });
  afterEach(() => vi.useRealTimers());

  it('marca onboarding_dismissed_at del propio usuario', async () => {
    const { llamadas } = clienteFalso();

    await expect(dismissChecklistAction()).resolves.toBeUndefined();

    expect(llamadasDe(llamadas, 'profiles', 'update')[0].args[0]).toEqual({
      onboarding_dismissed_at: AHORA,
    });
    expect(llamadasDe(llamadas, 'profiles', 'eq')[0].args).toEqual([
      'id',
      USER_ID,
    ]);
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('sin sesión no hace nada', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(dismissChecklistAction()).resolves.toBeUndefined();
    expect(client.from).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: FAIL — `completeOnboardingAction is not a function`.

- [x] **Step 3: Write minimal implementation**

En `src/lib/actions/onboarding.ts`, agregar a las importaciones:

```ts
import { redirect } from 'next/navigation';
```

(debajo de `import { revalidatePath } from 'next/cache';`) y al final del archivo:

```ts
/**
 * Fin de la bienvenida (terminar o saltar el último paso): marca
 * `onboarding_completed_at` y lleva al dashboard. Si el UPDATE falla igual
 * redirige: preferimos que vuelva a ver la bienvenida en el próximo ingreso a
 * dejarlo atrapado aquí.
 */
export async function completeOnboardingAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error(
      'completeOnboardingAction: no se pudo marcar la bienvenida:',
      error.code,
    );
  }

  revalidatePath('/dashboard');
  redirect('/dashboard');
}

/** "Ocultar" la checklist del dashboard (S12): marca `onboarding_dismissed_at`. */
export async function dismissChecklistAction(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) {
    console.error(
      'dismissChecklistAction: no se pudo ocultar la checklist:',
      error.code,
    );
    return;
  }

  revalidatePath('/dashboard');
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (26 + 5 = 31 tests).

- [x] **Step 5: Type-check**

Run: `bun run type-check`
Expected: sin errores. (`src/types/database.ts` no declara `ingresos` ni las columnas nuevas de `profiles`, pero el cliente ya acepta tablas no declaradas —`accounts.ts` usa `from('accounts')`—. Si el compilador rechaza `onboarding_completed_at`/`onboarding_dismissed_at` en `update`, **no regeneres los tipos** (`bun run db:types` trunca `database.ts`, §5.0) ni edites `src/types/database.ts`: tipa a mano en `onboarding.ts`, casteando solo esas llamadas a un cliente sin esquema (`(supabase as unknown as SupabaseClient).from('profiles')`, con `import type { SupabaseClient } from '@supabase/supabase-js';`, como `expense-classification.ts:171`), y anótalo en `deviations`.)

- [x] **Step 6: Commit**

```bash
git add src/lib/actions/onboarding.ts src/lib/actions/onboarding.test.ts
git commit -m "feat(onboarding): terminar la bienvenida y ocultar la checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `OnboardingWizard` (componente cliente de 3 pasos)

**Files:**
- Create: `src/components/organisms/OnboardingWizard/OnboardingWizard.tsx`

**Interfaces:**
- Consumes: `suggest503020` (Task 1), `buildWhatsAppLinkUrl` (S13, `src/lib/whatsapp/link-url.ts`), `DEFAULT_ACCOUNT_NAME` (S07, `src/lib/constants/expense-categories.ts`), `WizardItem` (Task 3), `saveOnboardingIncomeAction`, `saveOnboardingBudgetAction`, `completeOnboardingAction` (Tasks 5–7), `generateWhatsAppLinkCodeAction` (`src/lib/actions/whatsapp.ts`, devuelve `{ ok: true; code } | { ok: false; error }`), `createExpenseTransaction(expenseData: ExpenseFormData)` (`src/lib/services/expenses.ts`), `formatCOP` y `todayBogota` (`src/lib/whatsapp/format.ts`), átomos `Button`, `Card`, `CurrencyInput`, `Input`, y `cn` (`src/lib/utils`).
- Produces: `export default function OnboardingWizard(props: OnboardingWizardProps)` con `export interface OnboardingWizardProps { items: WizardItem[]; categoryNames: string[]; botNumber?: string }`.

Decisiones de diseño (siguen el estilo real de la app: fondo `slate-900`, tarjeta `Card variant="glass"`, botón principal `variant="gradient"`, acentos `emerald` para WhatsApp/éxito, como `WhatsAppLinkPanel` y `/auth/login`):
- Barra de progreso de 3 segmentos con `aria-current="step"`; cada paso es una `<section aria-labelledby>`.
- "Saltar" es `variant="ghost"` a la izquierda; la acción principal a la derecha; en móvil se apilan con la principal arriba (`flex-col-reverse`).
- `CurrencyInput` no acepta `id`, así que su etiqueta lo envuelve (`<label>` implícito).
- El gasto usa import dinámico de `@/lib/services/expenses`: ese módulo crea un cliente de Supabase de navegador al cargarse y no debe evaluarse en el render del servidor.

- [ ] **Step 1: Cuenta por defecto del gasto**

S07 ya creó `DEFAULT_ACCOUNT_NAME` (verificado en la Task 2): el código del Step 2 lo importa directamente. No hay variante sin S07.

- [ ] **Step 2: Crear el componente**

Crear `src/components/organisms/OnboardingWizard/OnboardingWizard.tsx`:

```tsx
/**
 * OnboardingWizard - Organism Level
 *
 * Bienvenida de 3 pasos saltables (contratos §2.7): ingreso mensual,
 * presupuesto del mes con sugerencia 50/30/20, y primer gasto (aquí o por
 * WhatsApp). Terminar o saltar el último paso marca la bienvenida como hecha
 * y lleva al dashboard.
 */
'use client';

import { useMemo, useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import Input from '@/components/atoms/Input/Input';
import {
  completeOnboardingAction,
  saveOnboardingBudgetAction,
  saveOnboardingIncomeAction,
} from '@/lib/actions/onboarding';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';
import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';
import { suggest503020 } from '@/lib/onboarding/budget-503020';
import type { WizardItem } from '@/lib/onboarding/wizard-data';
import { cn } from '@/lib/utils';
import { formatCOP, todayBogota } from '@/lib/whatsapp/format';
import { buildWhatsAppLinkUrl } from '@/lib/whatsapp/link-url';

type Paso = 1 | 2 | 3;

const PASOS: Array<{ n: Paso; titulo: string }> = [
  { n: 1, titulo: 'Tu ingreso' },
  { n: 2, titulo: 'Tu presupuesto' },
  { n: 3, titulo: 'Tu primer gasto' },
];

/** Cuenta con la que se guarda el primer gasto (contratos §2.6, S07). */
const CUENTA_GASTO = DEFAULT_ACCOUNT_NAME;

const SELECT_CLASES =
  'w-full rounded-md border border-slate-600 bg-slate-800 p-2 text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500';

export interface OnboardingWizardProps {
  /** Rubros del mes del usuario (kit inicial o los que ya tenga). */
  items: WizardItem[];
  /** Categorías activas del usuario, para el gasto del paso 3. */
  categoryNames: string[];
  /** NEXT_PUBLIC_WHATSAPP_BOT_NUMBER; sin él se muestra el código sin enlace. */
  botNumber?: string;
}

export default function OnboardingWizard({
  items,
  categoryNames,
  botNumber,
}: OnboardingWizardProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [terminando, setTerminando] = useState(false);

  // Paso 1
  const [ingreso, setIngreso] = useState(0);
  const [fuente, setFuente] = useState('Salario');
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);

  // Paso 2
  const [montos, setMontos] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map(i => [i.id, i.budgetedAmount])),
  );
  const [ahorroSinAsignar, setAhorroSinAsignar] = useState<number | null>(
    null,
  );
  const [guardandoPresupuesto, setGuardandoPresupuesto] = useState(false);

  // Paso 3
  const [gastoMonto, setGastoMonto] = useState(0);
  const [gastoDescripcion, setGastoDescripcion] = useState('');
  const [gastoCategoria, setGastoCategoria] = useState(() =>
    categoryNames.includes('OTROS') ? 'OTROS' : (categoryNames[0] ?? ''),
  );
  const [guardandoGasto, setGuardandoGasto] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [generandoCodigo, setGenerandoCodigo] = useState(false);

  const itemsPorCategoria = useMemo(() => {
    const grupos = new Map<string, WizardItem[]>();
    for (const item of items) {
      const lista = grupos.get(item.categoryName) ?? [];
      lista.push(item);
      grupos.set(item.categoryName, lista);
    }
    return Array.from(grupos.entries());
  }, [items]);

  const totalAsignado = Object.values(montos).reduce((s, m) => s + m, 0);
  const enlaceWhatsApp = codigo ? buildWhatsAppLinkUrl(botNumber, codigo) : null;
  const gastoListo =
    gastoMonto > 0 && gastoDescripcion.trim() !== '' && gastoCategoria !== '';

  const terminar = async () => {
    setTerminando(true);
    try {
      // Redirige a /dashboard desde el servidor.
      await completeOnboardingAction();
    } catch {
      toast.error('No pudimos terminar la bienvenida. Intenta de nuevo.');
      setTerminando(false);
    }
  };

  const guardarIngreso = async () => {
    setGuardandoIngreso(true);
    try {
      const r = await saveOnboardingIncomeAction({ monto: ingreso, fuente });
      if (!r.ok) {
        toast.error(r.error ?? 'No pudimos guardar tu ingreso.');
        return;
      }
      setPaso(2);
    } catch {
      toast.error('No pudimos guardar tu ingreso. Intenta de nuevo.');
    } finally {
      setGuardandoIngreso(false);
    }
  };

  const sugerir = () => {
    const sugerencia = suggest503020(
      ingreso,
      items.map(i => ({ id: i.id, classificationName: i.classificationName })),
    );
    setMontos(prev => ({ ...prev, ...sugerencia.amounts }));
    setAhorroSinAsignar(sugerencia.ahorroSinAsignar);
  };

  const guardarPresupuesto = async () => {
    setGuardandoPresupuesto(true);
    try {
      const r = await saveOnboardingBudgetAction(montos);
      if (!r.ok) {
        toast.error(r.error ?? 'No pudimos guardar tu presupuesto.');
        return;
      }
      setPaso(3);
    } catch {
      toast.error('No pudimos guardar tu presupuesto. Intenta de nuevo.');
    } finally {
      setGuardandoPresupuesto(false);
    }
  };

  const guardarGasto = async () => {
    if (!gastoListo) {
      toast.error('Completa el monto, la descripción y la categoría.');
      return;
    }
    setGuardandoGasto(true);
    try {
      // Import dinámico: expenses.ts crea un cliente de navegador al cargar el
      // módulo y no debe evaluarse al renderizar en el servidor.
      const { createExpenseTransaction } = await import(
        '@/lib/services/expenses'
      );
      await createExpenseTransaction({
        description: gastoDescripcion.trim(),
        amount: gastoMonto,
        transaction_date: todayBogota(),
        category_name: gastoCategoria,
        account_name: CUENTA_GASTO,
      });
      toast.success('¡Listo! Guardamos tu primer gasto.');
      await terminar();
    } catch {
      toast.error('No pudimos guardar el gasto. Intenta de nuevo.');
    } finally {
      setGuardandoGasto(false);
    }
  };

  const generarCodigo = async () => {
    setGenerandoCodigo(true);
    try {
      const r = await generateWhatsAppLinkCodeAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCodigo(r.code);
    } catch {
      toast.error('No pudimos generar el código. Intenta de nuevo.');
    } finally {
      setGenerandoCodigo(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 text-center">
        <p className="text-sm font-medium text-emerald-400">Bienvenida</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
          Armemos tu presupuesto en 3 pasos
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Puedes saltar cualquier paso y completarlo después.
        </p>
      </header>

      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Progreso">
        {PASOS.map(p => (
          <li
            key={p.n}
            aria-current={p.n === paso ? 'step' : undefined}
            className="space-y-2"
          >
            <div
              className={cn(
                'h-1.5 rounded-full transition-colors duration-200',
                p.n <= paso
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                  : 'bg-slate-700',
              )}
            />
            <p
              className={cn(
                'text-xs',
                p.n === paso ? 'font-medium text-white' : 'text-slate-500',
              )}
            >
              {p.n}. {p.titulo}
            </p>
          </li>
        ))}
      </ol>

      <Card variant="glass" className="p-6 sm:p-8">
        {paso === 1 && (
          <section aria-labelledby="paso-1-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-1-titulo"
                className="text-lg font-semibold text-white"
              >
                ¿Cuánto te entra al mes?
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Con tu ingreso te sugerimos cómo repartir el presupuesto. Lo
                guardamos en Ingresos con la fecha de hoy.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">
                Ingreso mensual
              </span>
              <CurrencyInput
                value={ingreso}
                onChange={setIngreso}
                placeholder="$0"
                disabled={guardandoIngreso}
              />
            </label>

            <div className="space-y-2">
              <label
                htmlFor="onboarding-fuente"
                className="text-sm font-medium text-white"
              >
                ¿De dónde viene?
              </label>
              <Input
                id="onboarding-fuente"
                variant="glass"
                value={fuente}
                onChange={e => setFuente(e.target.value)}
                placeholder="Ej.: Salario, negocio, freelance"
                maxLength={255}
                disabled={guardandoIngreso}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setPaso(2)}
                disabled={guardandoIngreso}
              >
                Saltar
              </Button>
              <Button
                variant="gradient"
                onClick={guardarIngreso}
                loading={guardandoIngreso}
                disabled={guardandoIngreso || ingreso <= 0 || !fuente.trim()}
              >
                Guardar y seguir
              </Button>
            </div>
          </section>
        )}

        {paso === 2 && (
          <section aria-labelledby="paso-2-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-2-titulo"
                className="text-lg font-semibold text-white"
              >
                Tu presupuesto de este mes
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Ponle un monto a cada rubro. Si no sabes cuánto, déjalo en cero
                y lo ajustas después en Presupuesto.
              </p>
            </div>

            {items.length === 0 ? (
              <p className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 text-sm text-slate-300">
                Aún no tienes rubros este mes. Puedes crearlos después en
                Presupuesto.
              </p>
            ) : (
              <>
                {ingreso > 0 ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-300">
                      50 % necesidades, 30 % deseos y 20 % ahorro de tus{' '}
                      {formatCOP(ingreso)}.
                    </p>
                    <Button variant="outline" onClick={sugerir}>
                      Sugerir con 50/30/20
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    Si escribes tu ingreso en el paso 1, te sugerimos los
                    montos con la regla 50/30/20.
                  </p>
                )}

                <div className="space-y-5">
                  {itemsPorCategoria.map(([categoria, lista]) => (
                    <fieldset key={categoria} className="space-y-3">
                      <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        {categoria}
                      </legend>
                      {lista.map(item => (
                        <label
                          key={item.id}
                          className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_12rem]"
                        >
                          <span className="text-sm text-white">
                            {item.name}
                            <span className="ml-2 text-xs text-slate-500">
                              {item.classificationName}
                            </span>
                          </span>
                          <CurrencyInput
                            value={montos[item.id] ?? 0}
                            onChange={valor =>
                              setMontos(prev => ({ ...prev, [item.id]: valor }))
                            }
                            disabled={guardandoPresupuesto}
                          />
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>

                <dl className="space-y-1 rounded-lg bg-slate-800/60 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Asignado</dt>
                    <dd className="font-medium tabular-nums text-white">
                      {formatCOP(totalAsignado)}
                      {ingreso > 0 && (
                        <span className="text-slate-500">
                          {' '}
                          de {formatCOP(ingreso)}
                        </span>
                      )}
                    </dd>
                  </div>
                  {ahorroSinAsignar !== null && ahorroSinAsignar > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-400">Sin asignar: ahorro</dt>
                      <dd className="font-medium tabular-nums text-emerald-400">
                        {formatCOP(ahorroSinAsignar)}
                      </dd>
                    </div>
                  )}
                </dl>
              </>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={() => setPaso(1)}
                  disabled={guardandoPresupuesto}
                >
                  Atrás
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setPaso(3)}
                  disabled={guardandoPresupuesto}
                >
                  Saltar
                </Button>
              </div>
              {items.length === 0 ? (
                <Button variant="gradient" onClick={() => setPaso(3)}>
                  Seguir
                </Button>
              ) : (
                <Button
                  variant="gradient"
                  onClick={guardarPresupuesto}
                  loading={guardandoPresupuesto}
                  disabled={guardandoPresupuesto}
                >
                  Guardar y seguir
                </Button>
              )}
            </div>
          </section>
        )}

        {paso === 3 && (
          <section aria-labelledby="paso-3-titulo" className="space-y-6">
            <div>
              <h2
                id="paso-3-titulo"
                className="text-lg font-semibold text-white"
              >
                Registra tu primer gasto
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Anótalo aquí o mándalo por WhatsApp: una foto de la factura o
                un texto como «40 mil almuerzo».
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
                <h3 className="text-sm font-semibold text-white">
                  Aquí mismo
                </h3>

                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">Monto</span>
                  <CurrencyInput
                    value={gastoMonto}
                    onChange={setGastoMonto}
                    disabled={guardandoGasto || terminando}
                  />
                </label>

                <div className="space-y-2">
                  <label
                    htmlFor="onboarding-gasto-descripcion"
                    className="text-sm text-slate-300"
                  >
                    Descripción
                  </label>
                  <Input
                    id="onboarding-gasto-descripcion"
                    variant="glass"
                    value={gastoDescripcion}
                    onChange={e => setGastoDescripcion(e.target.value)}
                    placeholder="Ej.: Almuerzo"
                    maxLength={255}
                    disabled={guardandoGasto || terminando}
                  />
                </div>

                {categoryNames.length > 0 ? (
                  <div className="space-y-2">
                    <label
                      htmlFor="onboarding-gasto-categoria"
                      className="text-sm text-slate-300"
                    >
                      Categoría
                    </label>
                    <select
                      id="onboarding-gasto-categoria"
                      value={gastoCategoria}
                      onChange={e => setGastoCategoria(e.target.value)}
                      className={SELECT_CLASES}
                      disabled={guardandoGasto || terminando}
                    >
                      {categoryNames.map(nombre => (
                        <option key={nombre} value={nombre}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-sm text-amber-300">
                    Primero crea una categoría en Ajustes.
                  </p>
                )}

                <p className="text-xs text-slate-500">
                  Se guarda con la fecha de hoy en la cuenta {CUENTA_GASTO}.
                </p>

                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={guardarGasto}
                  loading={guardandoGasto}
                  disabled={!gastoListo || guardandoGasto || terminando}
                >
                  Guardar gasto
                </Button>
              </div>

              <div className="space-y-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                <h3 className="text-sm font-semibold text-white">
                  Mándalo por WhatsApp
                </h3>

                {codigo ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400">
                      Tu código (válido 10 minutos)
                    </p>
                    <p className="font-mono text-3xl tracking-widest text-emerald-400">
                      {codigo}
                    </p>
                    {enlaceWhatsApp ? (
                      <a
                        href={enlaceWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                      >
                        Abrir WhatsApp
                      </a>
                    ) : (
                      <p className="text-sm text-slate-300">
                        Envía{' '}
                        <span className="font-mono text-white">
                          VINCULAR {codigo}
                        </span>{' '}
                        al número del bot.
                      </p>
                    )}
                    <p className="text-xs text-slate-400">
                      Cuando el bot te confirme, mándale tu primer gasto.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-300">
                      Vincula tu número y registra gastos con una foto o un
                      mensaje.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={generarCodigo}
                      loading={generandoCodigo}
                      disabled={generandoCodigo || terminando}
                    >
                      Generar código
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  variant="ghost"
                  onClick={() => setPaso(2)}
                  disabled={terminando || guardandoGasto}
                >
                  Atrás
                </Button>
                <Button
                  variant="ghost"
                  onClick={terminar}
                  disabled={terminando || guardandoGasto}
                >
                  Saltar
                </Button>
              </div>
              <Button
                variant="gradient"
                onClick={terminar}
                loading={terminando}
                disabled={terminando || guardandoGasto}
              >
                Ir a mi tablero
              </Button>
            </div>
          </section>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Type-check y lint**

Run: `bun run type-check && bunx eslint src/components/organisms/OnboardingWizard/OnboardingWizard.tsx`
Expected: sin errores (warnings de `import/order` se corrigen con `bunx eslint --fix` sobre el mismo archivo).

- [ ] **Step 4: Suite completa (nada se rompió)**

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/organisms/OnboardingWizard/OnboardingWizard.tsx
git commit -m "feat(onboarding): wizard de bienvenida en 3 pasos saltables

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Página `/bienvenida`

**Files:**
- Create: `src/app/bienvenida/page.tsx`

**Interfaces:**
- Consumes: `ensureStarterKitAction` (S10; nunca lanza), `loadWizardData` (Task 3), `OnboardingWizard` (Task 8), `createClient` (server), `todayBogota`, variable `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER` (§3; puede no existir).
- Produces: ruta `GET /bienvenida`.

- [ ] **Step 1: Crear la página**

Crear `src/app/bienvenida/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

import OnboardingWizard from '@/components/organisms/OnboardingWizard/OnboardingWizard';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loadWizardData } from '@/lib/onboarding/wizard-data';
import { createClient } from '@/lib/supabase/server';
import { todayBogota } from '@/lib/whatsapp/format';

export const dynamic = 'force-dynamic';

/**
 * Bienvenida del primer ingreso (contratos §2.7). Sin sesión → login. Si ya
 * terminó la bienvenida → dashboard. Si no, repara el kit inicial (por si el
 * trigger de registro falló) y muestra el wizard con los rubros del mes.
 */
export default async function BienvenidaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: perfil } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();
  const completadoEn = (
    perfil as { onboarding_completed_at: string | null } | null
  )?.onboarding_completed_at;
  if (completadoEn) redirect('/dashboard');

  // Nunca lanza (contratos §5.2): si la RPC falla (p. ej. antes de H8) solo
  // devuelve { seeded: false, error } y el wizard se muestra igual.
  await ensureStarterKitAction();

  const mes = todayBogota().slice(0, 7);
  const { items, categoryNames } = await loadWizardData(supabase, user.id, mes);

  return (
    <main className="relative min-h-screen px-4 py-10 sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10"
      />
      <div className="relative">
        <OnboardingWizard
          items={items}
          categoryNames={categoryNames}
          botNumber={process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER}
        />
      </div>
    </main>
  );
}
```

Notas:
- El kit se siembra **antes** de `loadWizardData` para que un usuario al que el trigger le falló vea sus 12 rubros en el paso 2.
- Si la columna `onboarding_completed_at` todavía no existe (S09 sin aplicar), la consulta devuelve error, `perfil` queda `null` y se muestra el wizard: no rompe.
- No se prueba con `bun run dev`: `.env.local` apunta a producción (ver Global Constraints). La prueba manual es S14.

- [ ] **Step 2: Type-check y lint**

Run: `bun run type-check && bunx eslint src/app/bienvenida/page.tsx`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/bienvenida/page.tsx
git commit -m "feat(onboarding): página /bienvenida con kit inicial y wizard

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa y typecheck**

Run: `bun run test && bun run type-check`
Expected: todo en verde; los tests nuevos aparecen en `budget-503020.test.ts` (12), `wizard-data.test.ts` (4) y `onboarding.test.ts` (31: los 7 de S10 + 24 de S11).

- [ ] **Step 2: Lint de los archivos de la historia**

Run: `bunx eslint src/lib/onboarding src/lib/actions/onboarding.ts src/lib/actions/onboarding.test.ts src/components/organisms/OnboardingWizard src/app/bienvenida`
Expected: sin errores.

- [ ] **Step 3: Revisión contra los criterios de aceptación**

Recorre los 9 criterios de arriba y confirma en el código:
1. `page.tsx`: `redirect('/auth/login')`, `redirect('/dashboard')` si `onboarding_completed_at`, `ensureStarterKitAction()` (sin try/catch) antes de `loadWizardData`.
2. `saveOnboardingIncomeAction`: inserta los 6 campos; "Saltar" del paso 1 solo hace `setPaso(2)`.
3. Paso 2: agrupado por categoría, botón solo con `ingreso > 0`, "Sin asignar: ahorro".
4. Paso 3: `createExpenseTransaction` con `CUENTA_GASTO` y `todayBogota()`; WhatsApp con `buildWhatsAppLinkUrl` y respaldo de texto.
5. `completeOnboardingAction` redirige aunque el UPDATE falle.
6–7. Tests de las Tasks 1 y 4–7.
8. `grep -rn "export async function ensureStarterKitAction\|export async function dismissChecklistAction" src` → una definición de cada una.
9. Step 1.

Sin commit en esta tarea (no hay cambios). Si algo falló, corrígelo en la tarea correspondiente con su propio commit.
