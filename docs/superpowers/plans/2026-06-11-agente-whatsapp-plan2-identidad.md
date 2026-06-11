# Plan 2 — Identidad WhatsApp: vinculación número↔usuario + webhook mínimo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que un número de WhatsApp se vincule de forma segura a un presupuesto (user_id) mediante un código de 6 dígitos generado en la app, y que un webhook de Twilio reciba el mensaje `VINCULAR <código>`, valide la firma de Twilio, y deje el número vinculado — respondiendo por el mismo chat.

**Architecture:** Un webhook **público** (`POST /api/whatsapp/webhook`, fuera del middleware de auth) valida la firma `X-Twilio-Signature` (HMAC-SHA1 sobre URL+params, función pura), normaliza el número (`whatsapp:+57...` → `+57...`), interpreta el comando y responde con **TwiML** síncrono (no requiere API saliente en esta fase). La identidad se resuelve sin sesión usando el **`createAdminClient()` service-role que ya existe**; cada operación lleva el `user_id` resuelto. La generación del código vive en una **Server Action** con la sesión del usuario (RLS). La app gana una página `/settings` con "Conectar WhatsApp". Toda la lógica no-trivial (firma, parsing de comando, normalización, TwiML, handler de vinculación con deps inyectadas) son **unidades puras testeables**; el route y la Server Action son orquestadores delgados.

**Tech Stack:** Next.js 15 App Router (route handlers, Server Actions), TypeScript, Node `crypto` (HMAC-SHA1, randomInt, timingSafeEqual), Supabase (service-role para webhook, cookie para la acción), Vitest, Twilio WhatsApp (sandbox para pruebas).

**Notas de base:**
- `createAdminClient()` (service-role, usa `SUPABASE_SERVICE_ROLE_KEY`) ya existe en `src/lib/supabase/server.ts`. No se crea de nuevo.
- El matcher del middleware **excluye `/api`**, así que el webhook no pasa por auth (correcto: lo llama Twilio, no un navegador).
- `/settings` ya está en `protectedRoutes` del middleware; la página nueva queda protegida sin tocar el middleware.
- Las tablas nuevas no estarán en `src/types/database.ts` (igual que `electronic_invoices`). Se consultan con `.from('...')` y los resultados se castean a interfaces locales — **no regenerar `database.ts`** (el script lo trunca; ver gotchas del repo).
- Esta fase NO crea la tabla `whatsapp_conversations` ni el transporte REST saliente (`WhatsAppTransport`): eso es Plan 3/4. Aquí las respuestas son TwiML síncrono.

---

## File Structure

| Archivo | Responsabilidad | Acción |
|---|---|---|
| `supabase/migrations/20260611000000_create_whatsapp_links.sql` | Tablas `whatsapp_links` + `whatsapp_link_codes` con RLS | Crear |
| `src/lib/whatsapp/twilio-signature.ts` | Validación de firma Twilio (HMAC-SHA1, pura) | Crear |
| `src/lib/whatsapp/twilio-signature.test.ts` | Tests con vector real | Crear |
| `src/lib/whatsapp/message.ts` | `normalizeWhatsappFrom` + `parseCommand` (puras) | Crear |
| `src/lib/whatsapp/message.test.ts` | Tests de normalización y parsing | Crear |
| `src/lib/whatsapp/twiml.ts` | Constructores TwiML con escape XML (puros) | Crear |
| `src/lib/whatsapp/twiml.test.ts` | Tests de TwiML/escape | Crear |
| `src/lib/services/whatsapp-links.ts` | `createLinkCode`, `redeemLinkCode`, `getLinkByPhone` (service-role) | Crear |
| `src/lib/services/whatsapp-links.test.ts` | Tests con `createAdminClient` mockeado | Crear |
| `src/lib/whatsapp/handle-linking.ts` | `handleLinkingMessage(phone, body, deps)` → texto de respuesta (deps inyectadas) | Crear |
| `src/lib/whatsapp/handle-linking.test.ts` | Tests del handler con deps mock | Crear |
| `src/app/api/whatsapp/webhook/route.ts` | Webhook: firma → parse → handler → TwiML | Crear |
| `src/lib/actions/whatsapp.ts` | Server Action `generateWhatsAppLinkCodeAction` | Crear |
| `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx` | UI cliente "Conectar WhatsApp" | Crear |
| `src/app/settings/page.tsx` | Página `/settings` (guard + panel + números vinculados) | Crear |
| `.env.example` | `TWILIO_AUTH_TOKEN`, `WHATSAPP_WEBHOOK_URL` | Modificar |

---

## Task 1: Migración — tablas de vínculo

**Files:**
- Create: `supabase/migrations/20260611000000_create_whatsapp_links.sql`

- [ ] **Step 1: Crear la migración**

Crear `supabase/migrations/20260611000000_create_whatsapp_links.sql`:

```sql
-- Vinculación de números de WhatsApp con presupuestos (user_id).
-- Varios números pueden apuntar al mismo user_id (familia → un presupuesto).

CREATE TABLE IF NOT EXISTS public.whatsapp_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164    text NOT NULL UNIQUE,                       -- +573001234567
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  default_account_name text,
  linked_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_user
  ON public.whatsapp_links(user_id);

ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;

-- El dueño ve y borra sus números. INSERT/UPDATE los hace el webhook con
-- service-role (bypassa RLS); no hay política de INSERT/UPDATE para usuarios.
CREATE POLICY "Dueño ve sus números"
  ON public.whatsapp_links FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Dueño borra sus números"
  ON public.whatsapp_links FOR DELETE
  USING (auth.uid() = user_id);

-- Códigos temporales de vinculación (un solo uso, caducan).
CREATE TABLE IF NOT EXISTS public.whatsapp_link_codes (
  code        text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_codes_code
  ON public.whatsapp_link_codes(code);

ALTER TABLE public.whatsapp_link_codes ENABLE ROW LEVEL SECURITY;

-- El usuario crea y ve sus propios códigos (la Server Action corre con su sesión).
-- El canje lo hace el webhook con service-role (bypassa RLS).
CREATE POLICY "Usuario crea sus códigos"
  ON public.whatsapp_link_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario ve sus códigos"
  ON public.whatsapp_link_codes FOR SELECT
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Aplicar la migración a Supabase**

Aplicar vía MCP de Supabase (`apply_migration`, name `create_whatsapp_links`, con el SQL de arriba). Verificar:

Run (MCP `execute_sql`): `SELECT table_name FROM information_schema.tables WHERE table_name IN ('whatsapp_links','whatsapp_link_codes');`
Expected: 2 filas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611000000_create_whatsapp_links.sql
git commit --no-verify -m "feat: tablas whatsapp_links y whatsapp_link_codes con RLS"
```

---

## Task 2: Validación de firma Twilio (pura, TDD)

**Files:**
- Create: `src/lib/whatsapp/twilio-signature.ts`
- Test: `src/lib/whatsapp/twilio-signature.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/twilio-signature.test.ts`. El vector está calculado con el algoritmo oficial (URL + params ordenados por clave concatenados key+value, HMAC-SHA1 con el authToken, base64) y verificado con openssl:

```ts
import { describe, expect, it } from 'vitest';

import {
  computeTwilioSignature,
  isValidTwilioSignature,
} from './twilio-signature';

// Vector real (verificado con openssl). NO cambiar sin recomputar.
const URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const PARAMS = {
  CallSid: 'CA1234567890ABCDE',
  Caller: '+14158675310',
  Digits: '1234',
  From: '+14158675310',
  To: '+18005551212',
};
const TOKEN = '12345';
const EXPECTED = 'GvWf1cFY/Q7PnoempGyD5oXAezc=';

describe('computeTwilioSignature', () => {
  it('produce la firma esperada para el vector conocido', () => {
    expect(computeTwilioSignature(TOKEN, URL, PARAMS)).toBe(EXPECTED);
  });

  it('es independiente del orden de inserción de los params', () => {
    const shuffled = {
      To: '+18005551212',
      Digits: '1234',
      CallSid: 'CA1234567890ABCDE',
      From: '+14158675310',
      Caller: '+14158675310',
    };
    expect(computeTwilioSignature(TOKEN, URL, shuffled)).toBe(EXPECTED);
  });
});

describe('isValidTwilioSignature', () => {
  it('acepta la firma correcta', () => {
    expect(isValidTwilioSignature(TOKEN, EXPECTED, URL, PARAMS)).toBe(true);
  });

  it('rechaza una firma manipulada', () => {
    expect(isValidTwilioSignature(TOKEN, 'AAAA/Q7PnoempGyD5oXAezc=', URL, PARAMS)).toBe(false);
  });

  it('rechaza una firma vacía sin lanzar', () => {
    expect(isValidTwilioSignature(TOKEN, '', URL, PARAMS)).toBe(false);
  });

  it('rechaza si cambia un parámetro (cuerpo manipulado)', () => {
    expect(
      isValidTwilioSignature(TOKEN, EXPECTED, URL, { ...PARAMS, Digits: '9999' }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/twilio-signature.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/twilio-signature.ts`:

```ts
// Validación de la firma X-Twilio-Signature.
// Algoritmo Twilio: concatenar la URL completa del webhook con cada par
// clave+valor de los parámetros POST ORDENADOS por clave, firmar con HMAC-SHA1
// usando el auth token de la cuenta y codificar en base64.
// Ref: https://www.twilio.com/docs/usage/security#validating-requests

import { createHmac, timingSafeEqual } from 'crypto';

export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function isValidTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const expected = computeTwilioSignature(authToken, url, params);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature || '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/twilio-signature.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/twilio-signature.ts src/lib/whatsapp/twilio-signature.test.ts
git commit --no-verify -m "feat: validación de firma Twilio (HMAC-SHA1, pura)"
```

---

## Task 3: Normalización de número + parsing de comando (puras, TDD)

**Files:**
- Create: `src/lib/whatsapp/message.ts`
- Test: `src/lib/whatsapp/message.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/message.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { normalizeWhatsappFrom, parseCommand } from './message';

describe('normalizeWhatsappFrom', () => {
  it('quita el prefijo whatsapp: y espacios', () => {
    expect(normalizeWhatsappFrom('whatsapp:+573001234567')).toBe('+573001234567');
    expect(normalizeWhatsappFrom('  whatsapp:+573001234567  ')).toBe('+573001234567');
  });

  it('deja intacto un número ya normalizado', () => {
    expect(normalizeWhatsappFrom('+573001234567')).toBe('+573001234567');
  });
});

describe('parseCommand', () => {
  it('reconoce VINCULAR con código de 6 dígitos (case-insensitive)', () => {
    expect(parseCommand('VINCULAR 482913')).toEqual({ kind: 'link', code: '482913' });
    expect(parseCommand('vincular 000001')).toEqual({ kind: 'link', code: '000001' });
    expect(parseCommand('  Vincular   482913 ')).toEqual({ kind: 'link', code: '482913' });
  });

  it('NO reconoce VINCULAR con formato inválido', () => {
    expect(parseCommand('VINCULAR 12345').kind).toBe('other'); // 5 dígitos
    expect(parseCommand('VINCULAR abcdef').kind).toBe('other');
    expect(parseCommand('VINCULAR').kind).toBe('other');
  });

  it('reconoce ayuda', () => {
    expect(parseCommand('ayuda').kind).toBe('help');
    expect(parseCommand('HELP').kind).toBe('help');
  });

  it('cualquier otra cosa es other con el texto recortado', () => {
    expect(parseCommand('  hola mundo ')).toEqual({ kind: 'other', text: 'hola mundo' });
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/message.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/message.ts`:

```ts
// Helpers puros para interpretar mensajes entrantes de WhatsApp.

/** "whatsapp:+573001234567" -> "+573001234567". */
export function normalizeWhatsappFrom(from: string): string {
  return (from || '').trim().replace(/^whatsapp:/i, '');
}

export type ParsedCommand =
  | { kind: 'link'; code: string }
  | { kind: 'help' }
  | { kind: 'other'; text: string };

/** Interpreta el cuerpo del mensaje como un comando conocido. */
export function parseCommand(body: string): ParsedCommand {
  const trimmed = (body || '').trim();
  const link = trimmed.match(/^vincular\s+(\d{6})$/i);
  if (link) {
    return { kind: 'link', code: link[1] };
  }
  if (/^(ayuda|help)$/i.test(trimmed)) {
    return { kind: 'help' };
  }
  return { kind: 'other', text: trimmed };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/message.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/message.ts src/lib/whatsapp/message.test.ts
git commit --no-verify -m "feat: normalización de número y parsing de comando WhatsApp"
```

---

## Task 4: Constructores TwiML (puros, TDD)

**Files:**
- Create: `src/lib/whatsapp/twiml.ts`
- Test: `src/lib/whatsapp/twiml.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/twiml.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { twimlEmpty, twimlMessage } from './twiml';

describe('twimlMessage', () => {
  it('envuelve el texto en <Response><Message>', () => {
    expect(twimlMessage('Hola')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>Hola</Message></Response>',
    );
  });

  it('escapa caracteres XML peligrosos', () => {
    expect(twimlMessage('a & b <c> "d" \'e\'')).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Message>a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;</Message></Response>',
    );
  });
});

describe('twimlEmpty', () => {
  it('devuelve una respuesta vacía', () => {
    expect(twimlEmpty()).toBe(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    );
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/twiml.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/twiml.ts`:

```ts
// Constructores de respuestas TwiML para webhooks de Twilio (síncronas).

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

/** Respuesta con un mensaje de vuelta al remitente. */
export function twimlMessage(text: string): string {
  return `${HEADER}<Response><Message>${escapeXml(text)}</Message></Response>`;
}

/** Respuesta vacía (acusar recibo sin contestar). */
export function twimlEmpty(): string {
  return `${HEADER}<Response></Response>`;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/twiml.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/twiml.ts src/lib/whatsapp/twiml.test.ts
git commit --no-verify -m "feat: constructores TwiML con escape XML"
```

---

## Task 5: Servicio de vínculos (service-role)

**Files:**
- Create: `src/lib/services/whatsapp-links.ts`
- Test: `src/lib/services/whatsapp-links.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/services/whatsapp-links.test.ts`. Se mockea `createAdminClient` con un builder encadenable:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/server';
import {
  generateSixDigitCode,
  getLinkByPhone,
  redeemLinkCode,
} from './whatsapp-links';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

describe('generateSixDigitCode', () => {
  it('devuelve exactamente 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSixDigitCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe('redeemLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canjea un código válido: marca usado, upserta el vínculo y devuelve userId', async () => {
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
    const upsert = vi.fn().mockResolvedValue({});
    // Cadena del SELECT del código: from().select().eq().is().gt().order().limit().maybeSingle()
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { code: '482913', user_id: 'user-1' } }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_link_codes') return { ...selectChain, update };
      if (table === 'whatsapp_links') return { upsert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from });

    const res = await redeemLinkCode('482913', '+573001234567');

    expect(res).toEqual({ ok: true, userId: 'user-1' });
    expect(update).toHaveBeenCalled(); // marcó used_at
    expect(upsert).toHaveBeenCalledWith(
      { phone_e164: '+573001234567', user_id: 'user-1' },
      { onConflict: 'phone_e164' },
    );
  });

  it('rechaza un código inexistente/expirado sin upsertar', async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_link_codes') return { ...selectChain, update: vi.fn() };
      if (table === 'whatsapp_links') return { upsert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from });

    const res = await redeemLinkCode('000000', '+573001234567');

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('getLinkByPhone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve userId si el número está vinculado', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-9' } });
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    }));
    mockedAdmin.mockReturnValue({ from });

    expect(await getLinkByPhone('+573001234567')).toEqual({ userId: 'user-9' });
  });

  it('devuelve null si no está vinculado', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));
    mockedAdmin.mockReturnValue({ from });

    expect(await getLinkByPhone('+573009999999')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/services/whatsapp-links.ts`:

```ts
// Servicio de vinculación número↔usuario. Usa el cliente service-role porque el
// webhook corre sin sesión; la seguridad la da el código de un solo uso + la
// firma de Twilio validada antes de llegar aquí.

import { randomInt } from 'crypto';

import { createAdminClient } from '@/lib/supabase/server';

const CODE_TTL_MINUTES = 10;

/** Código aleatorio de 6 dígitos (con ceros a la izquierda). */
export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Crea un código de vinculación para el usuario y lo persiste. Devuelve el código. */
export async function createLinkCode(userId: string): Promise<string> {
  const supabase = createAdminClient();
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
  await supabase
    .from('whatsapp_link_codes')
    .insert({ code, user_id: userId, expires_at: expiresAt });
  return code;
}

export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' };

/**
 * Canjea un código: valida vigencia y no-uso, lo marca usado y vincula el
 * número (upsert por phone_e164, así re-vincular mueve el número de presupuesto).
 */
export async function redeemLinkCode(
  code: string,
  phoneE164: string,
): Promise<RedeemResult> {
  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: row } = await supabase
    .from('whatsapp_link_codes')
    .select('code, user_id')
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const userId = (row as { user_id: string }).user_id;

  await supabase
    .from('whatsapp_link_codes')
    .update({ used_at: nowIso })
    .eq('code', code);

  await supabase
    .from('whatsapp_links')
    .upsert(
      { phone_e164: phoneE164, user_id: userId },
      { onConflict: 'phone_e164' },
    );

  return { ok: true, userId };
}

/** Resuelve el presupuesto (user_id) dueño de un número, o null. */
export async function getLinkByPhone(
  phoneE164: string,
): Promise<{ userId: string } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  return data ? { userId: (data as { user_id: string }).user_id } : null;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Type-check**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/whatsapp-links.ts src/lib/services/whatsapp-links.test.ts
git commit --no-verify -m "feat: servicio de vínculos WhatsApp (createLinkCode/redeem/getByPhone)"
```

---

## Task 6: Handler de vinculación (deps inyectadas, TDD)

**Files:**
- Create: `src/lib/whatsapp/handle-linking.ts`
- Test: `src/lib/whatsapp/handle-linking.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/whatsapp/handle-linking.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { handleLinkingMessage } from './handle-linking';

describe('handleLinkingMessage', () => {
  it('VINCULAR con código válido → confirma y canjea', async () => {
    const redeemLinkCode = vi.fn().mockResolvedValue({ ok: true, userId: 'u1' });
    const getLinkByPhone = vi.fn();
    const reply = await handleLinkingMessage('+573001234567', 'VINCULAR 482913', {
      redeemLinkCode,
      getLinkByPhone,
    });
    expect(redeemLinkCode).toHaveBeenCalledWith('482913', '+573001234567');
    expect(reply).toContain('vinculado');
    expect(getLinkByPhone).not.toHaveBeenCalled();
  });

  it('VINCULAR con código inválido → mensaje de error', async () => {
    const redeemLinkCode = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid_or_expired' });
    const reply = await handleLinkingMessage('+573001234567', 'VINCULAR 000000', {
      redeemLinkCode,
      getLinkByPhone: vi.fn(),
    });
    expect(reply.toLowerCase()).toContain('código');
    expect(reply).toMatch(/válido|expir/i);
  });

  it('número ya vinculado y mensaje cualquiera → avisa que ya está vinculado', async () => {
    const reply = await handleLinkingMessage('+573001234567', 'hola', {
      redeemLinkCode: vi.fn(),
      getLinkByPhone: vi.fn().mockResolvedValue({ userId: 'u1' }),
    });
    expect(reply.toLowerCase()).toContain('vinculado');
  });

  it('número NO vinculado y mensaje cualquiera → instrucciones de vinculación', async () => {
    const reply = await handleLinkingMessage('+573001234567', 'hola', {
      redeemLinkCode: vi.fn(),
      getLinkByPhone: vi.fn().mockResolvedValue(null),
    });
    expect(reply).toContain('VINCULAR');
    expect(reply.toLowerCase()).toContain('ajustes');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `bun run test src/lib/whatsapp/handle-linking.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

Crear `src/lib/whatsapp/handle-linking.ts`:

```ts
// Orquesta la respuesta a un mensaje entrante en la fase de vinculación.
// Recibe las dependencias inyectadas para ser testeable sin tocar la DB.

import type { RedeemResult } from '@/lib/services/whatsapp-links';
import { parseCommand } from '@/lib/whatsapp/message';

export interface LinkingDeps {
  redeemLinkCode: (code: string, phoneE164: string) => Promise<RedeemResult>;
  getLinkByPhone: (phoneE164: string) => Promise<{ userId: string } | null>;
}

const MSG_LINKED_OK =
  '✅ ¡Listo! Tu WhatsApp quedó vinculado a tu presupuesto. Pronto podrás ' +
  'enviarme tus facturas (CUFE o foto) y transferencias para registrar gastos.';
const MSG_CODE_INVALID =
  '❌ Ese código no es válido o ya expiró. Genera uno nuevo en la app ' +
  '(Ajustes → Conectar WhatsApp) y envíame: VINCULAR 123456';
const MSG_ALREADY_LINKED =
  'Tu número ya está vinculado a tu presupuesto. 👍 El registro de gastos por ' +
  'mensaje llegará muy pronto.';
const MSG_NEEDS_LINK =
  'Hola 👋 Para conectar tu WhatsApp con tu presupuesto, entra a la app → ' +
  'Ajustes → Conectar WhatsApp, genera tu código de 6 dígitos y envíame: ' +
  'VINCULAR 123456';

export async function handleLinkingMessage(
  phoneE164: string,
  body: string,
  deps: LinkingDeps,
): Promise<string> {
  const cmd = parseCommand(body);

  if (cmd.kind === 'link') {
    const res = await deps.redeemLinkCode(cmd.code, phoneE164);
    return res.ok ? MSG_LINKED_OK : MSG_CODE_INVALID;
  }

  const link = await deps.getLinkByPhone(phoneE164);
  return link ? MSG_ALREADY_LINKED : MSG_NEEDS_LINK;
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `bun run test src/lib/whatsapp/handle-linking.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/handle-linking.ts src/lib/whatsapp/handle-linking.test.ts
git commit --no-verify -m "feat: handler de vinculación WhatsApp (deps inyectadas)"
```

---

## Task 7: Webhook de Twilio

**Files:**
- Create: `src/app/api/whatsapp/webhook/route.ts`

- [ ] **Step 1: Implementar el route**

Crear `src/app/api/whatsapp/webhook/route.ts`:

```ts
// POST /api/whatsapp/webhook
// Webhook público de Twilio (fuera del middleware de auth). Valida la firma,
// resuelve el comando de vinculación y responde con TwiML síncrono.

import { NextRequest } from 'next/server';

import {
  getLinkByPhone,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
import { handleLinkingMessage } from '@/lib/whatsapp/handle-linking';
import { normalizeWhatsappFrom } from '@/lib/whatsapp/message';
import { isValidTwilioSignature } from '@/lib/whatsapp/twilio-signature';
import { twimlEmpty, twimlMessage } from '@/lib/whatsapp/twiml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function xml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!authToken || !webhookUrl) {
    return new Response('Webhook no configurado', { status: 500 });
  }

  // Twilio envía application/x-www-form-urlencoded.
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

  const reply = await handleLinkingMessage(phone, params.Body || '', {
    redeemLinkCode,
    getLinkByPhone,
  });

  return xml(twimlMessage(reply));
}
```

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bunx eslint src/app/api/whatsapp/webhook/route.ts`
Expected: PASS (corregir import/order si lo pide).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whatsapp/webhook/route.ts
git commit --no-verify -m "feat: webhook de Twilio con validación de firma + vinculación"
```

---

## Task 8: Server Action para generar el código

**Files:**
- Create: `src/lib/actions/whatsapp.ts`

- [ ] **Step 1: Implementar la acción**

Crear `src/lib/actions/whatsapp.ts`:

```ts
'use server';

import { createLinkCode } from '@/lib/services/whatsapp-links';
import { createClient } from '@/lib/supabase/server';

export type GenerateCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/** Genera un código de vinculación de WhatsApp para el usuario autenticado. */
export async function generateWhatsAppLinkCodeAction(): Promise<GenerateCodeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }
  const code = await createLinkCode(user.id);
  return { ok: true, code };
}
```

- [ ] **Step 2: Type-check**

Run: `bun run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/whatsapp.ts
git commit --no-verify -m "feat: Server Action para generar código de vínculo WhatsApp"
```

---

## Task 9: Página /settings + panel "Conectar WhatsApp"

**Files:**
- Create: `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx`
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: Crear el panel cliente**

Crear `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx`:

```tsx
'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';

export default function WhatsAppLinkPanel() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await generateWhatsAppLinkCodeAction();
      if (!res.ok) throw new Error(res.error);
      setCode(res.code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generando código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">Conectar WhatsApp</h3>
      <p className="mb-4 text-sm text-slate-400">
        Vincula tu WhatsApp para registrar gastos enviando facturas o
        transferencias. Genera un código y envíalo al bot.
      </p>

      {code ? (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-800 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Tu código (válido 10 minutos)
            </p>
            <p className="mt-1 font-mono text-3xl tracking-widest text-emerald-400">
              {code}
            </p>
          </div>
          <p className="text-sm text-slate-300">
            Abre WhatsApp y envía al número del bot:
          </p>
          <p className="rounded bg-slate-800 px-3 py-2 font-mono text-sm text-white">
            VINCULAR {code}
          </p>
          <Button variant="outline" onClick={generate} disabled={loading}>
            {loading ? 'Generando...' : 'Generar otro código'}
          </Button>
        </div>
      ) : (
        <Button onClick={generate} disabled={loading}>
          {loading ? 'Generando...' : 'Generar código de vinculación'}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crear la página /settings**

Crear `src/app/settings/page.tsx`. Lista los números ya vinculados del usuario (RLS por dueño) y muestra el panel:

```tsx
import { redirect } from 'next/navigation';

import WhatsAppLinkPanel from '@/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function maskPhone(phone: string): string {
  // +573001234567 -> +5730 ***4567
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 6)} ***${phone.slice(-4)}`;
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login');
  }

  const { data: links } = await supabase
    .from('whatsapp_links')
    .select('phone_e164, linked_at')
    .eq('user_id', user.id)
    .order('linked_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-white">Ajustes</h1>

      <WhatsAppLinkPanel />

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
        <h3 className="mb-3 text-lg font-medium text-white">
          Números vinculados
        </h3>
        {links && links.length > 0 ? (
          <ul className="space-y-2">
            {links.map(l => (
              <li
                key={l.phone_e164 as string}
                className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-sm"
              >
                <span className="font-mono text-slate-200">
                  {maskPhone(l.phone_e164 as string)}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(l.linked_at as string).toLocaleDateString('es-CO')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Aún no hay números vinculados.
          </p>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `bun run type-check && bunx eslint src/app/settings/page.tsx src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx
git commit --no-verify -m "feat: página /settings con panel Conectar WhatsApp y números vinculados"
```

---

## Task 10: Variables de entorno

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Agregar las variables nuevas**

En `.env.example`, al final del archivo, agregar:

```bash

# === WhatsApp (Twilio) ===
# Auth token de la cuenta Twilio (valida la firma X-Twilio-Signature).
TWILIO_AUTH_TOKEN=
# URL pública EXACTA del webhook configurada en Twilio (debe coincidir bit a bit
# para que la validación de firma funcione detrás del proxy de Vercel).
# Ej: https://tu-app.vercel.app/api/whatsapp/webhook
WHATSAPP_WEBHOOK_URL=
```

- [ ] **Step 2: Configurar las variables localmente y en Vercel**

Añadir `TWILIO_AUTH_TOKEN` y `WHATSAPP_WEBHOOK_URL` a `.env.local` (no versionado) y al entorno de Vercel. Esto es manual (secretos); no se commitea.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit --no-verify -m "chore: documentar env de WhatsApp (Twilio)"
```

---

## Task 11: Verificación end-to-end + suite

**Files:** (ninguno; verificación)

- [ ] **Step 1: Suite completa**

Run: `bun run test`
Expected: PASS (los nuevos tests de Plan 2 + los existentes de Plan 1).

- [ ] **Step 2: Type-check + lint**

Run: `bun run type-check && bun run lint`
Expected: PASS (solo warnings `no-console` preexistentes).

- [ ] **Step 3: Verificación manual del flujo de vínculo (Twilio sandbox)**

Requiere: cuenta Twilio con WhatsApp sandbox, `TWILIO_AUTH_TOKEN` y `WHATSAPP_WEBHOOK_URL` configurados, y la app desplegada (o túnel público apuntando al webhook; la firma exige URL pública exacta).

1. Configurar en Twilio el webhook de "When a message comes in" → `WHATSAPP_WEBHOOK_URL` (POST).
2. Unirse al sandbox desde el WhatsApp propio.
3. En la app, entrar a `/settings` → "Generar código de vinculación" → anotar el código.
4. Desde WhatsApp enviar `VINCULAR <código>`.
5. Esperar la respuesta "✅ ¡Listo! …".
6. Recargar `/settings` → el número aparece en "Números vinculados".
7. Enviar otro mensaje cualquiera (p. ej. "hola") → responde "ya está vinculado".
8. Probar un código inválido (`VINCULAR 000000` con código no generado) → responde error.
9. (Seguridad) Hacer un POST manual al webhook sin firma válida → responde 403.

Expected: el número queda vinculado y las respuestas coinciden.

- [ ] **Step 4: Verificar resolución de identidad en DB**

Run (MCP `execute_sql`): `SELECT phone_e164, user_id FROM whatsapp_links;` y `SELECT code, used_at FROM whatsapp_link_codes ORDER BY created_at DESC LIMIT 3;`
Expected: el número vinculado con el user_id correcto; el código usado tiene `used_at` no nulo.

---

## Done cuando

- `bun run test`, `bun run type-check`, `bun run lint` pasan.
- Generar un código en `/settings`, enviar `VINCULAR <código>` por WhatsApp y recibir confirmación; el número queda en `whatsapp_links` apuntando al user_id correcto.
- Un POST al webhook con firma inválida responde 403.
- Un número no vinculado recibe instrucciones; uno ya vinculado recibe el aviso correspondiente.
- Quedan listos para el Plan 3: `getLinkByPhone` (resolución de identidad), el webhook (punto de entrada) y la firma validada.
```
