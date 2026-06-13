# Plan 4 — Agente de WhatsApp: visión (transferencias + facturas foto)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un número vinculado pueda enviar por WhatsApp **una foto/screenshot** y el agente la entienda con visión: un **comprobante de transferencia** → gasto directo (deduciendo la cuenta de origen), o una **factura/recibo sin CUFE** → borrador con sus ítems para aprobar.

**Architecture:** El webhook (ya enruta texto en Plan 3) gana la rama `image`: ACK síncrono + `after()` que descarga la media de Twilio, la pasa a un `VisionExtractor` (MiniMax-VL vía el endpoint Anthropic-compatible — **validado: funciona**) que clasifica y extrae JSON estructurado (transfer | receipt | unknown), y enruta: transfer → `createDirectExpense` (cuenta deducida) ; receipt → nuevo borrador en `electronic_invoices` con `source='vision_receipt'` (reusa la bandeja y `approveInvoice` sin cambios). Sin estado de conversación: baja confianza → se pide reenviar/escribir; los errores se corrigen en la app. Todo el cerebro (visión, parsing, ruteo) son unidades con deps inyectadas y tests; el webhook es orquestador delgado.

**Tech Stack:** Next.js 15 (`after`), TypeScript, Node `fetch`/`Buffer`, Supabase (service-role), Vitest, MiniMax-VL (visión, endpoint Anthropic-compatible), Twilio (descarga de media con Basic auth).

**Notas de base / decisiones:**
- **Riesgo de visión RESUELTO** (probado 2026-06-12): el endpoint `https://api.minimax.io/anthropic/v1/messages` con modelo **`MiniMax-VL-01`** acepta bloques de imagen y hace OCR correcto. Reusa `MINIMAX_API_KEY`/`MINIMAX_BASE_URL`; modelo configurable vía `VISION_MODEL` (default `MiniMax-VL-01`).
- **Sin estado de conversación** (`whatsapp_conversations`) en este plan: receipt → borrador (se revisa en la app); transfer → gasto directo (se edita en la app si algo está mal); baja confianza → mensaje pidiendo reenviar o escribir el gasto. Las preguntas de seguimiento interactivas quedan para un plan futuro.
- `electronic_invoices.cufe_code` es `NOT NULL` con `UNIQUE(user_id, cufe_code)`. Para facturas por visión (sin CUFE) se hace **nullable** y se agrega columna **`source`**. Postgres permite múltiples `NULL` en un UNIQUE, así que los borradores de visión no chocan.
- Reuso: `approveInvoice`/`mapInvoiceItemToExpenseArgs` ya usan `item.total_with_tax ?? item.total_price`, `invoice.invoice_date`, `invoice.supplier_name` → un borrador de visión que llene esos campos se aprueba igual que un CUFE.
- Cuenta de la transferencia: la visión devuelve el origen (Nequi/Bancolombia/…); se usa como `account_name` directo (texto libre en `upsert_monthly_expense`); si viene vacío → cuenta por defecto del número.
- `createDirectExpense` (Plan 3) y `resolveDefaultAccount` (Plan 3) se reutilizan para transferencias.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `supabase/migrations/20260612000000_invoices_vision_source.sql` | `cufe_code` nullable + columna `source` | Crear |
| `src/types/invoices.ts` | `cufe_code: string \| null`; `source: string` en `ElectronicInvoice` | Modificar |
| `.env.example` | `VISION_MODEL` | Modificar |
| `src/lib/whatsapp/transport.ts` | `downloadTwilioMedia(url)` → `{base64, mime}` | Modificar |
| `src/lib/whatsapp/vision.ts` | `analyzeImage(base64, mime)` → `VisionResult` (MiniMax-VL) | Crear |
| `src/lib/whatsapp/vision.test.ts` | Tests (fetch mock) | Crear |
| `src/lib/services/whatsapp-expenses.ts` | `createVisionReceiptDraft(userId, data)` (service-role) | Modificar |
| `src/lib/services/whatsapp-expenses.test.ts` | Tests del draft de visión | Modificar |
| `src/lib/whatsapp/handle-image.ts` | `handleImageMessage(ctx, deps)` orquestador (deps inyectadas) | Crear |
| `src/lib/whatsapp/handle-image.test.ts` | Tests del orquestador | Crear |
| `src/app/api/whatsapp/webhook/route.ts` | Rama `image`: ACK + `after(handleImageMessage)` | Modificar |

---

## Task 1: Migración — `cufe_code` nullable + `source`

**Files:**
- Create: `supabase/migrations/20260612000000_invoices_vision_source.sql`

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260612000000_invoices_vision_source.sql`:

```sql
-- Permite facturas por VISIÓN (foto sin CUFE): cufe_code pasa a nullable y se
-- agrega `source` para distinguir el origen. El UNIQUE(user_id, cufe_code)
-- sigue válido: Postgres trata múltiples NULL como distintos.
ALTER TABLE public.electronic_invoices
  ALTER COLUMN cufe_code DROP NOT NULL;

ALTER TABLE public.electronic_invoices
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dian_cufe';
```

- [ ] **Step 2: Aplicar a Supabase**

Aplicar vía MCP de Supabase (`apply_migration`, name `invoices_vision_source`). Verificar:

Run (MCP `execute_sql`): `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='electronic_invoices' AND column_name IN ('cufe_code','source');`
Expected: `cufe_code` → `is_nullable = YES`; `source` presente.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260612000000_invoices_vision_source.sql
git commit --no-verify -m "feat: electronic_invoices cufe_code nullable + source (facturas por visión)"
```

---

## Task 2: Tipo `ElectronicInvoice` — cufe nullable + source

**Files:**
- Modify: `src/types/invoices.ts` (interface `ElectronicInvoice`)

- [ ] **Step 1: Ajustar el tipo**

En `src/types/invoices.ts`, en `interface ElectronicInvoice`, cambiar la línea `cufe_code: string;` por:

```ts
  cufe_code: string | null;
  source: string;
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: PASS (los accesos existentes a `cufe_code` siguen válidos; ningún consumidor asume no-null de forma que rompa).

- [ ] **Step 3: Commit**

```bash
git add src/types/invoices.ts
git commit --no-verify -m "feat: ElectronicInvoice cufe_code nullable + source"
```

---

## Task 3: Env — modelo de visión

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Agregar la variable**

En `.env.example`, dentro de la sección `# === Categorización de items con MiniMax ===` (después de `CATEGORIZE_MODEL=...`), agregar:

```bash
# Modelo de VISIÓN (lee fotos de facturas/transferencias). Validado: MiniMax-VL-01.
VISION_MODEL=MiniMax-VL-01
```

- [ ] **Step 2: Configurar en Vercel (manual)**

Setear `VISION_MODEL=MiniMax-VL-01` en Vercel producción (o dejar el default del código). No es secreto.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit --no-verify -m "chore: env VISION_MODEL para visión de WhatsApp"
```

---

## Task 4: Descarga de media de Twilio

**Files:**
- Modify: `src/lib/whatsapp/transport.ts`
- Modify: `src/lib/whatsapp/transport.test.ts`

- [ ] **Step 1: Agregar el test (al final del describe existente o en uno nuevo)**

En `src/lib/whatsapp/transport.test.ts`, agregar al final del archivo (después del `describe('sendWhatsAppMessage', ...)`):

```ts
import { downloadTwilioMedia } from './transport';

describe('downloadTwilioMedia', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok456');
  });

  it('descarga con Basic auth y devuelve base64 + mime', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'image/jpeg' : null) },
      arrayBuffer: async () => bytes.buffer,
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await downloadTwilioMedia('https://api.twilio.com/media/abc');

    expect(res).not.toBeNull();
    expect(res!.mime).toBe('image/jpeg');
    expect(res!.base64).toBe(Buffer.from(bytes).toString('base64'));
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:tok456').toString('base64')}`);
  });

  it('devuelve null si faltan credenciales', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await downloadTwilioMedia('https://x')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve null si Twilio responde error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await downloadTwilioMedia('https://x')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/transport.test.ts`
Expected: FAIL (`downloadTwilioMedia` no existe).

- [ ] **Step 3: Implementar (agregar a `transport.ts`)**

En `src/lib/whatsapp/transport.ts`, agregar al final:

```ts
export interface DownloadedMedia {
  base64: string;
  mime: string;
}

/**
 * Descarga un archivo de media de Twilio (las MediaUrl requieren Basic auth con
 * SID:token). Devuelve base64 + mime, o null ante falta de credenciales/error.
 */
export async function downloadTwilioMedia(
  url: string,
): Promise<DownloadedMedia | null> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error('downloadTwilioMedia sin credenciales (SID/TOKEN)');
    return null;
  }
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      },
    });
    if (!res.ok) {
      console.error(`Descarga de media falló: ${res.status}`);
      return null;
    }
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString('base64'), mime };
  } catch (err) {
    console.error('Error descargando media:', err);
    return null;
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/transport.test.ts`
Expected: PASS (los 4 de sendWhatsAppMessage + los 3 nuevos). Run `bun run type-check` (limpio).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/transport.ts src/lib/whatsapp/transport.test.ts
git commit --no-verify -m "feat: descarga de media de Twilio (Basic auth → base64)"
```

---

## Task 5: Extractor de visión (MiniMax-VL)

**Files:**
- Create: `src/lib/whatsapp/vision.ts`
- Test: `src/lib/whatsapp/vision.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/vision.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeImage } from './vision';

function mockMiniMax(text: string, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ content: [{ text }] }),
    text: async () => text,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('MINIMAX_API_KEY', 'k');
  });

  it('parsea una transferencia', async () => {
    mockMiniMax(
      JSON.stringify({
        type: 'transfer',
        amount: 50000,
        date: '2026-06-12',
        account: 'Nequi',
        description: 'Juan Pérez',
        confidence: 0.9,
      }),
    );
    const r = await analyzeImage('b64', 'image/png');
    expect(r).toEqual({
      kind: 'transfer',
      amount: 50000,
      date: '2026-06-12',
      account: 'Nequi',
      description: 'Juan Pérez',
      confidence: 0.9,
    });
  });

  it('parsea un recibo con ítems (tolerando fences ```json)', async () => {
    mockMiniMax(
      '```json\n' +
        JSON.stringify({
          type: 'receipt',
          supplier: 'D1',
          date: '2026-06-12',
          items: [
            { description: 'Arroz', amount: 6000 },
            { description: 'Leche', amount: 5000 },
          ],
          total: 11000,
          confidence: 0.8,
        }) +
        '\n```',
    );
    const r = await analyzeImage('b64', 'image/jpeg');
    expect(r.kind).toBe('receipt');
    if (r.kind === 'receipt') {
      expect(r.supplier).toBe('D1');
      expect(r.items).toHaveLength(2);
      expect(r.items[0]).toEqual({ description: 'Arroz', amount: 6000 });
      expect(r.total).toBe(11000);
    }
  });

  it('type desconocido → unknown', async () => {
    mockMiniMax(JSON.stringify({ type: 'unknown' }));
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('JSON inválido → unknown', async () => {
    mockMiniMax('no es json');
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('sin API key → unknown sin llamar fetch', async () => {
    vi.stubEnv('MINIMAX_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HTTP error → unknown', async () => {
    mockMiniMax('x', false, 500);
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('transfer sin amount válido → unknown', async () => {
    mockMiniMax(JSON.stringify({ type: 'transfer', amount: 0 }));
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/vision.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/vision.ts`:

```ts
// Extractor de visión: lee una imagen (transferencia o factura) con MiniMax-VL
// vía el endpoint Anthropic-compatible (validado). Devuelve datos estructurados
// o { kind: 'unknown' } ante cualquier problema. Nunca lanza.

export type TransferVision = {
  kind: 'transfer';
  amount: number;
  date: string | null;
  account: string | null;
  description: string | null;
  confidence: number;
};

export type ReceiptVision = {
  kind: 'receipt';
  supplier: string | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  total: number | null;
  confidence: number;
};

export type VisionResult = TransferVision | ReceiptVision | { kind: 'unknown' };

const PROMPT = [
  'Eres un asistente que lee imágenes financieras colombianas. Analiza la imagen',
  'y responde SOLO con un JSON (sin texto extra).',
  '',
  'Si es un comprobante de TRANSFERENCIA o pago (Nequi, Bancolombia, Daviplata,',
  'Davivienda, etc.):',
  '{"type":"transfer","amount":<entero COP sin separadores>,"date":"YYYY-MM-DD"|null,',
  '"account":"<app/banco de ORIGEN, ej Nequi>"|null,"description":"<destinatario o',
  'concepto>"|null,"confidence":<0..1>}',
  '',
  'Si es una FACTURA o recibo de compra con ítems:',
  '{"type":"receipt","supplier":"<tienda>"|null,"date":"YYYY-MM-DD"|null,',
  '"items":[{"description":"<ítem>","amount":<entero COP pagado del ítem>}],',
  '"total":<entero COP>|null,"confidence":<0..1>}',
  '',
  'Si no puedes leerla o no es ninguna de las dos: {"type":"unknown"}',
].join('\n');

/** Extrae un objeto JSON de un texto (directo, entre fences, o el primer {...}). */
function extractJson(content: string): unknown | null {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* sigue */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* sigue */
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      /* sigue */
    }
  }
  return null;
}

function toInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function toResult(parsed: unknown): VisionResult {
  const obj = parsed as Record<string, unknown> | null;
  if (!obj || typeof obj !== 'object') return { kind: 'unknown' };

  if (obj.type === 'transfer') {
    const amount = toInt(obj.amount);
    if (amount == null) return { kind: 'unknown' };
    return {
      kind: 'transfer',
      amount,
      date: typeof obj.date === 'string' ? obj.date : null,
      account: typeof obj.account === 'string' ? obj.account : null,
      description: typeof obj.description === 'string' ? obj.description : null,
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    };
  }

  if (obj.type === 'receipt') {
    const rawItems = Array.isArray(obj.items) ? obj.items : [];
    const items = rawItems
      .map(it => {
        const i = it as Record<string, unknown>;
        const amount = toInt(i?.amount);
        const description =
          typeof i?.description === 'string' ? i.description.trim() : '';
        return amount != null && description ? { description, amount } : null;
      })
      .filter((x): x is { description: string; amount: number } => x !== null);
    if (items.length === 0) return { kind: 'unknown' };
    return {
      kind: 'receipt',
      supplier: typeof obj.supplier === 'string' ? obj.supplier : null,
      date: typeof obj.date === 'string' ? obj.date : null,
      items,
      total: toInt(obj.total),
      confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.5,
    };
  }

  return { kind: 'unknown' };
}

/** Analiza una imagen con MiniMax-VL. Nunca lanza; ante error → unknown. */
export async function analyzeImage(
  base64: string,
  mime: string,
): Promise<VisionResult> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) return { kind: 'unknown' };

  const baseUrl = process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic';
  const model = process.env.VISION_MODEL || 'MiniMax-VL-01';

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
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mime, data: base64 },
              },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { kind: 'unknown' };

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : '';
    const parsed = extractJson(text);
    if (!parsed) return { kind: 'unknown' };
    return toResult(parsed);
  } catch (err) {
    console.error('Error en analyzeImage:', err);
    return { kind: 'unknown' };
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/vision.test.ts`
Expected: PASS (7 tests). Run `bun run type-check`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/vision.ts src/lib/whatsapp/vision.test.ts
git commit --no-verify -m "feat: extractor de visión MiniMax-VL (transferencia/recibo → JSON)"
```

---

## Task 6: Borrador de factura por visión (service-role)

**Files:**
- Modify: `src/lib/services/whatsapp-expenses.ts`
- Modify: `src/lib/services/whatsapp-expenses.test.ts`

- [ ] **Step 1: Agregar el test**

En `src/lib/services/whatsapp-expenses.test.ts`, agregar un `describe` nuevo (e importar `createVisionReceiptDraft` junto a los imports existentes desde `./whatsapp-expenses`):

```ts
describe('createVisionReceiptDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('categoriza ítems e inserta un borrador con source vision_receipt', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const catFrom = vi.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ name: 'MERCADO' }] }),
        };
      }
      if (table === 'electronic_invoices') return { insert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from: catFrom });

    const res = await createVisionReceiptDraft('user-1', {
      supplier: 'D1',
      date: '2026-06-12',
      items: [
        { description: 'Arroz', amount: 6000 },
        { description: 'Leche', amount: 5000 },
      ],
      total: 11000,
    });

    expect(res.ok).toBe(true);
    expect(res.itemsFound).toBe(2);
    const row = insert.mock.calls[0][0];
    expect(row.user_id).toBe('user-1');
    expect(row.source).toBe('vision_receipt');
    expect(row.cufe_code).toBeNull();
    expect(row.status).toBe('pending_review');
    expect(row.supplier_name).toBe('D1');
    expect(row.total_amount).toBe(11000);
    expect(row.items).toHaveLength(2);
    expect(row.items[0].description).toBe('Arroz');
    expect(row.items[0].total_price).toBe(6000);
    expect(row.items[0].total_with_tax).toBe(6000);
    expect(row.items[0].category).toBe('MERCADO');
  });

  it('devuelve ok:false si el insert falla', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const catFrom = vi.fn((table: string) => {
      if (table === 'categories') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [] }),
        };
      }
      return { insert };
    });
    mockedAdmin.mockReturnValue({ from: catFrom });

    const res = await createVisionReceiptDraft('user-1', {
      supplier: null,
      date: '2026-06-12',
      items: [{ description: 'x', amount: 100 }],
      total: 100,
    });
    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/services/whatsapp-expenses.test.ts`
Expected: FAIL (`createVisionReceiptDraft` no existe).

- [ ] **Step 3: Implementar (agregar a `whatsapp-expenses.ts`)**

En `src/lib/services/whatsapp-expenses.ts`, agregar el import del tipo y la función. Junto a los imports, agregar:

```ts
import type { StoredInvoiceItem } from '@/types/invoices';
```

Y al final del archivo:

```ts
export interface VisionReceiptInput {
  supplier: string | null;
  date: string; // YYYY-MM-DD (resuelta por el llamador)
  items: Array<{ description: string; amount: number }>;
  total: number | null;
}

export interface VisionReceiptResult {
  ok: boolean;
  itemsFound: number;
  error?: string;
}

/**
 * Crea un borrador de factura a partir de una foto leída por visión (sin CUFE).
 * Categoriza los ítems con IA y los guarda en electronic_invoices con
 * source='vision_receipt' y status='pending_review' → aparece en la bandeja y se
 * aprueba con el flujo existente.
 */
export async function createVisionReceiptDraft(
  userId: string,
  input: VisionReceiptInput,
): Promise<VisionReceiptResult> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const categories = await categorizeInvoiceItems(
    input.items.map(it => ({ description: it.description })),
    categoryNames,
  );

  const storedItems: StoredInvoiceItem[] = input.items.map((it, idx) => ({
    description: it.description,
    quantity: 1,
    unit_price: it.amount,
    total_price: it.amount,
    total_with_tax: it.amount,
    suggested_category: categories[idx] ?? 'OTROS',
    category: categories[idx] ?? 'OTROS',
  }));

  const totalAmount =
    input.total ?? storedItems.reduce((sum, it) => sum + it.total_price, 0);

  const { error } = await supabase.from('electronic_invoices').insert({
    user_id: userId,
    cufe_code: null,
    source: 'vision_receipt',
    supplier_name: input.supplier,
    invoice_date: input.date,
    total_amount: totalAmount,
    items: storedItems,
    status: 'pending_review',
    processed_at: new Date().toISOString(),
  });

  if (error) {
    return { ok: false, itemsFound: 0, error: error.message };
  }
  return { ok: true, itemsFound: storedItems.length };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/services/whatsapp-expenses.test.ts`
Expected: PASS. Run `bun run type-check` y `bunx eslint src/lib/services/whatsapp-expenses.ts` (corregir import/order con `--fix` si hace falta).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/whatsapp-expenses.ts src/lib/services/whatsapp-expenses.test.ts
git commit --no-verify -m "feat: borrador de factura por visión (vision_receipt) service-role"
```

---

## Task 7: Orquestador de imagen (deps inyectadas)

**Files:**
- Create: `src/lib/whatsapp/handle-image.ts`
- Test: `src/lib/whatsapp/handle-image.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/handle-image.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { handleImageMessage } from './handle-image';

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true })),
    downloadMedia: vi.fn(async () => ({ base64: 'b64', mime: 'image/png' })),
    analyzeImage: vi.fn(),
    createDirectExpense: vi.fn(async () => ({ ok: true, category: 'OTROS' })),
    createVisionReceiptDraft: vi.fn(async () => ({ ok: true, itemsFound: 2 })),
    resolveDefaultAccount: vi.fn(async () => 'Efectivo'),
    today: () => '2026-06-12',
    ...overrides,
  };
}

const ctx = { userId: 'u1', phone: '+57300', mediaUrl: 'https://m/0', mediaType: 'image/png' };

describe('handleImageMessage', () => {
  it('transferencia → gasto directo con la cuenta deducida', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        description: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 50000,
      description: 'Juan',
      accountName: 'Nequi',
      date: '2026-06-11',
    });
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/50.?000/));
  });

  it('transferencia sin cuenta → usa la cuenta por defecto', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 30000,
        date: null,
        account: null,
        description: null,
        confidence: 0.7,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+57300');
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 30000,
      description: 'Transferencia',
      accountName: 'Efectivo',
      date: '2026-06-12',
    });
  });

  it('recibo → borrador y avisa', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'Arroz', amount: 6000 }],
        total: 6000,
        confidence: 0.8,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createVisionReceiptDraft).toHaveBeenCalledWith('u1', {
      supplier: 'D1',
      date: '2026-06-12',
      items: [{ description: 'Arroz', amount: 6000 }],
      total: 6000,
    });
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/revisar|aprobar|lista/i));
  });

  it('unknown → pide reenviar/escribir (no crea nada)', async () => {
    const deps = makeDeps({ analyzeImage: vi.fn(async () => ({ kind: 'unknown' })) });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.createVisionReceiptDraft).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/no pude|reenv|escrib/i));
  });

  it('descarga falla → avisa y no analiza', async () => {
    const deps = makeDeps({ downloadMedia: vi.fn(async () => null) });
    await handleImageMessage(ctx, deps);
    expect(deps.analyzeImage).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/handle-image.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/handle-image.ts`:

```ts
// Orquestador de mensajes con imagen (corre en after). Descarga la media, la
// analiza con visión y enruta: transferencia → gasto directo; recibo → borrador.
// Deps inyectadas para testear sin red ni DB.

import type { VisionResult } from '@/lib/whatsapp/vision';

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export interface ImageDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  downloadMedia: (url: string) => Promise<{ base64: string; mime: string } | null>;
  analyzeImage: (base64: string, mime: string) => Promise<VisionResult>;
  createDirectExpense: (
    userId: string,
    phone: string,
    input: { amount: number; description: string; accountName: string; date: string },
  ) => Promise<{ ok: boolean; category: string; error?: string }>;
  createVisionReceiptDraft: (
    userId: string,
    input: {
      supplier: string | null;
      date: string;
      items: Array<{ description: string; amount: number }>;
      total: number | null;
    },
  ) => Promise<{ ok: boolean; itemsFound: number; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string;
}

export interface ImageContext {
  userId: string;
  phone: string;
  mediaUrl: string;
  mediaType: string;
}

export async function handleImageMessage(
  ctx: ImageContext,
  deps: ImageDeps,
): Promise<void> {
  const media = await deps.downloadMedia(ctx.mediaUrl);
  if (!media) {
    await deps.sendMessage(
      ctx.phone,
      '❌ No pude descargar la imagen. Inténtalo de nuevo en un momento.',
    );
    return;
  }

  const result = await deps.analyzeImage(media.base64, media.mime);

  if (result.kind === 'transfer') {
    const accountName =
      result.account ?? (await deps.resolveDefaultAccount(ctx.phone));
    const res = await deps.createDirectExpense(ctx.userId, ctx.phone, {
      amount: result.amount,
      description: result.description ?? 'Transferencia',
      accountName,
      date: result.date ?? deps.today(),
    });
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Registré ${formatCOP(result.amount)} en ${res.category} (${accountName}). Si algo está mal, edítalo en la app.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude registrar el gasto: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  if (result.kind === 'receipt') {
    const res = await deps.createVisionReceiptDraft(ctx.userId, {
      supplier: result.supplier,
      date: result.date ?? deps.today(),
      items: result.items,
      total: result.total,
    });
    if (res.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Leí tu factura${result.supplier ? ` de ${result.supplier}` : ''} (${res.itemsFound} ítems). Queda lista para revisar y aprobar en la app.`,
      );
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude guardar la factura: ${res.error ?? 'error desconocido'}.`,
      );
    }
    return;
  }

  await deps.sendMessage(
    ctx.phone,
    'No pude leer la imagen 🤔. Reenvíala más clara, o escribe el gasto (ej. "20k taxi") o pega el CUFE.',
  );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/handle-image.test.ts`
Expected: PASS (5 tests). Run `bun run type-check`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/handle-image.ts src/lib/whatsapp/handle-image.test.ts
git commit --no-verify -m "feat: orquestador de imagen (transferencia → gasto, recibo → borrador)"
```

---

## Task 8: Conectar la rama `image` del webhook

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Agregar imports**

En `src/app/api/whatsapp/webhook/route.ts`, agregar a los imports (respetando import/order; correr `bunx eslint --fix` al final):

```ts
import {
  createDirectExpense,
  createVisionReceiptDraft,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import { handleImageMessage } from '@/lib/whatsapp/handle-image';
import {
  downloadTwilioMedia,
  sendWhatsAppMessage,
} from '@/lib/whatsapp/transport';
import { analyzeImage } from '@/lib/whatsapp/vision';
```

Nota: `createDirectExpense`/`resolveDefaultAccount` y `sendWhatsAppMessage` ya se importaban; **fusiona** estos imports con los existentes (no dupliques): el import de `whatsapp-expenses` ahora trae además `createVisionReceiptDraft`, y el de `transport` ahora trae además `downloadTwilioMedia`.

- [ ] **Step 2: Manejar la rama `image` antes del bloque cufe/quick_expense**

En la función `POST`, justo después de `const decision = classifyText(body, numMedia);`, y ANTES del `if (decision === 'cufe' || decision === 'quick_expense')`, insertar:

```ts
  if (decision === 'image') {
    const mediaUrl = params.MediaUrl0 || '';
    const mediaType = params.MediaContentType0 || 'image/jpeg';
    if (!mediaUrl) {
      return xml(twimlMessage(simpleReply('unknown')));
    }
    const userId = link.userId;
    after(async () => {
      try {
        await handleImageMessage(
          { userId, phone, mediaUrl, mediaType },
          {
            sendMessage: sendWhatsAppMessage,
            downloadMedia: downloadTwilioMedia,
            analyzeImage,
            createDirectExpense,
            createVisionReceiptDraft,
            resolveDefaultAccount,
            today: todayYmd,
          },
        );
      } catch (err) {
        console.error('Error en handleImageMessage (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema leyendo tu imagen. Inténtalo de nuevo.',
        );
      }
    });
    return xml(twimlMessage('📷 Recibí tu imagen, la estoy leyendo (~30s)...'));
  }
```

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bunx eslint src/app/api/whatsapp/webhook/route.ts`
Expected: PASS (correr `bunx eslint --fix` si import/order lo pide). Verificar que la suite completa sigue verde: `bun run test`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit --no-verify -m "feat: webhook procesa imágenes (visión) con ACK + after"
```

---

## Task 9: Verificación end-to-end + suite

**Files:** (ninguno; verificación)

- [ ] **Step 1: Suite completa**

Run: `bun run test`
Expected: PASS (nuevos tests de Plan 4 + los de Planes 1-3).

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS (solo warnings `no-console` preexistentes).

- [ ] **Step 3: Verificación manual (requiere deploy + `VISION_MODEL` en Vercel)**

Con un número vinculado, desde WhatsApp:

1. **Transferencia:** enviar un screenshot de una transferencia (Nequi/Bancolombia) → ACK "📷 Recibí tu imagen..." y luego "✅ Registré $X en <categoría> (<cuenta deducida>)...". Verificar el gasto en `/gastos` y que la cuenta corresponda al origen.
2. **Factura foto sin CUFE:** enviar una foto de un recibo con ítems → "✅ Leí tu factura de <tienda> (N ítems). Queda lista para revisar..." → verificar el borrador en la bandeja "Facturas por aprobar" (con `source` vision_receipt) y aprobarlo → N gastos.
3. **Imagen ilegible / no financiera:** enviar una foto cualquiera → "No pude leer la imagen...".

- [ ] **Step 4: Verificar en DB el borrador de visión**

Run (MCP `execute_sql`): `SELECT source, cufe_code, supplier_name, status, jsonb_array_length(items) AS n FROM electronic_invoices WHERE source='vision_receipt' ORDER BY created_at DESC LIMIT 3;`
Expected: filas con `source='vision_receipt'`, `cufe_code` NULL, `status='pending_review'`.

---

## Done cuando

- `bun run test`, `bun run type-check`, `bun run lint` pasan.
- Enviar un screenshot de transferencia → gasto directo con la cuenta deducida + confirmación.
- Enviar una foto de factura sin CUFE → borrador con ítems en la bandeja, aprobable con el flujo existente.
- Imagen ilegible → mensaje de orientación.
- Reusa la visión MiniMax-VL (validada), el transporte y el motor de gastos/facturas sin romper los planes anteriores.

## Fuera de alcance (futuro)

- **Estado de conversación** (`whatsapp_conversations`) para preguntas de seguimiento en media confianza (p. ej. confirmar cuenta/categoría o un monto dudoso). Hoy: receipt→revisar en app, transfer→editar en app, baja confianza→reenviar.
- **QR de factura por foto** (jimp+jsqr) — el QR sigue funcionando por **texto** (extractCufe ya lee el bloque del QR pegado); decodificar la imagen del QR queda pendiente.
- UI para configurar `default_account_name` por número en `/settings`.
- Mapear la cuenta deducida por visión a la lista exacta de cuentas del usuario (hoy se usa el texto deducido tal cual).
- Guardar la imagen original en Supabase Storage.
