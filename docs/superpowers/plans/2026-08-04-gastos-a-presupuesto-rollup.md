# Roll-up de Gastos → Presupuesto — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada gasto se asigne (por IA, con corrección manual) a un ítem del presupuesto de su mes, y que la columna "Real" de cada ítem muestre automáticamente la suma de esos gastos; los no asignados se ven en un panel rojo.

**Architecture:** El vínculo se guarda en `transactions.budget_item_id` (+ nueva columna `budget_item_source`). Un clasificador de IA de texto (mismo AI Gateway del `categorizer.ts`) mapea `description` → nombre de ítem dentro de la categoría del gasto; se resuelve a `budget_item_id` del mes del gasto. El RPC `get_budget_by_month` calcula el "Real" híbrido (suma de gastos si hay, si no el manual). Un panel en la página Presupuesto lista los no asignados con desplegable para corregir.

**Tech Stack:** Next.js (App Router), Supabase (Postgres RPC, plpgsql), TypeScript, React, `bun test`.

**Spec:** `docs/superpowers/specs/2026-08-04-gastos-a-presupuesto-rollup-design.md`

---

## Estructura de archivos

- Create: `supabase/migrations/20260804120000_gastos_rollup_presupuesto.sql` — columna `budget_item_source`, RPCs nuevos (`assign_expense_budget_item`, `get_unclassified_expenses`, `get_budget_items_for_month`) y actualización de `get_budget_by_month` (Real híbrido).
- Modify: `src/lib/dian/categorizer.ts` — exportar `extractJsonObject` para reutilizar el parseo.
- Create: `src/lib/dian/expense-item-classifier.ts` — prompt + parseo + llamada IA que mapea descripción → nombre de ítem (o null).
- Create: `src/lib/dian/expense-item-classifier.test.ts` — tests del prompt y del parseo.
- Modify: `src/lib/services/expenses.ts` — `getBudgetItemsForMonth`, `getUnclassifiedExpenses`, `assignExpenseToBudgetItem`, `classifyAndAssignExpense`, y llamar clasificación tras crear gasto.
- Create: `src/lib/services/expenses-rollup.test.ts` — test del helper puro `resolveItemNameToId`.
- Modify: `src/lib/services/invoices.ts` — clasificar+asignar cada gasto al aprobar factura.
- Create: `src/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel.tsx` — panel rojo con total y desplegable de reasignación + botón "Clasificar con IA".
- Modify: `src/app/presupuesto/page.tsx` — montar el panel y recargar presupuesto tras asignar.

---

## Task 1: Migración de base de datos (columna + RPCs + Real híbrido)

**Files:**
- Create: `supabase/migrations/20260804120000_gastos_rollup_presupuesto.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- ============================================================
-- Roll-up de Gastos -> Presupuesto
-- - budget_item_source: marca si el vínculo lo puso la IA o el usuario
-- - assign_expense_budget_item: asigna un gasto a un ítem (validando mismo mes)
-- - get_unclassified_expenses: gastos del mes sin ítem asignado
-- - get_budget_items_for_month: ítems del mes (para dropdown y clasificador)
-- - get_budget_by_month: "Real" híbrido (suma de gastos o valor manual)
-- ============================================================

-- 1. Columna para saber el origen del vínculo ('ai' | 'manual')
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS budget_item_source VARCHAR(10);

-- 2. Asignar un gasto a un ítem del presupuesto (solo del mismo mes del gasto)
CREATE OR REPLACE FUNCTION assign_expense_budget_item(
    p_user_id UUID,
    p_transaction_id UUID,
    p_budget_item_id UUID,
    p_source VARCHAR
)
RETURNS VOID AS $$
BEGIN
    UPDATE transactions t
    SET budget_item_id = p_budget_item_id,
        budget_item_source = p_source,
        updated_at = now()
    WHERE t.id = p_transaction_id
      AND t.user_id = p_user_id
      AND (
        p_budget_item_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM budget_items bi
            JOIN budget_templates bt ON bt.id = bi.template_id
            WHERE bi.id = p_budget_item_id
              AND bt.user_id = p_user_id
              AND bt.month_year = t.month_year
        )
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ítems del presupuesto de un mes (id, nombre, categoría)
CREATE OR REPLACE FUNCTION get_budget_items_for_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    item_id UUID,
    item_name VARCHAR,
    category_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT bi.id, bi.name, c.name
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    LEFT JOIN categories c ON c.id = bi.category_id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND bi.is_active = true
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Gastos del mes sin ítem asignado (para el panel rojo)
CREATE OR REPLACE FUNCTION get_unclassified_expenses(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    id UUID,
    description TEXT,
    amount DECIMAL(12,2),
    category_name VARCHAR(100),
    transaction_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.description, t.amount, t.category_name, t.transaction_date
    FROM transactions t
    JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto'
      AND t.budget_item_id IS NULL
    ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. get_budget_by_month con "Real" híbrido
DROP FUNCTION IF EXISTS get_budget_by_month(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION get_budget_by_month(p_user_id UUID, p_month_year VARCHAR)
RETURNS TABLE(
    template_id UUID,
    template_name VARCHAR,
    category_id UUID,
    category_name VARCHAR,
    category_color VARCHAR,
    category_icon VARCHAR,
    item_id UUID,
    item_name VARCHAR,
    item_description TEXT,
    due_date VARCHAR,
    classification_name VARCHAR,
    classification_color VARCHAR,
    control_name VARCHAR,
    control_color VARCHAR,
    budgeted_amount NUMERIC,
    real_amount NUMERIC,
    spent_amount NUMERIC,
    deuda_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bt.id, bt.name, c.id, c.name, c.color, c.icon,
        bi.id, bi.name, bi.description, bi.due_date,
        cl.name, cl.color, co.name, co.color,
        bi.budgeted_amount,
        -- Real híbrido: si hay gastos asignados, su suma; si no, el manual
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             JOIN transaction_types tt ON t.type_id = tt.id
             WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
            bi.real_amount
        ) AS real_amount,
        bi.spent_amount,
        bi.deuda_id
    FROM budget_templates bt
    LEFT JOIN budget_items bi ON bt.id = bi.template_id
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN classifications cl ON bi.classification_id = cl.id
    LEFT JOIN controls co ON bi.control_id = co.id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND (bi.is_active = true OR bi.id IS NULL)
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION assign_expense_budget_item(UUID, UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_budget_items_for_month(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unclassified_expenses(UUID, VARCHAR) TO authenticated;
```

- [ ] **Step 2: Aplicar la migración vía Supabase MCP**

Aplicar el contenido del archivo con `mcp__supabase__apply_migration` (name: `gastos_rollup_presupuesto`).
Expected: sin error.

- [ ] **Step 3: Verificar columna y RPCs**

Ejecutar con `mcp__supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name='transactions' AND column_name='budget_item_source';
SELECT proname FROM pg_proc
WHERE proname IN ('assign_expense_budget_item','get_unclassified_expenses','get_budget_items_for_month');
```
Expected: 1 fila para la columna; 3 filas para las funciones.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260804120000_gastos_rollup_presupuesto.sql
git commit -m "feat(db): columna budget_item_source, RPCs de roll-up y Real híbrido"
```

---

## Task 2: Clasificador IA descripción → nombre de ítem

**Files:**
- Modify: `src/lib/dian/categorizer.ts` (exportar `extractJsonObject`)
- Create: `src/lib/dian/expense-item-classifier.ts`
- Test: `src/lib/dian/expense-item-classifier.test.ts`

- [ ] **Step 1: Exportar el helper de parseo en categorizer.ts**

Cambiar la firma de `function extractJsonObject(` a `export function extractJsonObject(` en `src/lib/dian/categorizer.ts` (línea ~34).

- [ ] **Step 2: Escribir el test (falla)**

```ts
// src/lib/dian/expense-item-classifier.test.ts
import { test, expect } from 'bun:test';
import {
  buildExpenseItemPrompt,
  parseExpenseItemResponse,
} from './expense-item-classifier';

test('el prompt incluye las descripciones y los ítems válidos', () => {
  const prompt = buildExpenseItemPrompt(
    [{ description: 'Pernil' }, { description: 'Banano' }],
    ['Carnes', 'Frutas', 'Aseo'],
  );
  expect(prompt).toContain('Pernil');
  expect(prompt).toContain('Carnes, Frutas, Aseo');
  expect(prompt).toContain('NINGUNO');
});

test('parseo: nombres válidos se respetan; inválido y NINGUNO -> null', () => {
  const content = '{"items": ["Carnes", "NINGUNO", "Inexistente"]}';
  const result = parseExpenseItemResponse(content, 3, ['Carnes', 'Frutas']);
  expect(result).toEqual(['Carnes', null, null]);
});

test('parseo: contenido nulo -> todos null', () => {
  expect(parseExpenseItemResponse(null, 2, ['Carnes'])).toEqual([null, null]);
});
```

- [ ] **Step 3: Ejecutar el test (verificar que falla)**

Run: `bun test src/lib/dian/expense-item-classifier.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 4: Implementar el clasificador**

```ts
// src/lib/dian/expense-item-classifier.ts
import { extractJsonObject } from './categorizer';

/**
 * Construye el prompt para mapear cada descripción de gasto a UN nombre de ítem
 * del presupuesto (o "NINGUNO" si no encaja en ninguno).
 */
export function buildExpenseItemPrompt(
  items: Array<{ description: string }>,
  itemNames: string[],
): string {
  const list = items.map((it, i) => `${i + 1}. ${it.description}`).join('\n');
  return [
    'Eres un asistente de finanzas personales. A cada gasto asígnale',
    'EXACTAMENTE uno de estos ítems de presupuesto:',
    `${itemNames.join(', ')}.`,
    'Si un gasto no encaja claramente en ninguno, responde "NINGUNO".',
    '',
    'Gastos:',
    list,
    '',
    'Responde SOLO con JSON: {"items": ["ITEM1", "NINGUNO", ...]} en el mismo',
    'orden y con la misma cantidad. Usa solo los ítems listados o "NINGUNO".',
  ].join('\n');
}

/**
 * Valida la respuesta del modelo. Devuelve un array de longitud `itemCount`:
 * cada posición es un nombre de ítem válido o `null` (NINGUNO / inválido).
 */
export function parseExpenseItemResponse(
  content: string | null,
  itemCount: number,
  itemNames: string[],
): Array<string | null> {
  const result: Array<string | null> = new Array(itemCount).fill(null);
  if (!content) return result;

  const parsed = extractJsonObject(content);
  const items = (parsed as { items?: unknown })?.items;
  if (!Array.isArray(items)) return result;

  const valid = new Set(itemNames);
  for (let i = 0; i < itemCount; i++) {
    const v = items[i];
    if (typeof v === 'string' && valid.has(v)) {
      result[i] = v;
    }
  }
  return result;
}

/**
 * Clasifica gastos en nombres de ítems usando el AI Gateway (mismo patrón que
 * categorizeInvoiceItems). Ante error o falta de API key devuelve todo null.
 */
export async function classifyExpensesToItems(
  items: Array<{ description: string }>,
  itemNames: string[],
): Promise<Array<string | null>> {
  if (items.length === 0 || itemNames.length === 0) {
    return new Array(items.length).fill(null);
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('classifyExpensesToItems: falta AI_GATEWAY_API_KEY');
    return new Array(items.length).fill(null);
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  const model = process.env.CATEGORIZE_MODEL || 'alibaba/qwen3.7-flash';

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [
          { role: 'user', content: buildExpenseItemPrompt(items, itemNames) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`IA respondió ${res.status}`);
    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const content = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : null;
    return parseExpenseItemResponse(content, items.length, itemNames);
  } catch (error) {
    console.error('Error clasificando gastos a ítems:', error);
    return new Array(items.length).fill(null);
  }
}
```

- [ ] **Step 5: Ejecutar el test (verificar que pasa)**

Run: `bun test src/lib/dian/expense-item-classifier.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dian/categorizer.ts src/lib/dian/expense-item-classifier.ts src/lib/dian/expense-item-classifier.test.ts
git commit -m "feat(ia): clasificador de gastos a ítems de presupuesto"
```

---

## Task 3: Servicios de roll-up (ítems del mes, sin clasificar, asignar, clasificar+asignar)

**Files:**
- Modify: `src/lib/services/expenses.ts`
- Test: `src/lib/services/expenses-rollup.test.ts`

- [ ] **Step 1: Escribir el test del helper puro (falla)**

```ts
// src/lib/services/expenses-rollup.test.ts
import { test, expect } from 'bun:test';
import { resolveItemNameToId } from './expenses';

const items = [
  { id: 'a', name: 'Carnes', category_name: 'MERCADO' },
  { id: 'b', name: 'Frutas', category_name: 'MERCADO' },
];

test('resuelve nombre exacto a id', () => {
  expect(resolveItemNameToId('Carnes', items)).toBe('a');
});

test('nombre no encontrado -> null', () => {
  expect(resolveItemNameToId('Aseo', items)).toBeNull();
  expect(resolveItemNameToId(null, items)).toBeNull();
});
```

- [ ] **Step 2: Ejecutar el test (verificar que falla)**

Run: `bun test src/lib/services/expenses-rollup.test.ts`
Expected: FAIL (`resolveItemNameToId` no existe).

- [ ] **Step 3: Implementar los servicios en expenses.ts**

Agregar al final de `src/lib/services/expenses.ts`:

```ts
import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';

export interface BudgetItemRef {
  id: string;
  name: string;
  category_name: string;
}

export interface UnclassifiedExpense {
  id: string;
  description: string;
  amount: number;
  category_name: string;
  transaction_date: string;
}

/** Resuelve un nombre de ítem al id dentro de una lista (helper puro y testeable). */
export function resolveItemNameToId(
  name: string | null,
  items: BudgetItemRef[],
): string | null {
  if (!name) return null;
  const found = items.find(i => i.name === name);
  return found ? found.id : null;
}

/** Ítems del presupuesto de un mes (para dropdown y clasificador). */
export async function getBudgetItemsForMonth(
  monthYear: string,
): Promise<BudgetItemRef[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.rpc('get_budget_items_for_month', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });
  if (error) {
    console.error('Error obteniendo ítems del mes:', error);
    return [];
  }
  return (data || []).map(
    (r: { item_id: string; item_name: string; category_name: string }) => ({
      id: r.item_id,
      name: r.item_name,
      category_name: r.category_name,
    }),
  );
}

/** Gastos del mes sin ítem asignado. */
export async function getUnclassifiedExpenses(
  monthYear: string,
): Promise<UnclassifiedExpense[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { data, error } = await supabase.rpc('get_unclassified_expenses', {
    p_user_id: user.id,
    p_month_year: monthYear,
  });
  if (error) {
    console.error('Error obteniendo gastos sin clasificar:', error);
    return [];
  }
  return data || [];
}

/** Asigna (o desasigna con null) un gasto a un ítem. source: 'ai' | 'manual'. */
export async function assignExpenseToBudgetItem(
  expenseId: string,
  budgetItemId: string | null,
  source: 'ai' | 'manual',
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const { error } = await supabase.rpc('assign_expense_budget_item', {
    p_user_id: user.id,
    p_transaction_id: expenseId,
    p_budget_item_id: budgetItemId,
    p_source: source,
  });
  if (error) {
    console.error('Error asignando gasto a ítem:', error);
    throw new Error(`Error asignando gasto: ${error.message}`);
  }
}

/**
 * Clasifica UN gasto (por IA) dentro de su categoría y lo asigna si hay match.
 * Acotado a la categoría del gasto; si no hay ítems en esa categoría, no hace nada.
 */
export async function classifyAndAssignExpense(
  expenseId: string,
  description: string,
  categoryName: string,
  monthYear: string,
): Promise<void> {
  try {
    const items = await getBudgetItemsForMonth(monthYear);
    const inCategory = items.filter(i => i.category_name === categoryName);
    if (inCategory.length === 0) return; // OTROS/sin ítems -> queda sin clasificar

    const [name] = await classifyExpensesToItems(
      [{ description }],
      inCategory.map(i => i.name),
    );
    const itemId = resolveItemNameToId(name, inCategory);
    if (itemId) {
      await assignExpenseToBudgetItem(expenseId, itemId, 'ai');
    }
  } catch (error) {
    console.error('Error en classifyAndAssignExpense:', error);
    // No relanzar: la clasificación es best-effort; el gasto queda sin asignar.
  }
}

/** Clasifica en lote los gastos sin asignar de un mes (botón "Clasificar con IA"). */
export async function classifyUnassignedForMonth(
  monthYear: string,
): Promise<number> {
  const pending = await getUnclassifiedExpenses(monthYear);
  let assigned = 0;
  for (const exp of pending) {
    const before = exp.id;
    await classifyAndAssignExpense(
      before,
      exp.description,
      exp.category_name,
      monthYear,
    );
    assigned++;
  }
  return assigned;
}
```

- [ ] **Step 4: Ejecutar el test (verificar que pasa)**

Run: `bun test src/lib/services/expenses-rollup.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/expenses.ts src/lib/services/expenses-rollup.test.ts
git commit -m "feat(gastos): servicios de roll-up (ítems del mes, asignar, clasificar)"
```

---

## Task 4: Clasificar al crear un gasto manual

**Files:**
- Modify: `src/lib/services/expenses.ts` (`createExpenseTransaction`)

- [ ] **Step 1: Enganchar la clasificación tras crear**

En `createExpenseTransaction`, tras obtener el `data` (id de la transacción) y antes de `return data`, reemplazar `return data;` por:

```ts
  const monthYear = expenseData.transaction_date.slice(0, 7);
  // Clasificación best-effort (no bloquea la creación si falla)
  await classifyAndAssignExpense(
    data,
    expenseData.description,
    expenseData.category_name,
    monthYear,
  );

  return data; // Retorna el ID de la transacción creada
```

- [ ] **Step 2: Verificar typecheck y lint**

Run: `bunx tsc --noEmit 2>&1 | grep -i "expenses.ts"` (Expected: vacío)
Run: `bunx eslint src/lib/services/expenses.ts` (Expected: exit 0)

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/expenses.ts
git commit -m "feat(gastos): clasificar y asignar al crear un gasto manual"
```

---

## Task 5: Clasificar al aprobar factura

**Files:**
- Modify: `src/lib/services/invoices.ts` (`approveInvoice`)

- [ ] **Step 1: Ubicar el punto de creación del gasto**

En `src/lib/services/invoices.ts`, dentro de `approveInvoice`, cada línea llama `upsert_monthly_expense` (vía `mapInvoiceItemToExpenseArgs`) y devuelve un id de transacción. Justo después de crear cada gasto, agregar la clasificación usando el `category` del ítem de factura y la fecha de la factura.

- [ ] **Step 2: Añadir la clasificación**

Importar al inicio del archivo:
```ts
import { classifyAndAssignExpense } from '@/lib/services/expenses';
```

Tras el `rpc('upsert_monthly_expense', args)` que devuelve el id (llamémoslo `transactionId`) para cada ítem, añadir:
```ts
    if (transactionId) {
      const monthYear = args.p_transaction_date.slice(0, 7);
      await classifyAndAssignExpense(
        transactionId,
        args.p_description,
        args.p_category_name,
        monthYear,
      );
    }
```
(Adaptar el nombre de la variable del id al que ya use `approveInvoice`.)

- [ ] **Step 3: Verificar typecheck y lint**

Run: `bunx tsc --noEmit 2>&1 | grep -i "invoices.ts"` (Expected: vacío)
Run: `bunx eslint src/lib/services/invoices.ts` (Expected: exit 0)

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/invoices.ts
git commit -m "feat(facturas): clasificar y asignar cada gasto al aprobar la factura"
```

---

## Task 6: Panel "Sin clasificar" en Presupuesto

**Files:**
- Create: `src/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel.tsx`
- Modify: `src/app/presupuesto/page.tsx`

- [ ] **Step 1: Crear el organismo del panel**

```tsx
// src/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { AlertTriangle } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import {
  getUnclassifiedExpenses,
  getBudgetItemsForMonth,
  assignExpenseToBudgetItem,
  classifyUnassignedForMonth,
  formatCurrency,
  type UnclassifiedExpense,
  type BudgetItemRef,
} from '@/lib/services/expenses';

interface Props {
  monthYear: string;
  /** Se llama tras asignar/clasificar para refrescar los totales del presupuesto. */
  onChanged?: () => void;
}

export default function UnclassifiedExpensesPanel({
  monthYear,
  onChanged,
}: Props) {
  const [expenses, setExpenses] = useState<UnclassifiedExpense[]>([]);
  const [items, setItems] = useState<BudgetItemRef[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    const [exp, its] = await Promise.all([
      getUnclassifiedExpenses(monthYear),
      getBudgetItemsForMonth(monthYear),
    ]);
    setExpenses(exp);
    setItems(its);
  }, [monthYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAssign = async (expenseId: string, itemId: string) => {
    if (!itemId) return;
    await assignExpenseToBudgetItem(expenseId, itemId, 'manual');
    await load();
    onChanged?.();
  };

  const handleClassifyAll = async () => {
    setIsBusy(true);
    try {
      await classifyUnassignedForMonth(monthYear);
      await load();
      onChanged?.();
    } finally {
      setIsBusy(false);
    }
  };

  if (expenses.length === 0) return null;

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);

  return (
    <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">
            Gastos sin clasificar ({expenses.length})
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClassifyAll}
          disabled={isBusy}
        >
          {isBusy ? 'Clasificando...' : 'Clasificar con IA'}
        </Button>
      </div>

      <p className="text-xs text-red-300/80 mb-3">
        Estos gastos aún NO suman en el Presupuesto Real. Asígnalos a un ítem
        para que se cuenten. Total sin contar:{' '}
        <span className="font-semibold">{formatCurrency(total)}</span>
      </p>

      <div className="space-y-2">
        {expenses.map(exp => (
          <div
            key={exp.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-white text-sm truncate">{exp.description}</p>
              <p className="text-xs text-gray-400">
                {exp.category_name} · {formatCurrency(Number(exp.amount))}
              </p>
            </div>
            <select
              defaultValue=""
              onChange={e => handleAssign(exp.id, e.target.value)}
              className="bg-slate-700/60 border border-slate-600 rounded-lg text-white text-sm px-2 py-1"
            >
              <option value="" disabled>
                Asignar a ítem…
              </option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  {it.category_name} · {it.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Montar el panel en la página Presupuesto**

En `src/app/presupuesto/page.tsx`:

Importar:
```tsx
import UnclassifiedExpensesPanel from '@/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel';
```

Renderizarlo encima de `budgetTable` (dentro del `budgetTable` prop del `BudgetPageTemplate`, envolviendo en un fragmento, o justo antes de `<BudgetTable ...>`). Reemplazar el bloque:
```tsx
        budgetTable={
          !isLoading && categories.length > 0 ? (
            <BudgetTable
```
por:
```tsx
        budgetTable={
          !isLoading && categories.length > 0 ? (
            <>
              <UnclassifiedExpensesPanel
                monthYear={selectedMonth}
                onChanged={refreshBudget}
              />
              <BudgetTable
```
y cerrar el fragmento tras el `/>` de `BudgetTable` (antes del `) : undefined`):
```tsx
              />
            </>
          ) : undefined
```

- [ ] **Step 3: Verificar typecheck y lint**

Run: `bunx tsc --noEmit 2>&1 | grep -iE "UnclassifiedExpensesPanel|presupuesto/page"` (Expected: vacío)
Run: `bunx eslint src/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel.tsx src/app/presupuesto/page.tsx` (Expected: exit 0)

- [ ] **Step 4: Commit**

```bash
git add src/components/organisms/UnclassifiedExpensesPanel/UnclassifiedExpensesPanel.tsx src/app/presupuesto/page.tsx
git commit -m "feat(presupuesto): panel de gastos sin clasificar con asignación y clasificación IA"
```

---

## Task 7: Verificación end-to-end (manual, con datos reales)

**Files:** ninguno (verificación)

- [ ] **Step 1: Verificar el Real híbrido con SQL**

Con `mcp__supabase__execute_sql`, tomar un `budget_item` real y un gasto del mismo mes, asignarlo con `assign_expense_budget_item`, y confirmar que `get_budget_by_month` devuelve el `real_amount` = suma de gastos para ese ítem, y el valor manual para ítems sin gastos. Documentar el resultado.

- [ ] **Step 2: Verificar en la app (deploy beta)**

Abrir Presupuesto en el mes con gastos: el panel rojo lista los sin clasificar con su total; asignar uno con el desplegable baja el total del panel y sube el "Real" del ítem; "Clasificar con IA" reduce los pendientes.

- [ ] **Step 3: Commit (si hubo ajustes)**

```bash
git commit -am "fix: ajustes tras verificación end-to-end del roll-up"
```

---

## Self-review (cobertura del spec)

- Mapeo por IA acotado a la categoría del gasto → Task 2 + `classifyAndAssignExpense` (Task 3).
- Corrección manual respetada (`source='manual'`, IA no pisa) → Task 1 (columna) + Task 3 (assign) + Task 6 (dropdown).
- Panel rojo con total "sin contar" y aviso → Task 6.
- Real híbrido (suma si hay gastos, manual si no) → Task 1 (RPC).
- Actualización automática al agregar/editar/eliminar → RPC calcula al cargar (Task 1); crear gasto clasifica (Task 4); factura clasifica (Task 5).
- Vínculo por mes → validado en `assign_expense_budget_item` (Task 1).
- Se conserva el campo manual "Real" → sin cambios en el modal (intencional).
