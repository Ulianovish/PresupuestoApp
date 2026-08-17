# Agente de WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el parser de regex del bot de WhatsApp por un agente LLM con herramientas y estado de conversación, que pregunte la cuenta cuando falta y permita eliminar la aprobación manual de facturas.

**Architecture:** El LLM interpreta y el código ejecuta. El modelo nunca escribe en la base: devuelve llamadas a herramientas, y las herramientas validan contra datos reales antes de escribir. El CUFE se sigue detectando con regex (96 hex, determinista). El estado de conversación vive en una tabla, porque entre "[foto]" y "Davivienda" hay dos invocaciones distintas de la función serverless.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (service-role desde el webhook), Vercel AI Gateway (superficie Anthropic Messages), vitest.

## Global Constraints

- **Package manager: `bun`.** Tests con `bunx vitest run`. Nunca npm/yarn.
- **Antes de commitear, los tres siempre:** `bunx tsc --noEmit`, `bunx vitest run`, `bunx next lint --quiet`. El lint **rompe el build de producción** (`prefer-template` e `import/order` son Error, no Warning) y vitest no hace type-check.
- **Modelo por defecto:** `google/gemini-3-flash`, sobrescribible con `AGENT_MODEL`.
- **Gateway:** `POST ${AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh'}/v1/messages`, headers `Authorization: Bearer ${AI_GATEWAY_API_KEY}`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
- **Nunca importar de `@/lib/services/expenses`** en código de servidor: ese módulo crea un cliente Supabase de navegador a nivel de módulo y rompe. Formatear COP inline (ver `handle-agent.ts:9`).
- **Import order:** grupos separados por línea en blanco (`next/*`, luego `@/*`, luego relativos). Es Error de ESLint.
- **Todo texto al usuario en español rioplatense-neutro**, como el resto del bot.
- Tests: dependencias inyectadas, sin red ni base. Nunca contra el modelo real.

## Firmas existentes que este plan consume

```ts
// src/lib/dian/expense-item-classifier.ts
classifyExpensesToItems(items: Array<{description: string}>, itemNames: string[]): Promise<Array<string|null>>

// src/lib/services/expenses-rollup.ts
resolveItemNameToId(name: string|null, items: BudgetItemRef[]): string|null
interface BudgetItemRef { id: string; name: string; category_name: string }

// src/lib/dian/categorizer.ts
categorizeInvoiceItems(items: Array<{description: string}>, categories: string[]): Promise<string[]>

// src/lib/services/invoices.ts
resolveUserCategoryNames(supabase, userId): Promise<string[]>

// src/lib/whatsapp/vision.ts
type VisionResult = TransferVision | ReceiptVision | {kind:'unknown'} | {kind:'service_error'}
```

RPCs de Supabase:

```
upsert_monthly_expense(p_user_id, p_description, p_amount, p_transaction_date,
                       p_category_name, p_account_name, p_place, p_month_year?) → string  // id de la transacción
assign_expense_budget_item(p_user_id, p_transaction_id, p_budget_item_id, p_source) → void
get_budget_items_for_month(p_user_id, p_month_year) → {item_id, item_name, category_name}[]
```

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/20260817000000_whatsapp_conversations.sql` | Tabla de estado |
| `src/lib/whatsapp/agent/state.ts` | Leer/escribir estado + TTL |
| `src/lib/whatsapp/agent/prompt.ts` | Construir el system prompt |
| `src/lib/whatsapp/agent/tools.ts` | Definiciones JSON + ejecutores con validación |
| `src/lib/whatsapp/agent/run.ts` | El bucle Gateway → herramientas → repetir |
| `src/lib/services/whatsapp-expenses.ts` | *(modificar)* devolver el id + clasificar ítem |
| `src/lib/whatsapp/classify.ts` | *(modificar)* no descartar el `Body` con media |
| `src/app/api/whatsapp/webhook/route.ts` | *(modificar)* enrutar al agente |

---

### Task 1: Tabla de estado de conversación

**Files:**
- Create: `supabase/migrations/20260817000000_whatsapp_conversations.sql`
- Create: `src/lib/whatsapp/agent/state.ts`
- Test: `src/lib/whatsapp/agent/state.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `applyTtl(row, nowMs)`, `readState(phone)`, `writeState(phone, userId, patch)`, y los tipos `Turn`, `Pending`, `PendingInvoice`, `LastEntity`, `ConversationState`.

- [ ] **Step 1: Escribir la migración**

```sql
-- Estado de conversación del bot de WhatsApp.
-- Existe porque entre "[foto]" y la respuesta "Davivienda" hay DOS invocaciones
-- distintas de la función serverless: no hay memoria compartida. Sin esto,
-- preguntarle algo al usuario y usar su respuesta es imposible.
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    phone_e164   TEXT PRIMARY KEY,
    user_id      UUID NOT NULL,
    turns        JSONB NOT NULL DEFAULT '[]'::jsonb,
    pending      JSONB,
    last_entity  JSONB,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo el webhook (service-role) toca esta tabla; el navegador nunca.
-- RLS activo SIN políticas = nadie más entra.
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Escribir el test que falla**

```ts
// src/lib/whatsapp/agent/state.test.ts
import { describe, it, expect } from 'vitest';

import { applyTtl } from './state';

const AHORA = 1_700_000_000_000;
const HACE_5_MIN = new Date(AHORA - 5 * 60 * 1000).toISOString();
const HACE_40_MIN = new Date(AHORA - 40 * 60 * 1000).toISOString();

const ENTIDAD = {
  kind: 'expense' as const,
  transactionId: 'tx-1',
  amount: 45000,
  description: 'mercado',
  accountName: 'Efectivo',
  category: 'MERCADO',
  date: '2026-08-17',
};

describe('applyTtl', () => {
  it('conserva turns y pending si la conversación está fresca', () => {
    const s = applyTtl(
      {
        turns: [{ role: 'user', content: '45k mercado' }],
        pending: { kind: 'invoice_account', invoice: null },
        last_entity: ENTIDAD,
        updated_at: HACE_5_MIN,
      },
      AHORA,
    );
    expect(s.turns).toHaveLength(1);
    expect(s.pending).not.toBeNull();
  });

  it('descarta turns y pending pasados los 30 min: un "sí, esa" tres horas después es otra conversación', () => {
    const s = applyTtl(
      {
        turns: [{ role: 'user', content: 'hola' }],
        pending: { kind: 'invoice_account', invoice: null },
        last_entity: ENTIDAD,
        updated_at: HACE_40_MIN,
      },
      AHORA,
    );
    expect(s.turns).toEqual([]);
    expect(s.pending).toBeNull();
  });

  it('conserva last_entity aunque la conversación haya vencido: "corregí lo último" no caduca a los 30 min', () => {
    const s = applyTtl(
      { turns: [], pending: null, last_entity: ENTIDAD, updated_at: HACE_40_MIN },
      AHORA,
    );
    expect(s.lastEntity).toEqual(ENTIDAD);
  });

  it('devuelve un estado vacío si no hay fila', () => {
    const s = applyTtl(null, AHORA);
    expect(s).toEqual({ turns: [], pending: null, lastEntity: null });
  });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/agent/state.test.ts`
Expected: FAIL — `Failed to resolve import "./state"`

- [ ] **Step 4: Implementar `state.ts`**

```ts
// src/lib/whatsapp/agent/state.ts
// Estado de conversación del agente. La lógica de vencimiento (`applyTtl`) es
// pura para poder testearla sin base, siguiendo el patrón de
// `expenses-rollup.ts`.

import { createAdminClient } from '@/lib/supabase/server';

export type Turn = { role: 'user' | 'assistant'; content: string };

/** Factura ya extraída, esperando que el usuario diga con qué cuenta pagó. */
export interface PendingInvoice {
  source: 'dian_cufe' | 'vision_receipt';
  cufe: string | null;
  supplier: string | null;
  date: string;
  total: number | null;
  items: Array<{ description: string; amount: number }>;
}

export type Pending = { kind: 'invoice_account'; invoice: PendingInvoice | null };

export interface LastEntity {
  kind: 'expense';
  transactionId: string;
  amount: number;
  description: string;
  accountName: string;
  category: string;
  date: string;
}

export interface ConversationState {
  turns: Turn[];
  pending: Pending | null;
  lastEntity: LastEntity | null;
}

interface StateRow {
  turns?: Turn[] | null;
  pending?: Pending | null;
  last_entity?: LastEntity | null;
  updated_at?: string | null;
}

/** Turnos que se recuerdan. Suficiente para "no, eran 30 mil" sin inflar tokens. */
export const MAX_TURNS = 6;
const TTL_MS = 30 * 60 * 1000;

/**
 * Aplica el vencimiento a una fila cruda.
 *
 * `turns` y `pending` vencen a los 30 min: un "sí, esa" tres horas más tarde
 * casi seguro habla de otra cosa, y actuar sobre un `pending` viejo escribiría
 * un gasto que el usuario no pidió. `lastEntity` NO vence: "corregí lo último"
 * sigue teniendo sentido al otro día, y solo se pisa con un gasto nuevo.
 */
export function applyTtl(row: StateRow | null, nowMs: number): ConversationState {
  if (!row) return { turns: [], pending: null, lastEntity: null };

  const updatedMs = row.updated_at ? Date.parse(row.updated_at) : 0;
  const vencido = !updatedMs || nowMs - updatedMs > TTL_MS;

  return {
    turns: vencido ? [] : (row.turns ?? []),
    pending: vencido ? null : (row.pending ?? null),
    lastEntity: row.last_entity ?? null,
  };
}

export async function readState(phone: string): Promise<ConversationState> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('turns, pending, last_entity, updated_at')
    .eq('phone_e164', phone)
    .maybeSingle();
  return applyTtl(data as StateRow | null, Date.now());
}

/**
 * Guarda el estado. Los campos ausentes en `patch` no se tocan, salvo `pending`,
 * que se puede limpiar pasando `null` explícito (es lo que hace falta al
 * resolver una pregunta pendiente).
 */
export async function writeState(
  phone: string,
  userId: string,
  patch: Partial<Pick<ConversationState, 'turns' | 'pending' | 'lastEntity'>>,
): Promise<void> {
  const supabase = createAdminClient();
  const fila: Record<string, unknown> = {
    phone_e164: phone,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (patch.turns !== undefined) fila.turns = patch.turns.slice(-MAX_TURNS);
  if (patch.pending !== undefined) fila.pending = patch.pending;
  if (patch.lastEntity !== undefined) fila.last_entity = patch.lastEntity;

  const { error } = await supabase
    .from('whatsapp_conversations')
    .upsert(fila, { onConflict: 'phone_e164' });
  if (error) console.error('writeState falló:', error.message);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `bunx vitest run src/lib/whatsapp/agent/state.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Aplicar la migración**

```bash
bunx supabase db push
```

Si el proyecto no está enlazado, aplicar el SQL con el MCP de Supabase (`apply_migration`). Verificar después:

```sql
select column_name from information_schema.columns where table_name = 'whatsapp_conversations';
```

- [ ] **Step 7: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add supabase/migrations src/lib/whatsapp/agent/
git commit -m "feat(agente): estado de conversación con vencimiento a 30 min"
```

---

### Task 2: `createDirectExpense` devuelve el id y clasifica el ítem

Hoy descarta el id que devuelve el RPC (`const { error } = ...`) y no asigna
ítem de presupuesto. Sin el id no hay correcciones; sin el ítem, **todo gasto
que entre por WhatsApp cae en el panel "Sin clasificar"** y hay que arreglarlo
a mano en la app — justo el trámite que estamos eliminando.

**Files:**
- Modify: `src/lib/services/whatsapp-expenses.ts`
- Test: `src/lib/services/whatsapp-expenses.test.ts` *(ya existe, agregar casos)*

**Interfaces:**
- Consumes: `classifyExpensesToItems`, `resolveItemNameToId`, RPCs `upsert_monthly_expense`, `get_budget_items_for_month`, `assign_expense_budget_item`.
- Produces: `DirectExpenseResult` con `transactionId?: string` y `budgetItemId?: string | null`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/lib/services/whatsapp-expenses.test.ts`:

```ts
describe('pickBudgetItemId', () => {
  const ITEMS = [
    { id: 'i1', name: 'Carnes', category_name: 'MERCADO' },
    { id: 'i2', name: 'Aseo', category_name: 'MERCADO' },
    { id: 'i3', name: 'Gasolina', category_name: 'TRANSPORTE' },
  ];

  it('elige el ítem dentro de la categoría del gasto', async () => {
    const clasificar = async () => ['Carnes'];
    const id = await pickBudgetItemId('pernil', 'MERCADO', ITEMS, clasificar);
    expect(id).toBe('i1');
  });

  it('solo le ofrece al clasificador los ítems de esa categoría', async () => {
    let ofrecidos: string[] = [];
    const clasificar = async (_: unknown, nombres: string[]) => {
      ofrecidos = nombres;
      return ['Carnes'];
    };
    await pickBudgetItemId('pernil', 'MERCADO', ITEMS, clasificar);
    expect(ofrecidos).toEqual(['Carnes', 'Aseo']);
    expect(ofrecidos).not.toContain('Gasolina');
  });

  it('devuelve null si la categoría no tiene ítems: no se adivina', async () => {
    const clasificar = async () => ['Carnes'];
    const id = await pickBudgetItemId('algo', 'VIVIENDA', ITEMS, clasificar);
    expect(id).toBeNull();
  });

  it('devuelve null si el clasificador no reconoce nada', async () => {
    const clasificar = async () => [null];
    const id = await pickBudgetItemId('xyz', 'MERCADO', ITEMS, clasificar);
    expect(id).toBeNull();
  });
});
```

Agregar el import al principio del archivo, en el grupo de `@/`:

```ts
import { createDirectExpense, pickBudgetItemId } from '@/lib/services/whatsapp-expenses';
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/services/whatsapp-expenses.test.ts`
Expected: FAIL — `pickBudgetItemId is not a function`

- [ ] **Step 3: Implementar**

En `src/lib/services/whatsapp-expenses.ts`, agregar a los imports del grupo `@/`:

```ts
import { classifyExpensesToItems } from '@/lib/dian/expense-item-classifier';
import { resolveItemNameToId, type BudgetItemRef } from '@/lib/services/expenses-rollup';
```

Agregar la función pura (el clasificador se inyecta para poder testear sin red):

```ts
type Clasificador = (
  items: Array<{ description: string }>,
  itemNames: string[],
) => Promise<Array<string | null>>;

/**
 * Elige el ítem de presupuesto para un gasto, acotado a los ítems de SU
 * categoría. Si la categoría no tiene ítems o el clasificador no reconoce
 * ninguno, devuelve null: el gasto queda sin clasificar y aparece en el panel
 * de la app. Adivinar sería peor que no asignar.
 */
export async function pickBudgetItemId(
  description: string,
  categoryName: string,
  items: BudgetItemRef[],
  clasificar: Clasificador = classifyExpensesToItems,
): Promise<string | null> {
  const enCategoria = items.filter(i => i.category_name === categoryName);
  if (enCategoria.length === 0) return null;

  const [nombre] = await clasificar(
    [{ description }],
    enCategoria.map(i => i.name),
  );
  return resolveItemNameToId(nombre, enCategoria);
}
```

Reemplazar el cuerpo de `createDirectExpense` desde la llamada al RPC:

```ts
  const { data, error } = await supabase.rpc('upsert_monthly_expense', {
    p_user_id: userId,
    p_description: input.description,
    p_amount: input.amount,
    p_transaction_date: input.date,
    p_category_name: finalCategory,
    p_account_name: input.accountName,
    p_place: 'WhatsApp',
  });

  if (error) {
    return { ok: false, category: finalCategory, error: error.message };
  }

  const transactionId = typeof data === 'string' ? data : undefined;

  // Asignar el ítem del presupuesto. Best-effort: si falla, el gasto YA está
  // guardado y aparece en el panel "Sin clasificar" — nunca se pierde.
  let budgetItemId: string | null = null;
  if (transactionId) {
    try {
      const monthYear = input.date.slice(0, 7);
      const { data: filas } = await supabase.rpc('get_budget_items_for_month', {
        p_user_id: userId,
        p_month_year: monthYear,
      });
      const items: BudgetItemRef[] = (filas ?? []).map(
        (r: { item_id: string; item_name: string; category_name: string }) => ({
          id: r.item_id,
          name: r.item_name,
          category_name: r.category_name,
        }),
      );
      budgetItemId = await pickBudgetItemId(input.description, finalCategory, items);
      if (budgetItemId) {
        await supabase.rpc('assign_expense_budget_item', {
          p_user_id: userId,
          p_transaction_id: transactionId,
          p_budget_item_id: budgetItemId,
          p_source: 'ai',
        });
      }
    } catch (err) {
      console.error('No se pudo asignar el ítem de presupuesto:', err);
    }
  }

  return { ok: true, category: finalCategory, transactionId, budgetItemId };
```

Y ampliar la interfaz:

```ts
export interface DirectExpenseResult {
  ok: boolean;
  category: string;
  transactionId?: string;
  budgetItemId?: string | null;
  error?: string;
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `bunx vitest run src/lib/services/whatsapp-expenses.test.ts`
Expected: PASS — los 4 nuevos más los que ya había

- [ ] **Step 5: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/services/whatsapp-expenses.ts src/lib/services/whatsapp-expenses.test.ts
git commit -m "feat(gastos): los gastos de WhatsApp devuelven su id y se clasifican en un ítem"
```

---

### Task 3: El system prompt

**Files:**
- Create: `src/lib/whatsapp/agent/prompt.ts`
- Test: `src/lib/whatsapp/agent/prompt.test.ts`

**Interfaces:**
- Consumes: los tipos de `state.ts`.
- Produces: `buildSystemPrompt(ctx: PromptContext): string`, `interface PromptContext`.

Las cuentas y categorías van **en el prompt**, no en una herramienta: son pocas,
cambian poco, y así el modelo resuelve "la Davivienda" → `Davivienda Crédito`
sin una vuelta extra al Gateway.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/whatsapp/agent/prompt.test.ts
import { describe, it, expect } from 'vitest';

import { buildSystemPrompt } from './prompt';

const BASE = {
  accounts: ['Efectivo', 'Davivienda Crédito', 'Nequi'],
  categories: ['MERCADO', 'TRANSPORTE', 'OTROS'],
  defaultAccount: 'Efectivo',
  today: '2026-08-17',
  pendingInvoice: null,
  lastEntity: null,
};

describe('buildSystemPrompt', () => {
  it('incluye las cuentas y categorías reales para que no las invente', () => {
    const p = buildSystemPrompt(BASE);
    expect(p).toContain('Davivienda Crédito');
    expect(p).toContain('MERCADO');
  });

  it('incluye la fecha de hoy para poder resolver "ayer"', () => {
    expect(buildSystemPrompt(BASE)).toContain('2026-08-17');
  });

  it('avisa que hay una factura esperando cuenta', () => {
    const p = buildSystemPrompt({
      ...BASE,
      pendingInvoice: {
        source: 'vision_receipt',
        cufe: null,
        supplier: 'ÉXITO',
        date: '2026-08-17',
        total: 89400,
        items: [{ description: 'arroz', amount: 5000 }],
      },
    });
    expect(p).toContain('ÉXITO');
    expect(p).toContain('registrar_factura');
  });

  it('no menciona factura pendiente cuando no la hay', () => {
    expect(buildSystemPrompt(BASE)).not.toContain('registrar_factura');
  });

  it('describe el último gasto para poder corregirlo', () => {
    const p = buildSystemPrompt({
      ...BASE,
      lastEntity: {
        kind: 'expense',
        transactionId: 'tx-1',
        amount: 45000,
        description: 'mercado',
        accountName: 'Efectivo',
        category: 'MERCADO',
        date: '2026-08-17',
      },
    });
    expect(p).toContain('45000');
    expect(p).toContain('corregir_ultimo');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/agent/prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./prompt"`

- [ ] **Step 3: Implementar**

```ts
// src/lib/whatsapp/agent/prompt.ts
// System prompt del agente. Las cuentas y categorías se inyectan acá (no como
// herramienta) porque son pocas y cambian poco: así el modelo resuelve
// "la Davivienda" -> "Davivienda Crédito" sin una vuelta extra al Gateway.

import type { LastEntity, PendingInvoice } from './state';

export interface PromptContext {
  accounts: string[];
  categories: string[];
  defaultAccount: string;
  today: string; // YYYY-MM-DD
  pendingInvoice: PendingInvoice | null;
  lastEntity: LastEntity | null;
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const partes: string[] = [
    'Sos el asistente de gastos de una app de presupuesto personal colombiana.',
    'Tu trabajo es convertir lo que escribe el usuario en llamadas a herramientas.',
    '',
    `Hoy es ${ctx.today}. Los montos son pesos colombianos (COP).`,
    `"20k" son 20000. "2 mil" son 2000.`,
    '',
    `Cuentas del usuario: ${ctx.accounts.join(', ')}.`,
    `Cuenta por defecto: ${ctx.defaultAccount}.`,
    `Categorías: ${ctx.categories.join(', ')}.`,
    '',
    'Reglas:',
    '- Usá SOLO las cuentas de la lista. Si el usuario nombra una que no existe, preguntale cuál de las que tiene.',
    '- Un mensaje puede traer varios gastos ("20k taxi y 15k almuerzo"): llamá a registrar_gasto una vez por cada uno.',
    '- El primer número no siempre es el monto: en "2 empanadas 5000" el monto es 5000 y la descripción "2 empanadas".',
    '- Si el usuario no dice cuenta en un gasto de texto, usá la de por defecto sin preguntar.',
    '- Resolvé fechas relativas ("ayer", "el lunes") a YYYY-MM-DD usando la fecha de hoy.',
    '- Respondé corto y en español, sin markdown: esto sale por WhatsApp.',
  ];

  if (ctx.pendingInvoice) {
    const f = ctx.pendingInvoice;
    const desc = f.supplier ? `de ${f.supplier}` : 'sin proveedor identificado';
    partes.push(
      '',
      `HAY UNA FACTURA ESPERANDO CUENTA: ${desc}, ${f.items.length} ítems, total ${f.total ?? 'desconocido'}.`,
      'Si el usuario nombra una cuenta, llamá a registrar_factura con esa cuenta.',
      'Si dice cualquier otra cosa, volvé a preguntarle con cuál de sus cuentas la pagó.',
      'NO llames a registrar_gasto por esta factura: sus ítems ya están guardados.',
    );
  }

  if (ctx.lastEntity) {
    const e = ctx.lastEntity;
    partes.push(
      '',
      `Último gasto registrado: ${e.amount} "${e.description}" en ${e.category} (${e.accountName}), ${e.date}.`,
      'Si el usuario lo corrige ("no, eran 30 mil", "ese fue con la Nequi"), usá corregir_ultimo.',
    );
  }

  return partes.join('\n');
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bunx vitest run src/lib/whatsapp/agent/prompt.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/agent/prompt.ts src/lib/whatsapp/agent/prompt.test.ts
git commit -m "feat(agente): system prompt con las cuentas y categorías reales"
```

---

### Task 4: Las herramientas y sus validaciones

Acá vive la seguridad del diseño: el modelo propone, la herramienta dispone.
Una cuenta inventada o un monto absurdo **no llegan nunca a la base**.

**Files:**
- Create: `src/lib/whatsapp/agent/tools.ts`
- Test: `src/lib/whatsapp/agent/tools.test.ts`

**Interfaces:**
- Consumes: `DirectExpenseResult` (Task 2), tipos de `state.ts`.
- Produces: `TOOL_DEFINITIONS`, `validateGasto(input, accounts)`, `executeTool(name, input, deps)`, `interface ToolDeps`, `type ToolResult`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/whatsapp/agent/tools.test.ts
import { describe, it, expect } from 'vitest';

import { TOOL_DEFINITIONS, validateGasto } from './tools';

const CUENTAS = ['Efectivo', 'Davivienda Crédito', 'Nequi'];

describe('validateGasto', () => {
  it('acepta un gasto normal', () => {
    const r = validateGasto({ monto: 45000, descripcion: 'mercado', cuenta: 'Nequi' }, CUENTAS);
    expect(r.ok).toBe(true);
  });

  it('rechaza una cuenta que el usuario no tiene: el modelo no puede inventarlas', () => {
    const r = validateGasto({ monto: 45000, descripcion: 'x', cuenta: 'Bancolombia' }, CUENTAS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Bancolombia');
  });

  it('acepta la cuenta sin importar mayúsculas ni tildes', () => {
    const r = validateGasto({ monto: 1000, descripcion: 'x', cuenta: 'davivienda credito' }, CUENTAS);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cuenta).toBe('Davivienda Crédito');
  });

  it('rechaza montos sobre 100 millones: casi siempre es un typo tipo "999999k"', () => {
    const r = validateGasto({ monto: 200_000_000, descripcion: 'x' }, CUENTAS);
    expect(r.ok).toBe(false);
  });

  it('rechaza monto cero o negativo', () => {
    expect(validateGasto({ monto: 0, descripcion: 'x' }, CUENTAS).ok).toBe(false);
    expect(validateGasto({ monto: -5, descripcion: 'x' }, CUENTAS).ok).toBe(false);
  });

  it('rechaza descripción vacía', () => {
    expect(validateGasto({ monto: 1000, descripcion: '   ' }, CUENTAS).ok).toBe(false);
  });

  it('rechaza una fecha con formato inválido', () => {
    const r = validateGasto({ monto: 1000, descripcion: 'x', fecha: '17/08/2026' }, CUENTAS);
    expect(r.ok).toBe(false);
  });
});

describe('TOOL_DEFINITIONS', () => {
  it('expone las cuatro herramientas', () => {
    expect(TOOL_DEFINITIONS.map(t => t.name).sort()).toEqual([
      'consultar_gastos',
      'corregir_ultimo',
      'registrar_factura',
      'registrar_gasto',
    ]);
  });

  it('cada herramienta declara un input_schema de objeto', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.input_schema.type).toBe('object');
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/agent/tools.test.ts`
Expected: FAIL — `Failed to resolve import "./tools"`

- [ ] **Step 3: Implementar**

```ts
// src/lib/whatsapp/agent/tools.ts
// Definiciones de herramientas + validación. El modelo propone; acá se decide
// si se puede. Una cuenta inventada o un monto absurdo mueren en esta capa.

/** Un gasto por texto de más de 100 millones es casi siempre un typo ("999999k"). */
const MAX_AMOUNT = 100_000_000;

export interface GastoInput {
  monto: number;
  descripcion: string;
  cuenta?: string;
  fecha?: string;
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Compara nombres de cuenta ignorando mayúsculas, tildes y espacios de más. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function validateGasto(
  input: GastoInput,
  accounts: string[],
): Validation<Required<Pick<GastoInput, 'monto' | 'descripcion'>> & { cuenta?: string; fecha?: string }> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    return { ok: false, error: 'El monto tiene que ser un número mayor que cero.' };
  }
  if (input.monto > MAX_AMOUNT) {
    return {
      ok: false,
      error: `El monto ${input.monto} supera el tope de ${MAX_AMOUNT}. Confirmá el valor con el usuario.`,
    };
  }
  const descripcion = (input.descripcion || '').trim();
  if (!descripcion) {
    return { ok: false, error: 'Falta la descripción del gasto.' };
  }
  if (input.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    return { ok: false, error: 'La fecha debe venir en formato YYYY-MM-DD.' };
  }

  let cuenta: string | undefined;
  if (input.cuenta) {
    const encontrada = accounts.find(a => normalizar(a) === normalizar(input.cuenta as string));
    if (!encontrada) {
      return {
        ok: false,
        error: `La cuenta "${input.cuenta}" no existe. Las cuentas del usuario son: ${accounts.join(', ')}. Preguntale cuál usó.`,
      };
    }
    cuenta = encontrada;
  }

  return { ok: true, value: { monto: input.monto, descripcion, cuenta, fecha: input.fecha } };
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'registrar_gasto',
    description:
      'Registra un gasto. Llamala una vez por cada gasto si el mensaje trae varios.',
    input_schema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto en COP. "20k" son 20000.' },
        descripcion: { type: 'string', description: 'Qué se compró, sin el monto.' },
        cuenta: { type: 'string', description: 'Cuenta usada. Omitir si el usuario no la mencionó.' },
        fecha: { type: 'string', description: 'YYYY-MM-DD. Omitir si es hoy.' },
      },
      required: ['monto', 'descripcion'],
    },
  },
  {
    name: 'registrar_factura',
    description:
      'Confirma la factura que está esperando cuenta. Solo requiere la cuenta: los ítems ya están guardados.',
    input_schema: {
      type: 'object',
      properties: {
        cuenta: { type: 'string', description: 'Cuenta con la que se pagó la factura.' },
      },
      required: ['cuenta'],
    },
  },
  {
    name: 'corregir_ultimo',
    description: 'Corrige un campo del último gasto registrado.',
    input_schema: {
      type: 'object',
      properties: {
        campo: {
          type: 'string',
          enum: ['monto', 'descripcion', 'cuenta', 'categoria', 'fecha'],
        },
        valor: { type: 'string', description: 'El valor nuevo, como texto.' },
      },
      required: ['campo', 'valor'],
    },
  },
  {
    name: 'consultar_gastos',
    description: 'Consulta cuánto se gastó. Solo lectura.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: { type: 'string', description: 'Categoría a consultar. Omitir para el total.' },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
];
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bunx vitest run src/lib/whatsapp/agent/tools.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/agent/tools.ts src/lib/whatsapp/agent/tools.test.ts
git commit -m "feat(agente): herramientas con validación contra las cuentas reales"
```

---

### Task 5: El bucle del agente

**Files:**
- Create: `src/lib/whatsapp/agent/run.ts`
- Test: `src/lib/whatsapp/agent/run.test.ts`

**Interfaces:**
- Consumes: `TOOL_DEFINITIONS` (Task 4), `buildSystemPrompt` (Task 3), tipos de `state.ts`.
- Produces: `runAgent(mensaje, ctx, deps): Promise<AgentReply>`, `interface AgentRunDeps`, `type AgentReply = {text: string; calls: ToolCall[]} | {kind: 'service_error'}`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// src/lib/whatsapp/agent/run.test.ts
import { describe, it, expect } from 'vitest';

import { runAgent, type AgentRunDeps } from './run';

const CTX = {
  accounts: ['Efectivo', 'Nequi'],
  categories: ['MERCADO'],
  defaultAccount: 'Efectivo',
  today: '2026-08-17',
  pendingInvoice: null,
  lastEntity: null,
  turns: [],
};

/** Respuesta del Gateway con una llamada a herramienta. */
function conHerramienta(name: string, input: unknown) {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tu_1', name, input }],
  };
}

function conTexto(text: string) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
}

describe('runAgent', () => {
  it('ejecuta la herramienta que pide el modelo y devuelve su texto final', async () => {
    const respuestas = [
      conHerramienta('registrar_gasto', { monto: 45000, descripcion: 'mercado' }),
      conTexto('Anotado.'),
    ];
    const ejecutadas: string[] = [];
    const deps: AgentRunDeps = {
      callGateway: async () => respuestas.shift(),
      executeTool: async name => {
        ejecutadas.push(name);
        return { ok: true, summary: 'listo' };
      },
    };

    const r = await runAgent('45k mercado', CTX, deps);
    expect(ejecutadas).toEqual(['registrar_gasto']);
    if ('text' in r) expect(r.text).toBe('Anotado.');
  });

  it('corta a las 3 vueltas: un modelo en bucle no puede colgar la función', async () => {
    let vueltas = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => {
        vueltas++;
        return conHerramienta('registrar_gasto', { monto: 1, descripcion: 'x' });
      },
      executeTool: async () => ({ ok: true, summary: 'listo' }),
    };

    await runAgent('loop', CTX, deps);
    expect(vueltas).toBeLessThanOrEqual(3);
  });

  it('devuelve service_error si el Gateway falla, para no culpar al usuario', async () => {
    const deps: AgentRunDeps = {
      callGateway: async () => {
        throw new Error('429 Too Many Requests');
      },
      executeTool: async () => ({ ok: true, summary: 'listo' }),
    };

    const r = await runAgent('45k mercado', CTX, deps);
    expect('kind' in r && r.kind === 'service_error').toBe(true);
  });

  it('le devuelve al modelo el error de la herramienta para que pueda reaccionar', async () => {
    const respuestas = [
      conHerramienta('registrar_gasto', { monto: 1000, descripcion: 'x', cuenta: 'Bancolombia' }),
      conTexto('¿Con cuál de tus cuentas fue?'),
    ];
    let recibidoPorElModelo = '';
    const deps: AgentRunDeps = {
      callGateway: async mensajes => {
        const ultimo = mensajes[mensajes.length - 1];
        if (Array.isArray(ultimo?.content)) {
          const res = ultimo.content.find(
            (c: { type?: string }) => c?.type === 'tool_result',
          ) as { content?: string } | undefined;
          if (res?.content) recibidoPorElModelo = res.content;
        }
        return respuestas.shift();
      },
      executeTool: async () => ({ ok: false, summary: 'La cuenta "Bancolombia" no existe.' }),
    };

    await runAgent('1000 x con Bancolombia', CTX, deps);
    expect(recibidoPorElModelo).toContain('Bancolombia');
  });

  it('varios gastos en un mensaje ejecutan varias herramientas', async () => {
    const respuestas = [
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'a', name: 'registrar_gasto', input: { monto: 20000, descripcion: 'taxi' } },
          { type: 'tool_use', id: 'b', name: 'registrar_gasto', input: { monto: 15000, descripcion: 'almuerzo' } },
        ],
      },
      conTexto('Anoté los dos.'),
    ];
    let n = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => respuestas.shift(),
      executeTool: async () => {
        n++;
        return { ok: true, summary: 'listo' };
      },
    };

    await runAgent('20k taxi y 15k almuerzo', CTX, deps);
    expect(n).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/agent/run.test.ts`
Expected: FAIL — `Failed to resolve import "./run"`

- [ ] **Step 3: Implementar**

```ts
// src/lib/whatsapp/agent/run.ts
// El bucle del agente: manda el mensaje al Gateway, ejecuta las herramientas
// que pida y vuelve, hasta que responda texto o se agoten las vueltas.
// callGateway y executeTool se inyectan para poder testear sin red.

import { buildSystemPrompt, type PromptContext } from './prompt';
import { TOOL_DEFINITIONS } from './tools';
import type { Turn } from './state';

/** Tope de vueltas. Un modelo en bucle no puede colgar la función serverless. */
const MAX_ITERACIONES = 3;

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolOutcome {
  ok: boolean;
  /** Texto corto que se le devuelve al modelo como resultado. */
  summary: string;
}

export type AgentReply =
  | { text: string; calls: ToolCall[] }
  | { kind: 'service_error' };

type GatewayMessage = { role: 'user' | 'assistant'; content: unknown };

export interface AgentRunDeps {
  callGateway: (
    messages: GatewayMessage[],
    system: string,
  ) => Promise<{ stop_reason?: string; content?: unknown[] } | undefined>;
  executeTool: (name: string, input: Record<string, unknown>) => Promise<ToolOutcome>;
}

export type AgentContextForRun = PromptContext & { turns: Turn[] };

export async function runAgent(
  mensaje: string,
  ctx: AgentContextForRun,
  deps: AgentRunDeps,
): Promise<AgentReply> {
  const system = buildSystemPrompt(ctx);
  const messages: GatewayMessage[] = [
    ...ctx.turns.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: mensaje },
  ];

  const ejecutadas: ToolCall[] = [];
  let textoFinal = '';

  try {
    for (let vuelta = 0; vuelta < MAX_ITERACIONES; vuelta++) {
      const data = await deps.callGateway(messages, system);
      const bloques = Array.isArray(data?.content) ? data.content : [];

      const texto = bloques
        .filter((b): b is { type: string; text: string } => (b as { type?: string })?.type === 'text')
        .map(b => b.text)
        .join('')
        .trim();
      if (texto) textoFinal = texto;

      const llamadas = bloques.filter(
        (b): b is { type: string; id: string; name: string; input: Record<string, unknown> } =>
          (b as { type?: string })?.type === 'tool_use',
      );

      if (llamadas.length === 0) break;

      messages.push({ role: 'assistant', content: bloques });

      const resultados: unknown[] = [];
      for (const ll of llamadas) {
        const out = await deps.executeTool(ll.name, ll.input ?? {});
        ejecutadas.push({ id: ll.id, name: ll.name, input: ll.input ?? {} });
        resultados.push({
          type: 'tool_result',
          tool_use_id: ll.id,
          content: out.summary,
          is_error: !out.ok,
        });
      }
      messages.push({ role: 'user', content: resultados });
    }
  } catch (err) {
    // No es culpa del usuario: el llamador debe decirlo así y no pedirle que
    // reformule el mensaje.
    console.error('runAgent: falló el Gateway:', err);
    return { kind: 'service_error' };
  }

  return { text: textoFinal, calls: ejecutadas };
}

/** Llamada real al Gateway. Se inyecta en producción; los tests la reemplazan. */
export async function callGatewayReal(
  messages: GatewayMessage[],
  system: string,
): Promise<{ stop_reason?: string; content?: unknown[] } | undefined> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error('falta AI_GATEWAY_API_KEY');

  const baseUrl = process.env.AI_GATEWAY_BASE_URL || 'https://ai-gateway.vercel.sh';
  const model = process.env.AGENT_MODEL || 'google/gemini-3-flash';

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 2048, system, tools: TOOL_DEFINITIONS, messages }),
    // Presupuesto de tiempo: un Gateway colgado no puede llevarse la función.
    // Vercel la mata SIN ejecutar ningún catch, y ahí el usuario se queda sin
    // respuesta — la misma falla muda que tuvo el CUFE.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Gateway ${res.status}: ${detalle.slice(0, 300)}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bunx vitest run src/lib/whatsapp/agent/run.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/agent/run.ts src/lib/whatsapp/agent/run.test.ts
git commit -m "feat(agente): bucle de herramientas con tope de vueltas y error de servicio"
```

---

### Task 6: Ejecutores reales de las herramientas

Conecta las definiciones de la Task 4 con los servicios que escriben.

**Files:**
- Modify: `src/lib/whatsapp/agent/tools.ts`
- Test: `src/lib/whatsapp/agent/tools.test.ts`

**Interfaces:**
- Consumes: `createDirectExpense` (Task 2), `validateGasto` (Task 4).
- Produces: `executeTool(name, input, deps): Promise<ToolOutcome>`, `interface ToolDeps`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tools.test.ts`:

```ts
import { executeTool, type ToolDeps } from './tools';

function depsFalsas(over: Partial<ToolDeps> = {}): ToolDeps {
  return {
    accounts: CUENTAS,
    defaultAccount: 'Efectivo',
    today: () => '2026-08-17',
    createExpense: async () => ({ ok: true, category: 'MERCADO', transactionId: 'tx-1' }),
    registerInvoice: async () => ({ ok: true, itemsFound: 3 }),
    correctLast: async () => ({ ok: true }),
    queryExpenses: async () => ({ total: 412000, categoria: 'MERCADO' }),
    onExpenseCreated: async () => {},
    ...over,
  };
}

describe('executeTool', () => {
  it('registra un gasto y avisa qué quedó guardado', async () => {
    const r = await executeTool('registrar_gasto', { monto: 45000, descripcion: 'mercado' }, depsFalsas());
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('45000');
  });

  it('usa la cuenta por defecto si el modelo no mandó ninguna', async () => {
    let usada = '';
    const deps = depsFalsas({
      createExpense: async (input) => {
        usada = input.accountName;
        return { ok: true, category: 'MERCADO', transactionId: 'tx-1' };
      },
    });
    await executeTool('registrar_gasto', { monto: 1000, descripcion: 'x' }, deps);
    expect(usada).toBe('Efectivo');
  });

  it('no escribe nada si la cuenta no existe y le explica al modelo', async () => {
    let escribio = false;
    const deps = depsFalsas({
      createExpense: async () => {
        escribio = true;
        return { ok: true, category: 'X', transactionId: 't' };
      },
    });
    const r = await executeTool(
      'registrar_gasto',
      { monto: 1000, descripcion: 'x', cuenta: 'Bancolombia' },
      deps,
    );
    expect(escribio).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.summary).toContain('Bancolombia');
  });

  it('avisa al llamador del gasto creado, para poder disparar alertas después', async () => {
    let avisado = '';
    const deps = depsFalsas({ onExpenseCreated: async cat => { avisado = cat; } });
    await executeTool('registrar_gasto', { monto: 1000, descripcion: 'x' }, deps);
    expect(avisado).toBe('MERCADO');
  });

  it('devuelve un error legible si la herramienta no existe', async () => {
    const r = await executeTool('volar', {}, depsFalsas());
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/agent/tools.test.ts`
Expected: FAIL — `executeTool is not a function`

- [ ] **Step 3: Implementar**

Agregar al final de `src/lib/whatsapp/agent/tools.ts`:

```ts
import type { ToolOutcome } from './run';

export interface ToolDeps {
  accounts: string[];
  defaultAccount: string;
  today: () => string;
  createExpense: (input: {
    amount: number;
    description: string;
    accountName: string;
    date: string;
  }) => Promise<{ ok: boolean; category: string; transactionId?: string; error?: string }>;
  registerInvoice: (accountName: string) => Promise<{ ok: boolean; itemsFound: number; error?: string }>;
  correctLast: (campo: string, valor: string) => Promise<{ ok: boolean; error?: string }>;
  queryExpenses: (q: {
    categoria?: string;
    desde?: string;
    hasta?: string;
  }) => Promise<{ total: number; categoria?: string }>;
  /** Se llama tras cada gasto creado. Enganche para las alertas de presupuesto. */
  onExpenseCreated: (categoria: string) => Promise<void>;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolDeps,
): Promise<ToolOutcome> {
  try {
    if (name === 'registrar_gasto') {
      const v = validateGasto(input as unknown as GastoInput, deps.accounts);
      if (!v.ok) return { ok: false, summary: v.error };

      const res = await deps.createExpense({
        amount: v.value.monto,
        description: v.value.descripcion,
        accountName: v.value.cuenta ?? deps.defaultAccount,
        date: v.value.fecha ?? deps.today(),
      });
      if (!res.ok) return { ok: false, summary: `No se pudo guardar: ${res.error ?? 'error desconocido'}` };

      await deps.onExpenseCreated(res.category);
      return {
        ok: true,
        summary: `Guardado: ${v.value.monto} "${v.value.descripcion}" en ${res.category} (${v.value.cuenta ?? deps.defaultAccount}).`,
      };
    }

    if (name === 'registrar_factura') {
      const cuenta = String(input.cuenta ?? '');
      const encontrada = deps.accounts.find(a => normalizar(a) === normalizar(cuenta));
      if (!encontrada) {
        return {
          ok: false,
          summary: `La cuenta "${cuenta}" no existe. Son: ${deps.accounts.join(', ')}. Preguntale cuál usó.`,
        };
      }
      const res = await deps.registerInvoice(encontrada);
      if (!res.ok) return { ok: false, summary: `No se pudo guardar la factura: ${res.error ?? 'error'}` };
      return { ok: true, summary: `Factura guardada con ${res.itemsFound} ítems en ${encontrada}.` };
    }

    if (name === 'corregir_ultimo') {
      const campo = String(input.campo ?? '');
      const valor = String(input.valor ?? '');
      if (campo === 'cuenta') {
        const encontrada = deps.accounts.find(a => normalizar(a) === normalizar(valor));
        if (!encontrada) {
          return { ok: false, summary: `La cuenta "${valor}" no existe. Son: ${deps.accounts.join(', ')}.` };
        }
        const res = await deps.correctLast(campo, encontrada);
        return res.ok
          ? { ok: true, summary: `Corregido: cuenta = ${encontrada}.` }
          : { ok: false, summary: res.error ?? 'no se pudo corregir' };
      }
      const res = await deps.correctLast(campo, valor);
      return res.ok
        ? { ok: true, summary: `Corregido: ${campo} = ${valor}.` }
        : { ok: false, summary: res.error ?? 'no se pudo corregir' };
    }

    if (name === 'consultar_gastos') {
      const r = await deps.queryExpenses({
        categoria: input.categoria as string | undefined,
        desde: input.desde as string | undefined,
        hasta: input.hasta as string | undefined,
      });
      return {
        ok: true,
        summary: r.categoria
          ? `Total en ${r.categoria}: ${r.total}.`
          : `Total: ${r.total}.`,
      };
    }

    return { ok: false, summary: `No existe la herramienta "${name}".` };
  } catch (err) {
    console.error(`executeTool(${name}) falló:`, err);
    return { ok: false, summary: 'Hubo un error interno ejecutando esa acción.' };
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `bunx vitest run src/lib/whatsapp/agent/tools.test.ts`
Expected: PASS (14 tests: los 9 de la Task 4 más 5 nuevos)

- [ ] **Step 5: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/agent/tools.ts src/lib/whatsapp/agent/tools.test.ts
git commit -m "feat(agente): ejecutores de herramientas conectados a los servicios"
```

---

### Task 7: Enrutar el texto suelto al agente, con caída al parser viejo

**Files:**
- Modify: `src/lib/whatsapp/classify.ts`
- Modify: `src/app/api/whatsapp/webhook/route.ts`
- Test: `src/lib/whatsapp/classify.test.ts`

**Interfaces:**
- Consumes: `runAgent` (Task 5), `executeTool` (Task 6), `readState`/`writeState` (Task 1).
- Produces: `classifyText` con la decisión `'agent'`.

`parseQuickExpense` **no se borra**: pasa a ser el modo degradado. Con el
Gateway caído, "20k taxi" se sigue registrando.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/lib/whatsapp/classify.test.ts`:

```ts
describe('classifyText — enrutado al agente', () => {
  it('el CUFE sigue siendo determinista, no pasa por el agente', () => {
    expect(classifyText('a'.repeat(96), 0)).toBe('cufe');
  });

  it('manda al agente lo que antes caía en unknown', () => {
    expect(classifyText('¿cuánto llevo en mercado?', 0)).toBe('agent');
  });

  it('manda al agente los gastos de texto: el parser acertaba mal en silencio', () => {
    expect(classifyText('2 empanadas 5000', 0)).toBe('agent');
  });

  it('"ayuda" sigue siendo respuesta fija: no gasta tokens', () => {
    expect(classifyText('ayuda', 0)).toBe('help');
  });

  it('una imagen sigue siendo imagen', () => {
    expect(classifyText('con la Davivienda', 1)).toBe('image');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/classify.test.ts`
Expected: FAIL — devuelve `'quick_expense'`/`'unknown'` en vez de `'agent'`

- [ ] **Step 3: Implementar el cambio de clasificación**

En `src/lib/whatsapp/classify.ts`, reemplazar el tipo y la función:

```ts
export type Decision = 'cufe' | 'agent' | 'image' | 'help';

export function classifyText(body: string, numMedia: number): Decision {
  if (numMedia > 0) return 'image';
  const text = (body || '').trim();
  // El CUFE es 96 hex: determinista y gratis. Un LLB acá solo agregaría formas
  // de fallar.
  if (extractCufe(text)) return 'cufe';
  if (/^(ayuda|help)$/i.test(text)) return 'help';
  // Todo lo demás va al agente. `parseQuickExpense` ya no decide el enrutado:
  // acertaba mal en silencio ("2 empanadas 5000" -> $2) y esos casos nunca
  // llegaban a 'unknown', así que un LLM de respaldo jamás los habría visto.
  return 'agent';
}
```

Actualizar `simpleReply` para que acepte solo `'image' | 'help'`, y borrar la
rama `'unknown'`:

```ts
export function simpleReply(decision: 'image' | 'help'): string {
  if (decision === 'image') {
    return '📷 Recibí una imagen. Envíame la *foto* de una factura o de una transferencia y la registro.';
  }
  return [
    'Puedo registrar tus gastos 💸',
    '• Pega el *CUFE* de una factura DIAN → la dejo lista.',
    '• Envía una *foto* de una factura o de una transferencia → la leo y la registro.',
    '• Escribe un gasto: "20k taxi", "gasté 35000 en mercado".',
    '• Preguntame: "¿cuánto llevo en mercado?"',
  ].join('\n');
}
```

- [ ] **Step 4: Conectar el agente en el webhook**

En `src/app/api/whatsapp/webhook/route.ts`, reemplazar la rama
`decision === 'cufe' || decision === 'quick_expense'` por dos ramas y agregar el
manejo de `'agent'`:

```ts
  if (decision === 'agent') {
    const userId = link.userId;
    after(async () => {
      try {
        await handleAgentTurn({ userId, phone, body });
      } catch (err) {
        console.error('Error en handleAgentTurn (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema procesando tu mensaje. Inténtalo de nuevo en un momento.',
        );
      }
    });
    return xml(twimlMessage('✍️ Un momento...'));
  }
```

Crear `src/lib/whatsapp/agent/turn.ts` con la orquestación (estado → agente →
respuesta), incluida la caída al parser viejo:

```ts
// src/lib/whatsapp/agent/turn.ts
// Orquesta un turno del agente: lee estado, corre el bucle, responde y guarda.
// Si el Gateway falla, cae a `parseQuickExpense` para no dejar al usuario sin
// nada: un gasto simple se sigue registrando con el LLM caído.

import { resolveUserCategoryNames } from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase/server';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

import { callGatewayReal, runAgent } from './run';
import { readState, writeState } from './state';
import { executeTool, type ToolDeps } from './tools';

function hoyBogota(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

async function listarCuentas(userId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('accounts')
    .select('name')
    .eq('user_id', userId)
    .eq('is_active', true);
  return (data ?? []).map((r: { name: string }) => r.name);
}

export async function handleAgentTurn(ctx: {
  userId: string;
  phone: string;
  body: string;
}): Promise<void> {
  const estado = await readState(ctx.phone);
  const [cuentas, categorias, cuentaDefecto] = await Promise.all([
    listarCuentas(ctx.userId),
    resolveUserCategoryNames(createAdminClient(), ctx.userId),
    resolveDefaultAccount(ctx.phone),
  ]);

  const deps: ToolDeps = {
    accounts: cuentas,
    defaultAccount: cuentaDefecto,
    today: hoyBogota,
    createExpense: async input => createDirectExpense(ctx.userId, ctx.phone, input),
    registerInvoice: async () => ({ ok: false, itemsFound: 0, error: 'sin factura pendiente' }),
    correctLast: async () => ({ ok: false, error: 'todavía no implementado' }),
    queryExpenses: async () => ({ total: 0 }),
    onExpenseCreated: async () => {},
  };

  const respuesta = await runAgent(
    ctx.body,
    {
      accounts: cuentas,
      categories: categorias,
      defaultAccount: cuentaDefecto,
      today: hoyBogota(),
      pendingInvoice: estado.pending?.invoice ?? null,
      lastEntity: estado.lastEntity,
      turns: estado.turns,
    },
    {
      callGateway: callGatewayReal,
      executeTool: (name, input) => executeTool(name, input, deps),
    },
  );

  // Gateway caído: no es culpa del usuario. Se intenta el parser viejo antes de
  // rendirse — con el LLM abajo, "20k taxi" se sigue registrando.
  if ('kind' in respuesta) {
    const rapido = parseQuickExpense(ctx.body);
    if (rapido) {
      const res = await createDirectExpense(ctx.userId, ctx.phone, {
        amount: rapido.amount,
        description: rapido.description,
        accountName: cuentaDefecto,
        date: hoyBogota(),
      });
      await sendWhatsAppMessage(
        ctx.phone,
        res.ok
          ? `✅ Anotado ${rapido.amount} en ${res.category} (${cuentaDefecto}).`
          : '❌ No pude registrar el gasto. Intentá de nuevo en un momento.',
      );
      return;
    }
    await sendWhatsAppMessage(
      ctx.phone,
      '⚠️ Mi asistente está fallando ahora mismo (no es tu mensaje). Probá en un minuto, o escribí el gasto simple: "20k taxi".',
    );
    return;
  }

  const texto = respuesta.text || 'Listo.';
  await sendWhatsAppMessage(ctx.phone, texto);
  await writeState(ctx.phone, ctx.userId, {
    turns: [
      ...estado.turns,
      { role: 'user', content: ctx.body },
      { role: 'assistant', content: texto },
    ],
  });
}
```

Actualizar el import en el webhook y quitar `handleAgentMessage` de la rama de
texto (sigue usándose para el CUFE).

- [ ] **Step 5: Correr todos los tests**

Run: `bunx vitest run`
Expected: PASS. Si algún test viejo esperaba `'quick_expense'` o `'unknown'` de
`classifyText`, actualizarlo a `'agent'` — el cambio es intencional.

- [ ] **Step 6: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/ src/app/api/whatsapp/webhook/route.ts
git commit -m "feat(agente): el texto suelto va al agente, con caída al parser viejo"
```

- [ ] **Step 7: Configurar el modelo en producción**

```bash
printf '%s' "google/gemini-3-flash" | vercel env add AGENT_MODEL production
vercel env ls production | grep AGENT_MODEL
```

- [ ] **Step 8: Desplegar y verificar que el deploy quedó Ready**

```bash
vercel deploy --prod --yes
vercel ls --yes | head -1   # tomar la URL
vercel inspect <url> | grep status    # DEBE decir "● Ready"
```

El deploy por git estuvo roto un mes sin avisar en el repo hermano. **No dar por
desplegado un push sin ver `Ready`.**

- [ ] **Step 9: Prueba manual contra el bot real**

Mandarle al bot, uno por uno, y verificar la respuesta:

| Mensaje | Esperado |
|---|---|
| `2 empanadas 5000` | $5.000, descripción "2 empanadas" (hoy da $2) |
| `20k taxi y 15k almuerzo` | **dos** gastos |
| `ayer pagué 40k de gasolina` | fecha de ayer, no hoy |
| `le pagué al taxista 20k` | descripción legible |
| `ayuda` | el texto fijo, sin llamar al modelo |

---

### Task 8: Preguntar la cuenta de una factura y registrarla

**Files:**
- Modify: `src/lib/whatsapp/handle-image.ts`
- Modify: `src/lib/whatsapp/agent/turn.ts`
- Test: `src/lib/whatsapp/handle-image.test.ts`

**Interfaces:**
- Consumes: `PendingInvoice` (Task 1), `executeTool` (Task 6), `VisionResult`.
- Produces: `resolveAccountFromMessage(texto, visionAccount, accounts): string | null`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `src/lib/whatsapp/handle-image.test.ts`:

```ts
import { resolveAccountFromMessage } from './handle-image';

const CUENTAS = ['Efectivo', 'Davivienda Crédito', 'Nequi'];

describe('resolveAccountFromMessage', () => {
  it('usa el texto que vino con la imagen', () => {
    expect(resolveAccountFromMessage('con la Davivienda', null, CUENTAS)).toBe('Davivienda Crédito');
  });

  it('cae a la cuenta que detectó la visión si el texto no dice nada', () => {
    expect(resolveAccountFromMessage('', 'Nequi', CUENTAS)).toBe('Nequi');
  });

  it('el texto le gana a la visión: el usuario sabe más que la foto', () => {
    expect(resolveAccountFromMessage('fue con Nequi', 'Efectivo', CUENTAS)).toBe('Nequi');
  });

  it('devuelve null si no hay nada que resolver, para que el bot pregunte', () => {
    expect(resolveAccountFromMessage('', null, CUENTAS)).toBeNull();
  });

  it('ignora una cuenta que el usuario no tiene', () => {
    expect(resolveAccountFromMessage('con Bancolombia', null, CUENTAS)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bunx vitest run src/lib/whatsapp/handle-image.test.ts`
Expected: FAIL — `resolveAccountFromMessage is not a function`

- [ ] **Step 3: Implementar**

Agregar a `src/lib/whatsapp/handle-image.ts`:

```ts
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Resuelve con qué cuenta se pagó, en orden: lo que escribió el usuario junto a
 * la imagen, después lo que detectó la visión. El texto le gana a la visión
 * porque el usuario sabe más que la foto. Null = hay que preguntarle.
 */
export function resolveAccountFromMessage(
  texto: string,
  visionAccount: string | null,
  accounts: string[],
): string | null {
  const t = normalizar(texto || '');
  // Coincidencia por la palabra más distintiva del nombre de la cuenta
  // ("Davivienda" en "Davivienda Crédito"), para que "con la Davivienda" ande.
  const porTexto = accounts.find(a =>
    normalizar(a)
      .split(/\s+/)
      .some(palabra => palabra.length >= 4 && t.includes(palabra)),
  );
  if (porTexto) return porTexto;

  if (visionAccount) {
    const porVision = accounts.find(a => normalizar(a).includes(normalizar(visionAccount)));
    if (porVision) return porVision;
  }
  return null;
}
```

- [ ] **Step 4: Usar el texto de la imagen en el webhook**

En `src/app/api/whatsapp/webhook/route.ts`, la rama `'image'` hoy no pasa el
`body`. Agregarlo al contexto:

```ts
    after(async () => {
      await handleImageMessage(
        { userId, phone, mediaUrl, body },   // <- body nuevo
        { /* deps como estaban */ },
      );
    });
```

Y en `handle-image.ts`, ampliar `ImageContext` con `body: string`, y en la rama
`receipt`: resolver la cuenta; si es `null`, guardar la factura en `pending` y
preguntar en vez de crear el borrador.

```ts
  if (result.kind === 'receipt') {
    const cuenta = resolveAccountFromMessage(ctx.body, null, deps.accounts);
    if (!cuenta) {
      await deps.savePending({
        source: 'vision_receipt',
        cufe: null,
        supplier: result.supplier,
        date: result.date ?? deps.today(),
        total: result.total,
        items: result.items,
      });
      await deps.sendMessage(
        ctx.phone,
        `🧾 Leí tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${result.items.length} ítems). ¿Con qué cuenta la pagaste?`,
      );
      return;
    }
    const res = await deps.registerInvoice(
      {
        source: 'vision_receipt',
        cufe: null,
        supplier: result.supplier,
        date: result.date ?? deps.today(),
        total: result.total,
        items: result.items,
      },
      cuenta,
    );
    await deps.sendMessage(
      ctx.phone,
      res.ok
        ? `✅ Registré tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${res.itemsFound} ítems) en ${cuenta}.`
        : `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
    );
    return;
  }
```

Agregar a `ImageDeps`: `accounts: string[]`,
`savePending: (inv: PendingInvoice) => Promise<void>` y
`registerInvoice: (inv: PendingInvoice, accountName: string) => Promise<{ok: boolean; itemsFound: number; error?: string}>`.

- [ ] **Step 5: Crear `createInvoiceDirect`**

Es lo que reemplaza a la aprobación manual. **Se crea acá, no en la Task 9**,
porque es la Task 8 la que lo necesita para registrar.

En `src/lib/services/invoices.ts`:

```ts
/**
 * Registra una factura directamente, sin aprobación manual. Reemplaza el par
 * `approveInvoice` + pantalla: la cuenta ahora la pregunta el agente, que era
 * la única función que pesaba de ese paso.
 *
 * `classifyApprovedExpenses` se sigue llamando. Es lo que asigna el ítem de
 * presupuesto de cada línea; sin esto la factura entera entra "sin clasificar".
 */
export async function createInvoiceDirect(
  userId: string,
  invoice: PendingInvoice,
  accountName: string,
  deps: { classify?: typeof classifyApprovedExpenses } = {},
): Promise<{ ok: boolean; itemsFound: number; error?: string }> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const categorias = await categorizeInvoiceItems(
    invoice.items.map(it => ({ description: it.description })),
    categoryNames,
  );

  const createdExpenses: Array<{ id: string; description: string; categoryName: string; monthYear: string }> = [];
  for (let i = 0; i < invoice.items.length; i++) {
    const it = invoice.items[i];
    const categoria = categorias[i] ?? 'OTROS';
    const { data, error } = await supabase.rpc('upsert_monthly_expense', {
      p_user_id: userId,
      p_description: it.description,
      p_amount: it.amount,
      p_transaction_date: invoice.date,
      p_category_name: categoria,
      p_account_name: accountName,
      p_place: invoice.supplier ?? 'WhatsApp',
    });
    if (error) return { ok: false, itemsFound: 0, error: error.message };
    if (typeof data === 'string') {
      createdExpenses.push({
        id: data,
        description: it.description,
        categoryName: categoria,
        monthYear: invoice.date.slice(0, 7),
      });
    }
  }

  await supabase.from('electronic_invoices').insert({
    user_id: userId,
    cufe_code: invoice.cufe,
    source: invoice.source,
    supplier_name: invoice.supplier,
    invoice_date: invoice.date,
    total_amount: invoice.total ?? invoice.items.reduce((s, it) => s + it.amount, 0),
    items: invoice.items,
    status: 'approved',
    processed_at: new Date().toISOString(),
  });

  const clasificar = deps.classify ?? classifyApprovedExpenses;
  await clasificar(supabase, userId, createdExpenses);

  return { ok: true, itemsFound: invoice.items.length };
}
```

Cambiar `classifyApprovedExpenses` (`invoices.ts:246`) de privada a exportada.

- [ ] **Step 6: Escribir el test de que la clasificación no se perdió**

```ts
// src/lib/services/invoices.test.ts
describe('createInvoiceDirect', () => {
  it('clasifica los ítems del presupuesto, igual que hacía la aprobación', async () => {
    // El riesgo del cambio: classifyApprovedExpenses corría al aprobar. Si el
    // registro directo no lo llama, cada factura entra entera sin clasificar.
    let clasificado = false;
    const res = await createInvoiceDirect(
      'user-1',
      {
        source: 'vision_receipt',
        cufe: null,
        supplier: 'ÉXITO',
        date: '2026-08-17',
        total: 5000,
        items: [{ description: 'arroz', amount: 5000 }],
      },
      'Nequi',
      { classify: async () => { clasificado = true; } },
    );
    expect(res.ok).toBe(true);
    expect(clasificado).toBe(true);
  });
});
```

Run: `bunx vitest run src/lib/services/invoices.test.ts` → PASS

- [ ] **Step 7: Conectar `registrar_factura` en `turn.ts`**

Reemplazar el `registerInvoice` provisorio de la Task 7:

```ts
    registerInvoice: async (accountName: string) => {
      const inv = estado.pending?.invoice;
      if (!inv) return { ok: false, itemsFound: 0, error: 'no hay factura pendiente' };
      const res = await createInvoiceDirect(ctx.userId, inv, accountName);
      // Limpiar el pendiente pase lo que pase: si falló, reintentar con la misma
      // factura vieja confundiría más de lo que ayuda.
      await writeState(ctx.phone, ctx.userId, { pending: null });
      return res;
    },
```

- [ ] **Step 8: Correr los tests y verificar que pasan**

Run: `bunx vitest run`
Expected: PASS

- [ ] **Step 9: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add src/lib/whatsapp/ src/lib/services/invoices.ts src/lib/services/invoices.test.ts
git commit -m "feat(agente): registro directo de facturas, preguntando la cuenta si falta"
```

- [ ] **Step 10: Prueba manual**

| Acción | Esperado |
|---|---|
| foto de factura + "con la Davivienda" | registra sin preguntar |
| foto de factura sin texto | pregunta la cuenta; al responder "Nequi", registra |
| foto de transferencia | sigue como hoy, sin preguntar |

---

### Task 9: Eliminar la aprobación de facturas

**Files:**
- Delete: `src/app/api/invoices/[id]/approve/route.ts`
- Modify: `src/lib/services/invoices.ts`
- Modify: la UI que lista "Facturas por aprobar"

**Interfaces:**
- Consumes: `createInvoiceDirect` (Task 8), que ya reemplazó funcionalmente a `approveInvoice`.
- Produces: nada nuevo. Esta task solo borra el camino viejo.

**Por qué va última:** borrar la pantalla antes de que el agente sepa registrar
facturas dejaría facturas sin forma de entrar. La Task 8 ya la reemplazó; recién
ahora es seguro.

- [ ] **Step 1: Verificar que no queden facturas inalcanzables**

```sql
select id, cufe_code, supplier_name, status
from electronic_invoices
where status in ('pending_review', 'error');
```

Si hay filas, resolverlas **antes** de borrar la pantalla: al eliminarla quedan
sin forma de aprobarse. Las de `status='error'` con 0 ítems se borran — nunca
van a poder aprobarse porque no tienen ítems.

- [ ] **Step 2: Borrar la ruta y la UI**

```bash
rm -r src/app/api/invoices/\[id\]/approve
grep -rn "invoices/.*approve\|listDraftInvoices\|Facturas por aprobar" src/
```

Borrar el panel "Facturas por aprobar" y sus llamadas. El panel además
listaba `status='error'` — facturas que nunca se iban a poder aprobar.

`approveInvoice` y `listDraftInvoices` quedan sin llamadores: borrarlas también.
`classifyApprovedExpenses` **NO se borra** — la Task 8 la dejó como el
clasificador de ítems del registro directo.

- [ ] **Step 3: Verificar y commitear**

```bash
bunx tsc --noEmit && bunx vitest run && bunx next lint --quiet
git add -A
git commit -m "feat(facturas): registro directo, se elimina la aprobación manual"
```

- [ ] **Step 4: Desplegar, verificar Ready y probar el CUFE de punta a punta**

```bash
vercel deploy --prod --yes
vercel inspect <url> | grep status   # DEBE decir "● Ready"
```

Mandarle un CUFE real al bot: debe procesarlo, **preguntar la cuenta**,
registrarlo al responder, y aparecer en Gastos con su ítem de presupuesto
asignado. Nunca se probó el CUFE por WhatsApp de punta a punta.

---

## Planes que siguen

- **`2026-08-XX-alertas-presupuesto.md`** — cálculo desde `transactions`
  (no desde el "Real" por ítem), dedupe con `budget_alerts_sent`, mensaje
  pegado a la respuesta del bot y `BudgetAlertsPanel` en el dashboard.
- **`2026-08-XX-nit-qr-cufe.md`** — parseo de `NitFac`/`DocAdq` y el parámetro
  `nits` en los dos scrapers. Toca tres repos.
