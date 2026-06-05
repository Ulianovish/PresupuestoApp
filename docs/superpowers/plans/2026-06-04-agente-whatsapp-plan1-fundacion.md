# Plan 1 — Fundación: motor CUFE reusable + fire-and-forget web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer la lógica de procesamiento de CUFE del route SSE a funciones reusables y convertir el flujo web del CUFE en fire-and-forget (no atado a la pestaña) con polling en la bandeja.

**Architecture:** Hoy `/api/invoices/process` (GET, SSE) corre todo el procesamiento dentro del stream que el navegador sostiene. Lo partimos en dos funciones puras-de-orquestación — `prepareInvoiceProcessing` (dedup + crear/reiniciar fila, rápido) y `runInvoiceProcessing` (proxy a factura-dian + categorizar + persistir, lento) — en un módulo nuevo. El route pasa a POST: ejecuta `prepare` sincrónico, devuelve `invoiceId` al instante, y corre `run` en segundo plano con `after()` de Next (Fluid Compute lo mantiene vivo). La bandeja muestra la fila en estado `processing` y hace polling hasta que cambia a `pending_review`. Estas funciones son las que el agente de WhatsApp reusará en el Plan 3.

**Tech Stack:** Next.js 15 App Router (`after` de `next/server`), TypeScript, Supabase (cliente server por cookie), Vitest, MiniMax (categorización, ya existente).

**Nota de alcance:** Este plan NO cambia el esquema de `electronic_invoices` (ya tiene todo lo necesario) ni introduce el cliente service-role; eso entra en planes posteriores cuando WhatsApp lo necesite. Aquí `run`/`prepare` usan el cliente por cookie existente, que funciona dentro de `after()` porque conserva el contexto de la request.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `src/lib/dian/process-invoice.ts` | `prepareInvoiceProcessing` + `runInvoiceProcessing`: orquestación de CUFE sin streaming al cliente | Crear |
| `src/lib/dian/process-invoice.test.ts` | Tests de `runInvoiceProcessing` (fetch + servicios + categorizer mockeados) | Crear |
| `src/app/api/invoices/process/route.ts` | Pasa de GET/SSE a POST: prepare → after(run) → devuelve `invoiceId` | Modificar |
| `src/lib/services/invoices.ts` | `listDraftInvoices` incluye también `processing` | Modificar |
| `src/components/organisms/CufeScanForm/CufeScanForm.tsx` | POST (sin SSE); cierra al instante con mensaje "procesando" | Modificar |
| `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx` | Muestra filas `processing` + polling cada 5s mientras existan | Modificar |

---

## Task 1: Extraer `prepareInvoiceProcessing` + `runInvoiceProcessing`

**Files:**
- Create: `src/lib/dian/process-invoice.ts`
- Test: `src/lib/dian/process-invoice.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/dian/process-invoice.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runInvoiceProcessing } from './process-invoice';

// Mock de los servicios de persistencia y del categorizador.
vi.mock('@/lib/services/invoices', () => ({
  saveProcessedInvoice: vi.fn(async () => undefined),
  markInvoiceError: vi.fn(async () => undefined),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(async (items: Array<{ description: string }>) =>
    items.map(() => 'MERCADO'),
  ),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { markInvoiceError, saveProcessedInvoice } from '@/lib/services/invoices';

/** Construye un ReadableStream SSE a partir de líneas ya formateadas. */
function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(enc.encode(line));
      controller.close();
    },
  });
}

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('procesa el stream, categoriza y persiste el borrador', async () => {
    const completeLine = `data: ${JSON.stringify({ step: 'complete', progress: 100, result: COMPLETE_RESULT })}\n\n`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, body: sseStream([completeLine]) })),
    );

    const res = await runInvoiceProcessing('inv-1', 'CUFE123');

    expect(res).toEqual({ ok: true, itemsFound: 2 });
    expect(categorizeInvoiceItems).toHaveBeenCalledOnce();
    expect(saveProcessedInvoice).toHaveBeenCalledWith('inv-1', expect.objectContaining({
      supplierName: 'D1',
      invoiceDate: '2026-06-01',
      totalAmount: 12000,
    }));
    const savedItems = (saveProcessedInvoice as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][1].items;
    expect(savedItems).toHaveLength(2);
    expect(savedItems[0].category).toBe('MERCADO');
    expect(savedItems[0].suggested_category).toBe('MERCADO');
  });

  it('marca error si factura-dian responde !ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, body: null })));

    const res = await runInvoiceProcessing('inv-2', 'CUFE123');

    expect(res.ok).toBe(false);
    expect(markInvoiceError).toHaveBeenCalledWith('inv-2', expect.stringContaining('502'));
    expect(saveProcessedInvoice).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/dian/process-invoice.test.ts`
Expected: FAIL con error de import (`runInvoiceProcessing` no existe / módulo no encontrado).

- [ ] **Step 3: Implementar el módulo**

Crear `src/lib/dian/process-invoice.ts`:

```ts
// Orquestación de procesamiento de CUFE, sin streaming al cliente.
// Reusable por el route web (con after) y, en planes posteriores, por WhatsApp.

import { EXPENSE_CATEGORIES } from '@/lib/constants/expense-categories';
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

/**
 * Parte pesada (~1 min): proxy SSE a factura-dian, categorización IA y
 * persistencia. No streamea al cliente. Marca error en la fila ante fallo.
 */
export async function runInvoiceProcessing(
  invoiceId: string,
  cufe: string,
): Promise<RunResult> {
  const startTime = Date.now();
  const baseUrl =
    process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';

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

    const categories = await categorizeInvoiceItems(
      result.items.map(it => ({ description: it.description })),
      [...EXPENSE_CATEGORIES],
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
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dian/process-invoice.ts src/lib/dian/process-invoice.test.ts
git commit --no-verify -m "feat: extraer prepare/runInvoiceProcessing reusable del route CUFE"
```

---

## Task 2: Convertir el route a POST + `after()`

**Files:**
- Modify: `src/app/api/invoices/process/route.ts` (reemplazo completo)

- [ ] **Step 1: Reemplazar el contenido del route**

Reemplazar TODO el contenido de `src/app/api/invoices/process/route.ts` por:

```ts
// POST /api/invoices/process  { cufe }
// Dedup + crea borrador sincrónico, responde invoiceId al instante y procesa
// en segundo plano con after() (fire-and-forget; no depende de la pestaña).

import { after, NextRequest } from 'next/server';

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
} from '@/lib/dian/process-invoice';
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
    await runInvoiceProcessing(invoiceId, cufeValue);
  });

  return Response.json({ invoiceId, status: 'processing' });
}
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: PASS (sin errores).

- [ ] **Step 3: Lint del archivo cambiado**

Run: `bun run lint`
Expected: PASS (sin errores en el route; corregir import/order si el linter lo pide).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invoices/process/route.ts
git commit --no-verify -m "feat: route de proceso CUFE a POST + after() (fire-and-forget)"
```

---

## Task 3: `listDraftInvoices` incluye `processing`

**Files:**
- Modify: `src/lib/services/invoices.ts:98-110`

- [ ] **Step 1: Incluir el estado processing**

En `src/lib/services/invoices.ts`, en la función `listDraftInvoices`, cambiar el filtro de estados. Reemplazar:

```ts
    .in('status', ['pending_review', 'error'])
```

por:

```ts
    .in('status', ['processing', 'pending_review', 'error'])
```

Y actualizar el comentario JSDoc de la función de:

```ts
/** Lista facturas en pending_review o error del usuario. */
```

a:

```ts
/** Lista facturas activas del usuario (processing, pending_review o error). */
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/invoices.ts
git commit --no-verify -m "feat: bandeja incluye facturas en processing"
```

---

## Task 4: `CufeScanForm` usa POST (sin SSE)

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

      toast.success('Procesando factura. Aparecerá en la bandeja en ~1 min.');
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
          quedará como borrador para aprobar en la bandeja.
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
Expected: PASS. (Ya no se importa `parseSSEEventLine` aquí; verificar que no quede import muerto.)

- [ ] **Step 3: Commit**

```bash
git add src/components/organisms/CufeScanForm/CufeScanForm.tsx
git commit --no-verify -m "feat: CufeScanForm dispara POST y cierra (fire-and-forget)"
```

---

## Task 5: `PendingInvoicesPanel` muestra `processing` + polling

**Files:**
- Modify: `src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx`

- [ ] **Step 1: Agregar polling mientras haya facturas en processing**

En `PendingInvoicesPanel.tsx`, reemplazar el bloque del `useEffect` de carga (líneas ~38-40):

```tsx
  useEffect(() => {
    load();
  }, [load, refreshToken]);
```

por una versión que re-consulta cada 5s mientras alguna factura esté en `processing`:

```tsx
  useEffect(() => {
    load();
  }, [load, refreshToken]);

  useEffect(() => {
    const hasProcessing = invoices.some(inv => inv.status === 'processing');
    if (!hasProcessing) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [invoices, load]);
```

- [ ] **Step 2: Renderizar el estado `processing` (sin botón Revisar)**

En el mismo archivo, dentro del `.map(inv => ...)`, el subtítulo (`<p className="text-xs text-slate-400">`) muestra fecha/total/ítems y, si `error`, un aviso rojo. Añadir el caso `processing`. Reemplazar el bloque:

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
                <p className="text-xs text-slate-400">
                  {inv.status === 'processing' ? (
                    <span className="text-blue-300">
                      Procesando… (~1 min)
                    </span>
                  ) : (
                    <>
                      {inv.invoice_date} &middot;{' '}
                      {inv.total_amount != null
                        ? formatCurrency(inv.total_amount)
                        : '—'}{' '}
                      &middot; {inv.items.length} ítems
                      {inv.status === 'error' && (
                        <span className="text-red-400"> &middot; error</span>
                      )}
                    </>
                  )}
                </p>
```

El botón "Revisar" ya está condicionado a `inv.status === 'pending_review'` (línea ~98), así que las filas en `processing` no muestran botón. No se requiere otro cambio ahí.

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/organisms/PendingInvoicesPanel/PendingInvoicesPanel.tsx
git commit --no-verify -m "feat: bandeja muestra 'procesando' y hace polling hasta listo"
```

---

## Task 6: Verificación end-to-end + suite completa

**Files:** (ninguno; verificación)

- [ ] **Step 1: Correr toda la suite de tests**

Run: `bun run test`
Expected: PASS (incluye los nuevos tests de `process-invoice` + los 13 existentes).

- [ ] **Step 2: Type-check + lint del proyecto**

Run: `bun run type-check && bun run lint`
Expected: PASS.

- [ ] **Step 3: Verificación manual del fire-and-forget**

Levantar la app (`bun run dev`, puerto 3001) y, autenticado:
1. Abrir `/gastos` → modal agregar gasto → modo "Factura (CUFE)".
2. Pegar un CUFE real, "Procesar factura". El modal debe cerrar y mostrar toast "Procesando…".
3. La fila aparece en "Facturas por aprobar" como **Procesando…**.
4. **Cerrar la pestaña** (o navegar fuera) y volver a `/gastos` a los ~90s.
5. Verificar que la factura pasó sola a `pending_review` con sus ítems (confirma que el procesamiento NO dependió de la pestaña).
6. "Revisar" → elegir cuenta → "Aprobar y crear gastos" → verificar N gastos creados.

Expected: la factura se completa aunque la pestaña se haya cerrado durante el procesamiento.

- [ ] **Step 4: Confirmar que no quedó código muerto del SSE de cliente**

Run: `grep -rn "cufe-to-data-stream\|parseSSEEventLine" src/components src/app/api/invoices/process`
Expected: el route de proceso ya NO referencia SSE de cliente; `parseSSEEventLine` solo se usa dentro de `process-invoice.ts` (parseo del stream upstream de factura-dian) y en sus tests. `CufeScanForm` no debe aparecer.

---

## Done cuando

- `bun run test`, `bun run type-check`, `bun run lint` pasan.
- Mandar un CUFE desde la web procesa en segundo plano: la factura llega a `pending_review` aunque se cierre la pestaña, y se aprueba creando los gastos.
- `prepareInvoiceProcessing` y `runInvoiceProcessing` quedan exportadas y testeadas, listas para que el Plan 3 (WhatsApp) las reuse.
