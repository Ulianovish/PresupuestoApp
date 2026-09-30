# S10 — Estados vacíos y navegación: plan de implementación

> **Alineado con contratos v2 (§5).** §5.2 (`ensureStarterKitAction` nunca lanza y devuelve `{ seeded, error? }`; S10 crea `onboarding.ts`) y §5.3 (flujo APP: S07 → S08 → **S10** → S13 → S11 → S12) prevalecen sobre §2.7 y §4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario nuevo (0 categorías) pueda salir de `/presupuesto`, que el menú móvil tenga Ajustes y Cerrar sesión, que `/test` desaparezca de ambos menús y que "Agregar Gasto" del dashboard abra el formulario de `/gastos`.

**Architecture:** La lógica que decide qué panel mostrar y qué mensaje dar tras cargar el kit va a funciones puras en `src/lib/onboarding/` (probadas con vitest). Los componentes solo pintan lo que esas funciones deciden. El botón del dashboard navega a `/gastos?nuevo=1`; `/gastos` lee el parámetro con `window.location.search` en un `useEffect` (sin `useSearchParams`, que obligaría a envolver la página en `Suspense`), abre el modal y limpia la URL. "Cargar categorías sugeridas" llama `ensureStarterKitAction()`, que crea esta historia con la firma v2 (contratos §5.2: S10 crea `src/lib/actions/onboarding.ts` y su test solo con esa acción; S11 los extiende y S12 solo los usa). La acción nunca lanza; el aviso sale de `result.seeded`/`result.error`.

**Tech Stack:** Next.js 15 (App Router, componentes cliente), React 19, Supabase (`@supabase/ssr`), vitest 4 (`environment: 'node'`), lucide-react, bun.

## Global Constraints

- Textos de UI en español colombiano, tuteo ("tú", no "vos").
- Nombres exactos del contrato (§5.2): `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` en `src/lib/actions/onboarding.ts`, `'use server'`, cliente de cookie y `auth.getUser()`, `rpc('ensure_starter_kit')`. Nunca lanza, sin `revalidatePath` ni `redirect`; sin sesión `{ seeded: false, error: 'no_session' }`; error de RPC `{ seeded: false, error: <code> }` + `console.warn` solo con el code.
- Ningún test toca una base real: el cliente de Supabase se mockea.
- Ningún dato personal en código ni tests (sin correos, teléfonos ni nombres reales).
- Orden (contratos §5.3, flujo APP, en serie en el mismo worktree): S07 y S08 **ya están hechas**. S07 dejó `Sidebar.tsx` sin la tarjeta de montos ni `useBudgetData` y `src/app/gastos/page.tsx` con `useMemo`/`withFormDefaults`; S08 dejó `src/app/presupuesto/page.tsx` con `defaultItemFormNames`. En esos archivos esta historia solo quita la entrada `/test` + su import (Sidebar), agrega un import + un `useEffect` (gastos) y cablea el panel vacío (presupuesto). Ancla cada cambio por texto, no por número de línea (las historias anteriores los movieron).
- Historias de otros flujos **no** están en este worktree: S09 (RPC `ensure_starter_kit`, flujo SEG) y S04. Todo compila y los tests pasan sin ellas (cliente mockeado).
- Prohibido `bun run dev` y `next build` contra `.env.local` (apunta a producción, §5.0). Nunca `bun run db:types`.
- La ruta `src/app/test` y su entrada en `middleware.ts` se quedan; solo sale del menú.
- No hay `@testing-library` instalado y vitest corre en `node`: los componentes se verifican con tests de texto sobre el archivo fuente (leen el `.tsx` y buscan/descartan cadenas) más `bun run type-check`. La lógica se prueba en funciones puras.
- Verificación del proyecto: `bun run test && bun run type-check`.
- Commits en español terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- No se aplica ninguna migración ni se accede a la base de producción. La RPC `ensure_starter_kit` la crea S09 y se aplica en H8; hasta entonces la acción devuelve `{ seeded: false, error: <code> }` y la UI lo muestra como error recuperable (toast) sin romper la página.

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Crear | `src/lib/onboarding/budget-empty-state.ts` | `getBudgetPanelState`, `starterKitToast`, `STARTER_KIT_ERROR_MESSAGE` |
| Crear | `src/lib/onboarding/budget-empty-state.test.ts` | Tests de lo anterior |
| Crear | `src/lib/actions/onboarding.ts` | Solo `ensureStarterKitAction` con la firma v2 (§5.2); S11 lo extiende, S12 solo lo usa |
| Crear | `src/lib/actions/onboarding.test.ts` | Tests de `ensureStarterKitAction` |
| Modificar | `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx` | Panel vacío con "Cargar categorías sugeridas" y "Crear categoría"; sin "Migrar Datos de Julio" |
| Crear | `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts` | Test de texto del panel |
| Modificar | `src/app/presupuesto/page.tsx` (destructuring de `useMonthlyBudget`, tras `showToast`, JSX de `statusPanels`, imports; S08 ya lo tocó) | Cablear el panel con `CategoryModal` y `ensureStarterKitAction` |
| Modificar | `src/components/molecules/MobileSidebar/MobileSidebar.tsx` | Ajustes y Cerrar sesión; sin `/test` |
| Modificar | `src/components/organisms/Sidebar/Sidebar.tsx:22,47` | Quitar `/test` y el import `FlaskConical` (nada más) |
| Crear | `src/components/molecules/MobileSidebar/MobileSidebar.test.ts` | Test de texto de ambos menús |
| Crear | `src/lib/onboarding/nuevo-gasto.ts` | `NUEVO_GASTO_PARAM`, `NUEVO_GASTO_HREF`, `wantsNewExpenseForm`, `stripNewExpenseParam` |
| Crear | `src/lib/onboarding/nuevo-gasto.test.ts` | Tests de lo anterior |
| Modificar | `src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx:22-26` | "Agregar Gasto" como `Link` a `NUEVO_GASTO_HREF` |
| Crear | `src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts` | Test de texto del botón y del `useEffect` de `/gastos` |
| Modificar | `src/app/gastos/page.tsx` (1 import + 1 `useEffect` tras `useMonthlyExpenses()`; S07 ya lo tocó) | Abrir el formulario si llega `?nuevo=1` |

## Criterios de aceptación

1. `/presupuesto` de un usuario sin categorías activas muestra "Aún no tienes categorías" con dos botones: **Cargar categorías sugeridas** (llama `ensureStarterKitAction()` y recarga) y **Crear categoría** (abre el `CategoryModal` existente, que ya crea el rubro por defecto del mes).
2. Tras cargar el kit (la acción nunca lanza, §5.2): si `seeded` es `true`, toast de éxito y la tabla aparece al recargar; si es `false` sin `error` (ya tiene alguna categoría activa; con v2 `_seed_starter_kit` solo cuenta las activas, así que quien borró todas sí puede recargar el kit), toast que lo explica y se recarga; si trae `error` (`no_session`, code de la RPC o `unexpected`), toast de error y el botón "Crear categoría" sigue disponible.
3. Si el kit se sembró mientras el usuario miraba otro mes, el toast avisa que los rubros quedaron en el mes actual (la RPC siembra el mes actual de Bogotá).
4. Desaparece el texto "Migrar Datos de Julio" y toda la lógica atada a `'2025-07'` del panel; desaparece "Crear Presupuesto para …" (con 0 categorías solo creaba una plantilla vacía y volvía al mismo panel).
5. El menú móvil tiene "Ajustes y cuentas" (`/settings`) y "Cerrar sesión" (`logoutAction`), como la barra de escritorio.
6. `/test` no aparece en `Sidebar.tsx` ni en `MobileSidebar.tsx`; la ruta sigue existiendo.
7. "Agregar Gasto" del dashboard es un enlace a `/gastos?nuevo=1`; al llegar, `/gastos` abre el formulario de gasto nuevo y quita `nuevo=1` de la URL (recargar o volver no lo reabre).
8. `bun run test && bun run type-check` en verde.

---

### Task 1: Decisión pura del panel de `/presupuesto` y aviso tras cargar el kit

**Files:**
- Create: `src/lib/onboarding/budget-empty-state.ts`
- Test: `src/lib/onboarding/budget-empty-state.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (extra aceptado por contratos §5.2):
  ```ts
  export type BudgetPanelState = 'error' | 'loading' | 'sin-categorias' | 'con-datos';
  export function getBudgetPanelState(input: {
    isLoading: boolean;
    error: string | null;
    categoryCount: number;
  }): BudgetPanelState;
  export type StarterKitResult = { seeded: boolean; error?: string }; // = retorno de ensureStarterKitAction (§5.2)
  export type StarterKitToast = { message: string; type: 'success' | 'error' };
  export function starterKitToast(
    result: StarterKitResult,
    viewedMonth: string,   // 'YYYY-MM' que el usuario está viendo
    currentMonth: string,  // 'YYYY-MM' actual de Bogotá
  ): StarterKitToast;
  export const STARTER_KIT_ERROR_MESSAGE: string;
  ```

- [x] **Step 1: Write the failing test**

Crear `src/lib/onboarding/budget-empty-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  STARTER_KIT_ERROR_MESSAGE,
  getBudgetPanelState,
  starterKitToast,
} from './budget-empty-state';

describe('getBudgetPanelState', () => {
  it('el error manda sobre la carga y sobre el vacío', () => {
    expect(
      getBudgetPanelState({ isLoading: true, error: 'falló', categoryCount: 0 }),
    ).toBe('error');
  });

  it('mientras carga muestra la carga aunque aún no haya categorías', () => {
    expect(
      getBudgetPanelState({ isLoading: true, error: null, categoryCount: 0 }),
    ).toBe('loading');
  });

  it('sin categorías activas es el estado vacío', () => {
    expect(
      getBudgetPanelState({ isLoading: false, error: null, categoryCount: 0 }),
    ).toBe('sin-categorias');
  });

  it('con al menos una categoría se muestra la tabla', () => {
    expect(
      getBudgetPanelState({ isLoading: false, error: null, categoryCount: 1 }),
    ).toBe('con-datos');
  });
});

describe('starterKitToast', () => {
  it('kit sembrado mirando el mes actual', () => {
    expect(starterKitToast({ seeded: true }, '2026-09', '2026-09')).toEqual({
      message:
        'Listo: cargamos las categorías sugeridas. Ajusta el monto de cada rubro cuando quieras.',
      type: 'success',
    });
  });

  it('kit sembrado mirando otro mes avisa dónde quedaron los rubros', () => {
    expect(starterKitToast({ seeded: true }, '2026-08', '2026-09')).toEqual({
      message:
        'Listo: cargamos las categorías sugeridas. Sus rubros quedaron en el presupuesto del mes actual.',
      type: 'success',
    });
  });

  it('si no sembró y no hubo error es porque ya tiene categorías activas', () => {
    expect(starterKitToast({ seeded: false }, '2026-09', '2026-09')).toEqual({
      message:
        'Ya tienes categorías, así que no cargamos las sugeridas. Te las mostramos ahora.',
      type: 'success',
    });
  });

  it.each(['no_session', 'PGRST202', '23503', 'unexpected'])(
    'con error (%s) el aviso es de error e invita a crear la categoría a mano',
    error => {
      expect(
        starterKitToast({ seeded: false, error }, '2026-09', '2026-09'),
      ).toEqual({ message: STARTER_KIT_ERROR_MESSAGE, type: 'error' });
    },
  );

  it('el mensaje de error invita a crear la categoría a mano', () => {
    expect(STARTER_KIT_ERROR_MESSAGE).toBe(
      'No pudimos cargar las categorías sugeridas. Crea una categoría a mano.',
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/onboarding/budget-empty-state.test.ts`
Expected: FAIL — `Failed to resolve import "./budget-empty-state"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/onboarding/budget-empty-state.ts`:

```ts
/**
 * Estado vacío de /presupuesto (S10).
 *
 * `useMonthlyBudget` devuelve TODAS las categorías activas del usuario, tengan
 * o no rubros en el mes (ver getBudgetByMonth en src/lib/services/budget.ts).
 * Por eso "0 categorías" no es "no hay presupuesto este mes": es un usuario
 * que aún no tiene ninguna categoría y necesita crearla o cargar el kit.
 */

export type BudgetPanelState =
  | 'error'
  | 'loading'
  | 'sin-categorias'
  | 'con-datos';

export function getBudgetPanelState(input: {
  isLoading: boolean;
  error: string | null;
  categoryCount: number;
}): BudgetPanelState {
  if (input.error) return 'error';
  if (input.isLoading) return 'loading';
  if (input.categoryCount === 0) return 'sin-categorias';
  return 'con-datos';
}

export const STARTER_KIT_ERROR_MESSAGE =
  'No pudimos cargar las categorías sugeridas. Crea una categoría a mano.';

/** Lo que devuelve ensureStarterKitAction (contratos §5.2). */
export type StarterKitResult = { seeded: boolean; error?: string };

export type StarterKitToast = { message: string; type: 'success' | 'error' };

/**
 * Aviso tras llamar ensureStarterKitAction, que nunca lanza: los fallos llegan
 * en `result.error` ('no_session', el código de la RPC o 'unexpected').
 * - La RPC siembra el mes actual de Bogotá, no el que se está viendo.
 * - `seeded: false` sin error significa que el usuario ya tiene alguna
 *   categoría activa (§5.1): quien borró todas sí puede recargar el kit.
 */
export function starterKitToast(
  result: StarterKitResult,
  viewedMonth: string,
  currentMonth: string,
): StarterKitToast {
  if (result.error) {
    return { message: STARTER_KIT_ERROR_MESSAGE, type: 'error' };
  }
  if (!result.seeded) {
    return {
      message:
        'Ya tienes categorías, así que no cargamos las sugeridas. Te las mostramos ahora.',
      type: 'success',
    };
  }
  if (viewedMonth !== currentMonth) {
    return {
      message:
        'Listo: cargamos las categorías sugeridas. Sus rubros quedaron en el presupuesto del mes actual.',
      type: 'success',
    };
  }
  return {
    message:
      'Listo: cargamos las categorías sugeridas. Ajusta el monto de cada rubro cuando quieras.',
    type: 'success',
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/onboarding/budget-empty-state.test.ts`
Expected: PASS (12 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/onboarding/budget-empty-state.ts src/lib/onboarding/budget-empty-state.test.ts
git commit -m "feat(onboarding): decidir el panel vacío de presupuesto y el aviso del kit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `ensureStarterKitAction` (crea `onboarding.ts` y su test)

Contratos §5.2: **S10 crea** `src/lib/actions/onboarding.ts` y `src/lib/actions/onboarding.test.ts` solo con `ensureStarterKitAction`; S11 los extiende después (no los reescribe) y S12 solo los usa. En el flujo APP ninguna historia anterior los crea.

**Files:**
- Create: `src/lib/actions/onboarding.ts`
- Test: `src/lib/actions/onboarding.test.ts`

**Interfaces:**
- Consumes: `createClient()` de `src/lib/supabase/server.ts`; RPC `public.ensure_starter_kit()` → `boolean` (contratos §1.3/§5.1; la crea S09 en el flujo SEG, **no está en este worktree** y no se aplica hasta H8: los tests mockean el cliente).
- Produces (contratos §5.2, exacto): `export async function ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>`. **Nunca lanza.** No llama `revalidatePath` ni `redirect` (se ejecuta durante el render de `/bienvenida` y del dashboard). Sin sesión → `{ seeded: false, error: 'no_session' }`. Error de la RPC (incluido `23503` sin perfil o la función inexistente antes de H8) → `{ seeded: false, error: <code> }` (`'rpc_error'` si la RPC no trae code) y `console.warn` solo con el code. Cualquier otra excepción → `{ seeded: false, error: 'unexpected' }`. Los llamadores no necesitan try/catch.

- [x] **Step 0: Verificar que el archivo todavía no existe**

Run: `test -e src/lib/actions/onboarding.ts || test -e src/lib/actions/onboarding.test.ts && echo "YA EXISTE"`
Expected: no imprime nada. Si imprime `YA EXISTE`, detente y repórtalo: el orden del flujo APP (§5.3) garantiza que S10 es quien los crea.

- [x] **Step 1: Write the failing test**

Crear `src/lib/actions/onboarding.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';

import { ensureStarterKitAction } from './onboarding';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';

interface Resultado {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

/**
 * Cliente de cookie falso: auth.getUser y rpc. S11 lo reemplaza por uno más
 * completo (con from) que conserva esta firma: `clienteFalso({ user,
 * rpcResult })` y devuelve `{ client }`.
 */
function clienteFalso({
  user = { id: USER_ID } as { id: string } | null,
  rpcResult = { data: true, error: null } as Resultado,
} = {}) {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client };
}

describe('ensureStarterKitAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('llama ensure_starter_kit sin parámetros y devuelve seeded: true', async () => {
    const { client } = clienteFalso();

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: true });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith('ensure_starter_kit');
  });

  it('si ya tenía categorías activas (false) → seeded: false, sin error', async () => {
    clienteFalso({ rpcResult: { data: false, error: null } });

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: false });
  });

  it('trata un data nulo como no sembrado', async () => {
    clienteFalso({ rpcResult: { data: null, error: null } });

    await expect(ensureStarterKitAction()).resolves.toEqual({ seeded: false });
  });

  it('sin sesión → error no_session y no llama la RPC', async () => {
    const { client } = clienteFalso({ user: null });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'no_session',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('si la RPC falla devuelve su code y hace console.warn solo con el code', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clienteFalso({
      rpcResult: {
        data: null,
        error: {
          code: '23503',
          message: 'violates foreign key constraint usuario@ejemplo.com',
        },
      },
    });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: '23503',
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.any(String), '23503');
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    warnSpy.mockRestore();
  });

  it('error de la RPC sin code → error rpc_error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    clienteFalso({ rpcResult: { data: null, error: { message: 'x' } } });

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'rpc_error',
    });
    warnSpy.mockRestore();
  });

  it('nunca lanza: si crear el cliente falla → error unexpected, sin loguear el detalle', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedCreateClient.mockRejectedValueOnce(
      new Error('fallo con usuario@ejemplo.com'),
    );

    await expect(ensureStarterKitAction()).resolves.toEqual({
      seeded: false,
      error: 'unexpected',
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain(
      'usuario@ejemplo.com',
    );
    warnSpy.mockRestore();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: FAIL — `Failed to resolve import "./onboarding"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/actions/onboarding.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Siembra el kit inicial (contratos §1.3 y §5.1) para el usuario de la sesión.
 * Idempotente en la base: si el usuario ya tiene alguna categoría activa, la
 * RPC no hace nada y devuelve false.
 *
 * Contrato v2 (§5.2): NUNCA lanza y no llama revalidatePath ni redirect,
 * porque /bienvenida y el dashboard la llaman durante el render. Los fallos
 * vuelven en `error`: 'no_session', el code de la RPC (p. ej. 23503 sin
 * perfil, o la función inexistente antes de H8) o 'unexpected'. Los
 * llamadores no necesitan try/catch.
 */
export async function ensureStarterKitAction(): Promise<{
  seeded: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { seeded: false, error: 'no_session' };
    }

    const { data, error } = await supabase.rpc('ensure_starter_kit');
    if (error) {
      const code = error.code || 'rpc_error';
      // Solo el code: el mensaje de Postgres puede traer datos del usuario.
      console.warn('ensureStarterKitAction: no se pudo sembrar el kit:', code);
      return { seeded: false, error: code };
    }

    return { seeded: data === true };
  } catch {
    // Sin el detalle: puede traer datos del usuario.
    console.warn('ensureStarterKitAction: error inesperado');
    return { seeded: false, error: 'unexpected' };
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/actions/onboarding.test.ts`
Expected: PASS (7 tests).

Run: `bun run type-check`
Expected: sin errores. Si el compilador rechaza el nombre `'ensure_starter_kit'` (no está en `src/types/database.ts`), **no regeneres tipos** (§5.0): castea solo esa llamada, `(supabase as unknown as SupabaseClient).rpc('ensure_starter_kit')` con `import type { SupabaseClient } from '@supabase/supabase-js';`, como `expense-classification.ts:171`.

- [x] **Step 5: Commit**

```bash
git add src/lib/actions/onboarding.ts src/lib/actions/onboarding.test.ts
git commit -m "feat(onboarding): ensureStarterKitAction según contratos v2 (§5.2)

La crea S10 porque el panel vacío de /presupuesto la necesita; S11 extiende
el mismo archivo. Nunca lanza: los fallos vuelven en error.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Panel vacío de `/presupuesto` con salida

**Files:**
- Modify: `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx` (archivo completo)
- Modify: `src/app/presupuesto/page.tsx` (imports ~23-37, destructuring 76-81, tras `showToast` 286-296, JSX 671-680)
- Test: `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts`

**Interfaces:**
- Consumes: `getBudgetPanelState`, `starterKitToast` (Task 1); `ensureStarterKitAction` (Task 2); `CategoryModal` y `setShowCategoryModal` ya existentes en la página; `todayBogota` de `@/lib/whatsapp/format` (ya importado en la página).
- Produces: nuevas props de `BudgetStatusPanels`:
  ```ts
  interface BudgetStatusPanelsProps {
    isLoading: boolean;
    error: string | null;
    categoryCount: number;
    selectedMonthLabel: string;
    onCreateCategory: () => void;
    onLoadStarterKit: () => void;
    isLoadingStarterKit: boolean;
  }
  ```
  Se eliminan `hasData`, `selectedMonth` y `onCreateBudget`. El único consumidor es `src/app/presupuesto/page.tsx` (verificado con grep).

- [x] **Step 1: Write the failing test**

Crear `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node. La lógica
// vive en src/lib/onboarding/budget-empty-state.ts (con sus propios tests);
// aquí solo se asegura que el panel la usa y ofrece las dos salidas.
const panel = readFileSync(
  resolve(
    process.cwd(),
    'src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx',
  ),
  'utf8',
);
const page = readFileSync(
  resolve(process.cwd(), 'src/app/presupuesto/page.tsx'),
  'utf8',
);

describe('BudgetStatusPanels (S10)', () => {
  it('ya no habla de migrar datos de julio ni depende de 2025-07', () => {
    expect(panel).not.toContain('Migrar Datos de Julio');
    expect(panel).not.toContain('2025-07');
  });

  it('decide el estado con getBudgetPanelState', () => {
    expect(panel).toContain('getBudgetPanelState(');
  });

  it('el estado vacío ofrece cargar el kit y crear una categoría', () => {
    expect(panel).toContain('Cargar categorías sugeridas');
    expect(panel).toContain('Crear categoría');
    expect(panel).toContain('onLoadStarterKit');
    expect(panel).toContain('onCreateCategory');
  });

  it('ya no ofrece "Crear Presupuesto" (con 0 categorías era un callejón)', () => {
    expect(panel).not.toContain('Crear Presupuesto');
    expect(panel).not.toContain('onCreateBudget');
  });
});

describe('/presupuesto cablea el panel vacío (S10)', () => {
  it('llama ensureStarterKitAction y abre el CategoryModal existente', () => {
    expect(page).toContain('ensureStarterKitAction()');
    expect(page).toContain('starterKitToast(');
    expect(page).toContain('onCreateCategory={() => setShowCategoryModal(true)}');
    expect(page).toContain('onLoadStarterKit={handleLoadStarterKit}');
    expect(page).toContain('categoryCount={categories.length}');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts`
Expected: FAIL — 5 fallos (p. ej. `expected '…Migrar Datos de Julio…' not to contain 'Migrar Datos de Julio'`, `expected … to contain 'ensureStarterKitAction()'`).

- [x] **Step 3a: Reescribir el panel**

Reemplazar todo `src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx` por:

```tsx
/**
 * BudgetStatusPanels - Organism Level
 *
 * Paneles de estado de /presupuesto: error, carga y "sin categorías".
 * Qué panel se pinta lo decide getBudgetPanelState
 * (src/lib/onboarding/budget-empty-state.ts).
 *
 * Sin categorías activas no hay presupuesto posible, así que el panel vacío
 * ofrece las dos salidas: cargar las categorías sugeridas
 * (ensureStarterKitAction) o crear una a mano (el CategoryModal de la página,
 * que también crea el rubro por defecto del mes).
 *
 * @example
 * <BudgetStatusPanels
 *   isLoading={false}
 *   error={null}
 *   categoryCount={0}
 *   selectedMonthLabel="Septiembre 2026"
 *   onCreateCategory={() => setShowCategoryModal(true)}
 *   onLoadStarterKit={handleLoadStarterKit}
 *   isLoadingStarterKit={false}
 * />
 */

import React from 'react';

import { AlertCircle, FolderPlus, RefreshCw, Sparkles } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import { getBudgetPanelState } from '@/lib/onboarding/budget-empty-state';

interface BudgetStatusPanelsProps {
  isLoading: boolean;
  error: string | null;
  /** Categorías activas del usuario (las que devuelve useMonthlyBudget). */
  categoryCount: number;
  selectedMonthLabel: string;
  /** Abre el CategoryModal de la página. */
  onCreateCategory: () => void;
  /** Llama ensureStarterKitAction y recarga el presupuesto. */
  onLoadStarterKit: () => void;
  isLoadingStarterKit: boolean;
}

export default function BudgetStatusPanels({
  isLoading,
  error,
  categoryCount,
  selectedMonthLabel,
  onCreateCategory,
  onLoadStarterKit,
  isLoadingStarterKit,
}: BudgetStatusPanelsProps) {
  const state = getBudgetPanelState({ isLoading, error, categoryCount });

  if (state === 'error') {
    return (
      <Card variant="glass" className="p-6 border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-1">Error</h3>
            <p className="text-gray-300">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (state === 'loading') {
    return (
      <Card variant="glass" className="p-8">
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-gray-300 text-lg">Cargando presupuesto...</span>
        </div>
      </Card>
    );
  }

  if (state === 'sin-categorias') {
    return (
      <Card variant="glass" className="p-8 text-center">
        <div className="text-gray-400 mb-4">
          <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            Aún no tienes categorías
          </h3>
          <p className="text-sm">
            Para armar el presupuesto de {selectedMonthLabel} necesitas al
            menos una categoría. Carga las sugeridas (vivienda, mercado,
            transporte, salud, deudas y otros) o crea la tuya.
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="gradient"
            onClick={onLoadStarterKit}
            loading={isLoadingStarterKit}
            disabled={isLoadingStarterKit}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Cargar categorías sugeridas
          </Button>
          <Button
            variant="glass"
            onClick={onCreateCategory}
            disabled={isLoadingStarterKit}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Crear categoría
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
```

- [x] **Step 3b: Imports de la página**

En `src/app/presupuesto/page.tsx`, justo después de la línea
`import { deleteCategory, updateCategory } from '@/lib/actions/categories';`
agregar:

```ts
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
```

y justo después del bloque
```ts
import {
  mapRubroEstado,
  rubrosEnRiesgo,
  type RubroEstado,
} from '@/lib/budget/alerts';
```
agregar:

```ts
import { starterKitToast } from '@/lib/onboarding/budget-empty-state';
```

(S08 ya agregó `import { defaultItemFormNames } from '@/lib/budget/catalog-defaults';` justo **antes** de ese bloque; no lo toques.)

- [x] **Step 3c: Quitar `initializeMonth` de la página**

En el destructuring de `useMonthlyBudget(selectedMonth)` (líneas 69-81), cambiar:

```ts
    deleteBudgetItem,
    initializeMonth,
  } = useMonthlyBudget(selectedMonth);
```
por:
```ts
    deleteBudgetItem,
  } = useMonthlyBudget(selectedMonth);
```

(`initializeMonth` solo se usaba en `onCreateBudget`; el hook lo sigue exportando.)

- [x] **Step 3d: Handler del kit**

Justo después de la función `showToast` (termina en la línea ~296 con `  };`), agregar:

```ts
  // Estado vacío (S10): cargar el kit inicial de categorías sugeridas.
  const [isLoadingStarterKit, setIsLoadingStarterKit] = useState(false);

  const handleLoadStarterKit = async () => {
    setIsLoadingStarterKit(true);
    try {
      // Nunca lanza (contratos §5.2): los fallos llegan en result.error. Hasta
      // que se aplique la migración de S09 (H8) la RPC no existe y el aviso es
      // de error; el usuario puede seguir con "Crear categoría".
      const result = await ensureStarterKitAction();
      const aviso = starterKitToast(
        result,
        selectedMonth,
        todayBogota().slice(0, 7),
      );
      showToast(aviso.message, aviso.type);
      if (!result.error) {
        await handleCategoryCreated();
      }
    } finally {
      setIsLoadingStarterKit(false);
    }
  };
```

- [x] **Step 3e: JSX del panel**

Reemplazar:

```tsx
        statusPanels={
          <BudgetStatusPanels
            isLoading={isLoading}
            error={error}
            hasData={categories.length > 0}
            selectedMonth={selectedMonth}
            selectedMonthLabel={selectedMonthLabel}
            onCreateBudget={initializeMonth}
          />
        }
```
por:
```tsx
        statusPanels={
          <BudgetStatusPanels
            isLoading={isLoading}
            error={error}
            categoryCount={categories.length}
            selectedMonthLabel={selectedMonthLabel}
            onCreateCategory={() => setShowCategoryModal(true)}
            onLoadStarterKit={handleLoadStarterKit}
            isLoadingStarterKit={isLoadingStarterKit}
          />
        }
```

- [x] **Step 4: Run tests and type-check**

Run: `bun run test src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts src/lib/onboarding/budget-empty-state.test.ts`
Expected: PASS (5 + 12 tests).

Run: `bun run type-check`
Expected: sin errores. Si `tsc` reporta `hasData`/`onCreateBudget` en otro archivo, es un consumidor que el grep no vio: ajústalo a las props nuevas y anótalo.

- [x] **Step 5: Commit**

```bash
git add src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.test.ts src/app/presupuesto/page.tsx
git commit -m "feat(presupuesto): el panel vacío ofrece cargar categorías sugeridas o crear una

Quita el texto de migrar datos de julio y el botón Crear Presupuesto, que con
0 categorías creaba una plantilla vacía y volvía al mismo panel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Menús — Ajustes y Cerrar sesión en móvil; `/test` fuera de ambos

**Files:**
- Modify: `src/components/molecules/MobileSidebar/MobileSidebar.tsx`
- Modify: `src/components/organisms/Sidebar/Sidebar.tsx:22,47` (solo esas dos líneas)
- Test: `src/components/molecules/MobileSidebar/MobileSidebar.test.ts`

**Interfaces:**
- Consumes: `logoutAction` de `src/lib/actions/auth.ts` (server action ya existente, se usa como `<form action={logoutAction}>` igual que en `Sidebar.tsx:236`).
- Produces: nada que usen otras tareas. Props de `MobileSidebar` sin cambios (`isOpen`, `onClose`, `className`), así que `Sidebar.tsx` no cambia su uso.

- [ ] **Step 1: Write the failing test**

Crear `src/components/molecules/MobileSidebar/MobileSidebar.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node.
const leer = (ruta: string) =>
  readFileSync(resolve(process.cwd(), ruta), 'utf8');

const mobile = leer('src/components/molecules/MobileSidebar/MobileSidebar.tsx');
const desktop = leer('src/components/organisms/Sidebar/Sidebar.tsx');

describe('menú móvil (S10)', () => {
  it('tiene Ajustes', () => {
    expect(mobile).toContain('href="/settings"');
    expect(mobile).toContain('Ajustes y cuentas');
  });

  it('tiene Cerrar sesión con la misma server action que el escritorio', () => {
    expect(mobile).toContain("import { logoutAction } from '@/lib/actions/auth';");
    expect(mobile).toContain('<form action={logoutAction}>');
    expect(mobile).toContain('Cerrar sesión');
  });
});

describe('/test fuera de los menús (S10)', () => {
  it.each([
    ['MobileSidebar.tsx', mobile],
    ['Sidebar.tsx', desktop],
  ])('%s no enlaza /test', (_nombre, fuente) => {
    expect(fuente).not.toContain("'/test'");
    expect(fuente).not.toContain('FlaskConical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/components/molecules/MobileSidebar/MobileSidebar.test.ts`
Expected: FAIL — 4 fallos (`expected … to contain 'href="/settings"'`, `… to contain "import { logoutAction }…"`, y los dos `not to contain "'/test'"`).

- [ ] **Step 3a: Sidebar de escritorio (cambio mínimo; S07 ya lo modificó)**

Antes: `grep -n "useBudgetData\|formatCurrency" src/components/organisms/Sidebar/Sidebar.tsx` no debe imprimir nada (S07 ya quitó la tarjeta de montos). Si imprime algo, detente: S07 no está hecha.

En `src/components/organisms/Sidebar/Sidebar.tsx`:

1. Borrar la línea `  FlaskConical,` del import de `lucide-react` (línea 22).
2. Borrar la línea `  { href: '/test', label: 'Test', icon: FlaskConical },` de `NAV_ITEMS` (línea 47).

No tocar nada más del archivo. El test de S07 (`Sidebar.test.ts`) debe seguir en verde.

- [ ] **Step 3b: MobileSidebar**

En `src/components/molecules/MobileSidebar/MobileSidebar.tsx`:

1. Reemplazar el import de iconos:

```ts
import {
  LayoutDashboard,
  PieChart,
  FlaskConical,
  TrendingUp,
  CreditCard,
  Wallet,
  X,
  Home,
} from 'lucide-react';

import { cn } from '@/lib/utils';
```
por:
```ts
import {
  LayoutDashboard,
  LogOut,
  PieChart,
  Settings,
  TrendingUp,
  CreditCard,
  Wallet,
  X,
  Home,
} from 'lucide-react';

import { logoutAction } from '@/lib/actions/auth';
import { cn } from '@/lib/utils';
```

2. En `navigationLinks`, borrar el último objeto:

```ts
  {
    href: '/test',
    label: 'Test',
    icon: FlaskConical,
    description: 'Página de pruebas',
  },
```

3. Justo antes del comentario `{/* Footer del menú */}` (después del cierre `</nav>`), insertar:

```tsx
          {/* Ajustes y cerrar sesión (igual que en Sidebar.tsx) */}
          <div className="space-y-2 border-t border-white/20 p-6">
            <Link
              href="/settings"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all duration-200 border',
                pathname === '/settings' || pathname?.startsWith('/settings/')
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  : 'text-gray-300 hover:text-white hover:bg-white/10 border-transparent',
              )}
            >
              <Settings size={20} />
              <span className="font-medium">Ajustes y cuentas</span>
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 p-3 rounded-lg border border-transparent text-gray-300 transition-all duration-200 hover:bg-white/10 hover:text-white"
              >
                <LogOut size={20} />
                <span className="font-medium">Cerrar sesión</span>
              </button>
            </form>
          </div>
```

(El `MobileSidebar` solo se monta desde `Sidebar.tsx`, que vive dentro de `AppShell` en páginas con sesión; por eso "Cerrar sesión" se muestra siempre, sin el `user &&` del escritorio.)

- [ ] **Step 4: Run tests and type-check**

Run: `bun run test src/components/molecules/MobileSidebar/MobileSidebar.test.ts`
Expected: PASS (4 tests).

Run: `bun run type-check`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/components/molecules/MobileSidebar/MobileSidebar.tsx src/components/molecules/MobileSidebar/MobileSidebar.test.ts src/components/organisms/Sidebar/Sidebar.tsx
git commit -m "feat(navegacion): Ajustes y Cerrar sesión en el menú móvil; /test fuera de los menús

La ruta /test sigue existiendo; solo deja de aparecer en la navegación.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: "Agregar Gasto" del dashboard abre el formulario de `/gastos`

**Files:**
- Create: `src/lib/onboarding/nuevo-gasto.ts`
- Test: `src/lib/onboarding/nuevo-gasto.test.ts`
- Modify: `src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx:22-26`
- Modify: `src/app/gastos/page.tsx` (1 import tras `import { montoDeCelda } from '@/lib/money/parse-cop';` y 1 `useEffect` tras `} = useMonthlyExpenses();`; S07 ya modificó el archivo, así que se ancla por texto)
- Test: `src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts`

**Interfaces:**
- Consumes: `openModal: () => void` de `useMonthlyExpenses()` (`src/hooks/useMonthlyExpenses.ts:139`, estable por `useCallback`), el mismo que usa `ExpenseFloatingButton`.
- Produces:
  ```ts
  export const NUEVO_GASTO_PARAM = 'nuevo';
  export const NUEVO_GASTO_HREF = '/gastos?nuevo=1';
  export function wantsNewExpenseForm(search: string): boolean;
  export function stripNewExpenseParam(pathname: string, search: string): string;
  ```

- [ ] **Step 1: Write the failing tests**

Crear `src/lib/onboarding/nuevo-gasto.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  NUEVO_GASTO_HREF,
  NUEVO_GASTO_PARAM,
  stripNewExpenseParam,
  wantsNewExpenseForm,
} from './nuevo-gasto';

describe('NUEVO_GASTO_HREF', () => {
  it('apunta a /gastos con nuevo=1', () => {
    expect(NUEVO_GASTO_PARAM).toBe('nuevo');
    expect(NUEVO_GASTO_HREF).toBe('/gastos?nuevo=1');
  });
});

describe('wantsNewExpenseForm', () => {
  it.each([
    ['?nuevo=1', true],
    ['nuevo=1', true],
    ['?mes=2026-09&nuevo=1', true],
    ['', false],
    ['?nuevo=0', false],
    ['?nuevo=', false],
    ['?otro=1', false],
  ])('%s → %s', (search, esperado) => {
    expect(wantsNewExpenseForm(search)).toBe(esperado);
  });

  it('reconoce el propio enlace del dashboard', () => {
    expect(wantsNewExpenseForm(NUEVO_GASTO_HREF.split('?')[1])).toBe(true);
  });
});

describe('stripNewExpenseParam', () => {
  it('quita nuevo=1 y deja la ruta limpia', () => {
    expect(stripNewExpenseParam('/gastos', '?nuevo=1')).toBe('/gastos');
  });

  it('conserva los demás parámetros', () => {
    expect(stripNewExpenseParam('/gastos', '?mes=2026-09&nuevo=1')).toBe(
      '/gastos?mes=2026-09',
    );
  });

  it('sin query devuelve la ruta tal cual', () => {
    expect(stripNewExpenseParam('/gastos', '')).toBe('/gastos');
  });
});
```

Crear `src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node. La lógica
// del parámetro está probada en src/lib/onboarding/nuevo-gasto.test.ts.
const leer = (ruta: string) =>
  readFileSync(resolve(process.cwd(), ruta), 'utf8');

const quickActions = leer(
  'src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx',
);
const gastos = leer('src/app/gastos/page.tsx');

describe('Agregar Gasto (S10)', () => {
  it('es un enlace a NUEVO_GASTO_HREF, no un botón muerto', () => {
    expect(quickActions).toContain('<Link href={NUEVO_GASTO_HREF}');
    expect(quickActions).toMatch(
      /<Link href=\{NUEVO_GASTO_HREF\}[\s\S]*?Agregar Gasto[\s\S]*?<\/Link>/,
    );
  });

  it('/gastos abre el formulario si llega el parámetro y limpia la URL', () => {
    expect(gastos).toContain('wantsNewExpenseForm(window.location.search)');
    expect(gastos).toContain('openModal();');
    expect(gastos).toContain('stripNewExpenseParam(');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/lib/onboarding/nuevo-gasto.test.ts src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts`
Expected: FAIL — `Failed to resolve import "./nuevo-gasto"` y 2 fallos de texto (`expected … to contain '<Link href={NUEVO_GASTO_HREF}'`, `… to contain 'wantsNewExpenseForm(window.location.search)'`).

- [ ] **Step 3a: Funciones puras**

Crear `src/lib/onboarding/nuevo-gasto.ts`:

```ts
/**
 * "Agregar Gasto" del dashboard (S10): navega a /gastos?nuevo=1 y /gastos abre
 * el formulario de gasto nuevo al ver el parámetro. Después se quita de la URL
 * para que recargar o volver atrás no reabra el formulario.
 */

export const NUEVO_GASTO_PARAM = 'nuevo';
export const NUEVO_GASTO_HREF = `/gastos?${NUEVO_GASTO_PARAM}=1`;

/** `search` como `window.location.search` ("?a=1") o sin "?". */
export function wantsNewExpenseForm(search: string): boolean {
  return new URLSearchParams(search).get(NUEVO_GASTO_PARAM) === '1';
}

/** URL relativa sin el parámetro `nuevo`, conservando los demás. */
export function stripNewExpenseParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(NUEVO_GASTO_PARAM);
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
```

- [ ] **Step 3b: Botón del dashboard**

En `src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx`:

1. Después de `import Button from '@/components/atoms/Button/Button';` agregar:

```ts
import { NUEVO_GASTO_HREF } from '@/lib/onboarding/nuevo-gasto';
```

2. Reemplazar:

```tsx
      {/* Agregar Gasto */}
      <Button variant="gradient" size="lg" className="flex-1">
        <Plus className="w-5 h-5 mr-2" />
        Agregar Gasto
      </Button>
```
por (mismo patrón `Link` + `Button` que los otros dos botones del archivo):
```tsx
      {/* Agregar Gasto: /gastos abre el formulario al ver ?nuevo=1 */}
      <Link href={NUEVO_GASTO_HREF} className="flex-1">
        <Button variant="gradient" size="lg" className="w-full">
          <Plus className="w-5 h-5 mr-2" />
          Agregar Gasto
        </Button>
      </Link>
```

- [ ] **Step 3c: `/gastos` (cambio mínimo; S07 ya lo modificó)**

En `src/app/gastos/page.tsx`:

1. Justo después de `import { montoDeCelda } from '@/lib/money/parse-cop';` agregar:

```ts
import {
  stripNewExpenseParam,
  wantsNewExpenseForm,
} from '@/lib/onboarding/nuevo-gasto';
```

2. Justo después de la línea `  } = useMonthlyExpenses();` (fin del destructuring) y antes del comentario que empieza con `  // Cargar categorías dinámicas desde la BD` (S07 lo dejó como `// Cargar categorías dinámicas desde la BD. Memorizadas: …`), insertar:

```tsx

  // "Agregar Gasto" del dashboard llega con ?nuevo=1 (S10): abrir el
  // formulario y quitar el parámetro para que recargar no lo reabra. Se lee
  // window.location en vez de useSearchParams para no exigir un Suspense.
  useEffect(() => {
    if (!wantsNewExpenseForm(window.location.search)) return;
    openModal();
    window.history.replaceState(
      null,
      '',
      stripNewExpenseParam(window.location.pathname, window.location.search),
    );
  }, [openModal]);
```

(`useEffect` ya está importado en el import de `react`. No tocar nada más del archivo.)

- [ ] **Step 4: Run tests and type-check**

Run: `bun run test src/lib/onboarding/nuevo-gasto.test.ts src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts`
Expected: PASS (12 + 2 tests).

Run: `bun run type-check`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/nuevo-gasto.ts src/lib/onboarding/nuevo-gasto.test.ts src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx src/components/organisms/DashboardQuickActions/DashboardQuickActions.test.ts src/app/gastos/page.tsx
git commit -m "feat(dashboard): Agregar Gasto lleva a /gastos y abre el formulario

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa y tipos**

Run: `bun run test && bun run type-check`
Expected: todos los tests en verde (los de antes más los nuevos: 12 + 7 + 5 + 4 + 12 + 2) y `tsc --noEmit` sin salida.

- [ ] **Step 2: Lint de los archivos tocados**

Run: `bunx eslint src/lib/onboarding/budget-empty-state.ts src/lib/onboarding/nuevo-gasto.ts src/lib/actions/onboarding.ts src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx src/components/molecules/MobileSidebar/MobileSidebar.tsx src/components/organisms/Sidebar/Sidebar.tsx src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx src/app/presupuesto/page.tsx src/app/gastos/page.tsx`
Expected: sin errores (advertencias previas del archivo no bloquean).

- [ ] **Step 3: Barrido de restos**

Run: `grep -rn "Migrar Datos de Julio\|'/test'" src/components/organisms/BudgetStatusPanels src/components/molecules/MobileSidebar src/components/organisms/Sidebar`
Expected: sin coincidencias.

- [ ] **Step 4: Revisión manual (solo humano, opcional; nunca producción)**

El implementador **no** corre `bun run dev` ni `next build` (`.env.local` apunta a producción, §5.0). El humano lo revisa en un entorno con base de desarrollo o en S14:
- En `/dashboard`, "Agregar Gasto" abre `/gastos` con el formulario abierto y la URL queda en `/gastos`.
- En ancho móvil, el menú muestra "Ajustes y cuentas" y "Cerrar sesión", sin "Test".
- `/presupuesto` con un usuario sin categorías (solo si hay uno de prueba en un entorno local; no crear usuarios en producción) muestra los dos botones; "Crear categoría" abre el modal; "Cargar categorías sugeridas" muestra el toast de error mientras la migración de S09 no esté aplicada (la acción devuelve `error`, no lanza).

No hay commit en esta tarea.

---

## Autorrevisión

- **Cobertura de la épica S10:** panel vacío con crear categoría y kit → Tasks 1-3; menú móvil con Ajustes y Cerrar sesión y `/test` fuera de ambos → Task 4; "Agregar Gasto" → Task 5; "Migrar Datos de Julio" fuera → Task 3 (test de texto + barrido en Task 6).
- **Contrato §5.2:** `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>`, `'use server'`, cliente de cookie, `auth.getUser()`, `rpc('ensure_starter_kit')`, nunca lanza, sin `revalidatePath`/`redirect`, `no_session` / code + `console.warn` — idéntico en Task 2 y en su uso de Task 3 (sin `catch`). S10 crea `onboarding.ts` y su test; S11 los extiende sin reescribir esta acción.
- **§5.3 orden y propiedad (flujo APP):** S07 → S08 → S10 → S13 → S11 → S12, en serie. En `Sidebar.tsx` (ya tocado por S07) solo se quitan 2 líneas; en `gastos/page.tsx` (ya tocado por S07) se agregan 1 import y 1 `useEffect`; `src/app/presupuesto/page.tsx` lo tocó S08 (formulario de rubro) y aquí se cablea el panel vacío.
- **Tipos consistentes:** `getBudgetPanelState`/`starterKitToast`/`STARTER_KIT_ERROR_MESSAGE` (Task 1) usados con esos nombres en Task 3 (`STARTER_KIT_ERROR_MESSAGE` solo lo usa `starterKitToast`); `NUEVO_GASTO_HREF`/`wantsNewExpenseForm`/`stripNewExpenseParam` (Task 5) usados con esos nombres en el mismo task y sus tests.
- **Migración de julio:** `BudgetMigrationPanel.tsx`, `ExpenseMigrationPanel.tsx`, los scripts `migrate-july-*` y el botón `'2025-07'` de `ExpenseHeader.tsx` ya los borró S07 (contratos §5.2). Aquí solo queda el `'2025-07'` de `BudgetStatusPanels.tsx`, que la Task 3 elimina.
