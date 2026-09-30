# S08 — Clasificación y control por defecto explícitos · Implementation Plan

> **Alineado con contratos v2 (§5).** v2 no cambia §2.5; lo que aplica aquí es §5.0 (convenciones) y §5.3 (flujo APP: S07 → **S08** → S10 → S13 → S11 → S12).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que todo rubro creado por la app (categoría nueva, rubro al vuelo desde Gastos, rubros de una deuda, formulario de rubro nuevo en /presupuesto) reciba la clasificación, el control y el estado elegidos **por nombre** según contratos §2.5, en lugar del primero en orden alfabético ("Basico"/"Eliminar").

**Architecture:** Las constantes viven en `src/lib/constants/budget-defaults.ts` (contrato §2.5). La lógica de elección es pura y testeable en `src/lib/budget/catalog-defaults.ts` (`pickCatalogId`, `itemDefaultNamesFor`, `defaultItemFormNames`). Un solo lector contra Supabase, `src/lib/budget/item-defaults-supabase.ts` (`resolveBudgetItemDefaults`), carga los tres catálogos activos ordenados por nombre, elige por nombre y, si el nombre no existe, cae al primero activo con `console.warn`. Las tres server actions y la página /presupuesto dejan de hacer su propia consulta "el primero" y usan estas piezas. No hay migración ni se tocan datos existentes.

**Tech Stack:** Next.js 15 (server actions), Supabase JS (`SupabaseClient<Database>`), TypeScript, vitest (`bun run test`), bun.

## Global Constraints

- Nombres exactos de contratos §2.5: `DEFAULT_ITEM_CLASSIFICATION = 'Estilo de Vida'`, `DEFAULT_ITEM_CONTROL = 'Reducir'`, `DEUDA_ITEM_CLASSIFICATION = 'Basico'`, `DEUDA_ITEM_CONTROL = 'Necesario'`, `DEFAULT_ITEM_STATUS = 'Activo'`.
- Si el nombre no existe: se usa el primer catálogo **activo** (orden por `name`) y se registra con `console.warn` sin datos personales (solo nombres de catálogo).
- Rubros de la categoría DEUDAS usan `DEUDA_ITEM_*`; el resto `DEFAULT_ITEM_*`.
- Sin migración, sin tocar filas existentes, sin acceso a la base de producción. Los tests mockean el cliente; ningún test toca una base real.
- Textos de UI y mensajes en español colombiano, tuteo.
- Verificación del proyecto: `bun run test && bun run type-check`.
- Commits en español terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ejecutar comandos con `builtin cd /Users/migue/Repos/personal/PresupuestoApp && …`.
- Orden (contratos §5.3, flujo APP, en serie en el mismo worktree): S08 va **después de S07** (ya hecho: borró `src/scripts/migrate-july-data.ts`) y **antes de S10**. Ambas tocan `src/app/presupuesto/page.tsx`: S08 solo el estado del formulario (~203-235) y un import; S10 luego cablea el panel vacío sobre el archivo ya modificado por S08.
- Prohibido `bun run dev` y `next build` contra `.env.local` (apunta a producción, §5.0). Nunca `bun run db:types`.

---

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Crear | `src/lib/constants/budget-defaults.ts` | Las 5 constantes del contrato §2.5 |
| Crear | `src/lib/budget/catalog-defaults.ts` | Lógica pura: `pickCatalogId`, `itemDefaultNamesFor`, `defaultItemFormNames` |
| Crear | `src/lib/budget/catalog-defaults.test.ts` | Tests de la lógica pura y de las constantes |
| Crear | `src/lib/budget/item-defaults-supabase.ts` | `resolveBudgetItemDefaults(supabase, names)` — consulta catálogos, elige, avisa |
| Crear | `src/lib/budget/item-defaults-supabase.test.ts` | Tests con cliente falso |
| Modificar | `src/lib/actions/categories.ts` (bloques ~284-320 y ~395-431, imports) | `createDefaultBudgetItemForCategory` y `createBudgetItemInMonth` usan el resolver |
| Crear | `src/lib/actions/categories.test.ts` | Tests de las dos acciones |
| Modificar | `src/lib/actions/deudas-budget.ts` (bloque ~45-79, imports) | `createBudgetItemsForDeuda` usa el resolver con `DEUDA_ITEM_*` |
| Crear | `src/lib/actions/deudas-budget.test.ts` | Tests de la acción |
| Modificar | `src/app/presupuesto/page.tsx` (~203-235, imports) | El formulario de rubro nuevo toma los nombres por defecto del contrato en lugar de `classifications[0]` |

**Búsqueda de otros sitios "el primero" (hecha al planear):**
- `src/app/api/budget/route.ts` y `src/app/api/budget/[id]/route.ts`: buscan clasificación/control **por el nombre que manda el formulario** — no eligen "el primero". Se corrigen indirectamente porque el formulario (`presupuesto/page.tsx`) deja de proponer `classifications[0]`. Sin cambios.
- `src/lib/services/budget.ts` (`getClassifications`, `getControls`): solo listan catálogos para la UI. Sin cambios.
- `src/scripts/migrate-july-data.ts`: ya no existe (lo borra S07, contratos §5.2, que va antes en el flujo APP).
- `supabase/migrations/*`: ninguna función SQL elige catálogo con `ORDER BY name LIMIT 1`. `upsert_monthly_budget` copia los rubros del mes anterior con sus ids. Sin cambios.
- `src/lib/whatsapp/*`, `src/hooks/*`: no crean rubros.

## Criterios de aceptación

1. Existe `src/lib/constants/budget-defaults.ts` con las 5 constantes exactas del contrato §2.5.
2. `createDefaultBudgetItemForCategory` y `createBudgetItemInMonth` asignan `Estilo de Vida` / `Reducir` / `Activo` por nombre; si la categoría es DEUDAS (sin importar mayúsculas ni espacios), `Basico` / `Necesario` / `Activo`.
3. `createBudgetItemsForDeuda` (`deudas-budget.ts`) asigna `Basico` / `Necesario` / `Activo` por nombre.
4. Si un nombre no existe en el catálogo activo, se usa el primero activo por orden de nombre y se emite un `console.warn` que nombra el catálogo buscado y el usado (sin datos personales).
5. Si una consulta de catálogo falla o un catálogo activo está vacío, la acción devuelve `success: false` con el mismo mensaje de error que hoy y no inserta nada.
6. El formulario "agregar rubro" de /presupuesto propone `Estilo de Vida` / `Reducir` (o `Basico` / `Necesario` en DEUDAS) en lugar del primero de la lista.
7. Tests de la selección por nombre, del respaldo y de cada acción; `bun run test && bun run type-check` en verde.
8. No hay migración ni cambios en datos existentes.

---

### Task 1: Constantes y lógica pura de selección

**Files:**
- Create: `src/lib/constants/budget-defaults.ts`
- Create: `src/lib/budget/catalog-defaults.ts`
- Test: `src/lib/budget/catalog-defaults.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `src/lib/constants/budget-defaults.ts`: `DEFAULT_ITEM_CLASSIFICATION`, `DEFAULT_ITEM_CONTROL`, `DEUDA_ITEM_CLASSIFICATION`, `DEUDA_ITEM_CONTROL`, `DEFAULT_ITEM_STATUS` (todas `string` literales).
  - `src/lib/budget/catalog-defaults.ts`:
    - `interface CatalogRow { id: string; name: string }`
    - `interface CatalogPick { id: string; name: string; usedFallback: boolean }`
    - `interface ItemDefaultNames { classification: string; control: string }`
    - `function pickCatalogId(rows: readonly CatalogRow[], preferredName: string): CatalogPick | null`
    - `function itemDefaultNamesFor(categoryName?: string | null): ItemDefaultNames`

- [ ] **Step 1: Write the failing test**

Crear `src/lib/budget/catalog-defaults.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEFAULT_ITEM_STATUS,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';

import { itemDefaultNamesFor, pickCatalogId } from './catalog-defaults';

const CLASIFICACIONES = [
  { id: 'cls-basico', name: 'Basico' },
  { id: 'cls-caprichos', name: 'Caprichos' },
  { id: 'cls-estilo', name: 'Estilo de Vida' },
];

describe('constantes de budget-defaults (contratos §2.5)', () => {
  it('tienen los nombres exactos del contrato', () => {
    expect(DEFAULT_ITEM_CLASSIFICATION).toBe('Estilo de Vida');
    expect(DEFAULT_ITEM_CONTROL).toBe('Reducir');
    expect(DEUDA_ITEM_CLASSIFICATION).toBe('Basico');
    expect(DEUDA_ITEM_CONTROL).toBe('Necesario');
    expect(DEFAULT_ITEM_STATUS).toBe('Activo');
  });
});

describe('pickCatalogId', () => {
  it('devuelve el id del nombre preferido sin respaldo', () => {
    expect(pickCatalogId(CLASIFICACIONES, 'Estilo de Vida')).toEqual({
      id: 'cls-estilo',
      name: 'Estilo de Vida',
      usedFallback: false,
    });
  });

  it('encuentra el nombre ignorando mayúsculas, tildes y espacios de borde', () => {
    expect(pickCatalogId(CLASIFICACIONES, '  estilo de vida ')).toEqual({
      id: 'cls-estilo',
      name: 'Estilo de Vida',
      usedFallback: false,
    });
    expect(pickCatalogId(CLASIFICACIONES, 'Básico')).toEqual({
      id: 'cls-basico',
      name: 'Basico',
      usedFallback: false,
    });
  });

  it('prefiere la coincidencia exacta sobre la normalizada', () => {
    const filas = [
      { id: 'a', name: 'basico' },
      { id: 'b', name: 'Basico' },
    ];
    expect(pickCatalogId(filas, 'Basico')?.id).toBe('b');
  });

  it('si el nombre no existe cae a la primera fila y lo marca', () => {
    expect(pickCatalogId(CLASIFICACIONES, 'No Existe')).toEqual({
      id: 'cls-basico',
      name: 'Basico',
      usedFallback: true,
    });
  });

  it('catálogo vacío → null', () => {
    expect(pickCatalogId([], 'Estilo de Vida')).toBeNull();
  });
});

describe('itemDefaultNamesFor', () => {
  it('categoría común → Estilo de Vida / Reducir', () => {
    expect(itemDefaultNamesFor('VIVIENDA')).toEqual({
      classification: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('DEUDAS (sin importar mayúsculas ni espacios) → Basico / Necesario', () => {
    const esperado = { classification: 'Basico', control: 'Necesario' };
    expect(itemDefaultNamesFor('DEUDAS')).toEqual(esperado);
    expect(itemDefaultNamesFor(' deudas ')).toEqual(esperado);
    expect(itemDefaultNamesFor('Deudas')).toEqual(esperado);
  });

  it('sin categoría (null/undefined/vacía) → valores generales', () => {
    const esperado = { classification: 'Estilo de Vida', control: 'Reducir' };
    expect(itemDefaultNamesFor(null)).toEqual(esperado);
    expect(itemDefaultNamesFor(undefined)).toEqual(esperado);
    expect(itemDefaultNamesFor('')).toEqual(esperado);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/catalog-defaults.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/constants/budget-defaults"` (el archivo no existe).

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/constants/budget-defaults.ts`:

```ts
/**
 * Valores por defecto de los rubros que crea la app (contratos §2.5).
 *
 * Se buscan POR NOMBRE en los catálogos (classifications, controls,
 * budget_statuses). Antes se tomaba el primero activo en orden alfabético,
 * que en producción es "Basico"/"Eliminar": todo rubro nuevo nacía marcado
 * como gasto básico que había que eliminar.
 */

/** Clasificación de un rubro nuevo cualquiera. */
export const DEFAULT_ITEM_CLASSIFICATION = 'Estilo de Vida';

/** Control de un rubro nuevo cualquiera. */
export const DEFAULT_ITEM_CONTROL = 'Reducir';

/** Clasificación de los rubros de la categoría DEUDAS. */
export const DEUDA_ITEM_CLASSIFICATION = 'Basico';

/** Control de los rubros de la categoría DEUDAS. */
export const DEUDA_ITEM_CONTROL = 'Necesario';

/** Estado de todo rubro nuevo. */
export const DEFAULT_ITEM_STATUS = 'Activo';
```

Crear `src/lib/budget/catalog-defaults.ts`:

```ts
/**
 * Elección pura de catálogos (clasificación, control, estado) para rubros
 * nuevos. Sin Supabase: se testea sola. El lector contra la base vive en
 * item-defaults-supabase.ts.
 */

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';

export interface CatalogRow {
  id: string;
  name: string;
}

export interface CatalogPick {
  id: string;
  name: string;
  /** true si el nombre preferido no existía y se tomó la primera fila. */
  usedFallback: boolean;
}

export interface ItemDefaultNames {
  classification: string;
  control: string;
}

/** Nombre de la categoría cuyos rubros usan los valores de deuda. */
const DEUDAS_CATEGORY_NAME = 'DEUDAS';

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Devuelve la fila cuyo nombre es `preferredName` (exacto primero; si no,
 * ignorando mayúsculas, tildes y espacios de borde). Si no existe, la primera
 * fila con `usedFallback: true`. Las filas deben venir ya filtradas a activas
 * y ordenadas por nombre: "la primera" es la primera activa por nombre.
 * Catálogo vacío → null.
 */
export function pickCatalogId(
  rows: readonly CatalogRow[],
  preferredName: string,
): CatalogPick | null {
  if (rows.length === 0) return null;

  const wanted = normalizeName(preferredName);
  const match =
    rows.find(row => row.name === preferredName) ??
    rows.find(row => normalizeName(row.name) === wanted);

  if (match) return { id: match.id, name: match.name, usedFallback: false };

  const first = rows[0];
  return { id: first.id, name: first.name, usedFallback: true };
}

/**
 * Nombres de clasificación y control para un rubro nuevo de la categoría
 * indicada: DEUDAS usa DEUDA_ITEM_*, cualquier otra (o ninguna) DEFAULT_ITEM_*.
 */
export function itemDefaultNamesFor(
  categoryName?: string | null,
): ItemDefaultNames {
  const isDeudas =
    !!categoryName &&
    normalizeName(categoryName) === normalizeName(DEUDAS_CATEGORY_NAME);

  return isDeudas
    ? {
        classification: DEUDA_ITEM_CLASSIFICATION,
        control: DEUDA_ITEM_CONTROL,
      }
    : {
        classification: DEFAULT_ITEM_CLASSIFICATION,
        control: DEFAULT_ITEM_CONTROL,
      };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/catalog-defaults.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/constants/budget-defaults.ts src/lib/budget/catalog-defaults.ts src/lib/budget/catalog-defaults.test.ts && git commit -m "$(cat <<'EOF'
feat(presupuesto): constantes y selección por nombre de los valores por defecto de rubros

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Lector de catálogos contra Supabase con respaldo y aviso

**Files:**
- Create: `src/lib/budget/item-defaults-supabase.ts`
- Test: `src/lib/budget/item-defaults-supabase.test.ts`

**Interfaces:**
- Consumes (Task 1): `pickCatalogId(rows, preferredName): CatalogPick | null`, `type CatalogRow`, `type ItemDefaultNames`, `DEFAULT_ITEM_STATUS`.
- Produces:
  - `interface BudgetItemDefaultIds { classificationId: string; controlId: string; statusId: string }`
  - `type ResolveDefaultsResult = { ok: true; ids: BudgetItemDefaultIds } | { ok: false }`
  - `async function resolveBudgetItemDefaults(supabase: SupabaseClient<Database>, names: ItemDefaultNames): Promise<ResolveDefaultsResult>`
  - Consultas que hace (las tres en paralelo): `from(<tabla>).select('id, name').eq('is_active', true).order('name')` para `classifications`, `controls` y `budget_statuses`.
  - Aviso de respaldo: `console.warn('[budget-defaults] No existe <etiqueta> "<buscado>"; se usa "<usado>".')` con etiqueta `la clasificación` | `el control` | `el estado`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/budget/item-defaults-supabase.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database';

import { resolveBudgetItemDefaults } from './item-defaults-supabase';

interface Resultado {
  data: { id: string; name: string }[] | null;
  error: unknown;
}

const CLASIFICACIONES = [
  { id: 'cls-basico', name: 'Basico' },
  { id: 'cls-estilo', name: 'Estilo de Vida' },
];
const CONTROLES = [
  { id: 'ctl-eliminar', name: 'Eliminar' },
  { id: 'ctl-necesario', name: 'Necesario' },
  { id: 'ctl-reducir', name: 'Reducir' },
];
const ESTADOS = [
  { id: 'st-activo', name: 'Activo' },
  { id: 'st-inactivo', name: 'Inactivo' },
];

/**
 * Cliente falso: cada tabla responde con su resultado al final de
 * select→eq→order, y se guarda qué se pidió para verificar los filtros.
 */
function clienteFalso(resultados: Partial<Record<string, Resultado>> = {}) {
  const tablas: Record<string, Resultado> = {
    classifications: { data: CLASIFICACIONES, error: null },
    controls: { data: CONTROLES, error: null },
    budget_statuses: { data: ESTADOS, error: null },
    ...resultados,
  };
  const pedidos: Array<{
    tabla: string;
    select?: string;
    eq?: [string, unknown];
    order?: string;
  }> = [];

  const client = {
    from: vi.fn((tabla: string) => {
      const pedido: (typeof pedidos)[number] = { tabla };
      pedidos.push(pedido);
      const chain = {
        select: vi.fn((cols: string) => {
          pedido.select = cols;
          return chain;
        }),
        eq: vi.fn((col: string, valor: unknown) => {
          pedido.eq = [col, valor];
          return chain;
        }),
        order: vi.fn((col: string) => {
          pedido.order = col;
          return Promise.resolve(tablas[tabla]);
        }),
      };
      return chain;
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    pedidos,
  };
}

const GENERAL = { classification: 'Estilo de Vida', control: 'Reducir' };
const DEUDA = { classification: 'Basico', control: 'Necesario' };

describe('resolveBudgetItemDefaults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('elige clasificación, control y estado por nombre (no el primero)', async () => {
    const { client } = clienteFalso();

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-estilo',
        controlId: 'ctl-reducir',
        statusId: 'st-activo',
      },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('usa los nombres de deuda cuando se le piden', async () => {
    const { client } = clienteFalso();

    const r = await resolveBudgetItemDefaults(client, DEUDA);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-basico',
        controlId: 'ctl-necesario',
        statusId: 'st-activo',
      },
    });
  });

  it('consulta solo catálogos activos, ordenados por nombre', async () => {
    const { client, pedidos } = clienteFalso();

    await resolveBudgetItemDefaults(client, GENERAL);

    expect(pedidos.map(p => p.tabla).sort()).toEqual([
      'budget_statuses',
      'classifications',
      'controls',
    ]);
    for (const p of pedidos) {
      expect(p.select).toBe('id, name');
      expect(p.eq).toEqual(['is_active', true]);
      expect(p.order).toBe('name');
    }
  });

  it('si el nombre no existe cae al primero activo y avisa con console.warn', async () => {
    const { client } = clienteFalso({
      classifications: {
        data: [
          { id: 'cls-basico', name: 'Basico' },
          { id: 'cls-caprichos', name: 'Caprichos' },
        ],
        error: null,
      },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-basico',
        controlId: 'ctl-reducir',
        statusId: 'st-activo',
      },
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[budget-defaults] No existe la clasificación "Estilo de Vida"; se usa "Basico".',
    );
  });

  it('si falla una consulta → ok:false y console.error', async () => {
    const { client } = clienteFalso({
      controls: { data: null, error: { message: 'fallo' } },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });

  it('si un catálogo activo está vacío → ok:false', async () => {
    const { client } = clienteFalso({
      budget_statuses: { data: [], error: null },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/item-defaults-supabase.test.ts`
Expected: FAIL — `Failed to resolve import "./item-defaults-supabase"`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/budget/item-defaults-supabase.ts`:

```ts
/**
 * Resuelve los ids de clasificación, control y estado de un rubro nuevo
 * contra Supabase. La elección (por nombre, con respaldo al primero activo)
 * es pura y vive en catalog-defaults.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { DEFAULT_ITEM_STATUS } from '@/lib/constants/budget-defaults';
import type { Database } from '@/types/database';

import {
  pickCatalogId,
  type CatalogPick,
  type CatalogRow,
  type ItemDefaultNames,
} from './catalog-defaults';

type DBClient = SupabaseClient<Database>;

export interface BudgetItemDefaultIds {
  classificationId: string;
  controlId: string;
  statusId: string;
}

export type ResolveDefaultsResult =
  | { ok: true; ids: BudgetItemDefaultIds }
  | { ok: false };

function pickWithWarning(
  rows: readonly CatalogRow[],
  preferredName: string,
  label: string,
): CatalogPick | null {
  const pick = pickCatalogId(rows, preferredName);
  if (pick?.usedFallback) {
    console.warn(
      `[budget-defaults] No existe ${label} "${preferredName}"; se usa "${pick.name}".`,
    );
  }
  return pick;
}

export async function resolveBudgetItemDefaults(
  supabase: DBClient,
  names: ItemDefaultNames,
): Promise<ResolveDefaultsResult> {
  const [classificationResult, controlResult, statusResult] =
    await Promise.all([
      supabase
        .from('classifications')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('controls')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('budget_statuses')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
    ]);

  if (
    classificationResult.error ||
    controlResult.error ||
    statusResult.error
  ) {
    console.error('Error obteniendo catálogos del rubro:', {
      classifications: classificationResult.error,
      controls: controlResult.error,
      statuses: statusResult.error,
    });
    return { ok: false };
  }

  const classification = pickWithWarning(
    classificationResult.data ?? [],
    names.classification,
    'la clasificación',
  );
  const control = pickWithWarning(
    controlResult.data ?? [],
    names.control,
    'el control',
  );
  const status = pickWithWarning(
    statusResult.data ?? [],
    DEFAULT_ITEM_STATUS,
    'el estado',
  );

  if (!classification || !control || !status) {
    console.error('Catálogo activo vacío para el rubro:', {
      classifications: !!classification,
      controls: !!control,
      statuses: !!status,
    });
    return { ok: false };
  }

  return {
    ok: true,
    ids: {
      classificationId: classification.id,
      controlId: control.id,
      statusId: status.id,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/item-defaults-supabase.test.ts && bun run type-check`
Expected: PASS (6 tests) y `tsc --noEmit` sin errores.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/budget/item-defaults-supabase.ts src/lib/budget/item-defaults-supabase.test.ts && git commit -m "$(cat <<'EOF'
feat(presupuesto): resolver de catálogos por nombre con respaldo y aviso

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `categories.ts` elige por nombre

**Files:**
- Modify: `src/lib/actions/categories.ts` (imports al inicio; bloque "Valores por defecto de clasificación, control y estado" en `createDefaultBudgetItemForCategory` ~284-320 y en `createBudgetItemInMonth` ~395-431; los dos `.insert(...)`)
- Test: `src/lib/actions/categories.test.ts`

**Interfaces:**
- Consumes (Tasks 1–2): `itemDefaultNamesFor(categoryName?: string | null): ItemDefaultNames`, `resolveBudgetItemDefaults(supabase, names): Promise<ResolveDefaultsResult>` con `ids.classificationId`, `ids.controlId`, `ids.statusId`.
- Produces: firmas públicas sin cambios:
  - `createDefaultBudgetItemForCategory(categoryId: string, categoryName: string, monthYear: string)` → `{ success: boolean; error?: string }`
  - `createBudgetItemInMonth(categoryId: string, name: string, monthYear: string): Promise<{ success: boolean; itemId?: string; error?: string }>`
  - Nuevo en `createBudgetItemInMonth`: lee el nombre de la categoría con `from('categories').select('name').eq('id', categoryId).eq('user_id', user.id).maybeSingle()`; si no la encuentra usa los valores generales.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/actions/categories.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/budget/item-defaults-supabase', () => ({
  resolveBudgetItemDefaults: vi.fn(),
}));

import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import { createClient } from '@/lib/supabase/server';

import {
  createBudgetItemInMonth,
  createDefaultBudgetItemForCategory,
} from './categories';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedResolve = resolveBudgetItemDefaults as unknown as ReturnType<
  typeof vi.fn
>;

const IDS = {
  classificationId: 'cls-elegida',
  controlId: 'ctl-elegido',
  statusId: 'st-activo',
};
const GENERAL = { classification: 'Estilo de Vida', control: 'Reducir' };
const DEUDA = { classification: 'Basico', control: 'Necesario' };

/**
 * Cadena falsa de PostgREST: todos los métodos devuelven la misma cadena y,
 * al hacer await (directo, o vía single/maybeSingle), resuelve `resultado`.
 */
function cadena(resultado: unknown) {
  const chain: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'ilike', 'order', 'insert']) {
    chain[metodo] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(resultado);
  chain.maybeSingle = vi.fn().mockResolvedValue(resultado);
  chain.then = (
    ok: (v: unknown) => unknown,
    ko?: (e: unknown) => unknown,
  ) => Promise.resolve(resultado).then(ok, ko);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}

function clienteFalso({
  user = { id: 'user-1' } as { id: string } | null,
  categoria = { name: 'VIVIENDA' } as { name: string } | null,
} = {}) {
  const categories = cadena({ data: categoria, error: null });
  const budgetItems = cadena({ data: { id: 'item-1' }, error: null });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    rpc: vi.fn().mockResolvedValue({ data: 'tpl-1', error: null }),
    from: vi.fn((tabla: string) =>
      tabla === 'categories' ? categories : budgetItems,
    ),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, categories, budgetItems };
}

describe('createDefaultBudgetItemForCategory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('pide Estilo de Vida / Reducir y los inserta en el rubro', async () => {
    const { client, budgetItems } = clienteFalso();

    const r = await createDefaultBudgetItemForCategory(
      'cat-1',
      'VIVIENDA',
      '2026-09',
    );

    expect(r).toEqual({ success: true });
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
    expect(budgetItems.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        template_id: 'tpl-1',
        category_id: 'cat-1',
        name: 'VIVIENDA',
        classification_id: 'cls-elegida',
        control_id: 'ctl-elegido',
        status_id: 'st-activo',
      }),
    );
  });

  it('categoría DEUDAS → pide Basico / Necesario', async () => {
    const { client } = clienteFalso();

    await createDefaultBudgetItemForCategory('cat-2', 'DEUDAS', '2026-09');

    expect(mockedResolve).toHaveBeenCalledWith(client, DEUDA);
  });

  it('sin valores por defecto → error y no inserta', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { budgetItems } = clienteFalso();

    const r = await createDefaultBudgetItemForCategory(
      'cat-1',
      'VIVIENDA',
      '2026-09',
    );

    expect(r).toEqual({
      success: false,
      error: 'No se pudieron obtener los valores por defecto del ítem',
    });
    expect(budgetItems.insert).not.toHaveBeenCalled();
  });
});

describe('createBudgetItemInMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('lee el nombre de la categoría del usuario y usa los valores generales', async () => {
    const { client, categories, budgetItems } = clienteFalso();

    const r = await createBudgetItemInMonth('cat-1', '  Arriendo ', '2026-09');

    expect(r).toEqual({ success: true, itemId: 'item-1' });
    expect(categories.select).toHaveBeenCalledWith('name');
    expect(categories.eq).toHaveBeenCalledWith('id', 'cat-1');
    expect(categories.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
    expect(budgetItems.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category_id: 'cat-1',
        name: 'Arriendo',
        classification_id: 'cls-elegida',
        control_id: 'ctl-elegido',
        status_id: 'st-activo',
      }),
    );
  });

  it('categoría DEUDAS → pide Basico / Necesario', async () => {
    const { client } = clienteFalso({ categoria: { name: 'Deudas' } });

    await createBudgetItemInMonth('cat-2', 'Tarjeta', '2026-09');

    expect(mockedResolve).toHaveBeenCalledWith(client, DEUDA);
  });

  it('categoría no encontrada → valores generales, igual crea el rubro', async () => {
    const { client } = clienteFalso({ categoria: null });

    const r = await createBudgetItemInMonth('cat-x', 'Algo', '2026-09');

    expect(r).toEqual({ success: true, itemId: 'item-1' });
    expect(mockedResolve).toHaveBeenCalledWith(client, GENERAL);
  });

  it('sin valores por defecto → error y no inserta', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { budgetItems } = clienteFalso();

    const r = await createBudgetItemInMonth('cat-1', 'Arriendo', '2026-09');

    expect(r).toEqual({
      success: false,
      error: 'No se pudieron obtener los valores por defecto del ítem',
    });
    expect(budgetItems.insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/categories.test.ts`
Expected: FAIL — `expected "spy" to be called with arguments` en `mockedResolve` (las acciones todavía consultan `classifications`/`controls` con `.limit(1)`; además `cadena` no tiene `limit`, así que puede fallar con `limit is not a function` y la acción devolver `Error interno del servidor`).

- [ ] **Step 3: Write minimal implementation**

En `src/lib/actions/categories.ts`, reemplazar el bloque de imports internos:

```ts
import { createClient } from '@/lib/supabase/server';
```

por:

```ts
import { itemDefaultNamesFor } from '@/lib/budget/catalog-defaults';
import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import { createClient } from '@/lib/supabase/server';
```

En `createDefaultBudgetItemForCategory`, reemplazar desde el comentario `// Valores por defecto de clasificación, control y estado` hasta el cierre del `if (classificationResult.error || …) { … }` (el que devuelve `'No se pudieron obtener los valores por defecto del ítem'`) por:

```ts
    // Clasificación, control y estado por nombre (contratos §2.5)
    const defaults = await resolveBudgetItemDefaults(
      supabase,
      itemDefaultNamesFor(categoryName),
    );

    if (!defaults.ok) {
      return {
        success: false,
        error: 'No se pudieron obtener los valores por defecto del ítem',
      };
    }
```

y en su `.insert({ … })` cambiar las tres líneas de catálogo:

```ts
      classification_id: defaults.ids.classificationId,
      control_id: defaults.ids.controlId,
      status_id: defaults.ids.statusId,
```

En `createBudgetItemInMonth`, reemplazar el mismo bloque (desde `// Valores por defecto de clasificación, control y estado` hasta el cierre del `if (classificationResult.error || …) { … }`) por:

```ts
    // Nombre de la categoría (del usuario) para saber si es DEUDAS
    const { data: category } = await supabase
      .from('categories')
      .select('name')
      .eq('id', categoryId)
      .eq('user_id', user.id)
      .maybeSingle();

    // Clasificación, control y estado por nombre (contratos §2.5)
    const defaults = await resolveBudgetItemDefaults(
      supabase,
      itemDefaultNamesFor(category?.name),
    );

    if (!defaults.ok) {
      return {
        success: false,
        error: 'No se pudieron obtener los valores por defecto del ítem',
      };
    }
```

y en su `.insert({ … })` cambiar las tres líneas de catálogo:

```ts
        classification_id: defaults.ids.classificationId,
        control_id: defaults.ids.controlId,
        status_id: defaults.ids.statusId,
```

Verificar que no quedan referencias viejas:

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -n "classificationResult\|controlResult\|statusResult\|limit(1)" src/lib/actions/categories.ts`
Expected: sin salida.

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/categories.test.ts && bun run type-check`
Expected: PASS (7 tests) y `tsc --noEmit` sin errores.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/actions/categories.ts src/lib/actions/categories.test.ts && git commit -m "$(cat <<'EOF'
fix(presupuesto): los rubros nuevos de una categoría nacen como Estilo de Vida/Reducir, no Basico/Eliminar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `deudas-budget.ts` usa Basico / Necesario por nombre

**Files:**
- Modify: `src/lib/actions/deudas-budget.ts` (imports; bloque "Valores por defecto de clasificación, control y estado" ~45-79; `.map(t => ({ … }))` ~106-120)
- Test: `src/lib/actions/deudas-budget.test.ts`

**Interfaces:**
- Consumes (Tasks 1–2): `DEUDA_ITEM_CLASSIFICATION`, `DEUDA_ITEM_CONTROL`, `resolveBudgetItemDefaults(supabase, { classification, control })`.
- Produces: firma sin cambios `createBudgetItemsForDeuda(deudaId: string, itemName: string)` → `{ success: boolean; error?: string }`.

- [ ] **Step 1: Write the failing test**

Crear `src/lib/actions/deudas-budget.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/budget/item-defaults-supabase', () => ({
  resolveBudgetItemDefaults: vi.fn(),
}));

import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import { createClient } from '@/lib/supabase/server';

import { createBudgetItemsForDeuda } from './deudas-budget';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedResolve = resolveBudgetItemDefaults as unknown as ReturnType<
  typeof vi.fn
>;

const IDS = {
  classificationId: 'cls-basico',
  controlId: 'ctl-necesario',
  statusId: 'st-activo',
};

/**
 * Cadena falsa de PostgREST: todos los métodos devuelven la misma cadena y,
 * al hacer await (directo, o vía single/maybeSingle), resuelve `resultado`.
 */
function cadena(resultado: unknown) {
  const chain: Record<string, unknown> = {};
  for (const metodo of ['select', 'eq', 'ilike', 'order', 'insert']) {
    chain[metodo] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(resultado);
  chain.maybeSingle = vi.fn().mockResolvedValue(resultado);
  chain.then = (
    ok: (v: unknown) => unknown,
    ko?: (e: unknown) => unknown,
  ) => Promise.resolve(resultado).then(ok, ko);
  return chain as Record<string, ReturnType<typeof vi.fn>>;
}

/**
 * budget_items se consulta dos veces: primero los templates que ya tienen
 * ítem para la deuda, después el insert. Se sirven en ese orden.
 */
function clienteFalso() {
  const categories = cadena({ data: { id: 'cat-deudas' }, error: null });
  const templates = cadena({
    data: [{ id: 'tpl-1' }, { id: 'tpl-2' }],
    error: null,
  });
  const existentes = cadena({ data: [{ template_id: 'tpl-2' }], error: null });
  const insert = cadena({ error: null });
  const colaItems = [existentes, insert];

  const client = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn((tabla: string) => {
      if (tabla === 'categories') return categories;
      if (tabla === 'budget_templates') return templates;
      return colaItems.shift();
    }),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, insert };
}

describe('createBudgetItemsForDeuda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolve.mockResolvedValue({ ok: true, ids: IDS });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('pide Basico / Necesario por nombre y los pone en los rubros nuevos', async () => {
    const { client, insert } = clienteFalso();

    const r = await createBudgetItemsForDeuda('deuda-1', 'Tarjeta X');

    expect(r).toEqual({ success: true });
    expect(mockedResolve).toHaveBeenCalledWith(client, {
      classification: 'Basico',
      control: 'Necesario',
    });
    expect(insert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        template_id: 'tpl-1',
        category_id: 'cat-deudas',
        name: 'Tarjeta X',
        deuda_id: 'deuda-1',
        classification_id: 'cls-basico',
        control_id: 'ctl-necesario',
        status_id: 'st-activo',
      }),
    ]);
  });

  it('sin valores por defecto → error y no consulta templates', async () => {
    mockedResolve.mockResolvedValue({ ok: false });
    const { client } = clienteFalso();

    const r = await createBudgetItemsForDeuda('deuda-1', 'Tarjeta X');

    expect(r).toEqual({ success: false, error: 'Faltan valores por defecto' });
    expect(client.from).not.toHaveBeenCalledWith('budget_templates');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/deudas-budget.test.ts`
Expected: FAIL — `mockedResolve` no fue llamado (la acción todavía consulta `classifications`/`controls` con `.limit(1)`, y `cadena` no tiene `limit`, así que devuelve `Error interno del servidor`).

- [ ] **Step 3: Write minimal implementation**

En `src/lib/actions/deudas-budget.ts`, reemplazar:

```ts
import { createClient } from '@/lib/supabase/server';
```

por:

```ts
import { resolveBudgetItemDefaults } from '@/lib/budget/item-defaults-supabase';
import {
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';
import { createClient } from '@/lib/supabase/server';
```

Reemplazar desde `// Valores por defecto de clasificación, control y estado` hasta el cierre del `if (classificationResult.error || …) { … return { success: false, error: 'Faltan valores por defecto' }; }` por:

```ts
    // Clasificación, control y estado por nombre (contratos §2.5)
    const defaults = await resolveBudgetItemDefaults(supabase, {
      classification: DEUDA_ITEM_CLASSIFICATION,
      control: DEUDA_ITEM_CONTROL,
    });

    if (!defaults.ok) {
      return { success: false, error: 'Faltan valores por defecto' };
    }
```

En el `.map(t => ({ … }))` que arma `rows`, cambiar las tres líneas de catálogo:

```ts
        classification_id: defaults.ids.classificationId,
        control_id: defaults.ids.controlId,
        status_id: defaults.ids.statusId,
```

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -n "classificationResult\|controlResult\|statusResult\|limit(1)" src/lib/actions/deudas-budget.ts`
Expected: sin salida.

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/deudas-budget.test.ts && bun run type-check`
Expected: PASS (2 tests) y `tsc --noEmit` sin errores.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/actions/deudas-budget.ts src/lib/actions/deudas-budget.test.ts && git commit -m "$(cat <<'EOF'
fix(deudas): los rubros de una deuda nacen como Basico/Necesario por nombre

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Formulario de rubro nuevo en /presupuesto propone los valores del contrato

**Files:**
- Modify: `src/lib/budget/catalog-defaults.ts` (agregar `defaultItemFormNames`)
- Modify: `src/lib/budget/catalog-defaults.test.ts` (agregar su `describe`)
- Modify: `src/app/presupuesto/page.tsx` (import; ~203-235: `defaultClasificacion`, `defaultControl`, estado inicial de `formData` y `openAddModal`)

**Interfaces:**
- Consumes (Task 1): `pickCatalogId`, `itemDefaultNamesFor`, `type CatalogRow`.
- Produces: `function defaultItemFormNames(classifications: readonly CatalogRow[], controls: readonly CatalogRow[], categoryName?: string | null): { clasificacion: string; control: string }` — nombre del catálogo elegido por `pickCatalogId`; con catálogo vacío (aún no cargó) devuelve el nombre del contrato.

- [ ] **Step 1: Write the failing test**

En `src/lib/budget/catalog-defaults.test.ts`, cambiar el import:

```ts
import { itemDefaultNamesFor, pickCatalogId } from './catalog-defaults';
```

por:

```ts
import {
  defaultItemFormNames,
  itemDefaultNamesFor,
  pickCatalogId,
} from './catalog-defaults';
```

y agregar al final del archivo:

```ts
describe('defaultItemFormNames', () => {
  const CONTROLES = [
    { id: 'ctl-eliminar', name: 'Eliminar' },
    { id: 'ctl-necesario', name: 'Necesario' },
    { id: 'ctl-reducir', name: 'Reducir' },
  ];

  it('catálogos aún sin cargar → nombres del contrato', () => {
    expect(defaultItemFormNames([], [])).toEqual({
      clasificacion: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('con catálogos → el nombre del contrato tal como está en el catálogo', () => {
    expect(defaultItemFormNames(CLASIFICACIONES, CONTROLES, 'VIVIENDA')).toEqual({
      clasificacion: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('categoría DEUDAS → Basico / Necesario', () => {
    expect(defaultItemFormNames(CLASIFICACIONES, CONTROLES, 'DEUDAS')).toEqual({
      clasificacion: 'Basico',
      control: 'Necesario',
    });
  });

  it('si el nombre no está en el catálogo → el primero de la lista', () => {
    const sinEstilo = [{ id: 'cls-basico', name: 'Basico' }];
    expect(defaultItemFormNames(sinEstilo, CONTROLES)).toEqual({
      clasificacion: 'Basico',
      control: 'Reducir',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/catalog-defaults.test.ts`
Expected: FAIL — `defaultItemFormNames is not a function` (no está exportada).

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `src/lib/budget/catalog-defaults.ts`:

```ts
/**
 * Clasificación y control que propone el formulario "agregar rubro" de
 * /presupuesto. Devuelve el nombre tal como está en el catálogo; si el
 * catálogo todavía no cargó (vacío), el nombre del contrato.
 */
export function defaultItemFormNames(
  classifications: readonly CatalogRow[],
  controls: readonly CatalogRow[],
  categoryName?: string | null,
): { clasificacion: string; control: string } {
  const wanted = itemDefaultNamesFor(categoryName);
  return {
    clasificacion:
      pickCatalogId(classifications, wanted.classification)?.name ??
      wanted.classification,
    control: pickCatalogId(controls, wanted.control)?.name ?? wanted.control,
  };
}
```

En `src/app/presupuesto/page.tsx`, agregar el import justo antes de `import {\n  mapRubroEstado,` (orden alfabético de `@/lib/budget/...`):

```ts
import { defaultItemFormNames } from '@/lib/budget/catalog-defaults';
```

Reemplazar:

```ts
  // Estado del formulario
  const defaultClasificacion = classifications[0]?.name || 'Basico';
  const defaultControl = controls[0]?.name || 'Reducir';

  const [formData, setFormData] = useState<BudgetFormData>({
    descripcion: '',
    fecha: '',
    clasificacion: defaultClasificacion,
    control: defaultControl,
```

por:

```ts
  // Estado del formulario (al montar los catálogos aún no cargan: nombres del contrato)
  const [formData, setFormData] = useState<BudgetFormData>({
    descripcion: '',
    fecha: '',
    ...defaultItemFormNames([], []),
```

Y dentro de `openAddModal`, reemplazar:

```ts
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: classifications[0]?.name || 'Basico',
      control: controls[0]?.name || 'Reducir',
```

por:

```ts
    const categoryName = categories.find(cat => cat.id === categoriaId)?.nombre;
    setFormData({
      descripcion: '',
      fecha: '',
      ...defaultItemFormNames(classifications, controls, categoryName),
```

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -n "classifications\[0\]\|controls\[0\]\|defaultClasificacion\|defaultControl" src/app/presupuesto/page.tsx`
Expected: sin salida.

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/budget/catalog-defaults.test.ts && bun run type-check`
Expected: PASS (13 tests) y `tsc --noEmit` sin errores.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/budget/catalog-defaults.ts src/lib/budget/catalog-defaults.test.ts src/app/presupuesto/page.tsx && git commit -m "$(cat <<'EOF'
fix(presupuesto): el formulario de rubro nuevo propone Estilo de Vida/Reducir en vez del primero de la lista

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación completa

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa y tipos**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: todos los tests en verde (incluye los 4 archivos nuevos) y `tsc --noEmit` sin errores.

- [ ] **Step 2: No quedan selecciones "el primero" de catálogos al crear rubros**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -rnE "from\('(classifications|controls)'\)" src --include='*.ts' --include='*.tsx' | grep -v "\.test\."`
Expected: solo `src/lib/budget/item-defaults-supabase.ts`, `src/lib/services/budget.ts` (listados de UI), `src/app/api/budget/route.ts` y `src/app/api/budget/[id]/route.ts` (por nombre enviado). (`src/scripts/migrate-july-data.ts` ya no aparece: lo borró S07.) Ninguno con `.limit(1)`:

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -rn "limit(1)" src/lib/actions src/lib/budget`
Expected: sin salida.

- [ ] **Step 3: Sin migraciones nuevas**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && git diff --name-only main...HEAD -- supabase/`
Expected: sin archivos de S08 (solo los que existieran de otras historias).

Sin commit en esta tarea (no cambia archivos).

---

## Autorrevisión

- **Cobertura de criterios:** 1 → Task 1; 2 → Task 3; 3 → Task 4; 4 → Task 2 (warn + respaldo) y Task 1 (`pickCatalogId`); 5 → Task 2 (`ok:false`) y Tasks 3–4 (mensajes y no-insert); 6 → Task 5; 7 → Task 6; 8 → Task 6 Step 3.
- **Marcadores:** ninguno; todo paso de código tiene el código completo.
- **Tipos consistentes:** `CatalogRow`, `CatalogPick`, `ItemDefaultNames` (Task 1) → usados en Tasks 2 y 5; `ResolveDefaultsResult` con `ids.classificationId/controlId/statusId` (Task 2) → usados igual en Tasks 3 y 4 y en los mocks de sus tests. `LookupItem` de `page.tsx` (`{ id; name }`) es compatible estructuralmente con `CatalogRow`; `categories` del hook `useMonthlyBudget` tiene `id` y `nombre` (ya usado en `handleDeleteCategory`).
- **Dependencias y orden (§5.3):** S08 va después de S07 y antes de S10 en el flujo APP. No usa código de S07 (solo nota que S07 borró `migrate-july-data.ts`, que por eso ya no sale en el grep de la Task 6). Toca archivos que ninguna otra historia modifica, salvo `src/app/presupuesto/page.tsx`, que S10 toca justo después (panel vacío). El cambio de S08 se limita a ~203-235 y un import para que S10 aplique sobre él sin choques.
