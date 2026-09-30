# S12 — Checklist del dashboard: plan de implementación

> **Alineado con contratos v2 (§5).** §5.2 (ítem `'alertas'` → `'presupuesto'`, `hasExplicitAlerts` → `hasBudgetAmounts`, `deudaCount` solo deudas activas, `ensureStarterKitAction` nunca lanza) y §5.3 (flujo APP: S07 → S08 → S10 → S13 → S11 → **S12**) prevalecen sobre §2.7 y §4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el dashboard una lista de 5 pasos pendientes de configuración (calculada desde los datos del usuario), que se puede ocultar para siempre, y reparar el kit inicial al cargar el dashboard mientras la bienvenida esté pendiente.

**Architecture:** `src/lib/onboarding/checklist.ts` tiene la lógica pura (`computeChecklist`), la carga de datos con conteos `head: true` (`loadChecklistInput`) y la decisión de mostrar (`loadDashboardChecklist`, que recibe el perfil ya leído). `src/app/dashboard/page.tsx` (server component) lee `profiles` una vez, llama `ensureStarterKitAction()` si la bienvenida está pendiente y `loadDashboardChecklist()` y pasa los ítems como prop serializable a `DashboardContent` (client component), que pinta `OnboardingChecklist` encima de las acciones rápidas. "Ocultar" llama `dismissChecklistAction()`.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase (`@supabase/ssr`, `@supabase/supabase-js`), React 19, Tailwind, lucide-react, sonner, vitest (environment `node`), bun.

**Depende de (flujo APP, ya hechas en este worktree, §5.3):** S10 (`ensureStarterKitAction` v2 en `src/lib/actions/onboarding.ts`) y S11 (`dismissChecklistAction` en el mismo archivo). S12 es la última historia del flujo; la Tarea 1 solo verifica que ambas existan.
**De otros flujos (no están en este worktree; todo compila y los tests pasan sin ellas, con el cliente mockeado):** S09 (columna `profiles.onboarding_dismissed_at`, RPC `ensure_starter_kit`, flujo SEG).

## Global Constraints

- Contratos: `docs/agile/contracts.md` §1.2 y §2.7, con las enmiendas §5.0–§5.3 (prevalecen). Nombres exactos: `ChecklistInput` (con `hasBudgetAmounts`, no `hasExplicitAlerts`), `ChecklistItemId` (con `'presupuesto'`, no `'alertas'`), `ChecklistItem`, `computeChecklist`, `loadChecklistInput`, `loadDashboardChecklist` (extra aceptado, §5.2), `ensureStarterKitAction`, `dismissChecklistAction`.
- Mes actual = `todayBogota().slice(0, 7)` (`src/lib/whatsapp/format.ts`, §0); en funciones puras o testeables se inyecta (parámetro opcional) y los tests no dependen de la hora real.
- `ensureStarterKitAction` nunca lanza (§5.2): se llama **sin** try/catch.
- Textos de UI en español colombiano, tuteo ("tú").
- Ningún dato personal en código, tests ni logs: usar UUIDs inventados; en `console.error` solo el código de error (`error.code`), nunca el `user_id` ni el mensaje/detalle de Postgres.
- Los tests mockean el cliente de Supabase; ningún test ni paso de este plan toca una base real. Prohibido `bun run dev` y `next build` contra `.env.local` (apunta a producción, §5.0). Nunca `bun run db:types`.
- Ninguna migración nueva en esta historia.
- Diseño: fondo oscuro, `Card variant="glass"` como `BudgetAlertsPanel`, verde de éxito `emerald-*`, texto `text-white` / `text-gray-400` (`docs/design-system.md`).
- Verificación del proyecto: `bun run test && bun run type-check`.
- Commits en español terminando en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Los commits de esta historia tocan `src/`, así que van **sin** `--no-verify` (lint-staged corre eslint --fix y prettier; revisa `git status` después de cada commit).

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Ya existe (S10 + S11) | `src/lib/actions/onboarding.ts` | `ensureStarterKitAction` (S10) y `dismissChecklistAction` (S11); no se modifica |
| Ya existe (S10 + S11) | `src/lib/actions/onboarding.test.ts` | Ya cubre esas dos acciones; no se modifica |
| Crear | `src/lib/onboarding/checklist.ts` | Tipos, `computeChecklist`, `loadChecklistInput`, `loadDashboardChecklist` |
| Crear | `src/lib/onboarding/checklist.test.ts` | Tests de las tres funciones |
| Crear | `src/components/organisms/OnboardingChecklist/OnboardingChecklist.tsx` | Tarjeta de la checklist con botón "Ocultar" |
| Modificar | `src/components/pages/DashboardContent.tsx` | Prop `checklist` y render encima de `DashboardQuickActions` |
| Modificar | `src/app/dashboard/page.tsx` | Llama `ensureStarterKitAction()` y `loadDashboardChecklist()` |

**Por qué `page.tsx` + `DashboardContent` y no `DashboardMainContent`:** `page.tsx` ya es server component (usa `getCurrentUser()` y `redirect`), así que puede leer el perfil y contar con el cliente de cookie sin crear otra server action ni un `useEffect`. `DashboardContent` es `'use client'` y arma los slots del template; `DashboardMainContent` vive dentro de la tarjeta que muestra "Cargando datos..." mientras `useDashboardData` carga, lo que escondería la checklist.

## Criterios de aceptación

- [x] `computeChecklist` devuelve siempre 5 ítems en este orden, con estos textos y enlaces:
  | id | label | href | done |
  |---|---|---|---|
  | `cuentas` | Agrega tus cuentas | `/settings` | `accountCount > 1` |
  | `deudas` | Registra tarjetas y deudas | `/deudas` | `deudaCount > 0` |
  | `whatsapp` | Vincula WhatsApp | `/settings` | `linkedPhoneCount > 0` |
  | `documento` | Carga tu cédula para facturas DIAN (sin número vinculado: "… (primero vincula WhatsApp)") | `/settings` | `hasDocumento` |
  | `presupuesto` | Ponle montos a tu presupuesto | `/presupuesto` | `hasBudgetAmounts` |
- [x] `loadChecklistInput(supabase, userId, monthYear = todayBogota().slice(0, 7))` hace 5 conteos con `{ count: 'exact', head: true }`, todos con `eq('user_id', userId)`: `accounts` (+ `eq('is_active', true)`), `deudas` (+ `eq('es_activo', true)`: solo deudas activas), `whatsapp_links`, `whatsapp_links` (+ `not('documento', 'is', null)` + `neq('documento', '')`), `budget_items` del mes (`select('id, budget_templates!inner(month_year)', …)` + `eq('budget_templates.month_year', monthYear)` + `gt('budgeted_amount', 0)`). `count` nulo cuenta como 0. Si una consulta falla, lanza un `Error` cuyo mensaje nombra la consulta y el código, sin el `user_id`.
- [x] El dashboard muestra `OnboardingChecklist` solo si `profiles.onboarding_dismissed_at` es null **y** hay algún ítem pendiente. Lee el perfil **una sola vez** (`onboarding_completed_at, onboarding_dismissed_at`) y se lo pasa a `loadDashboardChecklist(supabase, userId, perfil)`. Si la lectura del perfil o algún conteo falla, no la muestra (y el dashboard carga igual).
- [x] "Ocultar" esconde la tarjeta al instante y guarda `onboarding_dismissed_at = now()` con `dismissChecklistAction()` (de S11, `Promise<{ ok: boolean }>`, §5.2); si devuelve `{ ok: false }` (sin sesión o UPDATE fallido) o la llamada lanza (p. ej. error de red), la tarjeta vuelve y sale un toast "No pudimos ocultar la lista. Intenta de nuevo."
- [x] El dashboard llama `ensureStarterKitAction()` **solo si la bienvenida está pendiente** (`profiles.onboarding_completed_at IS NULL`), antes de contar (el kit crea la cuenta Efectivo), sin try/catch: la acción nunca lanza (§5.2) y un error vuelve en `result.error` sin romper el dashboard. Si la bienvenida ya terminó, si la lectura del perfil falla (p. ej. columna sin migrar) o si no hay fila, no se llama (así nunca se reactivan categorías borradas a propósito; contratos §5.2).
- [x] `bun run test && bun run type-check` en verde.

Columnas verificadas en el repo: `deudas.user_id` (`supabase_ingresos_deudas.sql:29`), `deudas.es_activo BOOLEAN DEFAULT true` (`supabase_ingresos_deudas.sql:36`; es la columna de actividad: el borrado de una deuda es `update({ es_activo: false })` en `src/lib/services/ingresos-deudas.ts:196` y los listados filtran `eq('es_activo', true)`; `pagada` es otra cosa y no se usa aquí), `accounts.user_id` / `accounts.is_active` (`src/lib/actions/accounts.ts:35-38`), `whatsapp_links.user_id` (`supabase/migrations/20260611000000_create_whatsapp_links.sql`), `whatsapp_links.documento` (`supabase/migrations/20260928140000_whatsapp_links_documento.sql`), `budget_items.user_id` / `budget_items.budgeted_amount` / `budget_items.template_id` (`src/types/database.ts:226-243`), única FK `budget_items_template_id_fkey` → `budget_templates` (`src/types/supabase.ts`), con `budget_templates.month_year` `'YYYY-MM'`.

---

### Task 1: Verificar las acciones que dejaron S10 y S11

El flujo APP corre en serie (contratos §5.3): `src/lib/actions/onboarding.ts` y su test los creó S10 (`ensureStarterKitAction`) y los extendió S11 (`dismissChecklistAction` y las acciones de la bienvenida). Esta historia **no** crea ni reescribe ninguna de las dos; solo comprueba que existen y cómo se comportan.

**Files:** ninguno (solo verificación).

**Interfaces:**
- Consumes (ya existen):
  - `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` (S10, §5.2): nunca lanza, no llama `revalidatePath` ni `redirect`; sin sesión `{ seeded: false, error: 'no_session' }`; error de RPC `{ seeded: false, error: <code> }`.
  - `dismissChecklistAction(): Promise<{ ok: boolean }>` (S11, Task 7; §5.2): guarda `profiles.onboarding_dismissed_at = now()` del propio usuario y revalida `/dashboard`; sin sesión o si el UPDATE falla devuelve `{ ok: false }`, registra solo el code y **no lanza**.
- Produces: nada.

- [x] **Step 1: Comprobar que existen una sola vez**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -rn "export async function ensureStarterKitAction\|export async function dismissChecklistAction" src`
Expected: exactamente dos líneas, ambas en `src/lib/actions/onboarding.ts`. Si falta alguna, detente y repórtalo: S10 o S11 no están hechas. **No** las crees aquí.

- [x] **Step 2: Sus tests pasan**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (31 tests: 7 de S10 + 24 de S11).

Sin commit en esta tarea.

---

### Task 2: `computeChecklist` (lógica pura)

**Files:**
- Create: `src/lib/onboarding/checklist.ts`
- Create: `src/lib/onboarding/checklist.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (contrato §2.7 con la enmienda §5.2, exactos):
  ```ts
  export type ChecklistInput = {
    accountCount: number; deudaCount: number; linkedPhoneCount: number;
    hasDocumento: boolean; hasBudgetAmounts: boolean;
  }
  export type ChecklistItemId = 'cuentas' | 'deudas' | 'whatsapp' | 'documento' | 'presupuesto'
  export type ChecklistItem = { id: ChecklistItemId; label: string; href: string; done: boolean }
  export function computeChecklist(input: ChecklistInput): ChecklistItem[]
  ```

- [x] **Step 1: Escribir el test que falla**

Crea `src/lib/onboarding/checklist.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  computeChecklist,
  type ChecklistInput,
  type ChecklistItemId,
} from './checklist';

/** Usuario recién sembrado: solo la cuenta Efectivo del kit. */
const RECIEN_LLEGADO: ChecklistInput = {
  accountCount: 1,
  deudaCount: 0,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
};

describe('computeChecklist', () => {
  it('devuelve los 5 ítems en orden, con su texto y su enlace', () => {
    expect(computeChecklist(RECIEN_LLEGADO)).toEqual([
      {
        id: 'cuentas',
        label: 'Agrega tus cuentas',
        href: '/settings',
        done: false,
      },
      {
        id: 'deudas',
        label: 'Registra tarjetas y deudas',
        href: '/deudas',
        done: false,
      },
      {
        id: 'whatsapp',
        label: 'Vincula WhatsApp',
        href: '/settings',
        done: false,
      },
      {
        id: 'documento',
        label: 'Carga tu cédula para facturas DIAN',
        href: '/settings',
        done: false,
      },
      {
        id: 'presupuesto',
        label: 'Ponle montos a tu presupuesto',
        href: '/presupuesto',
        done: false,
      },
    ]);
  });

  it('la cuenta Efectivo del kit sola no completa "cuentas": hacen falta más de una', () => {
    const cuentas = (n: number) =>
      computeChecklist({ ...RECIEN_LLEGADO, accountCount: n }).find(
        i => i.id === 'cuentas',
      )?.done;

    expect(cuentas(0)).toBe(false);
    expect(cuentas(1)).toBe(false);
    expect(cuentas(2)).toBe(true);
  });

  it('cada ítem depende solo de su dato', () => {
    const casos: Array<[Partial<ChecklistInput>, ChecklistItemId]> = [
      [{ accountCount: 3 }, 'cuentas'],
      [{ deudaCount: 1 }, 'deudas'],
      [{ linkedPhoneCount: 2 }, 'whatsapp'],
      [{ hasDocumento: true }, 'documento'],
      [{ hasBudgetAmounts: true }, 'presupuesto'],
    ];

    for (const [cambio, id] of casos) {
      const hechos = computeChecklist({ ...RECIEN_LLEGADO, ...cambio })
        .filter(i => i.done)
        .map(i => i.id);
      expect(hechos).toEqual([id]);
    }
  });

  it('con todo configurado, los 5 quedan hechos', () => {
    const items = computeChecklist({
      accountCount: 2,
      deudaCount: 1,
      linkedPhoneCount: 1,
      hasDocumento: true,
      hasBudgetAmounts: true,
    });

    expect(items).toHaveLength(5);
    expect(items.every(i => i.done)).toBe(true);
  });
});
```

- [x] **Step 2: Correr el test y ver que falla**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: FAIL con `Failed to resolve import "./checklist"`.

- [x] **Step 3: Implementar**

Crea `src/lib/onboarding/checklist.ts`:

```ts
/**
 * Checklist de configuración del dashboard (S12).
 *
 * El estado de cada ítem se calcula desde los datos del usuario: no hay una
 * columna por ítem que se pueda desfasar. Solo el "ocultar" se guarda
 * (profiles.onboarding_dismissed_at).
 */

export type ChecklistInput = {
  accountCount: number;
  deudaCount: number;
  linkedPhoneCount: number;
  hasDocumento: boolean;
  /** Hay algún rubro del mes actual con budgeted_amount > 0. */
  hasBudgetAmounts: boolean;
};

export type ChecklistItemId =
  | 'cuentas'
  | 'deudas'
  | 'whatsapp'
  | 'documento'
  | 'presupuesto';

export type ChecklistItem = {
  id: ChecklistItemId;
  label: string;
  href: string;
  done: boolean;
};

export function computeChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    {
      id: 'cuentas',
      label: 'Agrega tus cuentas',
      href: '/settings',
      // El kit ya crea "Efectivo": solo cuenta si agregó al menos otra.
      done: input.accountCount > 1,
    },
    {
      id: 'deudas',
      label: 'Registra tarjetas y deudas',
      href: '/deudas',
      done: input.deudaCount > 0,
    },
    {
      id: 'whatsapp',
      label: 'Vincula WhatsApp',
      href: '/settings',
      done: input.linkedPhoneCount > 0,
    },
    {
      id: 'documento',
      label: 'Carga tu cédula para facturas DIAN',
      href: '/settings',
      done: input.hasDocumento,
    },
    {
      id: 'presupuesto',
      label: 'Ponle montos a tu presupuesto',
      href: '/presupuesto',
      // El kit siembra los rubros en 0: hecho cuando alguno del mes tiene monto.
      done: input.hasBudgetAmounts,
    },
  ];
}
```

- [x] **Step 4: Correr el test y ver que pasa**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/onboarding/checklist.ts src/lib/onboarding/checklist.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): computeChecklist calcula los 5 pasos desde los datos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)" && git status --short
```

---

### Task 3: `loadChecklistInput` (conteos con cliente mockeado)

**Files:**
- Modify: `src/lib/onboarding/checklist.ts` (agregar import de tipo y la función al final)
- Modify: `src/lib/onboarding/checklist.test.ts` (agregar cliente falso y un `describe`)

**Interfaces:**
- Consumes: `ChecklistInput` (Task 2); `SupabaseClient` de `@supabase/supabase-js` (sin genérico = esquema `any`, igual que `src/lib/dian/historial-clasificacion.ts`; el `Database` de `src/types/database.ts` no tiene `accounts` ni `deudas`).
- Consumes también: `todayBogota()` de `@/lib/whatsapp/format` (mes actual por defecto).
- Produces: `export async function loadChecklistInput(supabase: SupabaseClient, userId: string, monthYear?: string): Promise<ChecklistInput>` — la firma del contrato más un `monthYear` opcional (`'YYYY-MM'`, por defecto `todayBogota().slice(0, 7)`) para no depender de la hora real en los tests. Lanza `Error('loadChecklistInput: <consulta> <código>')` si alguna consulta devuelve `error`.

- [x] **Step 1: Escribir el test que falla**

En `src/lib/onboarding/checklist.test.ts`:

1. Reemplaza la primera línea de imports por:

```ts
import { describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';
```

2. Reemplaza el import de `./checklist` por:

```ts
import {
  computeChecklist,
  loadChecklistInput,
  type ChecklistInput,
  type ChecklistItemId,
} from './checklist';
```

3. Agrega al final del archivo:

```ts
const USER_ID = '00000000-0000-4000-8000-000000000001';

type Llamada = { metodo: string; args: unknown[] };
type Consulta = { tabla: string; llamadas: Llamada[] };
type Respuesta = {
  data?: unknown;
  count?: number | null;
  error: { code: string } | null;
};

/**
 * Cliente falso: cada from() arma una consulta que registra sus llamadas
 * (select, eq, not, gt, maybeSingle) y al hacer await responde con lo que
 * decida `responder` mirando la tabla y los filtros.
 */
function clienteFalso(responder: (c: Consulta) => Respuesta) {
  const consultas: Consulta[] = [];
  const from = vi.fn((tabla: string) => {
    const consulta: Consulta = { tabla, llamadas: [] };
    consultas.push(consulta);
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'not', 'gt', 'maybeSingle']) {
      builder[metodo] = (...args: unknown[]) => {
        consulta.llamadas.push({ metodo, args });
        return builder;
      };
    }
    builder.then = (
      ok: (r: Respuesta) => unknown,
      fallo?: (e: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => responder(consulta))
        .then(ok, fallo);
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, from, consultas };
}

function llamo(c: Consulta, metodo: string, ...args: unknown[]): boolean {
  return c.llamadas.some(
    l => l.metodo === metodo && JSON.stringify(l.args) === JSON.stringify(args),
  );
}

function filtraNoNulo(c: Consulta, columna: string): boolean {
  return llamo(c, 'not', columna, 'is', null);
}

type Conteos = {
  accounts: number | null;
  deudas: number | null;
  links: number | null;
  linksConDocumento: number | null;
  presupuesto: number | null;
};

const CEROS: Conteos = {
  accounts: 0,
  deudas: 0,
  links: 0,
  linksConDocumento: 0,
  presupuesto: 0,
};

const MES = '2026-09';
const SELECT_RUBROS_DEL_MES = 'id, budget_templates!inner(month_year)';

function responderConteos(
  conteos: Conteos,
  fallas: Partial<Record<string, string>> = {},
) {
  return (c: Consulta): Respuesta => {
    const clave =
      c.tabla === 'whatsapp_links' && filtraNoNulo(c, 'documento')
        ? 'whatsapp_links.documento'
        : c.tabla;
    if (fallas[clave]) return { count: null, error: { code: fallas[clave] } };
    switch (clave) {
      case 'accounts':
        return { count: conteos.accounts, error: null };
      case 'deudas':
        return { count: conteos.deudas, error: null };
      case 'whatsapp_links':
        return { count: conteos.links, error: null };
      case 'whatsapp_links.documento':
        return { count: conteos.linksConDocumento, error: null };
      case 'budget_items':
        return { count: conteos.presupuesto, error: null };
      default:
        throw new Error(`tabla inesperada: ${c.tabla}`);
    }
  };
}

describe('loadChecklistInput', () => {
  it('cuenta con head:true, filtra todo por user_id y arma el input', async () => {
    const { client, consultas } = clienteFalso(
      responderConteos({
        accounts: 2,
        deudas: 3,
        links: 1,
        linksConDocumento: 1,
        presupuesto: 4,
      }),
    );

    await expect(loadChecklistInput(client, USER_ID, MES)).resolves.toEqual({
      accountCount: 2,
      deudaCount: 3,
      linkedPhoneCount: 1,
      hasDocumento: true,
      hasBudgetAmounts: true,
    });

    expect(consultas.map(c => c.tabla).sort()).toEqual([
      'accounts',
      'budget_items',
      'deudas',
      'whatsapp_links',
      'whatsapp_links',
    ]);
    for (const c of consultas) {
      const columnas = c.tabla === 'budget_items' ? SELECT_RUBROS_DEL_MES : 'id';
      expect(
        llamo(c, 'select', columnas, { count: 'exact', head: true }),
      ).toBe(true);
      expect(llamo(c, 'eq', 'user_id', USER_ID)).toBe(true);
    }

    const cuentas = consultas.find(c => c.tabla === 'accounts')!;
    expect(llamo(cuentas, 'eq', 'is_active', true)).toBe(true);

    // Solo deudas activas (§5.2): la columna es es_activo.
    const deudas = consultas.find(c => c.tabla === 'deudas')!;
    expect(llamo(deudas, 'eq', 'es_activo', true)).toBe(true);

    const links = consultas.filter(c => c.tabla === 'whatsapp_links');
    expect(links.filter(c => filtraNoNulo(c, 'documento'))).toHaveLength(1);

    // Rubros del mes con monto (§5.2).
    const rubros = consultas.find(c => c.tabla === 'budget_items')!;
    expect(llamo(rubros, 'eq', 'budget_templates.month_year', MES)).toBe(true);
    expect(llamo(rubros, 'gt', 'budgeted_amount', 0)).toBe(true);
  });

  it('sin mes, usa el mes actual de Bogotá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 3:00 UTC del 1 de octubre = 22:00 del 30 de septiembre en Bogotá.
    vi.setSystemTime(new Date('2026-10-01T03:00:00.000Z'));
    try {
      const { client, consultas } = clienteFalso(responderConteos(CEROS));

      await loadChecklistInput(client, USER_ID);

      const rubros = consultas.find(c => c.tabla === 'budget_items')!;
      expect(llamo(rubros, 'eq', 'budget_templates.month_year', '2026-09')).toBe(
        true,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('count nulo cuenta como 0', async () => {
    const { client } = clienteFalso(
      responderConteos({
        accounts: null,
        deudas: null,
        links: null,
        linksConDocumento: null,
        presupuesto: null,
      }),
    );

    await expect(loadChecklistInput(client, USER_ID, MES)).resolves.toEqual({
      accountCount: 0,
      deudaCount: 0,
      linkedPhoneCount: 0,
      hasDocumento: false,
      hasBudgetAmounts: false,
    });
  });

  it('con documento en 0 y sin rubros con monto, los booleanos quedan en false', async () => {
    const { client } = clienteFalso(
      responderConteos({ ...CEROS, accounts: 1, links: 2 }),
    );

    const input = await loadChecklistInput(client, USER_ID, MES);
    expect(input.linkedPhoneCount).toBe(2);
    expect(input.hasDocumento).toBe(false);
    expect(input.hasBudgetAmounts).toBe(false);
  });

  it('si una consulta falla, lanza nombrando la consulta y el código, sin el user_id', async () => {
    const { client } = clienteFalso(
      responderConteos(CEROS, { deudas: '42P01' }),
    );

    const error = await loadChecklistInput(client, USER_ID, MES).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/deudas.*42P01/);
    expect((error as Error).message).not.toContain(USER_ID);
  });
});
```

- [x] **Step 2: Correr el test y ver que falla**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: FAIL — `loadChecklistInput is not a function` en los 5 tests nuevos (los 4 de `computeChecklist` siguen en verde).

- [x] **Step 3: Implementar**

En `src/lib/onboarding/checklist.ts`, agrega justo después del comentario inicial del archivo (antes de `export type ChecklistInput`):

```ts
import { todayBogota } from '@/lib/whatsapp/format';

import type { SupabaseClient } from '@supabase/supabase-js';
```

Y agrega al final del archivo:

```ts
/** Solo el número de filas: head:true no trae ninguna. */
const CONTEO = { count: 'exact', head: true } as const;

/**
 * Datos de la checklist con 5 conteos en paralelo, todos filtrados por el
 * usuario (además de RLS). `monthYear` ('YYYY-MM') es el mes de los rubros
 * que cuentan para "presupuesto"; por defecto el actual de Bogotá. Lanza si
 * alguna consulta falla: quien llama decide no mostrar la checklist antes que
 * mostrarla con datos falsos.
 */
export async function loadChecklistInput(
  supabase: SupabaseClient,
  userId: string,
  monthYear: string = todayBogota().slice(0, 7),
): Promise<ChecklistInput> {
  const [cuentas, deudas, links, linksConDocumento, presupuesto] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .eq('is_active', true),
      // Solo deudas activas: borrar una deuda es es_activo = false.
      supabase
        .from('deudas')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .eq('es_activo', true),
      supabase.from('whatsapp_links').select('id', CONTEO).eq('user_id', userId),
      supabase
        .from('whatsapp_links')
        .select('id', CONTEO)
        .eq('user_id', userId)
        .not('documento', 'is', null),
      // Rubros del mes con monto: el join !inner con budget_templates (FK
      // budget_items_template_id_fkey) deja filtrar por month_year.
      supabase
        .from('budget_items')
        .select('id, budget_templates!inner(month_year)', CONTEO)
        .eq('user_id', userId)
        .eq('budget_templates.month_year', monthYear)
        .gt('budgeted_amount', 0),
    ]);

  const resultados: Array<[string, { error: { code: string } | null }]> = [
    ['accounts', cuentas],
    ['deudas', deudas],
    ['whatsapp_links', links],
    ['whatsapp_links.documento', linksConDocumento],
    ['budget_items.mes', presupuesto],
  ];
  for (const [nombre, r] of resultados) {
    if (r.error) {
      // Solo el nombre de la consulta y el código: nada del usuario.
      throw new Error(`loadChecklistInput: ${nombre} ${r.error.code}`);
    }
  }

  return {
    accountCount: cuentas.count ?? 0,
    deudaCount: deudas.count ?? 0,
    linkedPhoneCount: links.count ?? 0,
    hasDocumento: (linksConDocumento.count ?? 0) > 0,
    hasBudgetAmounts: (presupuesto.count ?? 0) > 0,
  };
}
```

- [x] **Step 4: Correr el test y ver que pasa**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: PASS (9 tests).

- [x] **Step 5: Type-check**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run type-check`
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/onboarding/checklist.ts src/lib/onboarding/checklist.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): loadChecklistInput cuenta cuentas, deudas, WhatsApp y presupuesto

Cinco conteos head:true filtrados por user_id: solo deudas activas y rubros
del mes con monto. Si uno falla, lanza sin datos del usuario.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)" && git status --short
```

---

### Task 4: `loadDashboardChecklist` (ocultada o completa → no se muestra)

**Files:**
- Modify: `src/lib/onboarding/checklist.ts` (agregar al final)
- Modify: `src/lib/onboarding/checklist.test.ts` (import y un `describe` al final)

**Interfaces:**
- Consumes: `computeChecklist`, `loadChecklistInput`, `ChecklistItem` (Tasks 2–3); columna `profiles.onboarding_dismissed_at` (S09).
- Produces: `export async function loadDashboardChecklist(supabase: SupabaseClient, userId: string): Promise<ChecklistItem[] | null>` — `null` = no mostrar. No lanza. (Función adicional a las del contrato; no cambia ninguna firma del contrato.)

- [x] **Step 1: Escribir el test que falla**

En `src/lib/onboarding/checklist.test.ts`, agrega `loadDashboardChecklist` al import de `./checklist`:

```ts
import {
  computeChecklist,
  loadChecklistInput,
  loadDashboardChecklist,
  type ChecklistInput,
  type ChecklistItemId,
} from './checklist';
```

Cambia la primera línea de imports de vitest por:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
```

Y agrega al final:

```ts
describe('loadDashboardChecklist', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function responderDashboard(
    perfil: Respuesta,
    conteos: Conteos = CEROS,
    fallas: Partial<Record<string, string>> = {},
  ) {
    const conteo = responderConteos(conteos, fallas);
    return (c: Consulta): Respuesta =>
      c.tabla === 'profiles' ? perfil : conteo(c);
  }

  it('si ya la ocultó, devuelve null sin hacer los conteos', async () => {
    const { client, from, consultas } = clienteFalso(
      responderDashboard({
        data: { onboarding_dismissed_at: '2026-09-01T00:00:00.000Z' },
        error: null,
      }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    const perfil = consultas[0];
    expect(perfil.tabla).toBe('profiles');
    expect(llamo(perfil, 'select', 'onboarding_dismissed_at')).toBe(true);
    expect(llamo(perfil, 'eq', 'id', USER_ID)).toBe(true);
    expect(llamo(perfil, 'maybeSingle')).toBe(true);
  });

  it('si no la ocultó y hay pendientes, devuelve los 5 ítems', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        { ...CEROS, accounts: 1, deudas: 2 },
      ),
    );

    const items = await loadDashboardChecklist(client, USER_ID);
    expect(items).toHaveLength(5);
    expect(items!.filter(i => i.done).map(i => i.id)).toEqual(['deudas']);
  });

  it('si todo está hecho, devuelve null', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        { accounts: 2, deudas: 1, links: 1, linksConDocumento: 1, presupuesto: 1 },
      ),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
  });

  it('si la lectura del perfil falla (p. ej. columna sin migrar), devuelve null y registra solo el código', async () => {
    const { client, from } = clienteFalso(
      responderDashboard({ data: null, error: { code: '42703' } }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), '42703');
  });

  it('sin fila de perfil, devuelve null', async () => {
    const { client } = clienteFalso(
      responderDashboard({ data: null, error: null }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
  });

  it('si un conteo falla, devuelve null sin lanzar y sin loguear el user_id', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        CEROS,
        { budget_items: '42501' },
      ),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    const logueado = JSON.stringify(
      (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls,
    );
    expect(logueado).toContain('42501');
    expect(logueado).not.toContain(USER_ID);
  });
});
```

- [x] **Step 2: Correr el test y ver que falla**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: FAIL — `loadDashboardChecklist is not a function` (los 9 tests anteriores siguen en verde).

- [x] **Step 3: Implementar**

Agrega al final de `src/lib/onboarding/checklist.ts`:

```ts
/**
 * Lo que el dashboard necesita: los ítems si hay que mostrar la checklist, o
 * null si no (la ocultó, ya hizo todo, o algo falló). Nunca lanza: la
 * checklist es opcional y no debe tumbar el dashboard.
 *
 * Una fila sin la columna (migración S09 sin aplicar) da undefined y se trata
 * como ocultada.
 */
export async function loadDashboardChecklist(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChecklistItem[] | null> {
  const { data: perfil, error } = await supabase
    .from('profiles')
    .select('onboarding_dismissed_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('loadDashboardChecklist: error leyendo el perfil:', error.code);
    return null;
  }
  if (!perfil || perfil.onboarding_dismissed_at !== null) {
    return null;
  }

  let input: ChecklistInput;
  try {
    input = await loadChecklistInput(supabase, userId);
  } catch (err) {
    // El mensaje de loadChecklistInput solo trae la consulta y el código.
    console.error(
      'loadDashboardChecklist:',
      err instanceof Error ? err.message : 'error desconocido',
    );
    return null;
  }

  const items = computeChecklist(input);
  return items.some(i => !i.done) ? items : null;
}
```

- [x] **Step 4: Correr el test y ver que pasa**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/onboarding/checklist.test.ts`
Expected: PASS (15 tests).

- [x] **Step 5: Type-check**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run type-check`
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/onboarding/checklist.ts src/lib/onboarding/checklist.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): loadDashboardChecklist decide si mostrar la checklist

Null si la ocultó, si ya hizo todo o si falla una lectura: el dashboard
carga igual.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)" && git status --short
```

---

### Task 5: Componente `OnboardingChecklist` e integración en el dashboard

**Files:**
- Create: `src/components/organisms/OnboardingChecklist/OnboardingChecklist.tsx`
- Modify: `src/components/pages/DashboardContent.tsx` (imports, props, slot `quickActions`)
- Modify: `src/app/dashboard/page.tsx` (reemplazo completo)

**Interfaces:**
- Consumes: `ChecklistItem`, `loadDashboardChecklist` (Tasks 2–4); `ensureStarterKitAction` (S10, nunca lanza), `dismissChecklistAction` (S11), verificadas en la Task 1; `createClient` de `@/lib/supabase/server`; `Card` de `@/components/atoms/Card/Card`; `Button` de `@/components/atoms/Button/Button`.
- Produces: `export default function OnboardingChecklist({ items }: { items: ChecklistItem[] })`; `DashboardContent` acepta la prop opcional `checklist?: ChecklistItem[] | null`.

El repo no tiene tests de componentes (vitest corre en `node`, sin DOM ni Testing Library). Esta tarea se verifica con la suite completa, `type-check` y eslint; la lógica que decide qué mostrar ya quedó probada en las Tasks 2–4.

- [x] **Step 1: Crear el componente**

Crea `src/components/organisms/OnboardingChecklist/OnboardingChecklist.tsx`:

```tsx
/**
 * OnboardingChecklist - Organism Level
 *
 * Pasos de configuración pendientes en el dashboard. El estado de cada ítem
 * viene calculado del servidor (loadDashboardChecklist); aquí solo se pinta y
 * se oculta. "Ocultar" esconde la tarjeta al instante y guarda
 * onboarding_dismissed_at con dismissChecklistAction (S11); si la llamada
 * lanza (p. ej. error de red), la tarjeta vuelve.
 */
'use client';

import React, { useState, useTransition } from 'react';

import Link from 'next/link';

import { CheckCircle2, ChevronRight, Circle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import { dismissChecklistAction } from '@/lib/actions/onboarding';
import type { ChecklistItem } from '@/lib/onboarding/checklist';

interface OnboardingChecklistProps {
  items: ChecklistItem[];
}

export default function OnboardingChecklist({
  items,
}: OnboardingChecklistProps) {
  const [oculta, setOculta] = useState(false);
  const [, startTransition] = useTransition();

  if (oculta || items.length === 0) return null;

  const hechos = items.filter(i => i.done).length;
  const porcentaje = Math.round((hechos / items.length) * 100);

  const ocultar = () => {
    setOculta(true);
    startTransition(async () => {
      try {
        await dismissChecklistAction();
      } catch {
        setOculta(false);
        toast.error('No pudimos ocultar la lista. Intenta de nuevo.');
      }
    });
  };

  return (
    <Card variant="glass" className="p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <ListChecks className="h-5 w-5 text-emerald-400" />
            Termina de configurar tu presupuesto
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {hechos} de {items.length} listos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={ocultar}
          className="text-gray-300 hover:text-white"
        >
          Ocultar
        </Button>
      </div>

      <div
        className="mb-4 h-2 w-full overflow-hidden rounded bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={hechos}
        aria-label="Pasos completados"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <ul className="space-y-1">
        {items.map(item =>
          item.done ? (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-gray-400"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span className="line-through">{item.label}</span>
            </li>
          ) : (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Circle className="h-5 w-5 shrink-0 text-gray-500" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </Link>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}
```

- [x] **Step 2: Pasar la checklist por `DashboardContent`**

En `src/components/pages/DashboardContent.tsx`:

a) Agrega el import del organismo después de `import DashboardSummaryCards from '@/components/organisms/DashboardSummaryCards/DashboardSummaryCards';`:

```tsx
import OnboardingChecklist from '@/components/organisms/OnboardingChecklist/OnboardingChecklist';
```

b) Agrega el import del tipo antes de `import { BudgetCategory } from '@/lib/services/budget';`:

```tsx
import type { ChecklistItem } from '@/lib/onboarding/checklist';
```

c) Reemplaza:

```tsx
interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({
  user: _user,
}: DashboardContentProps) {
```

por:

```tsx
interface DashboardContentProps {
  user: User;
  /** Pasos de configuración pendientes; null o ausente = no mostrar. */
  checklist?: ChecklistItem[] | null;
}

export default function DashboardContent({
  user: _user,
  checklist = null,
}: DashboardContentProps) {
```

d) Reemplaza:

```tsx
  const quickActions = <DashboardQuickActions />;
```

por:

```tsx
  const quickActions = (
    <div className="space-y-6">
      {checklist && <OnboardingChecklist items={checklist} />}
      <DashboardQuickActions />
    </div>
  );
```

- [x] **Step 3: Cargar la checklist en el server component**

Reemplaza todo `src/app/dashboard/page.tsx` por:

```tsx
import { redirect } from 'next/navigation';

import DashboardContent from '@/components/pages/DashboardContent';
import { getCurrentUser } from '@/lib/actions/auth';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loadDashboardChecklist } from '@/lib/onboarding/checklist';
import { createClient } from '@/lib/supabase/server';

/**
 * DashboardPage - Página principal del dashboard
 * Server Component protegido que requiere autenticación.
 * Repara el kit inicial si hace falta y calcula la checklist de
 * configuración antes de renderizar el contenido (cliente).
 */
export default async function DashboardPage() {
  // Verificar autenticación en el servidor
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Repara a quien el trigger de registro no le sembró el kit (ADR-001).
  // Idempotente. Va antes de la checklist porque el kit crea la cuenta
  // Efectivo que la checklist cuenta. Nunca lanza (contratos §5.2): un fallo
  // vuelve en `error` y el dashboard carga igual, sin try/catch.
  await ensureStarterKitAction();

  const checklist = await loadDashboardChecklist(await createClient(), user.id);

  // Pasar datos del usuario al componente cliente
  return <DashboardContent user={user} checklist={checklist} />;
}
```

- [x] **Step 4: Verificación del proyecto**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: toda la suite en PASS y `tsc --noEmit` sin errores.

Si `tsc` rechaza pasar `await createClient()` como `SupabaseClient` (no debería: `cargarHistorialManual(await createClient(), userId)` en `src/app/api/invoices/process/route.ts` hace lo mismo con `SupabaseClient<any>`), cambia la línea a:

```tsx
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const checklist = await loadDashboardChecklist(supabase, user.id);
```

y agrega al final de los imports `import type { SupabaseClient } from '@supabase/supabase-js';`.

- [x] **Step 5: Lint de los archivos tocados**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bunx eslint src/components/organisms/OnboardingChecklist/OnboardingChecklist.tsx src/components/pages/DashboardContent.tsx src/app/dashboard/page.tsx src/lib/onboarding/checklist.ts src/lib/onboarding/checklist.test.ts`
Expected: sin errores (warnings de orden de imports se arreglan con `--fix`).

- [x] **Step 6: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/components/organisms/OnboardingChecklist/OnboardingChecklist.tsx src/components/pages/DashboardContent.tsx src/app/dashboard/page.tsx && git commit -m "$(cat <<'EOF'
feat(dashboard): checklist de configuración y reparación del kit al cargar

El server component llama ensureStarterKitAction y loadDashboardChecklist;
OnboardingChecklist se pinta encima de las acciones rápidas y "Ocultar"
guarda onboarding_dismissed_at.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)" && git status --short
```

**Verificación visual:** queda para S14 (después de H8). Antes de aplicar la migración de S09 la lectura de `onboarding_dismissed_at` falla con `42703` y la checklist no aparece (comportamiento esperado y probado en la Task 4), y `ensureStarterKitAction` devuelve `{ seeded: false, error }` sin romper la página. No corras `bun run dev` ni `next build` contra `.env.local` (§5.0).

---

## Autorrevisión

- **Cobertura de la épica S12:** `computeChecklist` (con `'presupuesto'`) y `loadChecklistInput` (deudas activas, rubros del mes con monto) con tests → Tasks 2–3. `OnboardingChecklist` en el dashboard y "Ocultar" guarda `onboarding_dismissed_at` → Tasks 4, 5 (acción de S11, verificada en la Task 1). El dashboard llama `ensureStarterKitAction()` al cargar, sin try/catch → Task 5 (Step 3). Mostrar solo si `onboarding_dismissed_at` es null y hay pendientes (contrato §2.7) → Task 4.
- **Marcadores:** ninguno; todo el código está escrito.
- **Tipos:** `ChecklistInput` (con `hasBudgetAmounts`), `ChecklistItemId` (con `'presupuesto'`), `ChecklistItem`, `computeChecklist`, `loadChecklistInput(supabase: SupabaseClient, userId: string, monthYear?: string)` (el tercer parámetro es opcional: la firma del contrato sigue valiendo), `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>`, `dismissChecklistAction(): Promise<{ ok: boolean }>` idénticos al contrato §2.7 + §5.2. `loadDashboardChecklist` es el extra aceptado en §5.2 y solo lo usa `page.tsx`.
- **Historias previas (§5.3):** S12 cierra el flujo APP; S10 y S11 ya dejaron las dos acciones y la Task 1 solo las verifica. S09 (flujo SEG) no está en este worktree: sin sus columnas, la checklist no se muestra (probado en la Task 4).
- **Limitación resuelta en v2:** el ítem `'alertas'` salía hecho desde el primer día (el kit siembra `alerts_enabled = true` en 7 rubros); §5.2 lo reemplaza por `'presupuesto'`, que el kit deja pendiente (rubros en 0).

## Desviaciones (implementación)

- **Rutas:** los comandos del plan usan `/Users/migue/Repos/personal/PresupuestoApp`; se corrieron en el worktree `PresupuestoApp-app`.
- **Task 1:** `onboarding.test.ts` tiene 36 tests (no 31): S11 agregó más casos. `dismissChecklistAction` ya devuelve `Promise<{ ok: boolean }>` (§5.2), no `Promise<void>`.
- **Commits:** con `--no-verify` y `bunx eslint` + `bunx prettier --check` manuales antes de cada commit (instrucción del orquestador), no con lint-staged.
- **Task 5, kit solo con la bienvenida pendiente (orquestador, tras S09):** `page.tsx` lee `profiles.onboarding_completed_at` y llama `ensureStarterKitAction()` solo si es `null`. Si ya terminó la bienvenida no la llama (el kit reactivaría categorías borradas a propósito); si la lectura falla (columna sin migrar) o no hay fila, tampoco. Reemplaza el criterio "en cada carga". Probado en `src/app/dashboard/page.test.tsx` (tres ramas + sin fila + sin sesión + orden kit → checklist).
- **Task 5, "Ocultar" con `{ ok: false }`:** la lógica va en `hideChecklist` (`checklist.ts`, con `DISMISS_ERROR_MESSAGE`), con dependencias inyectadas y tests: oculta al instante, y restaura con toast si la acción devuelve `{ ok: false }` o lanza. El componente solo la conecta (sin `useTransition`).
- **Task 5, tests de componente:** S11 habilitó JSX en vitest (oxc), así que `OnboardingChecklist.render.test.tsx` renderiza con `renderToStaticMarkup` y verifica el cableado con `hideChecklist`; `page.test.tsx` además verifica por texto que `DashboardContent` pinta la checklist encima de las acciones rápidas.
- **Task 5, `createClient`:** la página crea el cliente una vez y lo usa para el perfil y para `loadDashboardChecklist`; compila sin el cast alternativo.
- **Ronda de revisión 1:**
  - `loadDashboardChecklist(supabase, userId, perfil)` recibe el perfil ya leído: `page.tsx` hace una sola lectura de `profiles` (`onboarding_completed_at, onboarding_dismissed_at`) en vez de dos en serie. Con error o sin fila le pasa `null` (no se muestra). No se paraleliza con el kit: el kit depende de esa lectura y la checklist cuenta la cuenta Efectivo que crea el kit.
  - Ítem `documento`: el conteo agrega `neq('documento', '')` (un documento vacío no es cédula). La cédula se carga por número en `DocumentosDianPanel` (Ajustes), que exige un número vinculado; sin número el texto del ítem dice "(primero vincula WhatsApp)". Se mantienen los 5 ítems (el contrato fija los ids).
  - Tests de componente por comportamiento: `OnboardingChecklist.render.test.tsx` captura el `onClick` de "Ocultar" (Button simulado) y registra los cambios de `oculta` (`useState` envuelto): oculta al instante, restaura con toast si `ok: false` o si lanza. `DashboardContent.render.test.tsx` renderiza el dashboard con datos simulados y verifica la tarjeta en el HTML. Sin Testing Library (§5.0: sin DOM), así que "desaparece" se prueba por el estado pedido, no por un re-render.
  - `page.test.tsx` restaura los spies en `afterEach`.

## Alcance adicional (deuda de S11, instrucción del orquestador)

- [x] **Extra 1 — el paso 2 del wizard envía solo lo que cambió** (arreglo arrastrado de S11, fuera del alcance de la checklist; va en su propio commit `43d1bbd`): `montosCambiados(cargados, montos)` y `saveBudgetStep({ montos, cargados, save, notify })` en `src/lib/onboarding/wizard-steps.ts` (tests: solo los editados, sin cambios no llama la acción; los tests viejos pasan `cargados: {}`). `OnboardingWizard` guarda `montosGuardados` (inicial = lo cargado; tras guardar = lo enviado) y lo pasa como `cargados` (test de cableado). Así no se pisan montos editados en otra pestaña ni los decimales que llegaron redondeados.
- [x] **Extra 2 — notas de desviación que faltaban en `S11-bienvenida.md`** (Tasks 3, 5, 7 y 8).

