# S13 — WhatsApp en Ajustes Implementation Plan

> **Alineado con contratos v2 (§5).** §5.2 (desvincular con `unlinkWhatsAppLinkAction(linkId)`, `key = l.id`, `MSG_ALREADY_LINKED` nuevo) y §5.3 (flujo APP: S07 → S08 → S10 → **S13** → S11 → S12) prevalecen sobre §2.8 y §4.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que vincular y desvincular WhatsApp desde Ajustes sea de un toque: el panel abre WhatsApp con `VINCULAR <código>` ya escrito, el bot confirma con un mensaje que enseña qué puede hacer, y cada número vinculado se puede desvincular con confirmación.

**Architecture:** Una función pura `buildWhatsAppLinkUrl` arma el enlace `wa.me` a partir de la variable pública `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`; `WhatsAppLinkPanel` (cliente) la usa y, sin variable, sigue mostrando solo el código. `unlinkWhatsAppLinkAction(linkId)` (contratos §5.2) borra la fila de `whatsapp_links` por `id` y `user_id` con el cliente de cookie (RLS: política DELETE del dueño). La página de Ajustes (server component) le pasa a cada botón cliente `UnlinkPhoneButton` solo el `id` del link y el número enmascarado; el botón pide confirmación con `ConfirmModal` y llama la acción. El número completo nunca llega al navegador y no hace falta una server action en línea.

**Tech Stack:** Next.js 15 App Router (server components + server actions), Supabase (`@supabase/ssr`, RLS), React 19, sonner, vitest (environment node), bun.

## Global Constraints

- Contratos: `docs/agile/contracts.md` §2.8, §3 y las enmiendas §5.2/§5.3. Nombres exactos: `buildWhatsAppLinkUrl`, `unlinkWhatsAppLinkAction`, `UnlinkLinkResult`, `MSG_LINKED_OK`, `MSG_ALREADY_LINKED`, `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`. `unlinkWhatsAppPhoneAction` (§2.8 v1) **no** se crea.
- `unlinkWhatsAppLinkAction(linkId: string): Promise<UnlinkLinkResult>` con `UnlinkLinkResult = { ok: true } | { ok: false; error: string }`; borra por `id` y `user_id`.
- `buildWhatsAppLinkUrl(botNumber: string | undefined, code: string): string | null` — quita `+`, espacios y `whatsapp:`; sin número → `null`; salida `https://wa.me/573000000000?text=VINCULAR%20123456`.
- Texto exacto de `MSG_LINKED_OK`: `¡Listo! Tu número quedó vinculado. Ya puedes mandarme una foto de la factura, el código CUFE o escribir algo como «40 mil almuerzo». También puedes preguntarme «¿cuánto llevo en mercado?».`
- Texto de `MSG_ALREADY_LINKED` (§5.2, sin el "llegará muy pronto"): `Este número ya está vinculado. Ya puedes mandarme tus gastos.`
- En `src/lib/whatsapp/handle-linking.ts` solo se cambian las constantes `MSG_LINKED_OK` y `MSG_ALREADY_LINKED`. S02 (flujo SEG, **no está en este worktree**) es dueña del resto del archivo: `MSG_TOO_MANY_ATTEMPTS`, el límite y las dependencias nuevas de `LinkingDeps`. Al integrar los flujos, `handle-linking.ts` y su test chocan (§5.3): se conservan ambos lados.
- `.env.example`: `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000` se agrega **al final** del archivo. S04 (flujo AUTH, no está en este worktree) agrega `NEXT_PUBLIC_SITE_URL` al final en el suyo; al integrar se conservan ambas (§5.3).
- Orden (contratos §5.3, flujo APP, en serie en el mismo worktree): S07, S08 y S10 **ya están hechas** y no tocan los archivos de esta historia. S11 viene después y reusa `buildWhatsAppLinkUrl` de la Task 1 sin cambiarla.
- Prohibido `bun run dev` y `next build` contra `.env.local` (apunta a producción, §5.0). Nunca `bun run db:types`.
- UI en español colombiano, tuteo.
- Datos personales: ningún teléfono real en código ni tests. Teléfono de prueba: `+573000000000`. Nunca loguear el número completo (solo `error.code`).
- Ningún test toca una base real; el cliente de Supabase se mockea. No se accede a la base de producción.
- Verificación: `bun run test <archivo>` por tarea; al final `bun run test && bun run type-check`.
- Commits en español, estilo del repo (`feat(whatsapp): …`), terminando con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Los commits de esta historia tocan `src/`, así que van sin `--no-verify` (el hook de lint-staged corre normal). Si un commit solo tocara docs, usar `--no-verify`.

## Verificación previa (hecha por el planificador)

- `supabase/migrations/20260611000000_create_whatsapp_links.sql` crea la política `"Dueño borra sus números" ON public.whatsapp_links FOR DELETE USING (auth.uid() = user_id)` y la política `"Dueño ve sus números" … FOR SELECT USING (auth.uid() = user_id)`.
- La única otra migración que toca la tabla (`20260928140000_whatsapp_links_documento.sql`) solo hace `REVOKE UPDATE` y `GRANT UPDATE (documento)`; **no** revoca `DELETE`. Por eso el cliente de cookie puede borrar sus propias filas.
- La política SELECT es necesaria porque el DELETE termina en `.select('id')` (RETURNING) para saber si se borró algo.
- `whatsapp_conversations` tiene RLS sin políticas: el cliente de cookie no puede borrarla. Desvincular no la toca (el contrato solo pide borrar el link; S02 borra la conversación cuando el número se revincula a otro usuario).
- Hallazgo: hoy `src/app/settings/page.tsx` usa `key={l.phone_e164}` en el `<li>`; en un server component la `key` viaja en el payload RSC, así que el número completo ya llega al navegador. Este plan cambia la key a `l.id`.

## Archivos

- Crear: `src/lib/whatsapp/link-url.ts` — `buildWhatsAppLinkUrl`.
- Crear: `src/lib/whatsapp/link-url.test.ts` — tests de la función.
- Modificar: `src/lib/whatsapp/handle-linking.ts` — solo las constantes `MSG_LINKED_OK` y `MSG_ALREADY_LINKED`.
- Modificar: `src/lib/whatsapp/handle-linking.test.ts` — el primer y el tercer test comparan el texto exacto.
- Modificar: `src/lib/actions/whatsapp.ts` — `UnlinkLinkResult` y `unlinkWhatsAppLinkAction`.
- Modificar: `src/lib/actions/whatsapp.test.ts` — `delete` en el cliente falso y `describe('unlinkWhatsAppLinkAction')`.
- Modificar: `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx` — botón "Abrir WhatsApp".
- Modificar: `.env.example` — `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER` al final.
- Crear: `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx` — botón "Desvincular" con confirmación; recibe `linkId` y `maskedPhone`.
- Crear: `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts` — test de texto del botón y de la página.
- Modificar: `src/app/settings/page.tsx:1-72` — lista de números con el botón, máscara `enmascararTelefono`, `key` por `id`.

## Criterios de aceptación

- [ ] `buildWhatsAppLinkUrl` con tests: `+573000000000`, `whatsapp:+573000000000` y `" +57 300 000 0000 "` dan `https://wa.me/573000000000?text=VINCULAR%20123456`; `undefined`, `''`, solo espacios o un valor sin dígitos válidos dan `null`.
- [ ] Con `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER` definido, el panel muestra el botón "Abrir WhatsApp" que abre `wa.me` en otra pestaña con `VINCULAR <código>`; sin la variable, el panel se ve como hoy (código y texto `VINCULAR <código>`, sin enlace).
- [ ] `MSG_LINKED_OK` es exactamente el texto del contrato y el test lo compara con `toBe`.
- [ ] `MSG_ALREADY_LINKED` ya no promete nada "muy pronto": es `Este número ya está vinculado. Ya puedes mandarme tus gastos.` y el test lo compara con `toBe`.
- [ ] `unlinkWhatsAppLinkAction(linkId)` borra solo filas del usuario autenticado (`.eq('id', linkId)` + `.eq('user_id', user.id)` + RLS), valida que `linkId` sea uuid antes de tocar la base, responde error si no borró nada, no loguea el número y revalida `/settings`. `unlinkWhatsAppPhoneAction` no existe.
- [ ] En Ajustes, cada número vinculado tiene "Desvincular"; el botón recibe solo `linkId` y el número enmascarado (el completo no llega al navegador; `key = l.id`); al tocarlo aparece una confirmación con el número enmascarado; al confirmar, el número desaparece de la lista y sale un toast.
- [ ] `.env.example` termina con `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000`.
- [ ] `bun run test && bun run type-check` en verde.

---

### Task 1: `buildWhatsAppLinkUrl`

**Files:**
- Create: `src/lib/whatsapp/link-url.ts`
- Test: `src/lib/whatsapp/link-url.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `export function buildWhatsAppLinkUrl(botNumber: string | undefined, code: string): string | null` (la usan la Task 4 y, después en el flujo APP, `OnboardingWizard` de S11, que la importa sin volver a crearla).

- [x] **Step 1: Write the failing test**

Crear `src/lib/whatsapp/link-url.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildWhatsAppLinkUrl } from './link-url';

const ESPERADO = 'https://wa.me/573000000000?text=VINCULAR%20123456';

describe('buildWhatsAppLinkUrl', () => {
  it('número E.164 → enlace wa.me con el mensaje VINCULAR codificado', () => {
    expect(buildWhatsAppLinkUrl('+573000000000', '123456')).toBe(ESPERADO);
  });

  it('quita el prefijo whatsapp: (formato de Twilio)', () => {
    expect(buildWhatsAppLinkUrl('whatsapp:+573000000000', '123456')).toBe(
      ESPERADO,
    );
  });

  it('quita espacios internos y de los extremos', () => {
    expect(buildWhatsAppLinkUrl(' +57 300 000 0000 ', '123456')).toBe(
      ESPERADO,
    );
  });

  it('sin número (undefined, vacío o solo espacios) → null', () => {
    expect(buildWhatsAppLinkUrl(undefined, '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('   ', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('whatsapp:', '123456')).toBeNull();
  });

  it('un valor que no es un número de teléfono → null, no un enlace roto', () => {
    expect(buildWhatsAppLinkUrl('pendiente', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('+57-300-000-0000', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('+1234', '123456')).toBeNull();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/whatsapp/link-url.test.ts`
Expected: FAIL — `Failed to resolve import "./link-url"` (el archivo no existe).

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/whatsapp/link-url.ts`:

```ts
// Enlace "click to chat" de WhatsApp para vincular un número desde la app.
// El número del bot viene de NEXT_PUBLIC_WHATSAPP_BOT_NUMBER (público: es el
// mismo número al que la gente le escribe). Sin número válido → null, y la UI
// muestra solo el código, como antes.

/** Entre 8 y 15 dígitos: rango de E.164 sin el '+'. */
const SOLO_DIGITOS = /^\d{8,15}$/;

export function buildWhatsAppLinkUrl(
  botNumber: string | undefined,
  code: string,
): string | null {
  if (!botNumber) return null;
  const digitos = botNumber.replace(/^\s*whatsapp:/i, '').replace(/[\s+]/g, '');
  if (!SOLO_DIGITOS.test(digitos)) return null;
  const texto = encodeURIComponent(`VINCULAR ${code}`);
  return `https://wa.me/${digitos}?text=${texto}`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/whatsapp/link-url.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/whatsapp/link-url.ts src/lib/whatsapp/link-url.test.ts && git commit -m "$(cat <<'EOF'
feat(whatsapp): enlace wa.me con el mensaje VINCULAR listo para enviar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `MSG_LINKED_OK` y `MSG_ALREADY_LINKED` nuevos

**Files:**
- Modify: `src/lib/whatsapp/handle-linking.ts` (solo las constantes `MSG_LINKED_OK` y `MSG_ALREADY_LINKED`)
- Test: `src/lib/whatsapp/handle-linking.test.ts` (solo la aserción del primer y del tercer test)

**Interfaces:**
- Consumes: nada.
- Produces: el texto que responde `handleLinkingMessage` cuando `redeemLinkCode` devuelve `{ ok: true }` y cuando el número ya está vinculado. No cambia firmas ni exports.

> S02 (flujo SEG) no está en este worktree, así que `LinkingDeps` todavía tiene solo `redeemLinkCode` y `getLinkByPhone`. Cambia únicamente las dos aserciones indicadas abajo y las dos constantes; al integrar con S02 se conservan sus dependencias nuevas.

- [ ] **Step 1: Write the failing test**

En `src/lib/whatsapp/handle-linking.test.ts`, dentro de `it('VINCULAR con código válido → confirma y canjea', …)`, reemplazar esta línea:

```ts
    expect(reply).toContain('vinculado');
```

por:

```ts
    expect(reply).toBe(
      '¡Listo! Tu número quedó vinculado. Ya puedes mandarme una foto de la ' +
        'factura, el código CUFE o escribir algo como «40 mil almuerzo». ' +
        'También puedes preguntarme «¿cuánto llevo en mercado?».',
    );
```

El test completo queda así (versión sin S02):

```ts
  it('VINCULAR con código válido → confirma y canjea', async () => {
    const redeemLinkCode = vi.fn().mockResolvedValue({ ok: true, userId: 'u1' });
    const getLinkByPhone = vi.fn();
    const reply = await handleLinkingMessage('+573001234567', 'VINCULAR 482913', {
      redeemLinkCode,
      getLinkByPhone,
    });
    expect(redeemLinkCode).toHaveBeenCalledWith('482913', '+573001234567');
    expect(reply).toBe(
      '¡Listo! Tu número quedó vinculado. Ya puedes mandarme una foto de la ' +
        'factura, el código CUFE o escribir algo como «40 mil almuerzo». ' +
        'También puedes preguntarme «¿cuánto llevo en mercado?».',
    );
    expect(getLinkByPhone).not.toHaveBeenCalled();
  });
```

Y dentro de `it('número ya vinculado y mensaje cualquiera → avisa que ya está vinculado', …)`, reemplazar:

```ts
    expect(reply.toLowerCase()).toContain('vinculado');
```

por:

```ts
    expect(reply).toBe(
      'Este número ya está vinculado. Ya puedes mandarme tus gastos.',
    );
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/whatsapp/handle-linking.test.ts`
Expected: FAIL en 2 tests: "VINCULAR con código válido → confirma y canjea" con `expected '✅ ¡Listo! Tu WhatsApp quedó vinculado…' to be '¡Listo! Tu número quedó vinculado…'` y "número ya vinculado y mensaje cualquiera → avisa que ya está vinculado" con `expected 'Tu número ya está vinculado a tu presupuesto. 👍 El registro de gastos por mensaje llegará muy pronto.' to be 'Este número ya está vinculado. Ya puedes mandarme tus gastos.'`.

- [ ] **Step 3: Write minimal implementation**

En `src/lib/whatsapp/handle-linking.ts`, reemplazar:

```ts
const MSG_LINKED_OK =
  '✅ ¡Listo! Tu WhatsApp quedó vinculado a tu presupuesto. Pronto podrás ' +
  'enviarme tus facturas (CUFE o foto) y transferencias para registrar gastos.';
```

por:

```ts
const MSG_LINKED_OK =
  '¡Listo! Tu número quedó vinculado. Ya puedes mandarme una foto de la ' +
  'factura, el código CUFE o escribir algo como «40 mil almuerzo». ' +
  'También puedes preguntarme «¿cuánto llevo en mercado?».';
```

y reemplazar:

```ts
const MSG_ALREADY_LINKED =
  'Tu número ya está vinculado a tu presupuesto. 👍 El registro de gastos por ' +
  'mensaje llegará muy pronto.';
```

por:

```ts
const MSG_ALREADY_LINKED =
  'Este número ya está vinculado. Ya puedes mandarme tus gastos.';
```

No toques ninguna otra constante ni función del archivo.

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/whatsapp/handle-linking.test.ts src/app/api/whatsapp/webhook/route.test.ts`
Expected: PASS (todos; el test del webhook se corre porque consume `handleLinkingMessage`).

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/whatsapp/handle-linking.ts src/lib/whatsapp/handle-linking.test.ts && git commit -m "$(cat <<'EOF'
feat(whatsapp): al vincular, el bot cuenta qué se le puede mandar

MSG_ALREADY_LINKED deja de prometer que el registro por mensaje "llegará
muy pronto": ya funciona.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `unlinkWhatsAppLinkAction`

**Files:**
- Modify: `src/lib/actions/whatsapp.ts` (agregar al final del archivo)
- Test: `src/lib/actions/whatsapp.test.ts`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/server`, `revalidatePath` de `next/cache` y `linkIdSchema` (`z.string().uuid()`, ya definido en el archivo para `guardarDocumentoDianAction`).
- Produces (contratos §5.2, exacto; reemplaza a `unlinkWhatsAppPhoneAction(phoneE164)` de §2.8, que **no** se crea):
  ```ts
  export type UnlinkLinkResult = { ok: true } | { ok: false; error: string };
  export async function unlinkWhatsAppLinkAction(linkId: string): Promise<UnlinkLinkResult>
  ```
  Borra por `id` **y** `user_id` con el cliente de cookie; así el número completo no llega al navegador (el cliente solo conoce el `id` y el número enmascarado). Mensajes de error exactos: `'Número inválido.'` (id que no es uuid, igual que `guardarDocumentoDianAction`), `'No autenticado'`, `'No encontramos ese número entre los tuyos.'`, `'No se pudo desvincular el número.'`.

- [ ] **Step 1: Write the failing test**

En `src/lib/actions/whatsapp.test.ts`:

1. Reemplazar el bloque de imports del módulo bajo prueba y agregar `revalidatePath`:

```ts
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

import {
  guardarDocumentoDianAction,
  listarDocumentosDianAction,
  unlinkWhatsAppLinkAction,
} from './whatsapp';
```

(reemplaza a las líneas actuales `import { createClient } from '@/lib/supabase/server';` y el `import { guardarDocumentoDianAction, listarDocumentosDianAction } from './whatsapp';`).

2. Reemplazar la función `clienteFalso` completa por esta versión, que agrega `delete` a la cadena:

```ts
/**
 * Cliente de cookie falso: una sola cadena con los métodos del SELECT
 * (select→eq→order), del UPDATE (update→eq→eq→select) y del DELETE
 * (delete→eq→eq→select), para mirar qué se llamó. `select('id')` cierra
 * tanto el UPDATE como el DELETE y devuelve `updateResult`.
 */
function clienteFalso({
  user = { id: 'user-1' } as { id: string } | null,
  updateResult = { data: [{ id: LINK_ID }], error: null } as Resultado,
  selectResult = { data: [], error: null } as Resultado,
} = {}) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // El UPDATE/DELETE terminan en select('id'); el listado sigue con eq→order.
    select: vi.fn((cols: string) =>
      cols === 'id' ? Promise.resolve(updateResult) : chain,
    ),
    order: vi.fn().mockResolvedValue(selectResult),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => chain),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, chain };
}
```

3. Agregar al final del archivo:

```ts
describe('unlinkWhatsAppLinkAction', () => {
  const PHONE = '+573000000000';

  beforeEach(() => vi.clearAllMocks());

  it('borra el link por id solo entre los del usuario autenticado y revalida Ajustes', async () => {
    const { client, chain } = clienteFalso();

    const r = await unlinkWhatsAppLinkAction(LINK_ID);

    expect(r).toEqual({ ok: true });
    expect(client.from).toHaveBeenCalledWith('whatsapp_links');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', LINK_ID);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.select).toHaveBeenCalledWith('id');
    expect(revalidatePath).toHaveBeenCalledWith('/settings');
  });

  it('id que no es uuid (incluido un teléfono) → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    for (const malo of ['', 'no-es-uuid', PHONE]) {
      const r = await unlinkWhatsAppLinkAction(malo);
      expect(r).toEqual({ ok: false, error: 'Número inválido.' });
    }
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin sesión → no autenticado y no borra nada', async () => {
    const { client } = clienteFalso({ user: null });

    const r = await unlinkWhatsAppLinkAction(LINK_ID);

    expect(r).toEqual({ ok: false, error: 'No autenticado' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('el link no es del usuario (0 filas borradas) → error, no éxito falso', async () => {
    clienteFalso({ updateResult: { data: [], error: null } });

    const r = await unlinkWhatsAppLinkAction(LINK_ID);

    expect(r).toEqual({
      ok: false,
      error: 'No encontramos ese número entre los tuyos.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('error de la DB → mensaje genérico y no loguea el número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      updateResult: {
        data: null,
        error: {
          code: '42501',
          message: 'permission denied',
          details: `Failing row contains (${PHONE})`,
        },
      },
    });

    const r = await unlinkWhatsAppLinkAction(LINK_ID);

    expect(r).toEqual({ ok: false, error: 'No se pudo desvincular el número.' });
    expect(errorSpy).toHaveBeenCalledWith(expect.any(String), '42501');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(PHONE);
    expect(revalidatePath).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/whatsapp.test.ts`
Expected: FAIL — los 5 tests de `unlinkWhatsAppLinkAction` fallan con `TypeError: unlinkWhatsAppLinkAction is not a function`; los tests existentes de `guardarDocumentoDianAction` y `listarDocumentosDianAction` siguen en verde.

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `src/lib/actions/whatsapp.ts` (después de `guardarDocumentoDianAction`, así `linkIdSchema` ya está definido):

```ts
export type UnlinkLinkResult = { ok: true } | { ok: false; error: string };

/**
 * Desvincula un número de WhatsApp del usuario autenticado por el `id` de su
 * fila en `whatsapp_links` (contratos §5.2): el navegador solo conoce el id y
 * el número enmascarado, nunca el completo. Con el cliente de la cookie: la
 * política DELETE solo deja borrar filas propias; el filtro por `user_id` es
 * además explícito. El `.select('id')` (RETURNING, cubierto por la política
 * SELECT del dueño) distingue "borrado" de "no era tuyo". Nunca loguea el
 * número.
 */
export async function unlinkWhatsAppLinkAction(
  linkId: string,
): Promise<UnlinkLinkResult> {
  if (!linkIdSchema.safeParse(linkId).success) {
    return { ok: false, error: 'Número inválido.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'No autenticado' };
  }

  const { data, error } = await supabase
    .from('whatsapp_links')
    .delete()
    .eq('id', linkId)
    .eq('user_id', user.id)
    .select('id');
  if (error) {
    // Solo el código: el detalle de Postgres puede traer la fila con el número.
    console.error('unlinkWhatsAppLinkAction: error desvinculando:', error.code);
    return { ok: false, error: 'No se pudo desvincular el número.' };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No encontramos ese número entre los tuyos.' };
  }

  revalidatePath('/settings');
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/actions/whatsapp.test.ts && bun run type-check`
Expected: PASS (15 tests: 7 + 3 existentes + 5 nuevos) y `tsc --noEmit` sin errores.

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -rn "unlinkWhatsAppPhoneAction\|UnlinkPhoneResult" src`
Expected: sin salida (la firma vieja de §2.8 no existe en ningún lado).

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/lib/actions/whatsapp.ts src/lib/actions/whatsapp.test.ts && git commit -m "$(cat <<'EOF'
feat(whatsapp): acción para desvincular un número propio por el id del link

Borra por id y user_id con el cliente de la cookie: el número completo no
tiene que llegar al navegador.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Botón "Abrir WhatsApp" en el panel y variable en `.env.example`

**Files:**
- Modify: `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx` (archivo completo)
- Modify: `.env.example` (agregar al final)

**Interfaces:**
- Consumes: `buildWhatsAppLinkUrl(botNumber: string | undefined, code: string): string | null` (Task 1); `generateWhatsAppLinkCodeAction(): Promise<GenerateCodeResult>` (existente).
- Produces: nada que otras tareas consuman.

> No hay tests de componentes en el repo (vitest corre en `environment: 'node'` sin testing-library). La lógica del enlace está cubierta por la Task 1; esta tarea se verifica con `type-check`, `lint` y una revisión visual opcional.

- [ ] **Step 1: Reemplazar el panel**

Reemplazar todo `src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx` por:

```tsx
'use client';

import React, { useState } from 'react';

import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';
import { buildWhatsAppLinkUrl } from '@/lib/whatsapp/link-url';

// Next.js reemplaza NEXT_PUBLIC_* en el build. Sin la variable, el panel
// muestra solo el código (sin botón), como antes.
const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER;

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

  const linkUrl = code ? buildWhatsAppLinkUrl(BOT_NUMBER, code) : null;

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

          {linkUrl ? (
            <>
              <p className="text-sm text-slate-300">
                Toca el botón: WhatsApp se abre con el mensaje listo, solo
                tienes que enviarlo.
              </p>
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:w-auto"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Abrir WhatsApp
              </a>
              <p className="text-sm text-slate-400">
                ¿No se abrió? Envía este mensaje al número del bot:
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-300">
              Abre WhatsApp y envía al número del bot:
            </p>
          )}

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

- [ ] **Step 2: Agregar la variable al final de `.env.example`**

Agregar al **final** de `.env.example` (después de la última línea existente; S04 no está en este worktree: al integrar, su `NEXT_PUBLIC_SITE_URL` y esta variable se conservan ambas):

```
# === WhatsApp: enlace de vinculación en Ajustes ===
# Número del bot en E.164. Es público (llega al navegador): es el mismo número
# al que la gente le escribe. Vacío = el panel muestra solo el código, sin el
# botón "Abrir WhatsApp". Cambiarlo requiere un deploy nuevo (se fija en el build).
NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run type-check && bunx eslint src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx`
Expected: `tsc --noEmit` sin errores; eslint sin errores (orden de imports incluido).

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && tail -n 1 .env.example`
Expected: `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000`

- [ ] **Step 4 (solo humano, opcional; nunca producción): revisión visual**

El implementador **no** corre `bun run dev` ni `next build` (`.env.local` apunta a producción, §5.0). El humano, en un entorno con base de desarrollo y `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000`, entra a `/settings`, tocar "Generar código de vinculación" y comprobar que el botón "Abrir WhatsApp" apunta a `https://wa.me/573000000000?text=VINCULAR%20<código>`. Sin la variable, el panel no muestra el botón. No uses datos de producción.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel.tsx .env.example && git commit -m "$(cat <<'EOF'
feat(ajustes): botón "Abrir WhatsApp" con el código de vinculación ya escrito

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Desvincular desde la lista de números en Ajustes

**Files:**
- Create: `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx`
- Modify: `src/app/settings/page.tsx:1-72` (archivo completo)
- Test: `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts` (test de texto; vitest corre en `node` sin Testing Library, contratos §5.0)

**Interfaces:**
- Consumes: `unlinkWhatsAppLinkAction(linkId: string): Promise<UnlinkLinkResult>` y `type UnlinkLinkResult` (Task 3); `enmascararTelefono(phone: string): string` de `@/lib/whatsapp/format` (existente); `ConfirmModal` de `@/components/atoms/ConfirmModal/ConfirmModal` (existente, props `isOpen`, `onClose`, `onConfirm`, `title`, `message`, `confirmText`, `cancelText`, `isLoading`).
- Produces: componente cliente
  ```ts
  export default function UnlinkPhoneButton(props: {
    linkId: string;
    maskedPhone: string;
  }): JSX.Element
  ```

> Por qué por `linkId` (contratos §5.2): el botón cliente recibe solo el `id` del link (uuid) y el número ya enmascarado, y llama directo a la server action `unlinkWhatsAppLinkAction(linkId)`. El número completo se queda en el servidor: ya no hace falta una server action en línea que cierre sobre él. La `key` de la lista también pasa a `l.id`, porque en un server component la `key` viaja en el payload RSC.

- [ ] **Step 1: Write the failing test**

Crear `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (contratos §5.0): vitest corre en `node`, sin DOM. Se lee el
// fuente; un archivo que aún no existe se lee como '' para que el test falle
// por aserción y no por excepción.
const leer = (ruta: string) => {
  const abs = resolve(process.cwd(), ruta);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
};

const boton = leer(
  'src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx',
);
const ajustes = leer('src/app/settings/page.tsx');

describe('UnlinkPhoneButton (S13, contratos §5.2)', () => {
  it('desvincula por el id del link con la server action', () => {
    expect(boton).toContain('unlinkWhatsAppLinkAction(linkId)');
    expect(boton).toContain('linkId: string;');
    expect(boton).toContain('maskedPhone: string;');
  });
});

describe('Ajustes: el número completo no llega al navegador', () => {
  it('la lista usa el id como key y se lo pasa al botón', () => {
    expect(ajustes).toContain('key={l.id as string}');
    expect(ajustes).toContain('linkId={l.id as string}');
    expect(ajustes).not.toContain('key={l.phone_e164');
  });

  it('no hay server action en línea ni la acción vieja por teléfono', () => {
    expect(ajustes).not.toContain("'use server'");
    expect(ajustes).not.toContain('unlinkWhatsAppPhoneAction');
    expect(ajustes).not.toContain('maskPhone');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts`
Expected: FAIL en 3 tests (`expected '' to contain 'unlinkWhatsAppLinkAction(linkId)'`, `expected '…' to contain 'key={l.id as string}'`, `expected '…maskPhone…' not to contain 'maskPhone'`).

- [ ] **Step 3: Crear el botón con confirmación**

Crear `src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx`:

```tsx
'use client';

/**
 * UnlinkPhoneButton - Molecule Level
 *
 * "Desvincular" de un número de WhatsApp en Ajustes. Pide confirmación y
 * llama a unlinkWhatsAppLinkAction con el id del link (contratos §5.2): el
 * número completo nunca llega al navegador, aquí solo está el enmascarado.
 * La acción revalida /settings, así que la lista se actualiza sola al
 * terminar.
 */

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import { unlinkWhatsAppLinkAction } from '@/lib/actions/whatsapp';

interface UnlinkPhoneButtonProps {
  linkId: string;
  maskedPhone: string;
}

export default function UnlinkPhoneButton({
  linkId,
  maskedPhone,
}: UnlinkPhoneButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const confirmar = async () => {
    setLoading(true);
    try {
      const res = await unlinkWhatsAppLinkAction(linkId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Número desvinculado');
      setOpen(false);
    } catch {
      toast.error('No se pudo desvincular el número.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-400 hover:bg-red-900/30 hover:text-red-300"
      >
        Desvincular
      </Button>
      <ConfirmModal
        isOpen={open}
        onClose={() => {
          if (!loading) setOpen(false);
        }}
        onConfirm={confirmar}
        title="Desvincular número"
        message={`El número ${maskedPhone} dejará de registrar gastos en tu presupuesto. Para volver a conectarlo tendrás que generar un código nuevo.`}
        confirmText="Desvincular"
        cancelText="Cancelar"
        isLoading={loading}
      />
    </>
  );
}
```

- [ ] **Step 4: Reemplazar la página de Ajustes**

Reemplazar todo `src/app/settings/page.tsx` por:

```tsx
import { redirect } from 'next/navigation';

import UnlinkPhoneButton from '@/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton';
import AccountsPanel from '@/components/organisms/AccountsPanel/AccountsPanel';
import CategoriesPanel from '@/components/organisms/CategoriesPanel/CategoriesPanel';
import DocumentosDianPanel from '@/components/organisms/DocumentosDianPanel/DocumentosDianPanel';
import WhatsAppLinkPanel from '@/components/organisms/WhatsAppLinkPanel/WhatsAppLinkPanel';
import { createClient } from '@/lib/supabase/server';
import { enmascararTelefono } from '@/lib/whatsapp/format';

export const dynamic = 'force-dynamic';

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
    .select('id, phone_e164, linked_at')
    .eq('user_id', user.id)
    .order('linked_at', { ascending: false });

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-white">Ajustes</h1>

      <AccountsPanel />

      <CategoriesPanel />

      <WhatsAppLinkPanel />

      <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
        <h3 className="mb-3 text-lg font-medium text-white">
          Números vinculados
        </h3>
        {links && links.length > 0 ? (
          <ul className="space-y-2">
            {links.map(l => {
              // El número completo se queda en el servidor: al cliente solo
              // llegan el id del link y el número enmascarado (§5.2).
              const masked = enmascararTelefono(l.phone_e164 as string);
              return (
                <li
                  key={l.id as string}
                  className="flex items-center justify-between gap-3 rounded bg-slate-800 px-3 py-2 text-sm"
                >
                  <div className="flex flex-col">
                    <span className="font-mono text-slate-200">{masked}</span>
                    <span className="text-xs text-slate-500">
                      Vinculado el{' '}
                      {new Date(l.linked_at as string).toLocaleDateString(
                        'es-CO',
                      )}
                    </span>
                  </div>
                  <UnlinkPhoneButton
                    linkId={l.id as string}
                    maskedPhone={masked}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">
            Aún no hay números vinculados.
          </p>
        )}
      </section>

      <DocumentosDianPanel />
    </main>
  );
}
```

Notas para el implementador:
- Se elimina la función local `maskPhone`; la máscara pasa a ser `enmascararTelefono` (la misma que usa `DocumentosDianPanel`), para que el número se vea igual en toda la página.
- La `key` pasa de `phone_e164` a `id`: en un server component la `key` viaja en el payload RSC.

- [ ] **Step 5: Verificar tests, tipos y lint**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts src/lib/actions/whatsapp.test.ts && bun run type-check && bunx eslint src/app/settings/page.tsx src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts`
Expected: PASS (3 + 15 tests); `tsc --noEmit` sin errores; eslint sin errores.

- [ ] **Step 6 (solo humano, opcional; nunca producción): revisión visual**

El implementador **no** corre `bun run dev` ni `next build` (`.env.local` apunta a producción, contratos §5.0). El humano, en un entorno con base de desarrollo (o en S14) y un usuario de prueba con un número vinculado de prueba (`+573000000000`), entra a `/settings`: cada número muestra "Desvincular"; al tocarlo aparece "Desvincular número" con el número enmascarado; "Cancelar" cierra sin cambios; "Desvincular" muestra el toast "Número desvinculado" y el número desaparece de "Números vinculados". En la pestaña Network, la respuesta RSC de `/settings` no contiene `573000000000` en claro.

- [ ] **Step 7: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.test.ts src/app/settings/page.tsx && git commit -m "$(cat <<'EOF'
feat(ajustes): desvincular un número de WhatsApp con confirmación

El botón recibe el id del link y el número enmascarado y llama a
unlinkWhatsAppLinkAction: el número completo no llega al navegador. La key
de la lista pasa a ser el id.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación final

**Files:** ninguno.

- [ ] **Step 1: Suite completa y tipos**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: todos los tests en verde y `tsc --noEmit` sin errores.

- [ ] **Step 2: Sin teléfonos reales en lo nuevo**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && git diff main --name-only | xargs grep -nE '\+57[0-9]{10}' | grep -v '573000000000' | grep -v '573001234567'`
Expected: sin salida (solo aparecen `+573000000000` y el `+573001234567` que ya existía en los tests previos).

- [ ] **Step 3: Revisar criterios de aceptación**

Marcar cada casilla de "Criterios de aceptación" de este archivo contra el código.

## Tareas humanas (después de integrar)

- En Vercel (Production y Preview), agregar `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER` con el número real del bot en E.164 (el que está configurado como remitente en Twilio, sin `whatsapp:`), y hacer un deploy nuevo: las variables `NEXT_PUBLIC_*` se fijan en el build.
- Probar en producción, con un número propio: generar código → "Abrir WhatsApp" → enviar → el bot responde el `MSG_LINKED_OK` nuevo → en Ajustes, desvincular ese número y comprobar que desaparece.

## Autorrevisión

- Cobertura: enlace `wa.me` (Tasks 1 y 4), `MSG_LINKED_OK` y `MSG_ALREADY_LINKED` (Task 2), `unlinkWhatsAppLinkAction` (Task 3), botón desvincular con confirmación por `linkId` y `key = l.id` (Task 5), `.env.example` (Task 4), política DELETE verificada (sección "Verificación previa").
- Tipos: `UnlinkLinkResult` se define en la Task 3; `UnlinkPhoneButton` solo usa `unlinkWhatsAppLinkAction` (el tipo se infiere). `buildWhatsAppLinkUrl` tiene la firma del contrato y S11 la reusa sin cambios.
- Límite con S02: en `handle-linking.ts` solo cambian `MSG_LINKED_OK` y `MSG_ALREADY_LINKED`; en su test solo cambian dos aserciones. Choque esperado al integrar (§5.3).
- Pendiente fuera de alcance: `DocumentosDianPanel` carga sus números al montar; después de desvincular sigue mostrando el número hasta recargar la página (guardar un documento en él devuelve "No encontramos ese número entre los tuyos.").
