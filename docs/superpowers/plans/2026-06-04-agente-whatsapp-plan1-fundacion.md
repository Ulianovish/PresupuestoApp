# Plan 1 — Fundación: motor CUFE reusable + procesamiento en background con progreso visible

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el procesamiento del CUFE a segundo plano (no atado a la pestaña) sin perder la visualización en vivo del progreso: el procesamiento corre en `after()` y escribe su avance en la fila; la UI lo muestra por polling. El usuario decide esperar y ver, o cerrar y dejarlo terminar solo.

**Architecture:** Hoy `/api/invoices/process` (GET, SSE) corre todo dentro del stream que el navegador sostiene; si se cierra la pestaña, la fila queda atascada en `processing`. Lo desacoplamos: extraemos la orquestación a `src/lib/dian/process-invoice.ts` (`prepareInvoiceProcessing` rápido + `runInvoiceProcessing` pesado con un callback `onProgress`). El route pasa a **POST**: `prepare` síncrono, devuelve `invoiceId`, y corre `runInvoiceProcessing` en `after()` (Fluid Compute lo mantiene vivo). El `onProgress` **persiste el avance** (porcentaje + mensaje) en la fila. La bandeja muestra las filas `processing` con una **barra en vivo** vía polling y termina sola cuando la fila pasa a `pending_review`. `runInvoiceProcessing` conserva la resiliencia actual del route (reintento con backoff ante errores transitorios, detección del error real del upstream, cierre prematuro) y la categorización con las **categorías activas del usuario**. Es la función que el agente de WhatsApp reusará (Plan 3).

**Tech Stack:** Next.js 15 App Router (`after` de `next/server`), TypeScript, Supabase (cliente server por cookie), Vitest, MiniMax (categorización, ya existente).

**Nota de base:** Este plan parte del route ACTUAL (`main` con los commits de resiliencia `de77c02` + `f063556`), no de una versión previa. Toda esa lógica (retry, `event.error`, "closed prematurely", categorías del usuario) se preserva en la función extraída.

**Nota de alcance:** Este plan NO cambia `cufe_code`/`source` de `electronic_invoices` (eso es Plan 4, para facturas por visión) ni introduce el cliente service-role (Plan 3). El cliente por cookie funciona dentro de `after()` porque conserva el contexto de la request.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `supabase/migrations/20260610000000_add_invoice_progress.sql` | Agrega `progress_percent` + `progress_message` a `electronic_invoices` | Crear |
| `src/types/invoices.ts` | `ElectronicInvoice` gana `progress_percent` / `progress_message` | Modificar |
| `src/lib/dian/process-invoice.ts` | `prepareInvoiceProcessing` + `runInvoiceProcessing(onProgress)` con retry/error/categorías | Crear |
| `src/lib/dian/process-invoice.test.ts` | Tests de `runInvoiceProcessing` (fetch + servicios + categorizer mockeados) | Crear |
| `src/lib/services/invoices.ts` | `updateInvoiceProgress`; `resolveUserCategoryNames`; `listDraftInvoices` incluye `processing` | Modificar |
| `src/app/api/invoices/process/route.ts` | GET/SSE → POST: prepare → after(run con onProgress que persiste) → devuelve `invoiceId` | Modificar (reemplazo) |
| `src/components/organisms/CufeScanForm/CufeScanForm.tsx` | POST (sin SSE); cierra al instante con mensaje "procesando" | Modificar (reemplazo) |
| `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx` | Filas `processing` con barra de progreso en vivo + polling cada 1.5s | Modificar |

---

## Task 1: Migración — columnas de progreso

**Files:**
- Create: `supabase/migrations/20260610000000_add_invoice_progress.sql`

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260610000000_add_invoice_progress.sql`:

```sql
-- Progreso visible del procesamiento de una factura (CUFE) corriendo en
-- background. La UI lo lee por polling para mostrar una barra en vivo sin
-- depender de una conexión SSE abierta.
ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS progress_percent integer,
  ADD COLUMN IF NOT EXISTS progress_message text;
```

- [ ] **Step 2: Aplicar la migración a Supabase**

Aplicar con el MCP de Supabase (`apply_migration`, name `add_invoice_progress`) o, si se usa CLI, `bun supabase db push`. Verificar que las columnas existen:

Run (vía MCP `execute_sql` o psql): `SELECT column_name FROM information_schema.columns WHERE table_name='electronic_invoices' AND column_name IN ('progress_percent','progress_message');`
Expected: 2 filas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610000000_add_invoice_progress.sql
git commit --no-verify -m "feat: columnas de progreso en electronic_invoices"
```

---

## Task 2: Tipo `ElectronicInvoice` gana campos de progreso

**Files:**
- Modify: `src/types/invoices.ts` (interface `ElectronicInvoice`, tras `processing_time_ms`)

- [ ] **Step 1: Agregar los campos al tipo**

En `src/types/invoices.ts`, dentro de `interface ElectronicInvoice`, después de la línea `processing_time_ms: number | null;` agregar:

```ts
  progress_percent: number | null;
  progress_message: string | null;
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/invoices.ts
git commit --no-verify -m "feat: campos de progreso en el tipo ElectronicInvoice"
```

---

## Task 3: Servicios — progreso, categorías de usuario, bandeja con `processing`

**Files:**
- Modify: `src/lib/services/invoices.ts`

- [ ] **Step 1: Agregar `updateInvoiceProgress` y `resolveUserCategoryNames`**

En `src/lib/services/invoices.ts`, después de la función `resetInvoiceToProcessing` (y antes de `markInvoiceError`), agregar:

```ts
/** Persiste el avance del procesamiento para que la UI lo muestre por polling. */
export async function updateInvoiceProgress(
  invoiceId: string,
  percent: number,
  message: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('electronic_invoices')
    .update({ progress_percent: percent, progress_message: message })
    .eq('id', invoiceId);
}

/**
 * Devuelve las categorías activas del usuario (mismas que el tab de presupuesto).
 * Si no hay o falla la consulta, cae a EXPENSE_CATEGORIES.
 */
export async function resolveUserCategoryNames(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('categories')
    .select('name')
    .eq('is_active', true)
    .order('name');
  if (data && data.length > 0) {
    return data.map(c => c.name as string);
  }
  return [...EXPENSE_CATEGORIES];
}
```

Y agregar el import de `EXPENSE_CATEGORIES` al inicio del archivo (junto a los otros imports `@/`):

```ts
import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
```

- [ ] **Step 2: `listDraftInvoices` incluye `processing`**

En la función `listDraftInvoices`, reemplazar:

```ts
    .in('status', ['pending_review', 'error'])
```

por:

```ts
    .in('status', ['processing', 'pending_review', 'error'])
```

Y su comentario JSDoc de `/** Lista facturas en pending_review o error del usuario. */` a `/** Lista facturas activas del usuario (processing, pending_review o error). */`.

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/invoices.ts
git commit --no-verify -m "feat: updateInvoiceProgress, resolveUserCategoryNames, bandeja con processing"
```

---

## Task 4: Extraer `prepareInvoiceProcessing` + `runInvoiceProcessing` (con resiliencia)

**Files:**
- Create: `src/lib/dian/process-invoice.ts`
- Test: `src/lib/dian/process-invoice.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/dian/process-invoice.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runInvoiceProcessing } from './process-invoice';

vi.mock('@/lib/services/invoices', () => ({
  saveProcessedInvoice: vi.fn(async () => undefined),
  markInvoiceError: vi.fn(async () => undefined),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(
    async (items: Array<{ description: string }>) => items.map(() => 'MERCADO'),
  ),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { markInvoiceError, saveProcessedInvoice } from '@/lib/services/invoices';

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(enc.encode(line));
      controller.close();
    },
  });
}

const sse = (obj: Record<string, unknown>) => `data: ${JSON.stringify(obj)}\n\n`;

const COMPLETE_RESULT = {
  success: true,
  invoice_details: {
    cufe: 'CUFE123',
    storeName: 'D1',
    date: '2026-06-01',
    currency: 'COP',
    nit: '900',
    subtotal: 10000,
    total_amount: 12000,
  },
  items: [
    { description: 'Arroz', quantity: 1, unit_price: 5000, total_price: 5000, total_with_tax: 6000 },
    { description: 'Leche', quantity: 1, unit_price: 5000, total_price: 5000, total_with_tax: 6000 },
  ],
};

describe('runInvoiceProcessing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('procesa, reporta progreso, categoriza con las categorías dadas y persiste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: sseStream([
          sse({ step: 'fetching', progress: 30, message: 'Descargando...' }),
          sse({ step: 'complete', progress: 100, result: COMPLETE_RESULT }),
        ]),
      })),
    );
    const onProgress = vi.fn();

    const res = await runInvoiceProcessing('inv-1', 'CUFE123', {
      categoryNames: ['MERCADO', 'OTROS'],
      onProgress,
    });

    expect(res).toEqual({ ok: true, itemsFound: 2 });
    expect(onProgress).toHaveBeenCalled();
    expect(categorizeInvoiceItems).toHaveBeenCalledWith(
      [{ description: 'Arroz' }, { description: 'Leche' }],
      ['MERCADO', 'OTROS'],
    );
    expect(saveProcessedInvoice).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ supplierName: 'D1', totalAmount: 12000 }),
    );
    const savedItems = (saveProcessedInvoice as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][1].items;
    expect(savedItems[0].category).toBe('MERCADO');
  });

  it('expone el error real del upstream emitido como {error} sin step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: sseStream([sse({ error: 'Error descargando PDF de la DIAN' })]),
      })),
    );

    const res = await runInvoiceProcessing('inv-2', 'CUFE123', {
      categoryNames: ['OTROS'],
    });

    expect(res.ok).toBe(false);
    expect(markInvoiceError).toHaveBeenCalledWith(
      'inv-2',
      expect.stringContaining('Error descargando PDF'),
    );
    expect(saveProcessedInvoice).not.toHaveBeenCalled();
  });

  it('reintenta ante cierre prematuro y tiene éxito en el 2º intento', async () => {
    const fetchMock = vi
      .fn()
      // 1er intento: stream se cierra sin complete (transitorio).
      .mockResolvedValueOnce({ ok: true, body: sseStream([sse({ step: 'fetching', progress: 10 })]) })
      // 2º intento: completa.
      .mockResolvedValueOnce({ ok: true, body: sseStream([sse({ step: 'complete', result: COMPLETE_RESULT })]) });
    vi.stubGlobal('fetch', fetchMock);

    const res = await runInvoiceProcessing('inv-3', 'CUFE123', {
      categoryNames: ['MERCADO'],
      retryBaseMs: 0, // sin espera en tests
    });

    expect(res).toEqual({ ok: true, itemsFound: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('NO reintidenta un error no transitorio (4xx) y marca error', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, body: null }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runInvoiceProcessing('inv-4', 'CUFE123', {
      categoryNames: ['OTROS'],
      retryBaseMs: 0,
    });

    expect(res.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin reintento
    expect(markInvoiceError).toHaveBeenCalledWith('inv-4', expect.stringContaining('404'));
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/dian/process-invoice.test.ts`
Expected: FAIL (módulo/función no existe).

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/dian/process-invoice.ts`:

```ts
// Orquestación de procesamiento de CUFE, sin streaming al cliente.
// Reusable por el route web (en after, con onProgress que persiste) y, en planes
// posteriores, por WhatsApp. Conserva la resiliencia del route: reintento ante
// errores transitorios, detección del error real del upstream y cierre prematuro.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { parseSSEEventLine } from '@/lib/dian/sse';
import {
  createProcessingInvoice,
  getInvoiceByCufe,
  markInvoiceError,
  resetInvoiceToProcessing,
  saveProcessedInvoice,
} from '@/lib/services/invoices';
import type {
  CufeProcessResult,
  ElectronicInvoice,
  StoredInvoiceItem,
} from '@/types/invoices';

export type PrepareResult =
  | { kind: 'duplicate'; invoice: ElectronicInvoice }
  | { kind: 'ready'; invoiceId: string }
  | { kind: 'error'; message: string };

export type RunResult =
  | { ok: true; itemsFound: number }
  | { ok: false; message: string };

/** Evento de progreso (forma libre tipo SSE) que se reporta vía onProgress. */
export type ProgressEvent = Record<string, unknown> & {
  step?: string;
  progress?: number;
  message?: string;
};

export interface RunOptions {
  /** Categorías candidatas para la IA (las activas del usuario; fallback arriba). */
  categoryNames: string[];
  /** Se invoca con cada evento de avance; el route lo usa para persistir progreso. */
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  /** Base del backoff entre reintentos (ms). Default 5000; los tests pasan 0. */
  retryBaseMs?: number;
}

// Errores del scraper que vale la pena reintentar (saturación / cierre abrupto).
// Un CUFE inválido o un 4xx NO entran aquí.
function isTransientUpstreamError(message: string): boolean {
  return /INSUFFICIENT_RESOURCES|FILE_ERROR_NO_SPACE|temporary directory|Target page, context or browser has been closed|closed prematurely|cerró la conexión|ECONNRESET|socket hang up|fetch failed|terminated/i.test(
    message,
  );
}

/**
 * Dedup + creación/reinicio de la fila en estado processing. Rápido (sin red
 * pesada): pensado para correr sincrónico antes de responder al cliente.
 */
export async function prepareInvoiceProcessing(
  userId: string,
  cufe: string,
): Promise<PrepareResult> {
  const existing = await getInvoiceByCufe(userId, cufe);
  if (
    existing &&
    (existing.status === 'pending_review' || existing.status === 'approved')
  ) {
    return { kind: 'duplicate', invoice: existing };
  }

  let invoiceId: string | null;
  if (existing) {
    invoiceId = existing.id;
    await resetInvoiceToProcessing(existing.id);
  } else {
    invoiceId = await createProcessingInvoice(userId, cufe);
  }
  if (!invoiceId) {
    return { kind: 'error', message: 'No se pudo crear el borrador' };
  }
  return { kind: 'ready', invoiceId };
}

// Consume UNA vez el stream SSE del upstream, reportando progreso. Distingue:
//  - `complete` con result.success -> devuelve el result
//  - `error`/`{error}` explícito    -> lanza con el mensaje real
//  - stream cerrado sin complete    -> lanza "closed prematurely" (transitorio)
async function streamUpstreamOnce(
  url: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>,
): Promise<CufeProcessResult> {
  const upstream = await fetch(url, {
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

      await onProgress?.(event as ProgressEvent);

      if (event.step === 'complete' && event.result) {
        result = event.result;
      }
      // factura-dian emite fallos como `event: error` con `{error}` pero SIN
      // campo `step`. Detectamos ambas formas para no tragarnos la causa real.
      if (event.step === 'error' || event.error) {
        throw new Error(event.error || 'Error en factura-dian');
      }
    }
  }

  if (!result) {
    throw new Error(
      'El servicio DIAN cerró la conexión sin completar (closed prematurely). Posible saturación; reintenta en unos minutos.',
    );
  }
  if (!result.success) {
    throw new Error(result.error || 'No se obtuvieron datos');
  }
  return result;
}

// Envuelve streamUpstreamOnce con reintento + backoff ante errores transitorios.
async function streamUpstreamWithRetry(
  url: string,
  onProgress?: (event: ProgressEvent) => void | Promise<void>,
  retryBaseMs = 5000,
): Promise<CufeProcessResult> {
  const MAX_ATTEMPTS = 2;
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await streamUpstreamOnce(url, onProgress);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const transient = isTransientUpstreamError(lastError.message);
      if (!transient || attempt >= MAX_ATTEMPTS) throw lastError;

      const waitMs = retryBaseMs * attempt;
      await onProgress?.({
        step: 'retrying',
        message: `Servicio DIAN saturado, reintentando en ${Math.round(waitMs / 1000)}s...`,
        progress: 5,
      });
      if (waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }
  throw lastError ?? new Error('No se obtuvieron datos');
}

/**
 * Parte pesada (~1 min): proxy SSE a factura-dian (con reintento), categorización
 * con las categorías dadas y persistencia. Reporta avance vía onProgress. No
 * streamea al cliente. Marca error en la fila ante fallo.
 */
export async function runInvoiceProcessing(
  invoiceId: string,
  cufe: string,
  opts: RunOptions,
): Promise<RunResult> {
  const startTime = Date.now();
  const baseUrl =
    process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';
  const { categoryNames, onProgress, retryBaseMs } = opts;

  try {
    const upstreamUrl = `${baseUrl}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
      cufe,
    )}&method=${method}&download-pdf=false`;

    const result = await streamUpstreamWithRetry(
      upstreamUrl,
      onProgress,
      retryBaseMs,
    );

    await onProgress?.({
      step: 'categorizing',
      message: 'Clasificando ítems con IA...',
      progress: 95,
    });
    const categories = await categorizeInvoiceItems(
      result.items.map(it => ({ description: it.description })),
      categoryNames,
    );
    const storedItems: StoredInvoiceItem[] = result.items.map((it, idx) => ({
      ...it,
      suggested_category: categories[idx] ?? 'OTROS',
      category: categories[idx] ?? 'OTROS',
    }));

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

    return { ok: true, itemsFound: storedItems.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markInvoiceError(invoiceId, message);
    return { ok: false, message };
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/dian/process-invoice.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dian/process-invoice.ts src/lib/dian/process-invoice.test.ts
git commit --no-verify -m "feat: extraer prepare/runInvoiceProcessing con retry, error real y onProgress"
```

---

## Task 5: Route a POST + `after()` con persistencia de progreso

**Files:**
- Modify: `src/app/api/invoices/process/route.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar el contenido del route**

Reemplazar TODO el contenido de `src/app/api/invoices/process/route.ts` por:

```ts
// POST /api/invoices/process  { cufe }
// Dedup + crea borrador sincrónico, responde invoiceId al instante y procesa en
// segundo plano con after() (fire-and-forget; no depende de la pestaña). El
// avance se persiste en la fila para que la UI lo muestre por polling.

import { after, NextRequest } from 'next/server';

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
  type ProgressEvent,
} from '@/lib/dian/process-invoice';
import {
  resolveUserCategoryNames,
  updateInvoiceProgress,
} from '@/lib/services/invoices';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let cufe: string | undefined;
  try {
    const body = (await request.json()) as { cufe?: string };
    cufe = body.cufe?.trim();
  } catch {
    cufe = undefined;
  }

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

  const prep = await prepareInvoiceProcessing(user.id, cufe);
  if (prep.kind === 'duplicate') {
    return Response.json(
      {
        error: 'Esta factura ya fue procesada',
        invoiceId: prep.invoice.id,
        status: prep.invoice.status,
      },
      { status: 409 },
    );
  }
  if (prep.kind === 'error') {
    return Response.json({ error: prep.message }, { status: 500 });
  }

  const cufeValue = cufe;
  const invoiceId = prep.invoiceId;

  after(async () => {
    const categoryNames = await resolveUserCategoryNames();

    // Persiste el avance, pero solo cuando el porcentaje sube ≥5 o el paso es
    // relevante, para no martillar la DB con cada evento del stream.
    let lastPersisted = -1;
    const onProgress = async (event: ProgressEvent) => {
      const percent = typeof event.progress === 'number' ? event.progress : null;
      const isMilestone =
        event.step === 'retrying' || event.step === 'categorizing';
      if (percent == null && !isMilestone) return;
      if (percent != null && percent - lastPersisted < 5 && !isMilestone) return;
      lastPersisted = percent ?? lastPersisted;
      await updateInvoiceProgress(
        invoiceId,
        percent ?? lastPersisted,
        (event.message as string) || (event.step as string) || 'Procesando...',
      );
    };

    await runInvoiceProcessing(invoiceId, cufeValue, {
      categoryNames,
      onProgress,
    });
  });

  return Response.json({ invoiceId, status: 'processing' });
}
```

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS (corregir import/order si el linter lo pide).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invoices/process/route.ts
git commit --no-verify -m "feat: route CUFE a POST + after() con progreso persistido"
```

---

## Task 6: `CufeScanForm` usa POST (sin SSE)

**Files:**
- Modify: `src/components/organisms/CufeScanForm/CufeScanForm.tsx` (reemplazo completo)

- [ ] **Step 1: Reemplazar el componente**

Reemplazar TODO el contenido de `src/components/organisms/CufeScanForm/CufeScanForm.tsx` por:

```tsx
'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';

interface CufeScanFormProps {
  onSaved: () => void; // refrescar panel de pendientes al terminar
}

export default function CufeScanForm({ onSaved }: CufeScanFormProps) {
  const [cufe, setCufe] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    const value = cufe.trim();
    if (!value) {
      toast.error('Ingresa un código CUFE');
      return;
    }
    setProcessing(true);

    try {
      const res = await fetch('/api/invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cufe: value }),
      });

      if (res.status === 409) {
        toast.error('Esta factura ya fue procesada');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      toast.success(
        'Procesando factura. Puedes seguir el avance en la bandeja o cerrar; termina sola.',
      );
      setCufe('');
      onSaved();
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
        <p className="text-xs text-slate-500">
          Se procesa en segundo plano. Puedes cerrar esta ventana; la factura
          aparece en la bandeja con su avance y queda como borrador para aprobar.
        </p>
      </div>

      <Button onClick={handleProcess} disabled={processing || !cufe.trim()}>
        {processing ? 'Enviando...' : 'Procesar factura'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS. Verificar que no quede import muerto de `parseSSEEventLine`.

- [ ] **Step 3: Commit**

```bash
git add src/components/organisms/CufeScanForm/CufeScanForm.tsx
git commit --no-verify -m "feat: CufeScanForm dispara POST y cierra (background)"
```

---

## Task 7: `PendingInvoicesPanel` — barra de progreso en vivo + polling

**Files:**
- Modify: `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx`

- [ ] **Step 1: Polling mientras haya facturas en processing**

Tras el `useEffect` de carga existente (`useEffect(() => { load(); }, [load, refreshToken]);`), agregar:

```tsx
  useEffect(() => {
    const hasProcessing = invoices.some(inv => inv.status === 'processing');
    if (!hasProcessing) return;
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [invoices, load]);
```

- [ ] **Step 2: Renderizar el estado `processing` con barra**

Dentro del `.map(inv => ...)`, reemplazar el bloque del subtítulo:

```tsx
                <p className="text-xs text-slate-400">
                  {inv.invoice_date} &middot;{' '}
                  {inv.total_amount != null
                    ? formatCurrency(inv.total_amount)
                    : '—'}{' '}
                  &middot; {inv.items.length} ítems
                  {inv.status === 'error' && (
                    <span className="text-red-400"> &middot; error</span>
                  )}
                </p>
```

por:

```tsx
                {inv.status === 'processing' ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{inv.progress_message || 'Procesando...'}</span>
                      <span>{inv.progress_percent ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-700">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${inv.progress_percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    {inv.invoice_date} &middot;{' '}
                    {inv.total_amount != null
                      ? formatCurrency(inv.total_amount)
                      : '—'}{' '}
                    &middot; {inv.items.length} ítems
                    {inv.status === 'error' && (
                      <span className="text-red-400"> &middot; error</span>
                    )}
                  </p>
                )}
```

El botón "Revisar" ya está condicionado a `inv.status === 'pending_review'`, así que las filas `processing` no muestran botón. Sin otro cambio.

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx
git commit --no-verify -m "feat: bandeja con barra de progreso en vivo + polling"
```

---

## Task 8: Verificación end-to-end + suite completa

**Files:** (ninguno; verificación)

- [ ] **Step 1: Correr toda la suite**

Run: `bun run test`
Expected: PASS (los 4 nuevos de `process-invoice` + los existentes).

- [ ] **Step 2: Type-check + lint del proyecto**

Run: `bun run type-check && bun run lint`
Expected: PASS.

- [ ] **Step 3: Verificación manual del "mejor de ambos"**

Levantar la app (`bun run dev`, puerto 3001), autenticado:
1. `/gastos` → modal agregar gasto → modo "Factura (CUFE)" → pegar un CUFE real → "Procesar factura".
2. El modal cierra con toast. En "Facturas por aprobar" aparece la factura **Procesando…** con **barra que avanza** (polling).
3. **Caso esperar:** quedarse en `/gastos` y ver la barra llegar a 100% y pasar a `pending_review`.
4. **Caso fire-and-forget:** repetir con otro CUFE; cerrar la pestaña a mitad; volver a `/gastos` a los ~90s y verificar que la factura completó igual (no quedó atascada).
5. "Revisar" → cuenta → "Aprobar y crear gastos" → N gastos creados.

Expected: progreso visible si te quedas; completa igual si te vas.

- [ ] **Step 4: Confirmar que no quedó SSE de cliente muerto**

Run: `grep -rn "parseSSEEventLine\|text/event-stream" src/components src/app/api/invoices/process`
Expected: el route ya NO usa SSE al cliente; `parseSSEEventLine` solo dentro de `process-invoice.ts` (parseo del stream upstream) y sus tests; `CufeScanForm` no aparece.

---

## Done cuando

- `bun run test`, `bun run type-check`, `bun run lint` pasan.
- Mandar un CUFE desde la web: procesa en background con barra de progreso en vivo en la bandeja; completa aunque se cierre la pestaña; se aprueba creando los gastos.
- Se conserva la resiliencia (reintento transitorio, error real del upstream, categorías del usuario).
- `prepareInvoiceProcessing` y `runInvoiceProcessing(onProgress)` quedan exportadas y testeadas, listas para que el Plan 3 (WhatsApp) las reuse.
```
