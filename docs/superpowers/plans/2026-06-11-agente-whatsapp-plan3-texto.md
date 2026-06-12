# Plan 3 — Agente de WhatsApp: entradas de texto (CUFE + gasto rápido) + backbone async

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un número ya vinculado pueda, por WhatsApp, **pegar un CUFE** (→ se procesa en background y queda como borrador para aprobar) o **escribir un gasto en texto libre** ("20k taxi" → gasto directo), recibiendo respuestas asíncronas del bot.

**Architecture:** El webhook valida la firma (Plan 2) y resuelve identidad con `getLinkByPhone` (service-role). Si el número NO está vinculado → flujo de vinculación síncrono con TwiML (Plan 2, intacto). Si está vinculado → **clasifica el texto** (función pura) y responde un ACK síncrono (TwiML); el trabajo lento (CUFE ~1min, o crear el gasto) corre en `after()` y la respuesta final se manda por la **REST API de Twilio** (transporte saliente). El motor CUFE del Plan 1 (`prepare/runInvoiceProcessing`) se **refactoriza para aceptar un cliente Supabase inyectado**: la web sigue usando el cliente por cookie; WhatsApp inyecta el **service-role** (`createAdminClient`, ya existe) con el `userId` resuelto. Las imágenes se difieren al Plan 4 (responde un stub "pronto").

**Tech Stack:** Next.js 15 (`after`), TypeScript, Node `fetch` (Twilio REST), Supabase (cookie para web, service-role para WhatsApp), Vitest, MiniMax (categorización, ya existe), Twilio WhatsApp.

**Notas de base:**
- `createAdminClient()` (service-role) y `getLinkByPhone` (Plan 2) ya existen.
- `prepareInvoiceProcessing`/`runInvoiceProcessing` (Plan 1) ya traen retry + error real + onProgress; aquí solo se les inyecta el cliente.
- `TWILIO_AUTH_TOKEN` ya está en Vercel. Faltan `TWILIO_ACCOUNT_SID` y `TWILIO_WHATSAPP_FROM`.
- Decisión de producto para texto libre (sin estado de conversación, que llega en Plan 4): **cuenta = `whatsapp_links.default_account_name` ?? 'Efectivo'**; **categoría = IA (`categorizeInvoiceItems`) sobre la descripción, fallback 'OTROS'**; fecha = hoy (servidor, UTC; aceptable en v1). El usuario puede corregir el gasto en la web.
- Tipo de cliente compartido: `SupabaseClient<Database>` (de `@supabase/supabase-js`, ya es dependencia).

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `.env.example` | `TWILIO_ACCOUNT_SID`, `TWILIO_WHATSAPP_FROM` | Modificar |
| `src/lib/whatsapp/transport.ts` | `sendWhatsAppMessage(to, body)` vía Twilio REST | Crear |
| `src/lib/whatsapp/transport.test.ts` | Tests (fetch mock) | Crear |
| `src/lib/whatsapp/quick-expense.ts` | `parseQuickExpense(text)` (pura) | Crear |
| `src/lib/whatsapp/quick-expense.test.ts` | Tests | Crear |
| `src/lib/whatsapp/classify.ts` | `classifyText`, `ackMessage`, `simpleReply`, `isCufe` (puras) | Crear |
| `src/lib/whatsapp/classify.test.ts` | Tests | Crear |
| `src/lib/services/invoices.ts` | Inyectar `client?: SupabaseClient<Database>` en las 6 funciones que usa el motor | Modificar |
| `src/lib/dian/process-invoice.ts` | Pasar `client` por `prepare`/`run` a las funciones de servicio | Modificar |
| `src/lib/services/whatsapp-expenses.ts` | `resolveDefaultAccount`, `createDirectExpense` (service-role) | Crear |
| `src/lib/services/whatsapp-expenses.test.ts` | Tests (admin mock) | Crear |
| `src/lib/whatsapp/handle-agent.ts` | `handleAgentMessage(decision, ctx, deps)` (orquestador, deps inyectadas) | Crear |
| `src/lib/whatsapp/handle-agent.test.ts` | Tests | Crear |
| `src/app/api/whatsapp/webhook/route.ts` | Linked → clasifica → ACK + `after(handleAgentMessage)` | Modificar |

---

## Task 1: Variables de entorno del transporte saliente

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Agregar las variables**

En `.env.example`, dentro de la sección `# === WhatsApp (Twilio) ===` (después de `WHATSAPP_WEBHOOK_URL=`), agregar:

```bash
# Account SID de Twilio (para enviar mensajes salientes vía REST API).
TWILIO_ACCOUNT_SID=
# Remitente de WhatsApp (número del sandbox o sender aprobado), con prefijo whatsapp:.
# Ej (sandbox): whatsapp:+14155238886
TWILIO_WHATSAPP_FROM=
```

- [ ] **Step 2: Configurar en Vercel (manual, secreto/no-commit)**

Setear `TWILIO_ACCOUNT_SID` (copiar del dashboard de Twilio) y `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886` en Vercel producción (CLI `vercel env add` o dashboard). El `TWILIO_ACCOUNT_SID` no es tan sensible como el token, pero igual va por la vía del usuario/manual.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit --no-verify -m "chore: env de transporte saliente de WhatsApp (Twilio REST)"
```

---

## Task 2: Transporte saliente (Twilio REST)

**Files:**
- Create: `src/lib/whatsapp/transport.ts`
- Test: `src/lib/whatsapp/transport.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/transport.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendWhatsAppMessage } from './transport';

describe('sendWhatsAppMessage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok456');
    vi.stubEnv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
  });

  it('hace POST a la API de Twilio con auth básica y form body', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => '{}' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'Hola 👋');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:tok456').toString('base64')}`);
    const body = init.body as URLSearchParams;
    expect(body.get('From')).toBe('whatsapp:+14155238886');
    expect(body.get('To')).toBe('whatsapp:+573001234567');
    expect(body.get('Body')).toBe('Hola 👋');
  });

  it('normaliza el To: no duplica el prefijo whatsapp:', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201, text: async () => '{}' }));
    vi.stubGlobal('fetch', fetchMock);

    await sendWhatsAppMessage('whatsapp:+573001234567', 'x');

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('To')).toBe('whatsapp:+573001234567');
  });

  it('devuelve ok:false si faltan credenciales (no lanza)', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'x');

    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve ok:false si Twilio responde error (no lanza)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 400, text: async () => 'bad' }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'x');

    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/transport.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/transport.ts`:

```ts
// Transporte saliente de WhatsApp vía la REST API de Twilio.
// Interfaz delgada y reemplazable: el núcleo del agente solo depende de
// `sendWhatsAppMessage`, así que migrar a Meta Cloud API = otra implementación.

export interface SendResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/** Asegura el prefijo whatsapp: en un número E.164 sin duplicarlo. */
function toWhatsApp(addr: string): string {
  const trimmed = addr.trim();
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`;
}

/**
 * Envía un mensaje de WhatsApp por Twilio. Nunca lanza: ante credenciales
 * faltantes o error de Twilio devuelve { ok: false } (el llamador decide).
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    console.error('Transporte WhatsApp sin configurar (SID/TOKEN/FROM)');
    return { ok: false, error: 'no_config' };
  }

  const params = new URLSearchParams();
  params.set('From', from);
  params.set('To', toWhatsApp(to));
  params.set('Body', body);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`Twilio respondió ${res.status}: ${detail}`);
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error('Error enviando WhatsApp:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/transport.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/transport.ts src/lib/whatsapp/transport.test.ts
git commit --no-verify -m "feat: transporte saliente de WhatsApp (Twilio REST)"
```

---

## Task 3: Parser de gasto rápido (puro)

**Files:**
- Create: `src/lib/whatsapp/quick-expense.ts`
- Test: `src/lib/whatsapp/quick-expense.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/quick-expense.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseQuickExpense } from './quick-expense';

describe('parseQuickExpense', () => {
  it('"20k taxi" → 20000 / taxi', () => {
    expect(parseQuickExpense('20k taxi')).toEqual({ amount: 20000, description: 'taxi' });
  });

  it('"taxi 20k" → 20000 / taxi (monto al final)', () => {
    expect(parseQuickExpense('taxi 20k')).toEqual({ amount: 20000, description: 'taxi' });
  });

  it('"gasté 35000 en mercado" → 35000 / mercado', () => {
    expect(parseQuickExpense('gasté 35000 en mercado')).toEqual({
      amount: 35000,
      description: 'mercado',
    });
  });

  it('"$15.000 almuerzo" → 15000 / almuerzo (separador de miles con punto)', () => {
    expect(parseQuickExpense('$15.000 almuerzo')).toEqual({
      amount: 15000,
      description: 'almuerzo',
    });
  });

  it('"2 mil pan" → 2000 / pan', () => {
    expect(parseQuickExpense('2 mil pan')).toEqual({ amount: 2000, description: 'pan' });
  });

  it('"1.5k café" → 1500 / café (k con decimal)', () => {
    expect(parseQuickExpense('1.5k café')).toEqual({ amount: 1500, description: 'café' });
  });

  it('sin monto → null', () => {
    expect(parseQuickExpense('hola')).toBeNull();
    expect(parseQuickExpense('')).toBeNull();
  });

  it('sin descripción usable → null (solo número)', () => {
    expect(parseQuickExpense('20000')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/quick-expense.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/quick-expense.ts`:

```ts
// Parser puro de un gasto escrito en lenguaje natural simple.
// Reconoce un monto (con k/mil y separadores) y toma el resto como descripción.

export interface QuickExpense {
  amount: number;
  description: string;
}

// Palabras de relleno que no aportan a la descripción.
const STOPWORDS = new Set(['gasté', 'gaste', 'en', 'de', 'por', 'pague', 'pagué', '$']);

/** Convierte un token de monto ("20k", "15.000", "2", "1.5k") a número, o null. */
function parseAmountToken(raw: string): number | null {
  let t = raw.toLowerCase().replace(/\$/g, '');
  let multiplier = 1;
  if (t.endsWith('k')) {
    multiplier = 1000;
    t = t.slice(0, -1);
  }
  // Quitar separadores de miles con punto/coma cuando hay 3 dígitos detrás.
  // "15.000" → "15000"; pero "1.5" (decimal con k) se respeta.
  if (multiplier === 1000) {
    t = t.replace(',', '.'); // decimal con k: "1,5k" → 1.5
  } else {
    t = t.replace(/[.,](?=\d{3}\b)/g, ''); // miles: "15.000" → "15000"
    t = t.replace(',', '.');
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * multiplier);
}

export function parseQuickExpense(text: string): QuickExpense | null {
  const trimmed = (text || '').trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);

  // "2 mil" / "1.5 mil": número seguido de "mil".
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^mil$/i.test(tokens[i + 1])) {
      const base = Number(tokens[i].replace(',', '.'));
      if (Number.isFinite(base) && base > 0) {
        const rest = [...tokens.slice(0, i), ...tokens.slice(i + 2)]
          .filter(w => !STOPWORDS.has(w.toLowerCase()))
          .join(' ')
          .trim();
        if (!rest) return null;
        return { amount: Math.round(base * 1000), description: rest };
      }
    }
  }

  // Buscar el primer token que sea monto; el resto (sin stopwords) es descripción.
  let amount: number | null = null;
  let amountIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const a = parseAmountToken(tokens[i]);
    if (a != null) {
      amount = a;
      amountIdx = i;
      break;
    }
  }
  if (amount == null) return null;

  const description = tokens
    .filter((_, i) => i !== amountIdx)
    .filter(w => !STOPWORDS.has(w.toLowerCase()))
    .join(' ')
    .trim();
  if (!description) return null;

  return { amount, description };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/quick-expense.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/quick-expense.ts src/lib/whatsapp/quick-expense.test.ts
git commit --no-verify -m "feat: parser de gasto rápido en texto libre"
```

---

## Task 4: Clasificación de texto + mensajes (puro)

**Files:**
- Create: `src/lib/whatsapp/classify.ts`
- Test: `src/lib/whatsapp/classify.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/classify.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ackMessage, classifyText, isCufe, simpleReply } from './classify';

// Un CUFE DIAN real es un hash hex de 96 caracteres.
const CUFE = 'a'.repeat(96);

describe('isCufe', () => {
  it('acepta 96 hex', () => {
    expect(isCufe(CUFE)).toBe(true);
    expect(isCufe(`  ${CUFE}  `)).toBe(true);
  });
  it('rechaza longitudes/!hex', () => {
    expect(isCufe('a'.repeat(95))).toBe(false);
    expect(isCufe('z'.repeat(96))).toBe(false);
    expect(isCufe('hola')).toBe(false);
  });
});

describe('classifyText', () => {
  it('imagen (numMedia>0) → image', () => {
    expect(classifyText('', 1)).toBe('image');
    expect(classifyText(CUFE, 1)).toBe('image'); // media manda
  });
  it('CUFE → cufe', () => {
    expect(classifyText(CUFE, 0)).toBe('cufe');
  });
  it('ayuda → help', () => {
    expect(classifyText('ayuda', 0)).toBe('help');
    expect(classifyText('HELP', 0)).toBe('help');
  });
  it('gasto rápido → quick_expense', () => {
    expect(classifyText('20k taxi', 0)).toBe('quick_expense');
  });
  it('no entendible → unknown', () => {
    expect(classifyText('hola', 0)).toBe('unknown');
  });
});

describe('ackMessage', () => {
  it('cufe y quick_expense tienen ack interino', () => {
    expect(ackMessage('cufe')).toMatch(/factura|proces/i);
    expect(ackMessage('quick_expense')).toMatch(/anot|registr|gast/i);
  });
});

describe('simpleReply', () => {
  it('image avisa que las fotos llegan pronto', () => {
    expect(simpleReply('image')).toMatch(/foto|imagen|pronto/i);
  });
  it('help lista lo que puede hacer', () => {
    expect(simpleReply('help')).toMatch(/CUFE/i);
  });
  it('unknown orienta al usuario', () => {
    expect(simpleReply('unknown')).toMatch(/CUFE|gasto/i);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/classify.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/classify.ts`:

```ts
// Clasificación pura del mensaje de un usuario YA vinculado, y los textos de
// respuesta. No toca DB ni red: el webhook clasifica de forma síncrona para
// responder un ACK inmediato y decidir qué corre en background.

import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';

export type Decision = 'cufe' | 'quick_expense' | 'image' | 'help' | 'unknown';

/** Un CUFE DIAN es un hash hexadecimal de 96 caracteres. */
export function isCufe(text: string): boolean {
  return /^[0-9a-f]{96}$/i.test((text || '').trim());
}

export function classifyText(body: string, numMedia: number): Decision {
  if (numMedia > 0) return 'image';
  const text = (body || '').trim();
  if (isCufe(text)) return 'cufe';
  if (/^(ayuda|help)$/i.test(text)) return 'help';
  if (parseQuickExpense(text)) return 'quick_expense';
  return 'unknown';
}

/** Respuesta inmediata (TwiML) para los casos que siguen en background. */
export function ackMessage(decision: 'cufe' | 'quick_expense'): string {
  if (decision === 'cufe') {
    return '🧾 Recibí tu factura, la estoy procesando (~1 min). Te aviso cuando esté lista para revisar.';
  }
  return '✍️ Anotando tu gasto...';
}

/** Respuesta completa (TwiML) para los casos que NO necesitan background. */
export function simpleReply(decision: 'image' | 'help' | 'unknown'): string {
  if (decision === 'image') {
    return '📷 ¡Gracias! Aún no proceso fotos ni QR, pero muy pronto podré. Por ahora envíame el CUFE en texto o un gasto como "20k taxi".';
  }
  if (decision === 'help') {
    return [
      'Puedo registrar tus gastos 💸',
      '• Pega el *CUFE* de una factura DIAN → la dejo lista para aprobar.',
      '• Escribe un gasto: "20k taxi", "gasté 35000 en mercado".',
      '(Las fotos y QR llegan pronto.)',
    ].join('\n');
  }
  return 'No te entendí 🤔. Pega el *CUFE* de una factura, o escribe un gasto como "20k taxi". Escribe *ayuda* para ver qué puedo hacer.';
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/classify.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/classify.ts src/lib/whatsapp/classify.test.ts
git commit --no-verify -m "feat: clasificación de texto del agente + mensajes"
```

---

## Task 5: Inyectar cliente Supabase en el servicio de facturas

**Files:**
- Modify: `src/lib/services/invoices.ts`

Objetivo: que las 6 funciones que usa el motor CUFE acepten un cliente opcional. Sin cliente → cookie (web, igual que hoy). Con cliente → el que se inyecte (service-role para WhatsApp). Backward-compatible.

- [ ] **Step 1: Agregar el tipo de cliente y el import**

En `src/lib/services/invoices.ts`, en los imports superiores, agregar:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
```

Y justo después de los imports, agregar el alias:

```ts
type DBClient = SupabaseClient<Database>;
```

- [ ] **Step 2: Inyectar `client` en `getInvoiceByCufe`**

Reemplazar la firma y la obtención del cliente:

```ts
export async function getInvoiceByCufe(
  userId: string,
  cufe: string,
  client?: DBClient,
): Promise<ElectronicInvoice | null> {
  const supabase = client ?? (await createClient());
```

(El resto del cuerpo no cambia.)

- [ ] **Step 3: Inyectar `client` en `createProcessingInvoice`**

```ts
export async function createProcessingInvoice(
  userId: string,
  cufe: string,
  client?: DBClient,
): Promise<string | null> {
  const supabase = client ?? (await createClient());
```

- [ ] **Step 4: Inyectar `client` en `resetInvoiceToProcessing`**

```ts
export async function resetInvoiceToProcessing(
  invoiceId: string,
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
```

- [ ] **Step 5: Inyectar `client` en `markInvoiceError`**

```ts
export async function markInvoiceError(
  invoiceId: string,
  message: string,
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
```

- [ ] **Step 6: Inyectar `client` en `saveProcessedInvoice`**

```ts
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
  client?: DBClient,
): Promise<void> {
  const supabase = client ?? (await createClient());
```

- [ ] **Step 7: Inyectar `client` + `userId` en `resolveUserCategoryNames`**

El cliente admin no aplica RLS, así que sin filtro devolvería categorías de TODOS los usuarios. Por eso, cuando se inyecta cliente, se exige `userId` para filtrar:

```ts
export async function resolveUserCategoryNames(
  client?: DBClient,
  userId?: string,
): Promise<string[]> {
  const supabase = client ?? (await createClient());
  let query = supabase
    .from('categories')
    .select('name')
    .eq('is_active', true);
  if (userId) {
    query = query.eq('user_id', userId);
  }
  const { data } = await query.order('name');
  if (data && data.length > 0) {
    return data.map(c => c.name as string);
  }
  return [...EXPENSE_CATEGORIES];
}
```

- [ ] **Step 8: Type-check + lint + suite (web sigue verde)**

Run: `bun run type-check && bunx eslint src/lib/services/invoices.ts && bun run test`
Expected: PASS. (Las llamadas existentes sin `client` siguen compilando porque el parámetro es opcional.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/invoices.ts
git commit --no-verify -m "refactor: inyectar cliente Supabase opcional en servicio de facturas"
```

---

## Task 6: Pasar el cliente por el motor de procesamiento

**Files:**
- Modify: `src/lib/dian/process-invoice.ts`

- [ ] **Step 1: Agregar `client` opcional a `prepareInvoiceProcessing`**

En `src/lib/dian/process-invoice.ts`, importar el tipo y agregar el alias (junto a los imports):

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';
```

y, tras los imports:

```ts
type DBClient = SupabaseClient<Database>;
```

Reemplazar `prepareInvoiceProcessing` para aceptar y pasar el cliente:

```ts
export async function prepareInvoiceProcessing(
  userId: string,
  cufe: string,
  client?: DBClient,
): Promise<PrepareResult> {
  const existing = await getInvoiceByCufe(userId, cufe, client);
  if (
    existing &&
    (existing.status === 'pending_review' || existing.status === 'approved')
  ) {
    return { kind: 'duplicate', invoice: existing };
  }

  let invoiceId: string | null;
  if (existing) {
    invoiceId = existing.id;
    await resetInvoiceToProcessing(existing.id, client);
  } else {
    invoiceId = await createProcessingInvoice(userId, cufe, client);
  }
  if (!invoiceId) {
    return { kind: 'error', message: 'No se pudo crear el borrador' };
  }
  return { kind: 'ready', invoiceId };
}
```

- [ ] **Step 2: Agregar `client` a `RunOptions` y usarlo en `runInvoiceProcessing`**

Agregar el campo a la interfaz `RunOptions`:

```ts
export interface RunOptions {
  /** Categorías candidatas para la IA (las activas del usuario; fallback arriba). */
  categoryNames: string[];
  /** Se invoca con cada evento de avance; el route lo usa para persistir progreso. */
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  /** Base del backoff entre reintentos (ms). Default 5000; los tests pasan 0. */
  retryBaseMs?: number;
  /** Cliente Supabase a inyectar (service-role para WhatsApp). Web: cookie por defecto. */
  client?: DBClient;
}
```

En `runInvoiceProcessing`, extraer `client` de `opts` y pasarlo a `saveProcessedInvoice` y `markInvoiceError`. Reemplazar la línea de desestructuración:

```ts
  const { categoryNames, onProgress, retryBaseMs, client } = opts;
```

la llamada a `saveProcessedInvoice`:

```ts
    await saveProcessedInvoice(
      invoiceId,
      {
        supplierName: result.invoice_details.storeName,
        supplierNit: result.invoice_details.nit,
        invoiceDate: result.invoice_details.date,
        currency: result.invoice_details.currency,
        subtotal: result.invoice_details.subtotal,
        totalAmount: result.invoice_details.total_amount,
        items: storedItems,
        processingTimeMs: Date.now() - startTime,
      },
      client,
    );
```

y la del `catch`:

```ts
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markInvoiceError(invoiceId, message, client);
    return { ok: false, message };
  }
```

- [ ] **Step 3: Suite + type-check (los tests del Plan 1 siguen verdes)**

Run: `bun run test src/lib/dian/process-invoice.test.ts && bun run type-check`
Expected: PASS. (Los tests existentes no pasan `client`, así que usan cookie por defecto — su mock de `@/lib/services/invoices` no se ve afectado.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/dian/process-invoice.ts
git commit --no-verify -m "feat: process-invoice acepta cliente inyectado (service-role para WhatsApp)"
```

---

## Task 7: Servicio de gasto directo (service-role)

**Files:**
- Create: `src/lib/services/whatsapp-expenses.ts`
- Test: `src/lib/services/whatsapp-expenses.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/services/whatsapp-expenses.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(async () => ['MERCADO']),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { createAdminClient } from '@/lib/supabase/server';
import { createDirectExpense, resolveDefaultAccount } from './whatsapp-expenses';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

describe('resolveDefaultAccount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa default_account_name del número si existe', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { default_account_name: 'Nequi' } }),
    }));
    mockedAdmin.mockReturnValue({ from });
    expect(await resolveDefaultAccount('+573001234567')).toBe('Nequi');
  });

  it('cae a Efectivo si no hay default', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { default_account_name: null } }),
    }));
    mockedAdmin.mockReturnValue({ from });
    expect(await resolveDefaultAccount('+573001234567')).toBe('Efectivo');
  });
});

describe('createDirectExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  it('categoriza con IA y llama upsert_monthly_expense con los args correctos', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const catFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ name: 'MERCADO' }] }),
    }));
    mockedAdmin.mockReturnValue({ rpc, from: catFrom });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 20000,
      description: 'mercado',
      accountName: 'Nequi',
      date: '2026-06-11',
    });

    expect(res.ok).toBe(true);
    expect(res.category).toBe('MERCADO');
    expect(categorizeInvoiceItems).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('upsert_monthly_expense', {
      p_user_id: 'user-1',
      p_description: 'mercado',
      p_amount: 20000,
      p_transaction_date: '2026-06-11',
      p_category_name: 'MERCADO',
      p_account_name: 'Nequi',
      p_place: 'WhatsApp',
    });
  });

  it('devuelve ok:false si el RPC falla', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { message: 'boom' } });
    const catFrom = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [] }),
    }));
    mockedAdmin.mockReturnValue({ rpc, from: catFrom });

    const res = await createDirectExpense('user-1', '+573001234567', {
      amount: 1000,
      description: 'x',
      accountName: 'Efectivo',
      date: '2026-06-11',
    });

    expect(res.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/services/whatsapp-expenses.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/services/whatsapp-expenses.ts`:

```ts
// Creación de gastos directos desde WhatsApp (texto libre). Usa service-role
// (sin sesión) con el userId ya resuelto por el vínculo del número.

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import { resolveUserCategoryNames } from '@/lib/services/invoices';
import { createAdminClient } from '@/lib/supabase/server';

const FALLBACK_ACCOUNT = 'Efectivo';

/** Cuenta por defecto del número (columna en whatsapp_links) o 'Efectivo'. */
export async function resolveDefaultAccount(phoneE164: string): Promise<string> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_links')
    .select('default_account_name')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  const acc = (data as { default_account_name: string | null } | null)
    ?.default_account_name;
  return acc && acc.trim() ? acc : FALLBACK_ACCOUNT;
}

export interface DirectExpenseInput {
  amount: number;
  description: string;
  accountName: string;
  date: string; // YYYY-MM-DD
}

export interface DirectExpenseResult {
  ok: boolean;
  category: string;
  error?: string;
}

/**
 * Crea un gasto directo: categoriza la descripción con IA (categorías del
 * usuario) y lo inserta vía el RPC existente upsert_monthly_expense.
 */
export async function createDirectExpense(
  userId: string,
  _phoneE164: string,
  input: DirectExpenseInput,
): Promise<DirectExpenseResult> {
  const supabase = createAdminClient();

  const categoryNames = await resolveUserCategoryNames(supabase, userId);
  const [category] = await categorizeInvoiceItems(
    [{ description: input.description }],
    categoryNames,
  );
  const finalCategory = category ?? 'OTROS';

  const { error } = await supabase.rpc('upsert_monthly_expense', {
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
  return { ok: true, category: finalCategory };
}
```

Nota: el 2º parámetro (`_phoneE164`) se recibe por consistencia de firma con el orquestador aunque aquí no se use (la cuenta ya viene resuelta en `input.accountName`). Va con guion bajo para no disparar `no-unused-vars`.

- [ ] **Step 4: Correr el test + type-check**

Run: `bun run test src/lib/services/whatsapp-expenses.test.ts && bun run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/whatsapp-expenses.ts src/lib/services/whatsapp-expenses.test.ts
git commit --no-verify -m "feat: gasto directo desde WhatsApp (service-role + IA)"
```

---

## Task 8: Orquestador del agente (deps inyectadas)

**Files:**
- Create: `src/lib/whatsapp/handle-agent.ts`
- Test: `src/lib/whatsapp/handle-agent.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/handle-agent.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { handleAgentMessage } from './handle-agent';

const CUFE = 'a'.repeat(96);

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true })),
    processCufe: vi.fn(async () => ({ ok: true, itemsFound: 3 })),
    createDirectExpense: vi.fn(async () => ({ ok: true, category: 'MERCADO' })),
    resolveDefaultAccount: vi.fn(async () => 'Nequi'),
    today: () => '2026-06-11',
    ...overrides,
  };
}

describe('handleAgentMessage', () => {
  it('cufe ok → procesa y avisa "lista para revisar"', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+573001234567', body: CUFE },
      deps,
    );
    expect(deps.processCufe).toHaveBeenCalledWith('u1', CUFE);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+573001234567',
      expect.stringMatching(/revisar|lista|aprobar/i),
    );
  });

  it('cufe duplicado → avisa que ya estaba procesada', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'duplicate' })),
    });
    await handleAgentMessage('cufe', { userId: 'u1', phone: '+57300', body: CUFE }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/ya/i),
    );
  });

  it('cufe error → avisa el error', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'error', message: 'DIAN caído' })),
    });
    await handleAgentMessage('cufe', { userId: 'u1', phone: '+57300', body: CUFE }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude|error|falló/i),
    );
  });

  it('quick_expense → crea gasto y confirma con monto y categoría', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'quick_expense',
      { userId: 'u1', phone: '+573001234567', body: '20k mercado' },
      deps,
    );
    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+573001234567');
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+573001234567', {
      amount: 20000,
      description: 'mercado',
      accountName: 'Nequi',
      date: '2026-06-11',
    });
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+573001234567',
      expect.stringMatching(/20.?000/),
    );
  });

  it('quick_expense con texto no parseable → pide reformular (no crea gasto)', async () => {
    const deps = makeDeps();
    await handleAgentMessage('quick_expense', { userId: 'u1', phone: '+57300', body: 'hola' }, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/handle-agent.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/handle-agent.ts`:

```ts
// Orquestador del agente para mensajes de un usuario YA vinculado. Corre en
// background (after) y manda las respuestas por el transporte saliente. Deps
// inyectadas para testear sin red ni DB.

import { parseQuickExpense } from '@/lib/whatsapp/quick-expense';

// Formateo COP inline: NO importar de '@/lib/services/expenses' (ese módulo crea
// un cliente de Supabase de navegador a nivel de módulo y rompería en servidor).
function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export type CufeOutcome =
  | { ok: true; itemsFound: number }
  | { ok: false; reason: 'duplicate' }
  | { ok: false; reason: 'error'; message: string };

export interface AgentDeps {
  sendMessage: (to: string, body: string) => Promise<{ ok: boolean }>;
  processCufe: (userId: string, cufe: string) => Promise<CufeOutcome>;
  createDirectExpense: (
    userId: string,
    phone: string,
    input: { amount: number; description: string; accountName: string; date: string },
  ) => Promise<{ ok: boolean; category: string; error?: string }>;
  resolveDefaultAccount: (phone: string) => Promise<string>;
  today: () => string; // YYYY-MM-DD
}

export interface AgentContext {
  userId: string;
  phone: string;
  body: string;
}

export async function handleAgentMessage(
  decision: 'cufe' | 'quick_expense',
  ctx: AgentContext,
  deps: AgentDeps,
): Promise<void> {
  if (decision === 'cufe') {
    const cufe = ctx.body.trim();
    const out = await deps.processCufe(ctx.userId, cufe);
    if (out.ok) {
      await deps.sendMessage(
        ctx.phone,
        `✅ Tu factura quedó lista para revisar y aprobar en la app (${out.itemsFound} ítems).`,
      );
    } else if (out.reason === 'duplicate') {
      await deps.sendMessage(ctx.phone, 'Esa factura ya la había procesado. 👍');
    } else {
      await deps.sendMessage(
        ctx.phone,
        `❌ No pude procesar la factura: ${out.message}. Puedes reintentar más tarde.`,
      );
    }
    return;
  }

  // quick_expense
  const parsed = parseQuickExpense(ctx.body);
  if (!parsed) {
    await deps.sendMessage(
      ctx.phone,
      'No logré entender el gasto 🤔. Escríbelo como "20k taxi" o "gasté 35000 en mercado".',
    );
    return;
  }
  const accountName = await deps.resolveDefaultAccount(ctx.phone);
  const res = await deps.createDirectExpense(ctx.userId, ctx.phone, {
    amount: parsed.amount,
    description: parsed.description,
    accountName,
    date: deps.today(),
  });
  if (res.ok) {
    await deps.sendMessage(
      ctx.phone,
      `✅ Registré ${formatCOP(parsed.amount)} en ${res.category} (${accountName}) · ${parsed.description}. Si algo está mal, edítalo en la app.`,
    );
  } else {
    await deps.sendMessage(
      ctx.phone,
      `❌ No pude registrar el gasto: ${res.error ?? 'error desconocido'}.`,
    );
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/handle-agent.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/handle-agent.ts src/lib/whatsapp/handle-agent.test.ts
git commit --no-verify -m "feat: orquestador del agente WhatsApp (CUFE + gasto rápido)"
```

---

## Task 9: Conectar el webhook (linked → clasifica → ACK + after)

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Reemplazar el route**

Reemplazar TODO el contenido de `src/app/api/whatsapp/webhook/route.ts` por:

```ts
// POST /api/whatsapp/webhook
// Webhook público de Twilio. Valida la firma, resuelve identidad y:
//  - número NO vinculado → flujo de vinculación síncrono (TwiML).
//  - vinculado → clasifica el texto, responde un ACK síncrono y, si hay trabajo
//    lento (CUFE / gasto), lo corre en after() respondiendo por la REST API.

import { after, NextRequest } from 'next/server';

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
} from '@/lib/dian/process-invoice';
import { resolveUserCategoryNames } from '@/lib/services/invoices';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import {
  getLinkByPhone,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
import { createAdminClient } from '@/lib/supabase/server';
import { ackMessage, classifyText, simpleReply } from '@/lib/whatsapp/classify';
import {
  handleAgentMessage,
  type CufeOutcome,
} from '@/lib/whatsapp/handle-agent';
import { handleLinkingMessage } from '@/lib/whatsapp/handle-linking';
import { normalizeWhatsappFrom } from '@/lib/whatsapp/message';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';
import { isValidTwilioSignature } from '@/lib/whatsapp/twilio-signature';
import { twimlEmpty, twimlMessage } from '@/lib/whatsapp/twiml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function xml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

/** Procesa un CUFE para WhatsApp con service-role; mapea el resultado a CufeOutcome. */
async function processCufeForWhatsApp(
  userId: string,
  cufe: string,
): Promise<CufeOutcome> {
  const admin = createAdminClient();
  const prep = await prepareInvoiceProcessing(userId, cufe, admin);
  if (prep.kind === 'duplicate') return { ok: false, reason: 'duplicate' };
  if (prep.kind === 'error') return { ok: false, reason: 'error', message: prep.message };

  const categoryNames = await resolveUserCategoryNames(admin, userId);
  const run = await runInvoiceProcessing(prep.invoiceId, cufe, {
    categoryNames,
    client: admin,
  });
  if (run.ok) return { ok: true, itemsFound: run.itemsFound };
  return { ok: false, reason: 'error', message: run.message };
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!authToken || !webhookUrl) {
    return new Response('Webhook no configurado', { status: 500 });
  }

  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = typeof value === 'string' ? value : '';
  }

  const signature = request.headers.get('x-twilio-signature') || '';
  if (!isValidTwilioSignature(authToken, signature, webhookUrl, params)) {
    return new Response('Firma inválida', { status: 403 });
  }

  const phone = normalizeWhatsappFrom(params.From || '');
  if (!phone) {
    return xml(twimlEmpty());
  }

  const body = params.Body || '';
  const numMedia = Number.parseInt(params.NumMedia || '0', 10) || 0;

  // ¿Vinculado?
  const link = await getLinkByPhone(phone);
  if (!link) {
    // Flujo de vinculación (Plan 2): síncrono.
    const reply = await handleLinkingMessage(phone, body, {
      redeemLinkCode,
      getLinkByPhone,
    });
    return xml(twimlMessage(reply));
  }

  const decision = classifyText(body, numMedia);

  if (decision === 'cufe' || decision === 'quick_expense') {
    const userId = link.userId;
    after(async () => {
      await handleAgentMessage(
        decision,
        { userId, phone, body },
        {
          sendMessage: sendWhatsAppMessage,
          processCufe: processCufeForWhatsApp,
          createDirectExpense,
          resolveDefaultAccount,
          today: todayYmd,
        },
      );
    });
    return xml(twimlMessage(ackMessage(decision)));
  }

  // image / help / unknown → respuesta completa síncrona.
  return xml(twimlMessage(simpleReply(decision)));
}
```

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bunx eslint src/app/api/whatsapp/webhook/route.ts`
Expected: PASS (corregir import/order si el linter lo pide).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit --no-verify -m "feat: webhook enruta a agente (CUFE/gasto) con ACK + after"
```

---

## Task 10: Verificación end-to-end + suite

**Files:** (ninguno; verificación)

- [ ] **Step 1: Suite completa**

Run: `bun run test`
Expected: PASS (nuevos tests de Plan 3 + los de Planes 1 y 2).

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS (solo warnings `no-console` preexistentes).

- [ ] **Step 3: Verificación manual (Twilio sandbox, requiere deploy + env)**

Requiere: `TWILIO_ACCOUNT_SID` + `TWILIO_WHATSAPP_FROM` seteadas en Vercel y un redeploy a producción. Con un número ya vinculado (Plan 2):

1. **Gasto rápido:** enviar `20k taxi` por WhatsApp → ACK "✍️ Anotando..." y luego "✅ Registré $20.000 en TRANSPORTE (Efectivo) · taxi...". Verificar el gasto en la app (mes actual).
2. **CUFE:** enviar un CUFE real (96 hex) → ACK "🧾 Recibí tu factura..." y, ~1 min después, "✅ Tu factura quedó lista para revisar... (N ítems)". Verificar el borrador en la bandeja de `/gastos`.
3. **CUFE duplicado:** reenviar el mismo CUFE → "Esa factura ya la había procesado".
4. **Ayuda:** enviar `ayuda` → lista de capacidades (síncrono).
5. **Imagen:** enviar una foto → "Aún no proceso fotos ni QR..." (síncrono).
6. **No entendido:** enviar `hola` → mensaje de orientación.

- [ ] **Step 4: Verificar identidad/seguridad**

- Un número NO vinculado que envíe `20k taxi` → debe recibir las instrucciones de vinculación (no crea gasto). Confirma que el gasto se crea SOLO para el `userId` del número vinculado.

---

## Done cuando

- `bun run test`, `bun run type-check`, `bun run lint` pasan.
- Un número vinculado puede: pegar un CUFE → borrador en la bandeja + aviso async; escribir "20k taxi" → gasto directo + confirmación.
- El motor CUFE corre con service-role desde el webhook (sin sesión), reusando `prepare/runInvoiceProcessing` del Plan 1 sin romper el flujo web (que sigue con cookie).
- Quedan listos para el Plan 4 (imágenes): el transporte saliente, la descarga de media (pendiente), el enrutado por `classifyText` (rama `image`) y el estado de conversación.

## Fuera de alcance (Plan 4)

- Descarga de media de Twilio + decodificación de **QR → CUFE**.
- **Visión** (MiniMax) para fotos de factura sin CUFE → borrador, y screenshots de transferencia → gasto directo.
- **Estado de conversación** (`whatsapp_conversations`) para preguntas de seguimiento (cuenta/categoría) en media confianza.
- UI para configurar `default_account_name` por número en `/settings`.
- Persistencia de progreso del CUFE de WhatsApp (no hay barra; el usuario recibe avisos por chat).
