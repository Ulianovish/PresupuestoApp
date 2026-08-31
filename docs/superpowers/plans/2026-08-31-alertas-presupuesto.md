# Alertas de presupuesto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar cuando un rubro del presupuesto se acerca o pasa su límite, por WhatsApp en el momento del gasto y en el dashboard como estado.

**Architecture:** Una función pura calcula el umbral alcanzado; un RPC devuelve gasto vs presupuesto de los rubros vigilados; una tabla de dedupe con `ON CONFLICT ... WHERE` decide atómicamente si el aviso se manda. WhatsApp cuelga del enganche `onExpenseCreated` que ya existe; el panel del dashboard calcula en vivo sin tocar la tabla de dedupe.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (Postgres + RPCs `SECURITY DEFINER`), vitest, Tailwind, lucide-react.

## Global Constraints

- **Package manager: `bun`.** Nunca `npm` ni `yarn`.
- **Tests: `bun run test`** (= `vitest run`). `environment: 'node'` — no hay jsdom, así que **no se testean componentes React**; la lógica que se testea vive en archivos `.ts` puros.
- **Commits: `git commit --no-verify`.** El hook de husky en este repo revierte cambios.
- **NO correr `bun run db:types`.** Trunca `src/types/supabase.ts`. Los tipos nuevos se escriben a mano.
- Rama de trabajo: `feat/alertas-presupuesto` (ya creada, el spec ya está commiteado ahí).
- Umbrales: **80, 100, y luego cada +50** (150, 200, 250…).
- Selección de rubros: `COALESCE(bi.alerts_enabled, cl.name = 'Variable') AND bi.budgeted_amount > 0`.
- Idioma del código: comentarios y mensajes de usuario en español, como el resto del repo.
- Spec de referencia: `docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260831000000_budget_alerts.sql` | Columna `alerts_enabled`, tabla `budget_alerts_sent`, RPC `get_budget_alert_status` |
| `supabase/migrations/20260831000001_mark_budget_alert_sent.sql` | RPC del dedupe (Task 5) |
| `src/lib/budget/thresholds.ts` | `highestThreshold` y `diasRestantesDelMes` — puras, sin I/O |
| `src/lib/budget/thresholds.test.ts` | Tests de las puras |
| `src/lib/budget/alerts.ts` | `evaluarRubro` (pura), `formatearAlerta` (pura), `dispararAlertas` (I/O) |
| `src/lib/budget/alerts.test.ts` | Tests de evaluación, formato y dedupe |
| `src/lib/whatsapp/agent/tools.ts` | Cambia la firma de `onExpenseCreated` |
| `src/lib/whatsapp/agent/turn.ts` | Conecta el enganche real |
| `src/components/organisms/BudgetAlertsPanel/BudgetAlertsPanel.tsx` | Panel del dashboard |
| `src/components/organisms/BudgetItemModal/BudgetItemModal.tsx` | Selector de 3 estados del interruptor |

**Por qué `thresholds.ts` aparte de `alerts.ts`:** las puras no necesitan Supabase ni mocks. Separarlas deja el test de umbrales corriendo en milisegundos y sin fixtures, y `alerts.ts` importa de ahí.

---

### Task 1: Migración SQL

**Files:**
- Create: `supabase/migrations/20260831000000_budget_alerts.sql`

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: columna `budget_items.alerts_enabled BOOLEAN NULL`; tabla `budget_alerts_sent(user_id, month_year, budget_item_id, last_threshold, sent_at)`; RPC `get_budget_alert_status(p_user_id UUID, p_month_year VARCHAR(7))` que devuelve `(budget_item_id UUID, item_name VARCHAR, category_name VARCHAR, budgeted DECIMAL(12,2), spent DECIMAL(12,2))`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260831000000_budget_alerts.sql`:

```sql
-- Alertas de presupuesto por rubro.
-- Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md

-- 1. Qué rubros se vigilan.
-- NULL a propósito: significa "decide por clasificación" (Variable → vigila).
-- true/false es override explícito del usuario y manda sobre el default, para
-- que cambiar la clasificación de un rubro no le pise una decisión manual.
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN;

COMMENT ON COLUMN budget_items.alerts_enabled IS
  'NULL = automático por clasificación (Variable vigila). true/false = override del usuario.';

-- 2. Dedupe: UNA fila por rubro por mes, con el umbral más alto ya avisado.
-- Una fila por umbral cruzado explotaría: un rubro al 938% son 19 umbrales.
CREATE TABLE IF NOT EXISTS budget_alerts_sent (
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year     TEXT NOT NULL,
    budget_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
    last_threshold INT  NOT NULL,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, month_year, budget_item_id)
);

-- Solo el webhook (service-role) escribe aquí; el navegador nunca la lee,
-- porque el panel calcula en vivo. RLS activo SIN políticas = nadie más entra.
ALTER TABLE budget_alerts_sent ENABLE ROW LEVEL SECURITY;

-- 3. Gasto vs presupuesto de los rubros vigilados.
-- Lo usan las dos puntas: el webhook de WhatsApp y el panel del dashboard.
-- El gasto se calcula desde transactions y NO desde budget_items.spent_amount,
-- que depende del roll-up y puede estar desfasado.
CREATE OR REPLACE FUNCTION get_budget_alert_status(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    budget_item_id UUID,
    item_name VARCHAR,
    category_name VARCHAR,
    budgeted DECIMAL(12,2),
    spent DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bi.id,
        bi.name,
        c.name,
        bi.budgeted_amount,
        COALESCE(SUM(t.amount), 0)::DECIMAL(12,2)
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    LEFT JOIN categories c ON c.id = bi.category_id
    LEFT JOIN classifications cl ON cl.id = bi.classification_id
    LEFT JOIN transactions t
           ON t.budget_item_id = bi.id
          AND t.month_year = p_month_year
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND bi.is_active = true
      AND bi.budgeted_amount > 0
      AND COALESCE(bi.alerts_enabled, cl.name = 'Variable')
    GROUP BY bi.id, bi.name, c.name, bi.budgeted_amount
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_budget_alert_status(UUID, VARCHAR) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración**

Aplicarla en Supabase (MCP `apply_migration` con nombre `budget_alerts`, o `supabase db push`).

- [ ] **Step 3: Verificar que el RPC devuelve rubros**

Correr en el SQL editor:

```sql
SELECT * FROM get_budget_alert_status(
  '4f87341b-e90c-4400-8cc0-5ac0203894a0', '2026-09'
) ORDER BY spent DESC;
```

Esperado: **25 filas** (los rubros Variable con presupuesto > 0 de septiembre 2026). Ninguna con `budgeted = 0`. No debe aparecer `Arriendo`, `Leasing`, `Pensión Abril` ni `Pensión Alice` (son `Fijo`).

- [ ] **Step 4: Verificar que el override funciona**

```sql
UPDATE budget_items bi SET alerts_enabled = false
FROM budget_templates bt, categories c
WHERE bt.id = bi.template_id AND bt.month_year = '2026-09'
  AND c.id = bi.category_id AND bi.name = 'Dulces' AND c.name = 'MERCADO';

SELECT count(*) FROM get_budget_alert_status(
  '4f87341b-e90c-4400-8cc0-5ac0203894a0', '2026-09');
-- Esperado: 24

UPDATE budget_items bi SET alerts_enabled = NULL
FROM budget_templates bt, categories c
WHERE bt.id = bi.template_id AND bt.month_year = '2026-09'
  AND c.id = bi.category_id AND bi.name = 'Dulces' AND c.name = 'MERCADO';
-- vuelve a 25
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260831000000_budget_alerts.sql
git commit --no-verify -m "feat(alertas): migración de alerts_enabled, budget_alerts_sent y RPC"
```

---

### Task 2: Umbrales y días restantes (puras)

**Files:**
- Create: `src/lib/budget/thresholds.ts`
- Test: `src/lib/budget/thresholds.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `highestThreshold(pct: number): number` y `diasRestantesDelMes(hoy: Date): number`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/budget/thresholds.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { highestThreshold, diasRestantesDelMes } from './thresholds';

describe('highestThreshold', () => {
  it('calla por debajo del 80%', () => {
    expect(highestThreshold(0)).toBe(0);
    expect(highestThreshold(79.9)).toBe(0);
  });

  it('avisa al 80 y se queda ahí hasta el 100', () => {
    expect(highestThreshold(80)).toBe(80);
    expect(highestThreshold(99.9)).toBe(80);
  });

  it('escalona de 50 en 50 después del 100', () => {
    expect(highestThreshold(100)).toBe(100);
    expect(highestThreshold(149)).toBe(100);
    expect(highestThreshold(150)).toBe(150);
    expect(highestThreshold(199)).toBe(150);
    expect(highestThreshold(200)).toBe(200);
  });

  it('sigue avisando en un rubro disparado: Dulces llegó al 938% en agosto 2026', () => {
    expect(highestThreshold(938)).toBe(900);
  });

  it('trata un porcentaje negativo o NaN como silencio, no como error', () => {
    expect(highestThreshold(-5)).toBe(0);
    expect(highestThreshold(NaN)).toBe(0);
  });
});

describe('diasRestantesDelMes', () => {
  it('cuenta el día de hoy incluido', () => {
    // 22 de septiembre de 2026: quedan 22..30 = 9 días.
    expect(diasRestantesDelMes(new Date(2026, 8, 22))).toBe(9);
  });

  it('el último día del mes queda en 1', () => {
    expect(diasRestantesDelMes(new Date(2026, 7, 31))).toBe(1);
  });

  it('funciona en febrero bisiesto', () => {
    expect(diasRestantesDelMes(new Date(2028, 1, 28))).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/budget/thresholds.test.ts
```

Esperado: FAIL — `Failed to resolve import "./thresholds"`.

- [ ] **Step 3: Implementar**

Crear `src/lib/budget/thresholds.ts`:

```ts
/**
 * Umbrales de alerta de presupuesto.
 *
 * La escalera sigue DESPUÉS del 100% a propósito: con avisos solo en 80 y 100,
 * un rubro que se dispara avisa dos veces a principio de mes y después se calla.
 * En agosto 2026, Dulces llegó al 938% de su presupuesto.
 */

/** 0 si va por debajo del 80%. Si no: 80, 100, 150, 200, 250... */
export function highestThreshold(pct: number): number {
  if (!Number.isFinite(pct) || pct < 80) return 0;
  if (pct < 100) return 80;
  return Math.floor(pct / 50) * 50;
}

/** Días de calendario que faltan del mes, contando hoy. */
export function diasRestantesDelMes(hoy: Date): number {
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  return ultimo - hoy.getDate() + 1;
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

```bash
bun run test src/lib/budget/thresholds.test.ts
```

Esperado: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget/thresholds.ts src/lib/budget/thresholds.test.ts
git commit --no-verify -m "feat(alertas): escalera de umbrales y días restantes del mes"
```

---

### Task 3: Evaluación y formato de la alerta (puras)

**Files:**
- Create: `src/lib/budget/alerts.ts`
- Test: `src/lib/budget/alerts.test.ts`

**Interfaces:**
- Consumes: `highestThreshold`, `diasRestantesDelMes` de `./thresholds`.
- Produces:
  - `type RubroEstado = { budgetItemId: string; itemName: string; categoryName: string; budgeted: number; spent: number }`
  - `type Alerta = { budgetItemId: string; itemName: string; threshold: number; pct: number; spent: number; budgeted: number }`
  - `evaluarRubro(r: RubroEstado): Alerta | null`
  - `formatearAlerta(a: Alerta, hoy: Date): string`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/budget/alerts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { evaluarRubro, formatearAlerta, type RubroEstado } from './alerts';

const rubro = (over: Partial<RubroEstado> = {}): RubroEstado => ({
  budgetItemId: 'item-1',
  itemName: 'Dulces',
  categoryName: 'MERCADO',
  budgeted: 150000,
  spent: 0,
  ...over,
});

describe('evaluarRubro', () => {
  it('no alerta por debajo del 80%', () => {
    expect(evaluarRubro(rubro({ spent: 100000 }))).toBeNull();
  });

  it('alerta al cruzar el 80%', () => {
    const a = evaluarRubro(rubro({ spent: 123000 }));
    expect(a).not.toBeNull();
    expect(a!.threshold).toBe(80);
    expect(Math.round(a!.pct)).toBe(82);
  });

  it('alerta al pasarse', () => {
    expect(evaluarRubro(rubro({ spent: 195000 }))!.threshold).toBe(100);
  });

  it('un rubro sin presupuesto es silencio, no división por cero', () => {
    expect(evaluarRubro(rubro({ budgeted: 0, spent: 50000 }))).toBeNull();
  });
});

describe('formatearAlerta', () => {
  const hoy = new Date(2026, 8, 22); // 22-sep-2026, quedan 9 días

  it('al 80% dice cuánto queda y para cuántos días', () => {
    const msg = formatearAlerta(evaluarRubro(rubro({ spent: 123000 }))!, hoy);
    expect(msg).toContain('⚠️');
    expect(msg).toContain('Dulces');
    expect(msg).toContain('82%');
    expect(msg).toContain('27.000');
    expect(msg).toContain('9 días');
  });

  it('al pasarse dice por cuánto', () => {
    const msg = formatearAlerta(evaluarRubro(rubro({ spent: 195000 }))!, hoy);
    expect(msg).toContain('🔴');
    expect(msg).toContain('130%');
    expect(msg).toContain('45.000');
    expect(msg).not.toContain('Te quedan');
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: FAIL — `Failed to resolve import "./alerts"`.

- [ ] **Step 3: Implementar las puras**

Crear `src/lib/budget/alerts.ts`:

```ts
/**
 * Alertas de presupuesto por rubro.
 * Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md
 */

import { formatCOP } from '@/lib/whatsapp/format';

import { highestThreshold, diasRestantesDelMes } from './thresholds';

export interface RubroEstado {
  budgetItemId: string;
  itemName: string;
  categoryName: string;
  budgeted: number;
  spent: number;
}

export interface Alerta {
  budgetItemId: string;
  itemName: string;
  threshold: number;
  pct: number;
  spent: number;
  budgeted: number;
}

/** null = no hay nada que decir de este rubro. */
export function evaluarRubro(r: RubroEstado): Alerta | null {
  if (r.budgeted <= 0) return null;
  const pct = (r.spent / r.budgeted) * 100;
  const threshold = highestThreshold(pct);
  if (threshold === 0) return null;
  return {
    budgetItemId: r.budgetItemId,
    itemName: r.itemName,
    threshold,
    pct,
    spent: r.spent,
    budgeted: r.budgeted,
  };
}

export function formatearAlerta(a: Alerta, hoy: Date): string {
  const pct = Math.round(a.pct);
  if (a.threshold >= 100) {
    const exceso = a.spent - a.budgeted;
    return `🔴 ${a.itemName}: ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} (${pct}%). Te pasaste por ${formatCOP(exceso)}.`;
  }
  const queda = a.budgeted - a.spent;
  const dias = diasRestantesDelMes(hoy);
  return `⚠️ Vas en ${formatCOP(a.spent)} de ${formatCOP(a.budgeted)} en ${a.itemName} (${pct}%).\n   Te quedan ${formatCOP(queda)} para los ${dias} días que faltan del mes.`;
}
```

**Nota:** `formatCOP` vive en `src/lib/whatsapp/format.ts:7` y ya lo usa el agente.

⚠️ **`formatCOP` mete un NBSP (U+00A0) entre el `$` y el número:** `formatCOP(27000)`
es `"$ 27.000"`, no `"$ 27.000"`. Por eso los tests afirman sobre `'27.000'`
y nunca sobre `'$ 27.000'` — con espacio normal fallan.

- [ ] **Step 4: Correr el test y ver que pasa**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget/alerts.ts src/lib/budget/alerts.test.ts
git commit --no-verify -m "feat(alertas): evaluación por rubro y formato del mensaje"
```

---

### Task 4: Disparo con dedupe

**Files:**
- Modify: `src/lib/budget/alerts.ts`
- Modify: `src/lib/budget/alerts.test.ts`

**Interfaces:**
- Consumes: `evaluarRubro`, `formatearAlerta`, `RubroEstado`, `Alerta` de esta misma tarea anterior.
- Produces: `dispararAlertas(deps: AlertDeps, args: { userId: string; monthYear: string; budgetItemIds: string[]; hoy: Date }): Promise<string[]>` — devuelve los mensajes ya formateados, listos para pegar a la respuesta del bot. Array vacío = nada que decir.
- Produces: `interface AlertDeps { cargarEstado(userId, monthYear): Promise<RubroEstado[]>; marcarEnviado(userId, monthYear, budgetItemId, threshold): Promise<boolean> }`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `src/lib/budget/alerts.test.ts`:

```ts
import { dispararAlertas, type AlertDeps } from './alerts';

function depsFake(
  estado: RubroEstado[],
  yaEnviados: Record<string, number> = {},
): AlertDeps {
  return {
    cargarEstado: async () => estado,
    // Réplica en memoria del ON CONFLICT ... WHERE last_threshold < excluded:
    // solo "entra" si sube el umbral.
    marcarEnviado: async (_u, _m, id, threshold) => {
      if ((yaEnviados[id] ?? 0) >= threshold) return false;
      yaEnviados[id] = threshold;
      return true;
    },
  };
}

describe('dispararAlertas', () => {
  const hoy = new Date(2026, 8, 22);
  const args = {
    userId: 'u1',
    monthYear: '2026-09',
    budgetItemIds: ['item-1'],
    hoy,
  };

  it('avisa la primera vez que cruza el 80%', async () => {
    const msgs = await dispararAlertas(depsFake([rubro({ spent: 123000 })]), args);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('82%');
  });

  it('no repite el mismo umbral', async () => {
    const enviados = {};
    const deps = depsFake([rubro({ spent: 123000 })], enviados);
    expect(await dispararAlertas(deps, args)).toHaveLength(1);
    expect(await dispararAlertas(deps, args)).toHaveLength(0);
  });

  it('vuelve a avisar cuando sube de escalón', async () => {
    const enviados = {};
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 123000 })], enviados), args),
    ).toHaveLength(1);
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(1); // cruzó el 100
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 200000 })], enviados), args),
    ).toHaveLength(0); // sigue en 100, no repite
  });

  it('cruzar 80 y 100 de un solo golpe manda un solo aviso, el del 100', async () => {
    const msgs = await dispararAlertas(depsFake([rubro({ spent: 195000 })]), args);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('🔴');
  });

  it('solo mira los rubros que tocó el gasto', async () => {
    const estado = [
      rubro({ budgetItemId: 'item-1', spent: 123000 }),
      rubro({ budgetItemId: 'item-2', itemName: 'Cine', spent: 999000 }),
    ];
    const msgs = await dispararAlertas(depsFake(estado), args); // solo item-1
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Dulces');
  });

  it('junta las alertas de una factura que toca varios rubros', async () => {
    const estado = [
      rubro({ budgetItemId: 'item-1', spent: 123000 }),
      rubro({ budgetItemId: 'item-2', itemName: 'Cine', budgeted: 60000, spent: 90000 }),
    ];
    const msgs = await dispararAlertas(depsFake(estado), {
      ...args,
      budgetItemIds: ['item-1', 'item-2'],
    });
    expect(msgs).toHaveLength(2);
  });

  it('un rubro que no está vigilado no aparece en el estado y no alerta', async () => {
    const msgs = await dispararAlertas(depsFake([]), args);
    expect(msgs).toHaveLength(0);
  });

  it('una corrección que baja el gasto no "des-avisa" ni re-avisa al volver a subir', async () => {
    const enviados = {};
    // Se pasó: avisa el 100.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(1);
    // Corrige a la baja: vuelve al 82%. No se des-avisa nada.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 123000 })], enviados), args),
    ).toHaveLength(0);
    // Vuelve a pasarse al mismo escalón: tampoco repite.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: FAIL — `dispararAlertas is not a function`.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/budget/alerts.ts`:

```ts
export interface AlertDeps {
  /** Rubros vigilados del mes, con gasto y presupuesto. */
  cargarEstado(userId: string, monthYear: string): Promise<RubroEstado[]>;
  /**
   * Registra el umbral. Devuelve true SOLO si subió respecto al ya avisado:
   * la escritura ES la decisión, así dos gastos simultáneos no pueden mandar
   * el mismo aviso dos veces.
   */
  marcarEnviado(
    userId: string,
    monthYear: string,
    budgetItemId: string,
    threshold: number,
  ): Promise<boolean>;
}

/**
 * Devuelve los mensajes a pegar a la respuesta del bot. Vacío = nada que decir.
 * Solo evalúa los rubros que tocó este gasto: si otro rubro está al 200% pero
 * no se le gastó nada ahora, avisarlo sería ruido fuera de contexto (el panel
 * del dashboard sí lo muestra).
 */
export async function dispararAlertas(
  deps: AlertDeps,
  args: {
    userId: string;
    monthYear: string;
    budgetItemIds: string[];
    hoy: Date;
  },
): Promise<string[]> {
  const tocados = new Set(args.budgetItemIds.filter(Boolean));
  if (tocados.size === 0) return [];

  const estado = await deps.cargarEstado(args.userId, args.monthYear);
  const mensajes: string[] = [];

  for (const r of estado) {
    if (!tocados.has(r.budgetItemId)) continue;
    const alerta = evaluarRubro(r);
    if (!alerta) continue;
    const esNueva = await deps.marcarEnviado(
      args.userId,
      args.monthYear,
      alerta.budgetItemId,
      alerta.threshold,
    );
    if (esNueva) mensajes.push(formatearAlerta(alerta, args.hoy));
  }

  return mensajes;
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget/alerts.ts src/lib/budget/alerts.test.ts
git commit --no-verify -m "feat(alertas): disparo con dedupe atómico por umbral"
```

---

### Task 5: Implementación real de AlertDeps contra Supabase

**Files:**
- Create: `src/lib/budget/alerts-supabase.ts`

**Interfaces:**
- Consumes: `AlertDeps`, `RubroEstado` de `./alerts`.
- Produces: `alertDepsSupabase(): AlertDeps`.

- [ ] **Step 1: Implementar**

Crear `src/lib/budget/alerts-supabase.ts`:

```ts
/**
 * AlertDeps contra Supabase con service-role.
 * Vive aparte de alerts.ts para que la lógica se pueda testear sin base de datos.
 */

import { createAdminClient } from '@/lib/supabase/server';

import type { AlertDeps, RubroEstado } from './alerts';

export function alertDepsSupabase(): AlertDeps {
  const supabase = createAdminClient();

  return {
    async cargarEstado(userId, monthYear): Promise<RubroEstado[]> {
      const { data, error } = await supabase.rpc('get_budget_alert_status', {
        p_user_id: userId,
        p_month_year: monthYear,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map(
        (r: {
          budget_item_id: string;
          item_name: string;
          category_name: string;
          budgeted: number | string;
          spent: number | string;
        }) => ({
          budgetItemId: r.budget_item_id,
          itemName: r.item_name,
          categoryName: r.category_name,
          budgeted: Number(r.budgeted),
          spent: Number(r.spent),
        }),
      );
    },

    async marcarEnviado(userId, monthYear, budgetItemId, threshold) {
      // La escritura ES la decisión: el WHERE del ON CONFLICT deja pasar solo
      // si el umbral sube. Sin fila devuelta = ya se había avisado.
      const { data, error } = await supabase.rpc('mark_budget_alert_sent', {
        p_user_id: userId,
        p_month_year: monthYear,
        p_budget_item_id: budgetItemId,
        p_threshold: threshold,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  };
}
```

- [ ] **Step 2: Añadir el RPC del dedupe a la migración**

`supabase-js` no expresa `ON CONFLICT ... WHERE`, así que va como RPC. Crear
`supabase/migrations/20260831000001_mark_budget_alert_sent.sql`:

```sql
-- Registra el umbral avisado y dice si ES NUEVO, en una sola sentencia atómica.
-- La escritura es la decisión: dos gastos simultáneos no pueden mandar el mismo
-- aviso dos veces, sin locks.
CREATE OR REPLACE FUNCTION mark_budget_alert_sent(
    p_user_id UUID,
    p_month_year VARCHAR(7),
    p_budget_item_id UUID,
    p_threshold INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_insertado INT;
BEGIN
    INSERT INTO budget_alerts_sent (user_id, month_year, budget_item_id, last_threshold)
    VALUES (p_user_id, p_month_year, p_budget_item_id, p_threshold)
    ON CONFLICT (user_id, month_year, budget_item_id)
    DO UPDATE SET last_threshold = EXCLUDED.last_threshold, sent_at = now()
    WHERE budget_alerts_sent.last_threshold < EXCLUDED.last_threshold;

    GET DIAGNOSTICS v_insertado = ROW_COUNT;
    RETURN v_insertado > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Aplicarla.

- [ ] **Step 3: Verificar el dedupe a mano**

```sql
SELECT mark_budget_alert_sent('4f87341b-e90c-4400-8cc0-5ac0203894a0','2026-09',
  (SELECT bi.id FROM budget_items bi JOIN budget_templates bt ON bt.id=bi.template_id
   JOIN categories c ON c.id=bi.category_id
   WHERE bt.month_year='2026-09' AND bi.name='Dulces' AND c.name='MERCADO'), 80);
-- Esperado: true

-- repetir el MISMO comando  → false
-- el mismo pero con 100     → true
-- de nuevo con 80           → false
```

Limpiar después:

```sql
DELETE FROM budget_alerts_sent WHERE month_year='2026-09';
```

- [ ] **Step 4: Verificar que compila**

```bash
bun run build
```

Esperado: build OK. (Si falla por variables de entorno, usar valores dummy — está documentado en las notas del repo.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/budget/alerts-supabase.ts supabase/migrations/20260831000001_mark_budget_alert_sent.sql
git commit --no-verify -m "feat(alertas): AlertDeps contra Supabase y RPC de dedupe"
```

---

### Task 6: Enganchar WhatsApp

**Files:**
- Modify: `src/lib/whatsapp/agent/tools.ts:278` y `:335`
- Modify: `src/lib/whatsapp/agent/tools.test.ts:164,217,236`
- Modify: `src/lib/whatsapp/agent/turn.ts:243`

**Interfaces:**
- Consumes: `dispararAlertas` de `@/lib/budget/alerts`, `alertDepsSupabase` de `@/lib/budget/alerts-supabase`.
- Produces: `onExpenseCreated` cambia de `(categoria: string) => Promise<void>` a `(e: { categoria: string; budgetItemId: string | null }) => Promise<void>`.

- [ ] **Step 1: Actualizar el test existente del enganche**

En `src/lib/whatsapp/agent/tools.test.ts`, cambiar la aserción de `onExpenseCreated` (cerca de la línea 217) para que reciba el objeto, y añadir un caso nuevo:

```ts
it('le pasa el rubro al enganche de alertas, no solo la categoría', async () => {
  let recibido: { categoria: string; budgetItemId: string | null } | null = null;
  const deps = {
    ...depsBase,
    createExpense: async () => ({
      ok: true as const,
      category: 'MERCADO',
      transactionId: 't1',
      budgetItemId: 'item-1',
    }),
    onExpenseCreated: async (e: {
      categoria: string;
      budgetItemId: string | null;
    }) => {
      recibido = e;
    },
  };
  await executeTool(
    'registrar_gasto',
    { monto: 8500, descripcion: 'chocolatina' },
    deps,
  );
  expect(recibido).toEqual({ categoria: 'MERCADO', budgetItemId: 'item-1' });
});
```

Actualizar también los otros tres sitios (`:164`, `:217`, `:236`) a la firma nueva: `onExpenseCreated: async () => {}` sigue compilando, pero el de `:217` que capturaba `cat` hay que pasarlo a `e => { cat = e.categoria }`.

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/whatsapp/agent/tools.test.ts
```

Esperado: FAIL — el enganche recibe un string, no el objeto.

- [ ] **Step 3: Cambiar la firma y la llamada**

En `src/lib/whatsapp/agent/tools.ts`, línea ~278:

```ts
  /** Se llama tras cada gasto creado. Enganche para las alertas de presupuesto. */
  onExpenseCreated: (e: {
    categoria: string;
    budgetItemId: string | null;
  }) => Promise<void>;
```

Y la llamada en la línea ~335:

```ts
      try {
        await deps.onExpenseCreated({
          categoria: res.category,
          budgetItemId: res.budgetItemId ?? null,
        });
      } catch (errAlerta) {
```

**No tocar el `try/catch`:** el gasto ya está guardado y una alerta que falla no puede convertirlo en un "no se pudo guardar" que empuje al modelo a reintentar y duplicarlo.

- [ ] **Step 4: Correr los tests y ver que pasan**

```bash
bun run test src/lib/whatsapp/agent/tools.test.ts
```

Esperado: PASS.

- [ ] **Step 5: Conectar el enganche real en turn.ts**

En `src/lib/whatsapp/agent/turn.ts`, reemplazar `onExpenseCreated: async () => {},` (línea ~243) por:

```ts
    onExpenseCreated: async e => {
      if (!e.budgetItemId) return; // sin rubro no hay contra qué comparar
      const hoy = new Date();
      const msgs = await dispararAlertas(alertDepsSupabase(), {
        userId: ctx.userId,
        monthYear: todayBogota().slice(0, 7),
        budgetItemIds: [e.budgetItemId],
        hoy,
      });
      alertasPendientes.push(...msgs);
    },
```

Declarar el acumulador antes de `const deps = {`:

```ts
  // Las alertas se pegan a la respuesta del bot, no van como mensaje aparte:
  // así no chocan con la ventana de 24 h de WhatsApp Business. Si una factura
  // toca varios rubros, se juntan todas en el mismo mensaje.
  const alertasPendientes: string[] = [];
```

Y los imports arriba del archivo:

```ts
import { dispararAlertas } from '@/lib/budget/alerts';
import { alertDepsSupabase } from '@/lib/budget/alerts-supabase';
```

- [ ] **Step 6: Pegar las alertas a la respuesta**

`turn.ts` termina con **dos** salidas. Añadir antes de ellas un helper local:

```ts
  const conAlertas = (texto: string) =>
    alertasPendientes.length > 0
      ? `${texto}\n\n${alertasPendientes.join('\n\n')}`
      : texto;
```

Salida de modo degradado (Gateway caído), al final de `if ('kind' in respuesta)`:

```ts
    await responderYGuardar(
      ctx,
      estado.turns,
      conAlertas(texto),
      lastEntityDirty ? estado.lastEntity : undefined,
    );
    return;
```

Y la salida normal, en las últimas líneas del archivo:

```ts
  const texto = respuesta.text || 'Listo.';
  await responderYGuardar(
    ctx,
    estado.turns,
    conAlertas(texto),
    lastEntityDirty ? estado.lastEntity : undefined,
  );
```

**Las dos salidas, no solo la normal:** en modo degradado con
`huboEscrituras`, alguna herramienta ya escribió y puede haber alertas
acumuladas. Perderlas ahí sería un silencio justo cuando el usuario menos
contexto tiene.

- [ ] **Step 7: Correr toda la suite**

```bash
bun run test
```

Esperado: PASS, sin regresiones (la base eran 268 tests + los nuevos de las tareas 2-4).

- [ ] **Step 8: Commit**

```bash
git add src/lib/whatsapp/agent/tools.ts src/lib/whatsapp/agent/tools.test.ts src/lib/whatsapp/agent/turn.ts
git commit --no-verify -m "feat(alertas): el bot de WhatsApp pega las alertas a su respuesta"
```

---

### Task 7: Panel del dashboard

**Files:**
- Create: `src/components/organisms/BudgetAlertsPanel/BudgetAlertsPanel.tsx`
- Modify: `src/lib/budget/alerts.ts` (añadir `rubrosEnRiesgo`)
- Modify: `src/lib/budget/alerts.test.ts`

**Interfaces:**
- Consumes: `evaluarRubro`, `RubroEstado`, `Alerta` de `./alerts`.
- Produces: `rubrosEnRiesgo(estado: RubroEstado[]): Alerta[]` — ordenado de mayor a menor `pct`. Componente `BudgetAlertsPanel({ alertas, hoy }: { alertas: Alerta[]; hoy: Date })`.

- [ ] **Step 1: Escribir el test de `rubrosEnRiesgo`**

Añadir a `src/lib/budget/alerts.test.ts`:

```ts
import { rubrosEnRiesgo } from './alerts';

describe('rubrosEnRiesgo', () => {
  it('deja fuera los que van bien y ordena por porcentaje descendente', () => {
    const estado: RubroEstado[] = [
      rubro({ budgetItemId: 'a', itemName: 'Aseo', spent: 50000 }), // 33%
      rubro({ budgetItemId: 'b', itemName: 'Dulces', spent: 195000 }), // 130%
      rubro({ budgetItemId: 'c', itemName: 'Cine', spent: 123000 }), // 82%
    ];
    const r = rubrosEnRiesgo(estado);
    expect(r.map(x => x.itemName)).toEqual(['Dulces', 'Cine']);
  });

  it('devuelve vacío cuando todo va bien: el panel entonces no se pinta', () => {
    expect(rubrosEnRiesgo([rubro({ spent: 1000 })])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: FAIL — `rubrosEnRiesgo is not a function`.

- [ ] **Step 3: Implementar**

Añadir a `src/lib/budget/alerts.ts`:

```ts
/**
 * Rubros que hoy merecen un renglón en el dashboard (>=80%), de peor a mejor.
 *
 * NO consulta budget_alerts_sent a propósito: aunque el bot ya haya avisado por
 * chat, si seguís al 82% eso sigue siendo verdad y el panel debe mostrarlo.
 */
export function rubrosEnRiesgo(estado: RubroEstado[]): Alerta[] {
  return estado
    .map(evaluarRubro)
    .filter((a): a is Alerta => a !== null)
    .sort((x, y) => y.pct - x.pct);
}
```

- [ ] **Step 4: Correr el test y ver que pasa**

```bash
bun run test src/lib/budget/alerts.test.ts
```

Esperado: PASS, 16 tests.

- [ ] **Step 5: Escribir el componente**

Crear `src/components/organisms/BudgetAlertsPanel/BudgetAlertsPanel.tsx`:

```tsx
/**
 * BudgetAlertsPanel - Organism Level
 *
 * Muestra los rubros del mes que van en 80% o más de su presupuesto.
 * Se calcula en vivo: "vas al 82% de Dulces" sigue siendo cierto mañana, así
 * que no hay tabla de notificaciones ni "marcar como leído" que se desfase.
 *
 * Devuelve null cuando no hay nada que decir: un panel siempre presente deja de
 * leerse a las dos semanas.
 */

import React from 'react';

import { AlertTriangle } from 'lucide-react';

import Card from '@/components/atoms/Card/Card';
import { type Alerta } from '@/lib/budget/alerts';
import { diasRestantesDelMes } from '@/lib/budget/thresholds';
import { formatCOP } from '@/lib/whatsapp/format';

interface BudgetAlertsPanelProps {
  alertas: Alerta[];
  hoy: Date;
}

export default function BudgetAlertsPanel({
  alertas,
  hoy,
}: BudgetAlertsPanelProps) {
  if (alertas.length === 0) return null;

  const dias = diasRestantesDelMes(hoy);

  return (
    <Card className="p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        Presupuestos en riesgo
      </h3>
      <ul className="space-y-4">
        {alertas.map(a => {
          const pct = Math.round(a.pct);
          const excedido = a.spent > a.budgeted;
          return (
            <li key={a.budgetItemId}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-gray-900">
                  {excedido ? '🔴' : '⚠️'} {a.itemName}
                </span>
                <span className="text-gray-600">
                  {formatCOP(a.spent)} / {formatCOP(a.budgeted)}
                </span>
              </div>
              <div className="my-1 h-2 w-full overflow-hidden rounded bg-gray-200">
                <div
                  className={excedido ? 'h-full bg-red-500' : 'h-full bg-amber-400'}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">
                {excedido
                  ? `${pct}% · Te pasaste por ${formatCOP(a.spent - a.budgeted)}`
                  : `${pct}% · Quedan ${formatCOP(a.budgeted - a.spent)} para ${dias} días`}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
```

**Nota:** verificar que `Card` acepte `className` y que su ruta sea la correcta —
`BudgetStatusPanels.tsx` lo importa de `@/components/atoms/Card/Card`. Si la API
difiere, ajustar sin cambiar la lógica.

- [ ] **Step 6: Montarlo en el dashboard**

En `src/app/presupuesto/page.tsx`, junto a `<UnclassifiedExpensesPanel>`
(línea ~596), que es su vecino natural: los dos responden "¿qué pasa con mi
presupuesto?". Cargar el estado con el RPC y renderizar:

```tsx
<BudgetAlertsPanel alertas={rubrosEnRiesgo(estadoRubros)} hoy={new Date()} />
```

El `estadoRubros` sale de `supabase.rpc('get_budget_alert_status', { p_user_id, p_month_year })`
con la sesión del navegador — el RPC es `SECURITY DEFINER` y está `GRANT`eado a
`authenticated`. Mapear `snake_case → camelCase` igual que en
`src/lib/budget/alerts-supabase.ts`.

- [ ] **Step 7: Verificar en el navegador**

```bash
bun run dev
```

Abrir `http://localhost:3001`. Con los datos de agosto 2026 reclasificados,
**Dulces** debe salir en rojo (194.796 / 150.000 = 130%).

- [ ] **Step 8: Commit**

```bash
git add src/lib/budget/alerts.ts src/lib/budget/alerts.test.ts src/components/organisms/BudgetAlertsPanel/
git commit --no-verify -m "feat(alertas): panel de presupuestos en riesgo en el dashboard"
```

---

### Task 8: Interruptor por rubro

**Files:**
- Modify: `src/components/organisms/BudgetItemModal/BudgetItemModal.tsx`

**Interfaces:**
- Consumes: la columna `budget_items.alerts_enabled` de la Task 1.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Añadir el control**

En `BudgetItemModal.tsx`, junto a los campos existentes, añadir un select de tres
estados (no un checkbox: hacen falta tres valores, y `null` es el que hace que el
default por clasificación siga vivo):

```tsx
<label className="block text-sm font-medium text-gray-700">
  Alertas de presupuesto
  <select
    className="mt-1 block w-full rounded border-gray-300"
    value={form.alertsEnabled === null ? 'auto' : String(form.alertsEnabled)}
    onChange={e =>
      setForm({
        ...form,
        alertsEnabled:
          e.target.value === 'auto' ? null : e.target.value === 'true',
      })
    }
  >
    <option value="auto">Automático (según clasificación)</option>
    <option value="true">Siempre avisar</option>
    <option value="false">Nunca avisar</option>
  </select>
  <span className="mt-1 block text-xs text-gray-500">
    En automático se vigilan los rubros Variable, que son los que se deciden
    compra a compra.
  </span>
</label>
```

Incluir `alerts_enabled` en el `update` que ya hace el modal.

- [ ] **Step 2: Añadir el campo al tipo**

En `src/types/supabase.ts`, añadir `alerts_enabled: boolean | null` a `Row`,
`Insert` (opcional) y `Update` (opcional) de `budget_items`. **A mano** —
`bun run db:types` trunca el archivo.

- [ ] **Step 3: Verificar que compila**

```bash
bun run build
```

Esperado: build OK.

- [ ] **Step 4: Probarlo en el navegador**

```bash
bun run dev
```

Abrir un rubro, ponerlo en **Nunca avisar**, guardar, reabrir: debe seguir en
"Nunca avisar". Confirmar en la base:

```sql
SELECT name, alerts_enabled FROM budget_items WHERE id = '<el que tocaste>';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/organisms/BudgetItemModal/BudgetItemModal.tsx src/types/supabase.ts
git commit --no-verify -m "feat(alertas): interruptor de alertas por rubro"
```

---

## Verificación final

- [ ] `bun run test` — toda la suite en verde
- [ ] `bun run build` — compila
- [ ] Mandar por WhatsApp un gasto que lleve un rubro sobre el 80% y confirmar que la alerta viene **pegada** a la respuesta del bot, no como mensaje aparte
- [ ] Repetir el mismo gasto: **no** debe volver a avisar el mismo umbral
- [ ] El dashboard muestra el panel; con todos los rubros por debajo del 80% el panel **no se pinta**
- [ ] Un rubro en "Nunca avisar" desaparece del panel **y** del chat
