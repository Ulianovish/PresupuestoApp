# Integración CUFE → Gastos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir pegar un CUFE dentro de "agregar gasto", procesar la factura DIAN vía el endpoint `factura-dian.vercel.app`, guardarla como borrador, y al aprobarla crear un gasto por cada ítem.

**Architecture:** PresupuestoApp actúa de orquestador: un route SSE hace proxy a `factura-dian.vercel.app` (que ya extrae items estructurados), categoriza cada ítem con IA hacia las categorías del presupuesto, y persiste un borrador en la tabla nueva `electronic_invoices` (`status='pending_review'`). El usuario revisa, elige una cuenta única y aprueba; cada ítem se inserta como gasto vía el RPC existente `upsert_monthly_expense`.

**Tech Stack:** Next.js 15 (App Router), React 19, Supabase (`@supabase/ssr`), OpenAI SDK v6, Vitest (a instalar), Tailwind/shadcn.

**Spec:** `docs/superpowers/specs/2026-05-30-cufe-integracion-gastos-design.md`

**Convención de commits:** este repo usa Husky + lint-staged. Commits en español tipo `feat:`/`fix:`/`chore:`. Package manager: **bun**.

---

## File Structure

**Crear:**
- `vitest.config.ts` — config de tests (jsdom no necesario; node env).
- `supabase/migrations/20260530000000_create_electronic_invoices.sql` — tabla + RLS + índice.
- `src/lib/dian/categorizer.ts` — `buildCategorizationPrompt`, `parseCategorizationResponse`, `categorizeInvoiceItems`.
- `src/lib/dian/categorizer.test.ts`
- `src/lib/dian/sse.ts` — `parseSSEEventLine` (parser puro de líneas SSE).
- `src/lib/dian/sse.test.ts`
- `src/lib/dian/invoice-mapper.ts` — `mapInvoiceItemToExpenseArgs` (puro).
- `src/lib/dian/invoice-mapper.test.ts`
- `src/app/api/invoices/process/route.ts` — proxy SSE + dedup + persistir + categorizar.
- `src/app/api/invoices/[id]/approve/route.ts` — crear N gastos + marcar approved.
- `src/components/organisms/CufeScanForm/CufeScanForm.tsx` — input CUFE + progreso (modo dentro del modal).
- `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx` — lista de borradores + revisión/aprobación.

**Modificar:**
- `src/types/invoices.ts` — alinear item a `total_price`, tipos de fila/estado; quitar dead types.
- `src/lib/services/invoices.ts` — reescribir contra `electronic_invoices` real.
- `src/components/organisms/ExpenseModal/ExpenseModal.tsx` — toggle "Manual | Factura (CUFE)".
- `src/app/gastos/page.tsx` — montar `PendingInvoicesPanel` + badge.
- `package.json` — scripts de test + devDeps de vitest.
- `.env.example` (o crear) — `FACTURA_DIAN_URL`, `FACTURA_DIAN_METHOD`.

**Borrar:**
- `src/lib/dian/scraper.ts` (mock + puppeteer).
- `src/app/api/invoices/cufe-to-data-stream/route.ts` (scraper local roto).
- `src/app/gastos/escanear-factura/page.tsx` (standalone, reubicado).

---

## Task 1: Infraestructura de tests (Vitest)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/dian/smoke.test.ts` (temporal, se borra al final del task)

- [ ] **Step 1: Instalar Vitest**

```bash
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Crear `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
```

- [ ] **Step 3: Añadir scripts en `package.json`**

En el bloque `"scripts"`, agregar:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Smoke test para verificar el runner**

Create `src/lib/dian/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Correr y verificar PASS**

Run: `bun run test`
Expected: 1 passed.

- [ ] **Step 6: Borrar el smoke test y commit**

```bash
rm src/lib/dian/smoke.test.ts
git add package.json vitest.config.ts bun.lock
git commit -m "chore: configurar Vitest para tests unitarios"
```

---

## Task 2: Migración tabla `electronic_invoices`

**Files:**
- Create: `supabase/migrations/20260530000000_create_electronic_invoices.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- Tabla para facturas electrónicas DIAN procesadas desde un CUFE.
-- Sirve como borrador (status) y como guarda anti-reprocesamiento (unique cufe).

CREATE TABLE IF NOT EXISTS electronic_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cufe_code TEXT NOT NULL,
    supplier_name TEXT,
    supplier_nit TEXT,
    invoice_date DATE,
    currency TEXT DEFAULT 'COP',
    subtotal NUMERIC(14,2),
    total_amount NUMERIC(14,2),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'pending_review', 'approved', 'error')),
    selected_account_name TEXT,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ
);

-- Guarda anti-reprocesamiento: un CUFE único por usuario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_electronic_invoices_user_cufe
    ON electronic_invoices(user_id, cufe_code);

CREATE INDEX IF NOT EXISTS idx_electronic_invoices_user_status
    ON electronic_invoices(user_id, status);

ALTER TABLE electronic_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propias facturas"
    ON electronic_invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias facturas"
    ON electronic_invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias facturas"
    ON electronic_invoices FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias facturas"
    ON electronic_invoices FOR DELETE
    USING (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar la migración**

Run: `bun run db:migrate` (equivale a `supabase db push`)
Expected: migración aplicada sin error. Si no hay conexión a Supabase local/remota, dejar registrado y aplicar manualmente desde el dashboard SQL.

- [ ] **Step 3: Regenerar tipos de la base de datos**

Run: `bun run db:types` (requiere `$PROJECT_ID`)
Expected: `src/types/database.ts` ahora incluye la tabla `electronic_invoices`. Si falla por falta de `PROJECT_ID`, registrarlo como pendiente y continuar (el código no depende de tipos generados gracias a los tipos manuales del Task 3).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260530000000_create_electronic_invoices.sql src/types/database.ts
git commit -m "feat: migración tabla electronic_invoices con RLS y dedup por CUFE"
```

---

## Task 3: Tipos de facturas (limpieza y alineación)

**Files:**
- Modify: `src/types/invoices.ts`

- [ ] **Step 1: Reescribir `src/types/invoices.ts` completo**

Reemplazar TODO el contenido del archivo por:

```ts
// Tipos para facturas electrónicas DIAN (CUFE)

// Estructura de item tal como la devuelve factura-dian.vercel.app
export interface InvoiceItem {
  description: string;
  code?: string;
  item_number?: number;
  unit_measure?: string;
  quantity: number;
  unit_price: number;
  iva_amount?: number;
  iva_percent?: number;
  inc_amount?: number;
  inc_percent?: number;
  total_price: number; // total de línea (OJO: no es `total`)
}

export interface InvoiceDetails {
  cufe: string;
  storeName: string;
  date: string;
  currency: string;
  nit: string;
  subtotal: number;
  total_amount: number;
}

export interface CufeProcessResult {
  success: boolean;
  invoice_details: InvoiceDetails;
  items: InvoiceItem[];
  processing_info?: {
    total_time?: number;
    items_found?: number;
    extraction_method?: string;
    [key: string]: unknown;
  };
  pdf_download?: {
    filename: string;
    content_type: string;
    base64: string;
    size_bytes: number;
    size_kb: number;
  };
  error?: string;
}

export interface SSEEvent {
  step:
    | 'init'
    | 'fetching'
    | 'captcha'
    | 'extracting'
    | 'complete'
    | 'error'
    | string;
  message?: string;
  details?: string;
  progress?: number;
  method?: string;
  download_pdf?: boolean;
  result?: CufeProcessResult;
  error?: string;
}

// --- Persistencia (tabla electronic_invoices) ---

export type InvoiceStatus =
  | 'processing'
  | 'pending_review'
  | 'approved'
  | 'error';

// Item enriquecido que guardamos en la fila (con categoría sugerida/elegida).
export interface StoredInvoiceItem extends InvoiceItem {
  suggested_category: string;
  category: string;
}

export interface ElectronicInvoice {
  id: string;
  user_id: string;
  cufe_code: string;
  supplier_name: string | null;
  supplier_nit: string | null;
  invoice_date: string | null;
  currency: string | null;
  subtotal: number | null;
  total_amount: number | null;
  items: StoredInvoiceItem[];
  status: InvoiceStatus;
  selected_account_name: string | null;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
  approved_at: string | null;
}
```

- [ ] **Step 2: Verificar compilación de tipos (habrá errores en archivos viejos — es esperado)**

Run: `bun run type-check`
Expected: errores SOLO en `src/lib/dian/scraper.ts`, `src/lib/services/invoices.ts`, `src/app/api/invoices/cufe-to-data-stream/route.ts`, `src/app/gastos/escanear-factura/page.tsx` (todos se borran/reescriben en tasks siguientes). No debe haber errores en otros archivos.

- [ ] **Step 3: Commit**

```bash
git add src/types/invoices.ts
git commit -m "refactor: alinear tipos de factura a la respuesta real (total_price, status)"
```

---

## Task 4: Parser SSE puro

**Files:**
- Create: `src/lib/dian/sse.ts`
- Test: `src/lib/dian/sse.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/dian/sse.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSSEEventLine } from './sse';

describe('parseSSEEventLine', () => {
  it('parsea una línea data: con JSON', () => {
    const line = 'data: {"step":"fetching","progress":10}';
    expect(parseSSEEventLine(line)).toEqual({ step: 'fetching', progress: 10 });
  });

  it('devuelve null para líneas que no son data:', () => {
    expect(parseSSEEventLine('')).toBeNull();
    expect(parseSSEEventLine(': keep-alive')).toBeNull();
    expect(parseSSEEventLine('event: message')).toBeNull();
  });

  it('devuelve null para JSON malformado', () => {
    expect(parseSSEEventLine('data: {no-json')).toBeNull();
  });

  it('extrae el result del evento complete', () => {
    const line =
      'data: {"step":"complete","result":{"success":true,"items":[]}}';
    const ev = parseSSEEventLine(line);
    expect(ev?.step).toBe('complete');
    expect(ev?.result?.success).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun run test src/lib/dian/sse.test.ts`
Expected: FAIL ("Cannot find module './sse'").

- [ ] **Step 3: Implementar `src/lib/dian/sse.ts`**

```ts
import type { SSEEvent } from '@/types/invoices';

/**
 * Parsea una línea de un stream SSE. Devuelve el evento si la línea es
 * `data: <json>` válido; en cualquier otro caso devuelve null.
 */
export function parseSSEEventLine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }
  try {
    return JSON.parse(line.slice(6)) as SSEEvent;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Correr el test y verificar PASS**

Run: `bun run test src/lib/dian/sse.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dian/sse.ts src/lib/dian/sse.test.ts
git commit -m "feat: parser puro de eventos SSE para factura-dian"
```

---

## Task 5: Categorizador con IA

**Files:**
- Create: `src/lib/dian/categorizer.ts`
- Test: `src/lib/dian/categorizer.test.ts`

**Categorías destino** (de `src/lib/services/expenses.ts`): `['VIVIENDA','DEUDAS','TRANSPORTE','MERCADO','OTROS']`.

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/dian/categorizer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  buildCategorizationPrompt,
  parseCategorizationResponse,
} from './categorizer';

const CATS = ['VIVIENDA', 'DEUDAS', 'TRANSPORTE', 'MERCADO', 'OTROS'];

describe('buildCategorizationPrompt', () => {
  it('incluye las categorías y las descripciones', () => {
    const prompt = buildCategorizationPrompt(
      [{ description: 'Arroz 1kg' }, { description: 'Gasolina' }],
      CATS,
    );
    expect(prompt).toContain('MERCADO');
    expect(prompt).toContain('Arroz 1kg');
    expect(prompt).toContain('Gasolina');
  });
});

describe('parseCategorizationResponse', () => {
  it('mapea categorías válidas por índice', () => {
    const raw = JSON.stringify({ categories: ['MERCADO', 'TRANSPORTE'] });
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'MERCADO',
      'TRANSPORTE',
    ]);
  });

  it('reemplaza categorías inválidas por OTROS', () => {
    const raw = JSON.stringify({ categories: ['COMIDA', 'TRANSPORTE'] });
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'OTROS',
      'TRANSPORTE',
    ]);
  });

  it('rellena con OTROS si faltan elementos', () => {
    const raw = JSON.stringify({ categories: ['MERCADO'] });
    expect(parseCategorizationResponse(raw, 3, CATS)).toEqual([
      'MERCADO',
      'OTROS',
      'OTROS',
    ]);
  });

  it('devuelve todo OTROS si el contenido es null o inválido', () => {
    expect(parseCategorizationResponse(null, 2, CATS)).toEqual([
      'OTROS',
      'OTROS',
    ]);
    expect(parseCategorizationResponse('no-json', 2, CATS)).toEqual([
      'OTROS',
      'OTROS',
    ]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun run test src/lib/dian/categorizer.test.ts`
Expected: FAIL ("Cannot find module './categorizer'").

- [ ] **Step 3: Implementar `src/lib/dian/categorizer.ts`**

```ts
import OpenAI from 'openai';

const FALLBACK = 'OTROS';

export function buildCategorizationPrompt(
  items: Array<{ description: string }>,
  categories: string[],
): string {
  const list = items
    .map((it, i) => `${i + 1}. ${it.description}`)
    .join('\n');
  return [
    'Eres un asistente de finanzas personales. Clasifica cada ítem de una',
    'factura en EXACTAMENTE una de estas categorías:',
    categories.join(', ') + '.',
    '',
    'Ítems:',
    list,
    '',
    'Responde SOLO con JSON: {"categories": ["CAT1", "CAT2", ...]} en el',
    'mismo orden y con la misma cantidad de ítems. Usa solo las categorías',
    'listadas; si dudas, usa OTROS.',
  ].join('\n');
}

/**
 * Valida la respuesta cruda del modelo. Garantiza un array de longitud
 * `itemCount` con categorías válidas; cualquier valor inválido/faltante → OTROS.
 */
export function parseCategorizationResponse(
  content: string | null,
  itemCount: number,
  categories: string[],
): string[] {
  const result: string[] = new Array(itemCount).fill(FALLBACK);
  if (!content) return result;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return result;
  }
  const cats = (parsed as { categories?: unknown })?.categories;
  if (!Array.isArray(cats)) return result;
  const valid = new Set(categories);
  for (let i = 0; i < itemCount; i++) {
    const c = cats[i];
    if (typeof c === 'string' && valid.has(c)) {
      result[i] = c;
    }
  }
  return result;
}

/**
 * Categoriza los ítems con OpenAI. Ante cualquier error devuelve todo OTROS.
 */
export async function categorizeInvoiceItems(
  items: Array<{ description: string }>,
  categories: string[],
): Promise<string[]> {
  if (items.length === 0) return [];
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_CATEGORIZE_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'user', content: buildCategorizationPrompt(items, categories) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });
    const content = completion.choices[0]?.message?.content ?? null;
    return parseCategorizationResponse(content, items.length, categories);
  } catch (error) {
    console.error('Error categorizando items con IA:', error);
    return new Array(items.length).fill(FALLBACK);
  }
}
```

- [ ] **Step 4: Correr el test y verificar PASS**

Run: `bun run test src/lib/dian/categorizer.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dian/categorizer.ts src/lib/dian/categorizer.test.ts
git commit -m "feat: categorizador de items de factura con OpenAI y fallback OTROS"
```

---

## Task 6: Mapper item → argumentos del RPC

**Files:**
- Create: `src/lib/dian/invoice-mapper.ts`
- Test: `src/lib/dian/invoice-mapper.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/dian/invoice-mapper.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mapInvoiceItemToExpenseArgs } from './invoice-mapper';
import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

const invoice = {
  invoice_date: '2026-05-15',
  supplier_name: 'Supermercado XYZ',
} as ElectronicInvoice;

const item = {
  description: 'Arroz 1kg',
  quantity: 2,
  unit_price: 2500,
  total_price: 5000,
  suggested_category: 'MERCADO',
  category: 'MERCADO',
} as StoredInvoiceItem;

describe('mapInvoiceItemToExpenseArgs', () => {
  it('usa total_price como amount y el proveedor como place', () => {
    const args = mapInvoiceItemToExpenseArgs(
      item,
      invoice,
      'user-1',
      'TC Falabella',
    );
    expect(args).toEqual({
      p_user_id: 'user-1',
      p_description: 'Arroz 1kg',
      p_amount: 5000,
      p_transaction_date: '2026-05-15',
      p_category_name: 'MERCADO',
      p_account_name: 'TC Falabella',
      p_place: 'Supermercado XYZ',
    });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `bun run test src/lib/dian/invoice-mapper.test.ts`
Expected: FAIL ("Cannot find module './invoice-mapper'").

- [ ] **Step 3: Implementar `src/lib/dian/invoice-mapper.ts`**

```ts
import type { ElectronicInvoice, StoredInvoiceItem } from '@/types/invoices';

export interface UpsertExpenseArgs {
  p_user_id: string;
  p_description: string;
  p_amount: number;
  p_transaction_date: string;
  p_category_name: string;
  p_account_name: string;
  p_place: string;
}

/**
 * Mapea un ítem de factura a los argumentos del RPC `upsert_monthly_expense`.
 * El total de línea viene en `total_price` (no `total`).
 */
export function mapInvoiceItemToExpenseArgs(
  item: StoredInvoiceItem,
  invoice: ElectronicInvoice,
  userId: string,
  accountName: string,
): UpsertExpenseArgs {
  return {
    p_user_id: userId,
    p_description: item.description,
    p_amount: item.total_price,
    p_transaction_date: invoice.invoice_date ?? '',
    p_category_name: item.category,
    p_account_name: accountName,
    p_place: invoice.supplier_name ?? '',
  };
}
```

- [ ] **Step 4: Correr el test y verificar PASS**

Run: `bun run test src/lib/dian/invoice-mapper.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dian/invoice-mapper.ts src/lib/dian/invoice-mapper.test.ts
git commit -m "feat: mapper de item de factura a argumentos de upsert_monthly_expense"
```

---

## Task 7: Reescribir el servicio de facturas

**Files:**
- Modify (reescribir completo): `src/lib/services/invoices.ts`

- [ ] **Step 1: Reemplazar TODO el contenido de `src/lib/services/invoices.ts`**

```ts
// Servicio para gestionar facturas electrónicas DIAN (tabla electronic_invoices)

import { createClient } from '@/lib/supabase/server';
import { mapInvoiceItemToExpenseArgs } from '@/lib/dian/invoice-mapper';
import type {
  ElectronicInvoice,
  StoredInvoiceItem,
} from '@/types/invoices';

/** Busca una factura por CUFE (guarda anti-reprocesamiento). */
export async function getInvoiceByCufe(
  userId: string,
  cufe: string,
): Promise<ElectronicInvoice | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('user_id', userId)
    .eq('cufe_code', cufe)
    .maybeSingle();
  return (data as ElectronicInvoice) ?? null;
}

/** Crea la fila en estado processing. Devuelve el id. */
export async function createProcessingInvoice(
  userId: string,
  cufe: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('electronic_invoices')
    .insert({ user_id: userId, cufe_code: cufe, status: 'processing' })
    .select('id')
    .single();
  if (error) {
    console.error('Error creando factura en processing:', error);
    return null;
  }
  return data.id;
}

/** Marca la factura como error con un mensaje. */
export async function markInvoiceError(
  invoiceId: string,
  message: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('electronic_invoices')
    .update({ status: 'error', error_message: message })
    .eq('id', invoiceId);
}

/** Guarda los datos extraídos + items categorizados y pasa a pending_review. */
export async function saveProcessedInvoice(
  invoiceId: string,
  data: {
    supplierName: string;
    supplierNit: string;
    invoiceDate: string;
    currency: string;
    subtotal: number;
    totalAmount: number;
    items: StoredInvoiceItem[];
    processingTimeMs: number;
  },
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('electronic_invoices')
    .update({
      supplier_name: data.supplierName,
      supplier_nit: data.supplierNit,
      invoice_date: data.invoiceDate,
      currency: data.currency,
      subtotal: data.subtotal,
      total_amount: data.totalAmount,
      items: data.items,
      processing_time_ms: data.processingTimeMs,
      status: 'pending_review',
      processed_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

/** Lista facturas en pending_review o error del usuario. */
export async function listDraftInvoices(
  userId: string,
): Promise<ElectronicInvoice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending_review', 'error'])
    .order('created_at', { ascending: false });
  return (data as ElectronicInvoice[]) ?? [];
}

/**
 * Aprueba una factura: crea un gasto por ítem vía upsert_monthly_expense y
 * marca la factura como approved.
 */
export async function approveInvoice(
  userId: string,
  invoiceId: string,
  accountName: string,
  categoryOverrides?: Record<number, string>,
): Promise<{ success: boolean; created: number; error?: string }> {
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('user_id', userId)
    .single();

  if (error || !invoice) {
    return { success: false, created: 0, error: 'Factura no encontrada' };
  }
  if ((invoice as ElectronicInvoice).status !== 'pending_review') {
    return {
      success: false,
      created: 0,
      error: 'La factura no está pendiente de revisión',
    };
  }

  const typed = invoice as ElectronicInvoice;
  const items = (typed.items || []).map((it, idx) => ({
    ...it,
    category: categoryOverrides?.[idx] ?? it.category,
  }));

  let created = 0;
  for (const item of items) {
    const args = mapInvoiceItemToExpenseArgs(item, typed, userId, accountName);
    const { error: rpcError } = await supabase.rpc(
      'upsert_monthly_expense',
      args,
    );
    if (rpcError) {
      return {
        success: false,
        created,
        error: `Error creando gasto "${item.description}": ${rpcError.message}`,
      };
    }
    created++;
  }

  await supabase
    .from('electronic_invoices')
    .update({
      status: 'approved',
      selected_account_name: accountName,
      items,
      approved_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  return { success: true, created };
}
```

- [ ] **Step 2: Verificar tipos (solo deben quedar errores en archivos a borrar)**

Run: `bun run type-check`
Expected: errores solo en `scraper.ts`, `cufe-to-data-stream/route.ts`, `escanear-factura/page.tsx` (se borran en Task 11).

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/invoices.ts
git commit -m "refactor: servicio de facturas contra electronic_invoices real"
```

---

## Task 8: Route de procesamiento (proxy SSE + persistir)

**Files:**
- Create: `src/app/api/invoices/process/route.ts`

- [ ] **Step 1: Implementar `src/app/api/invoices/process/route.ts`**

```ts
// Route SSE: recibe un CUFE, hace proxy a factura-dian.vercel.app, categoriza
// los items con IA y persiste un borrador en electronic_invoices.
// GET /api/invoices/process?cufe=...

import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import {
  getInvoiceByCufe,
  createProcessingInvoice,
  markInvoiceError,
  saveProcessedInvoice,
} from '@/lib/services/invoices';
import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { parseSSEEventLine } from '@/lib/dian/sse';
import { EXPENSE_CATEGORIES } from '@/lib/services/expenses';
import type {
  CufeProcessResult,
  StoredInvoiceItem,
} from '@/types/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function send(
  controller: ReadableStreamDefaultController,
  data: Record<string, unknown>,
) {
  controller.enqueue(
    new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`),
  );
}

export async function GET(request: NextRequest) {
  const cufe = request.nextUrl.searchParams.get('cufe')?.trim();

  if (!cufe) {
    return Response.json({ error: 'El parámetro cufe es requerido' }, {
      status: 400,
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }
  const userId = user.id;

  // Dedup: si ya existe, no reprocesar.
  const existing = await getInvoiceByCufe(userId, cufe);
  if (existing) {
    return Response.json(
      {
        error: 'Esta factura ya fue procesada',
        invoiceId: existing.id,
        status: existing.status,
      },
      { status: 409 },
    );
  }

  const baseUrl =
    process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';

  const stream = new ReadableStream({
    async start(controller) {
      const startTime = Date.now();
      const invoiceId = await createProcessingInvoice(userId, cufe);
      if (!invoiceId) {
        send(controller, { step: 'error', error: 'No se pudo crear el borrador' });
        controller.close();
        return;
      }

      try {
        const upstreamUrl = `${baseUrl}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
          cufe,
        )}&method=${method}&download-pdf=false`;

        const upstream = await fetch(upstreamUrl, {
          headers: { Accept: 'text/event-stream' },
        });
        if (!upstream.ok || !upstream.body) {
          throw new Error(`factura-dian respondió ${upstream.status}`);
        }

        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let result: CufeProcessResult | null = null;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const event = parseSSEEventLine(line);
            if (!event) continue;

            // Passthrough de progreso al cliente.
            send(controller, event as Record<string, unknown>);

            if (event.step === 'complete' && event.result) {
              result = event.result;
            }
            if (event.step === 'error') {
              throw new Error(event.error || 'Error en factura-dian');
            }
          }
        }

        if (!result || !result.success) {
          throw new Error(result?.error || 'No se obtuvieron datos');
        }

        // Categorizar con IA.
        send(controller, {
          step: 'categorizing',
          message: 'Clasificando ítems con IA...',
          progress: 95,
        });
        const categories = await categorizeInvoiceItems(
          result.items.map(it => ({ description: it.description })),
          [...EXPENSE_CATEGORIES],
        );
        const storedItems: StoredInvoiceItem[] = result.items.map(
          (it, idx) => ({
            ...it,
            suggested_category: categories[idx] ?? 'OTROS',
            category: categories[idx] ?? 'OTROS',
          }),
        );

        await saveProcessedInvoice(invoiceId, {
          supplierName: result.invoice_details.storeName,
          supplierNit: result.invoice_details.nit,
          invoiceDate: result.invoice_details.date,
          currency: result.invoice_details.currency,
          subtotal: result.invoice_details.subtotal,
          totalAmount: result.invoice_details.total_amount,
          items: storedItems,
          processingTimeMs: Date.now() - startTime,
        });

        send(controller, {
          step: 'saved',
          message: 'Factura guardada como borrador',
          progress: 100,
          invoiceId,
          items_found: storedItems.length,
        });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markInvoiceError(invoiceId, message);
        send(controller, { step: 'error', error: message, invoiceId });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `bun run type-check`
Expected: sin errores nuevos en este archivo (siguen solo los de los archivos a borrar).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/process/route.ts
git commit -m "feat: route SSE de proceso de CUFE (proxy + categorizar + persistir)"
```

---

## Task 9: Route de aprobación

**Files:**
- Create: `src/app/api/invoices/[id]/approve/route.ts`

- [ ] **Step 1: Implementar `src/app/api/invoices/[id]/approve/route.ts`**

```ts
// POST /api/invoices/[id]/approve
// Body: { accountName: string, categoryOverrides?: Record<number, string> }

import { NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { approveInvoice } from '@/lib/services/invoices';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: { accountName?: string; categoryOverrides?: Record<number, string> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 });
  }

  if (!body.accountName) {
    return Response.json(
      { error: 'accountName es requerido' },
      { status: 400 },
    );
  }

  const result = await approveInvoice(
    user.id,
    id,
    body.accountName,
    body.categoryOverrides,
  );

  if (!result.success) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  return Response.json({ success: true, created: result.created });
}
```

- [ ] **Step 2: Verificar tipos**

Run: `bun run type-check`
Expected: sin errores nuevos en este archivo.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/\[id\]/approve/route.ts
git commit -m "feat: route de aprobación de factura (crea N gastos)"
```

---

## Task 10: UI — formulario CUFE dentro del modal

**Files:**
- Create: `src/components/organisms/CufeScanForm/CufeScanForm.tsx`
- Modify: `src/components/organisms/ExpenseModal/ExpenseModal.tsx`

- [ ] **Step 1: Crear `src/components/organisms/CufeScanForm/CufeScanForm.tsx`**

```tsx
'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { parseSSEEventLine } from '@/lib/dian/sse';

interface CufeScanFormProps {
  onSaved: () => void; // refrescar panel de pendientes al terminar
}

export default function CufeScanForm({ onSaved }: CufeScanFormProps) {
  const [cufe, setCufe] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const handleProcess = async () => {
    const value = cufe.trim();
    if (!value) {
      toast.error('Ingresa un código CUFE');
      return;
    }
    setProcessing(true);
    setProgress(0);
    setMessage('Iniciando...');

    try {
      const res = await fetch(
        `/api/invoices/process?cufe=${encodeURIComponent(value)}`,
      );

      if (res.status === 409) {
        toast.error('Esta factura ya fue procesada');
        setProcessing(false);
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let saved = false;

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSSEEventLine(line);
          if (!event) continue;
          if (typeof event.progress === 'number') setProgress(event.progress);
          if (event.message) setMessage(event.message);
          if (event.step === 'saved') {
            saved = true;
            toast.success('Factura guardada como borrador para aprobar');
          }
          if (event.step === 'error') {
            throw new Error(event.error || 'Error procesando factura');
          }
        }
      }

      if (saved) {
        setCufe('');
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error procesando');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Código CUFE</label>
        <input
          value={cufe}
          onChange={e => setCufe(e.target.value)}
          disabled={processing}
          placeholder="Pega el código CUFE de la factura DIAN..."
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 font-mono text-sm text-white"
        />
      </div>

      {processing && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{message}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            El proceso puede tardar ~1 minuto. Quedará como borrador para aprobar.
          </p>
        </div>
      )}

      <Button onClick={handleProcess} disabled={processing || !cufe.trim()}>
        {processing ? 'Procesando...' : 'Procesar factura'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Añadir el toggle de modo en `ExpenseModal.tsx`**

En `src/components/organisms/ExpenseModal/ExpenseModal.tsx`:

1. Añadir imports al inicio (junto a los existentes):

```tsx
import { useState } from 'react';
import CufeScanForm from '@/components/organisms/CufeScanForm/CufeScanForm';
```

2. Añadir a `ExpenseModalProps` la prop opcional:

```tsx
  onCufeSaved?: () => void;
```

3. Dentro del componente, antes del `return`, añadir estado de modo:

```tsx
  const [mode, setMode] = useState<'manual' | 'cufe'>('manual');
```

4. Dentro de `<DialogContent>`, justo después de `</DialogHeader>`, insertar el selector de modo y el render condicional. Reemplazar el bloque del formulario manual existente para que quede envuelto así:

```tsx
        {!isEditing && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode('cufe')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === 'cufe'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Factura (CUFE)
            </button>
          </div>
        )}

        {mode === 'cufe' && !isEditing ? (
          <CufeScanForm
            onSaved={() => {
              onCufeSaved?.();
              onClose();
            }}
          />
        ) : (
          /* ...aquí queda el <form>/ExpenseFormFields existente sin cambios... */
          <ExistingManualForm />
        )}
```

> NOTA para el implementador: `<ExistingManualForm />` es un marcador — NO crear ese componente. Mantené el JSX del formulario manual que ya existe en el archivo (el `<form>` con `ExpenseFormFields` y los botones) exactamente como está, solo movido dentro de la rama `else` del ternario. Revisá el archivo completo antes de editar para envolver el bloque correcto.

- [ ] **Step 3: Verificar tipos y lint**

Run: `bun run type-check && bun run lint`
Expected: sin errores nuevos en `CufeScanForm.tsx` ni `ExpenseModal.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/organisms/CufeScanForm/CufeScanForm.tsx src/components/organisms/ExpenseModal/ExpenseModal.tsx
git commit -m "feat: modo Factura (CUFE) dentro del modal de agregar gasto"
```

---

## Task 11: UI — panel de facturas por aprobar

**Files:**
- Create: `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx`
- Modify: `src/app/gastos/page.tsx`

- [ ] **Step 1: Crear `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx`**

```tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import {
  ACCOUNT_TYPES,
  EXPENSE_CATEGORIES,
  formatCurrency,
} from '@/lib/services/expenses';
import type { ElectronicInvoice } from '@/types/invoices';

interface PendingInvoicesPanelProps {
  refreshToken: number; // cambia para forzar recarga
  onApproved: () => void; // refrescar la tabla de gastos
}

export default function PendingInvoicesPanel({
  refreshToken,
  onApproved,
}: PendingInvoicesPanelProps) {
  const [invoices, setInvoices] = useState<ElectronicInvoice[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [account, setAccount] = useState<string>(ACCOUNT_TYPES[0]);
  const [cats, setCats] = useState<Record<number, string>>({});
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/invoices/pending');
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const openInvoice = (inv: ElectronicInvoice) => {
    setOpenId(inv.id);
    setAccount(ACCOUNT_TYPES[0]);
    const initial: Record<number, string> = {};
    inv.items.forEach((it, idx) => (initial[idx] = it.category));
    setCats(initial);
  };

  const approve = async (inv: ElectronicInvoice) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: account, categoryOverrides: cats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error aprobando');
      toast.success(`${data.created} gastos creados`);
      setOpenId(null);
      await load();
      onApproved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error aprobando');
    } finally {
      setApproving(false);
    }
  };

  if (invoices.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/20 p-4">
      <h3 className="text-amber-300 font-medium mb-3">
        Facturas por aprobar ({invoices.length})
      </h3>

      <div className="space-y-2">
        {invoices.map(inv => (
          <div key={inv.id} className="rounded-md bg-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm">
                  {inv.supplier_name || 'Proveedor desconocido'}
                </p>
                <p className="text-xs text-slate-400">
                  {inv.invoice_date} ·{' '}
                  {inv.total_amount != null
                    ? formatCurrency(inv.total_amount)
                    : '—'}{' '}
                  · {inv.items.length} ítems
                  {inv.status === 'error' && (
                    <span className="text-red-400"> · error</span>
                  )}
                </p>
              </div>
              {inv.status === 'pending_review' && (
                <Button
                  onClick={() =>
                    openId === inv.id ? setOpenId(null) : openInvoice(inv)
                  }
                >
                  {openId === inv.id ? 'Cerrar' : 'Revisar'}
                </Button>
              )}
            </div>

            {openId === inv.id && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Cuenta (toda la factura)
                  </label>
                  <select
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-sm text-white"
                  >
                    {ACCOUNT_TYPES.map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  {inv.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm bg-slate-900 rounded px-2 py-1"
                    >
                      <span className="flex-1 text-slate-200">
                        {it.description}
                      </span>
                      <span className="text-slate-400">
                        {formatCurrency(it.total_price)}
                      </span>
                      <select
                        value={cats[idx]}
                        onChange={e =>
                          setCats(prev => ({ ...prev, [idx]: e.target.value }))
                        }
                        className="rounded bg-slate-800 border border-slate-700 px-1 py-0.5 text-xs text-white"
                      >
                        {EXPENSE_CATEGORIES.map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <Button onClick={() => approve(inv)} disabled={approving}>
                  {approving ? 'Aprobando...' : 'Aprobar y crear gastos'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crear el route `GET /api/invoices/pending`**

Create `src/app/api/invoices/pending/route.ts`:

```ts
import { createClient } from '@/lib/supabase/server';
import { listDraftInvoices } from '@/lib/services/invoices';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 });
  }
  const invoices = await listDraftInvoices(user.id);
  return Response.json({ invoices });
}
```

- [ ] **Step 3: Montar el panel en `src/app/gastos/page.tsx`**

1. Añadir import:

```tsx
import PendingInvoicesPanel from '@/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel';
```

2. Añadir estado de refresco (junto a los otros `useState`):

```tsx
  const [invoiceRefresh, setInvoiceRefresh] = useState(0);
```

3. Renderizar el panel encima de la tabla de gastos (dentro del JSX, antes de `<ExpenseTable .../>`):

```tsx
      <PendingInvoicesPanel
        refreshToken={invoiceRefresh}
        onApproved={refreshExpenses}
      />
```

4. Pasar `onCufeSaved` al `ExpenseModal` para refrescar el panel cuando se guarde un borrador:

```tsx
        onCufeSaved={() => setInvoiceRefresh(n => n + 1)}
```

- [ ] **Step 4: Verificar tipos, lint y build**

Run: `bun run type-check && bun run lint`
Expected: sin errores en los archivos nuevos/modificados.

- [ ] **Step 5: Commit**

```bash
git add src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx src/app/api/invoices/pending/route.ts src/app/gastos/page.tsx
git commit -m "feat: panel de facturas por aprobar en /gastos"
```

---

## Task 12: Limpieza del andamiaje roto + env + verificación final

**Files:**
- Delete: `src/lib/dian/scraper.ts`
- Delete: `src/app/api/invoices/cufe-to-data-stream/route.ts` (y su carpeta)
- Delete: `src/app/gastos/escanear-factura/page.tsx` (y su carpeta)
- Modify/Create: `.env.example`

- [ ] **Step 1: Borrar el código muerto**

```bash
git rm src/lib/dian/scraper.ts
git rm src/app/api/invoices/cufe-to-data-stream/route.ts
git rm src/app/gastos/escanear-factura/page.tsx
rmdir src/app/api/invoices/cufe-to-data-stream src/app/gastos/escanear-factura 2>/dev/null || true
```

- [ ] **Step 2: Buscar referencias colgantes a lo borrado o a la key expuesta**

Run: `grep -rn "scraper\|cufe-to-data-stream\|escanear-factura\|NEXT_PUBLIC_CAPTCHA_API_KEY\|scrapeDianInvoice\|extractInvoiceDataFromPdf" src/`
Expected: **sin resultados**. Si aparece alguno, eliminar/ajustar esa referencia (p. ej. un link a `/gastos/escanear-factura` o un import muerto).

- [ ] **Step 3: Documentar variables de entorno en `.env.example`**

Añadir (o crear el archivo con) estas líneas:

```
# Endpoint del motor de facturas DIAN (proxy CUFE)
FACTURA_DIAN_URL=https://factura-dian.vercel.app
# Método de extracción: python (default) | openai
FACTURA_DIAN_METHOD=python
# Modelo para categorizar items (opcional)
OPENAI_CATEGORIZE_MODEL=gpt-4o-mini
```

- [ ] **Step 4: Verificación completa**

Run: `bun run test && bun run type-check && bun run lint && bun run build`
Expected: tests passed, type-check sin errores, lint limpio, build exitoso.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: eliminar scraper local roto y documentar env de CUFE"
```

---

## Verificación manual (post-implementación)

1. Configurar `FACTURA_DIAN_URL` en `.env.local` y aplicar la migración.
2. `bun run dev` → ir a `/gastos` → botón flotante → pestaña "Factura (CUFE)".
3. Pegar un CUFE real → ver barra de progreso → al terminar, aparece en "Facturas por aprobar".
4. "Revisar" → elegir cuenta, ajustar categorías → "Aprobar y crear gastos" → verificar N gastos en la tabla del mes.
5. Reintentar el mismo CUFE → debe rechazar con "ya fue procesada" (409).
6. (Diferido) Cambiar `FACTURA_DIAN_METHOD=openai` y comparar calidad de extracción de items.

## Notas de alcance (backlog, NO implementar ahora)

- Archivar PDF en Supabase Storage (`download-pdf=true` + bucket).
- Consolidación con import de Excel (evitar duplicar gasto factura vs extracto).
- Job 100% en background (Vercel Queues) para true fire-and-forget.
