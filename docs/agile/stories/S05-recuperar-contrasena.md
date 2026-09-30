# S05 — Recuperar contraseña Implementation Plan

> **Alineado con contratos v2 (§5).** Donde §5 de `docs/agile/contracts.md` choca con §0–§4, gana §5. Flujo AUTH en serie: **S04 → S06 → S05**: esta historia va al final y usa `passwordSchema` de S06 (ya no lo crea).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario que olvidó su contraseña pida un enlace por correo en `/auth/forgot-password` (con la misma respuesta exista o no el correo) y, al abrirlo, cree una contraseña nueva en `/auth/reset-password` y siga a `/bienvenida` o `/dashboard` según su onboarding (`getPostLoginPath`, contratos §5.2).

**Architecture:** Dos server actions nuevas en `src/lib/actions/auth.ts`. `forgotPasswordAction` llama `supabase.auth.resetPasswordForEmail` con `redirectTo` hacia `/auth/confirm` (S04), se traga todo error (incluido el límite de envíos, que revelaría que el correo existe; contratos §5.2), registra solo el `code` y siempre redirige al mismo mensaje. El correo (plantilla "Reset Password", tarea humana H4) apunta a `/auth/confirm?token_hash=…&type=recovery&next=/auth/reset-password`; ese route handler (S04) llama `verifyOtp`, deja la sesión en cookies y redirige a `/auth/reset-password`. `resetPasswordAction` exige esa sesión (`auth.getUser()`), valida con `resetPasswordFormSchema` (usa `passwordSchema` de S06) y llama `updateUser({ password })`; tras el éxito redirige con `getPostLoginPath(supabase, user.id)`. En `?error=`/`?message=` solo viajan **códigos**, nunca texto; las páginas los traducen con `resolveForgotPasswordFeedback` y `resolveResetPasswordError` (`src/lib/auth/password-reset-feedback.ts`, listas cerradas; lo que no está en la lista pasa por `translateAuthError`, incluido `same_password`). Las páginas imitan el estilo de `login/page.tsx` y `register/page.tsx` (Card `glass`, fondo `slate-900`). **Ver la sección «Desviaciones» al final: prevalece sobre el código de las Tasks 2–5.**

**Tech Stack:** Next.js 15 App Router (server actions, server components), `@supabase/ssr` (cliente de cookie), Zod 4, vitest 4, bun.

## Global Constraints

- Nombres y firmas EXACTOS del contrato (`docs/agile/contracts.md` v2; §5 prevalece sobre §0–§4): `forgotPasswordAction(formData)`, `resetPasswordAction(formData)`, `getSiteUrl()`, `translateAuthError(err)`, `passwordSchema`, ruta `/auth/confirm`.
- `redirectTo` de `resetPasswordForEmail` = `` `${getSiteUrl()}/auth/confirm?type=recovery&next=/auth/reset-password` `` (contrato §2.3).
- Respuesta de `forgotPasswordAction`, exista o no el correo: **"Si el correo está registrado, te enviamos un enlace."** (contrato §2.3).
- `passwordSchema` = `z.string().min(8, 'Usa al menos 8 caracteres').max(72, 'Usa como máximo 72 caracteres')` (contrato §2.4). El texto de ayuda de la UI dice "Mínimo 8 caracteres." y nada más.
- Nunca se muestra el mensaje crudo de Supabase: todo error de Supabase en `resetPasswordAction` pasa por `translateAuthError` (contrato §2.2 + §5.2, que agrega la fila `same_password`: "La contraseña nueva debe ser distinta de la anterior.").
- `forgotPasswordAction` **se traga todo error** de `resetPasswordForEmail`, devuelto o lanzado, incluido el límite de envíos (contrato §5.2): la respuesta no cambia y el log lleva **solo** el `code`.
- UI en español colombiano, tuteo.
- Ningún correo, teléfono o nombre real en código, tests o logs: en tests se usa `usuario@ejemplo.com`; los `console.error` registran solo `code` (y `status` en `resetPasswordAction`), nunca el correo.
- Contratos §5.0: sin tests de render (vitest en `node`); no se toca `vitest.config.ts`; nunca `bun run db:types`; **prohibido** `bun run dev` y `next build` contra `.env.local` (apunta a producción).
- Un archivo `'use server'` solo puede **exportar** funciones async (Next.js falla en build si exporta una constante). Constantes y helpers de `auth.ts` quedan sin `export`.
- Los tests mockean Supabase; ningún test toca una base real. No se accede a la base de producción.
- Comandos siempre con `builtin cd <raíz-del-repo> && …` (el `cd` del shell está envuelto).
- Verificación del proyecto: `bun run test && bun run type-check`.
- Commits en español terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Dependencias (verificar antes de empezar)

S05 depende de **S04** (crea `getSiteUrl`, `safeRedirectPath`, `translateAuthError` con la fila `same_password`, `/auth/confirm`, `route-access.ts`) y de **S06** (crea `passwordSchema`). Por el orden del flujo AUTH (contratos §5.3: S04 → S06 → S05), las dos ya están en la rama cuando empieza S05.

- Si falta cualquiera de los archivos de S04 (Task 1, Step 1): **no implementes S04 aquí**. Detente y repórtalo al orquestador (S05 no se puede probar sin `/auth/confirm`).
- Si falta `passwordSchema` o difiere del contrato (Task 1, Step 2): **no lo crees ni lo cambies aquí** (es de S06). Detente y repórtalo al orquestador.

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Modificar | `src/lib/actions/auth.ts` | `forgotPasswordAction`, `resetPasswordAction` (agregadas al final; no tocar las acciones de S04) |
| Crear | `src/lib/actions/auth-password.test.ts` | Tests de las dos acciones (nombre distinto de `auth.test.ts` para no chocar con S04) |
| Crear | `src/app/auth/forgot-password/page.tsx` | Formulario de correo (componente cliente, estilo login) |
| Crear | `src/app/auth/reset-password/page.tsx` | Server component: exige sesión; sin sesión → `/auth/forgot-password` con "El enlace venció. Pide uno nuevo." |
| Crear | `src/app/auth/reset-password/ResetPasswordForm.tsx` | Formulario cliente de contraseña nueva (estilo register) |
| Crear | `src/lib/auth/password-reset-feedback.ts` (+ test) | Códigos de las dos páginas y su traducción desde listas cerradas (ver Desviaciones) |
| Crear | `src/app/auth/forgot-password/forgot-password-page.test.ts`, `src/app/auth/reset-password/reset-password-page.test.ts` | Invariantes de seguridad sobre el código fuente de las páginas (sin render, §5.0) |
| Crear | `src/app/auth/AuthLoadingFallback.tsx` | Fallback de Suspense compartido por login, registro y las dos páginas de contraseña |
| Modificar | `src/lib/validations/schemas.ts` | `resetPasswordFormSchema` (exportado para que el test use el esquema real) |
| Modificar | `src/lib/auth/error-messages.ts` | Fila `reauthentication_needed` (contratos §5.2) |

`src/lib/validations/schemas.ts` **no se toca**: `passwordSchema` lo crea S06. `middleware.ts` y `src/lib/auth/route-access.ts` **no se tocan**: S04 deja `/auth/forgot-password` y `/auth/reset-password` en `AUTH_ROUTES` de `route-access.ts` (siempre accesibles; solo `/auth/login` y `/auth/register` redirigen a usuarios con sesión). S04 es dueña de esos archivos.

La plantilla "Invite user" de S04 también lleva a `/auth/reset-password` (contratos §5.2): después de desplegar esta historia se pueden enviar invitaciones (con el correo antes en la allowlist).

## Criterios de aceptación

1. `/auth/forgot-password` muestra un formulario de correo. Al enviarlo con un correo válido se llama `resetPasswordForEmail(correo, { redirectTo: `${getSiteUrl()}/auth/confirm?type=recovery&next=/auth/reset-password` })` y se muestra **exactamente** "Si el correo está registrado, te enviamos un enlace.", tanto si Supabase responde bien como si devuelve cualquier error (incluido el límite de envíos) o lanza: la URL final es idéntica en todos los casos y el log lleva solo el `code` (contratos §5.2).
2. Correo vacío o con formato inválido → `/auth/forgot-password?error=correo_invalido` sin llamar a Supabase; la página muestra "Escribe un correo válido.". (En el éxito la URL es `?message=enlace_enviado` y la página muestra el texto del criterio 1.)
3. `/auth/reset-password` sin sesión redirige a `/auth/forgot-password?error=otp_expired`, que la página traduce a "El enlace venció. Pide uno nuevo." (`translateAuthError({ code: 'otp_expired' })`). `resetPasswordAction` aplica la misma regla (no confía en la página).
4. `resetPasswordAction` valida con `resetPasswordFormSchema` (`passwordSchema` 8–72, confirmación no vacía y que ambas coincidan); si falla, vuelve a `/auth/reset-password?error=<código>` (`password_corta`, `password_larga`, `confirmar_password`, `no_coinciden` o `datos_invalidos`) sin llamar `updateUser`, y la página muestra el texto de la lista cerrada ("Las contraseñas no coinciden.", etc.).
5. Con sesión y contraseña válida: `updateUser({ password })`, `revalidatePath('/', 'layout')` y redirección a `getPostLoginPath(supabase, user.id)` (`/bienvenida` o `/dashboard`; contratos §5.2), no a `/dashboard` fijo.
6. Error de `updateUser` → `/auth/reset-password?error=<authErrorCode(error)>`; la página lo traduce con `resolveResetPasswordError`, nunca muestra el mensaje crudo y un texto libre en `?error=` cae en el genérico. `same_password` muestra "La contraseña nueva debe ser distinta de la anterior." y `reauthentication_needed` "Por seguridad, pide un enlace nuevo para cambiar la contraseña." (filas de §5.2).
7. La UI de reset usa `PASSWORD_HINT` ("Mínimo 8 caracteres.") como único texto de ayuda y `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH` de `password-rules.ts` en los campos.
8. Los logs de error no contienen el correo; el de `forgotPasswordAction` es exactamente `{ code }`.
9. Texto de la plantilla "Reset Password" para H4 incluido en esta historia (sección final).
10. `bun run test && bun run type-check` en verde.

---

### Task 1: Verificar dependencias (S04 y `passwordSchema` de S06)

**Files:** ninguno se crea ni se modifica. Esta tarea solo verifica; no tiene commit.

**Interfaces:**
- Consumes: de S04 `getSiteUrl` (`@/lib/site-url`), `translateAuthError` (`@/lib/auth/error-messages`, con las filas `otp_expired`, `weak_password` y `same_password`), `GET /auth/confirm`; de S06 `export const passwordSchema` (`@/lib/validations/schemas`, contrato §2.4).
- Produces: nada. Las Tasks 3 y 5 usan `passwordSchema` y `translateAuthError` tal como los dejaron S06 y S04.

- [x] **Step 1: Verificar que S04 está implementada**

Run:
```bash
builtin cd <raíz-del-repo> && ls src/lib/site-url.ts src/lib/auth/safe-redirect.ts src/lib/auth/error-messages.ts src/lib/auth/route-access.ts src/app/auth/confirm/route.ts && grep -n "export function getSiteUrl" src/lib/site-url.ts && grep -n "export function translateAuthError" src/lib/auth/error-messages.ts && grep -n "same_password" src/lib/auth/error-messages.ts
```
Expected: los cinco archivos listados y al menos una línea por cada `grep`. Si algo falta: **detente** y reporta "S04 no está integrada en esta rama; S05 depende de ella".

Además confirma en la tabla de `src/lib/auth/error-messages.ts` que `translateAuthError({ code: 'otp_expired' })` devuelve "El enlace venció. Pide uno nuevo.", `translateAuthError({ code: 'weak_password' })` devuelve "La contraseña es muy débil. Usa al menos 8 caracteres." y `translateAuthError({ code: 'same_password' })` devuelve "La contraseña nueva debe ser distinta de la anterior." (contratos §2.2 y §5.2). Los tests de la Task 3 dependen de esos textos.

- [x] **Step 2: Verificar que `passwordSchema` existe (lo crea S06)**

Run:
```bash
builtin cd <raíz-del-repo> && grep -n -A 3 "export const passwordSchema" src/lib/validations/schemas.ts && bun run test src/lib/validations/schemas.test.ts
```
Expected: la declaración `export const passwordSchema = z.string().min(8, 'Usa al menos 8 caracteres').max(72, 'Usa como máximo 72 caracteres')` (puede estar partida en varias líneas) y los tests de S06 en verde.

- Si no imprime la declaración, o los mensajes o límites difieren del contrato §2.4: **detente**. No lo crees ni lo cambies en esta historia (es de S06, que va antes en el flujo AUTH); reporta "passwordSchema de S06 no está integrado o difiere del contrato".

---

### Task 2: `forgotPasswordAction`

**Files:**
- Modify: `src/lib/actions/auth.ts` (imports al inicio; código nuevo al final del archivo)
- Test: `src/lib/actions/auth-password.test.ts` (nuevo)

**Interfaces:**
- Consumes: `getSiteUrl(): string` de `@/lib/site-url` (S04); `createClient()` de `@/lib/supabase/server`; `redirect` de `next/navigation`.
- Produces: `export async function forgotPasswordAction(formData: FormData): Promise<void>` en `@/lib/actions/auth`. Lee el campo `email`. Siempre termina en `redirect(...)`:
  - correo inválido → `/auth/forgot-password?error=Escribe%20un%20correo%20v%C3%A1lido.`
  - cualquier otro caso → `/auth/forgot-password?message=<"Si el correo está registrado, te enviamos un enlace." codificado>`, **también** si `resetPasswordForEmail` devuelve un error (incluido `over_email_send_rate_limit`) o lanza (contratos §5.2). El error se registra con `console.error(<texto>, { code })` y nada más (sin `status`, sin correo).
  - Helper privado (sin export) `withQueryParam(path: string, key: 'error' | 'message', text: string): string`, que también usa la Task 3.

- [x] **Step 1: Escribir el test que falla**

Crea `src/lib/actions/auth-password.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  // Igual que el redirect real: lanza para cortar la ejecución.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/site-url', () => ({
  getSiteUrl: vi.fn(() => 'https://app.ejemplo.com'),
}));

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

import { forgotPasswordAction } from './auth';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedRedirect = redirect as unknown as ReturnType<typeof vi.fn>;

const CORREO = 'usuario@ejemplo.com';
const MENSAJE_GENERICO = 'Si el correo está registrado, te enviamos un enlace.';
const REDIRECT_TO =
  'https://app.ejemplo.com/auth/confirm?type=recovery&next=/auth/reset-password';

interface ErrorFalso {
  message: string;
  code?: string;
  status?: number;
}

/** Cliente de cookie falso con solo los métodos de auth que usan las acciones. */
function clienteFalso({
  user = { id: '11111111-1111-4111-8111-111111111111' } as { id: string } | null,
  resetError = null as ErrorFalso | null,
  resetThrows = null as Error | null,
  updateError = null as ErrorFalso | null,
} = {}) {
  const client = {
    auth: {
      resetPasswordForEmail: resetThrows
        ? vi.fn().mockRejectedValue(resetThrows)
        : vi.fn().mockResolvedValue({ data: {}, error: resetError }),
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user }, error: null }),
      updateUser: vi
        .fn()
        .mockResolvedValue({ data: { user }, error: updateError }),
    },
  };
  mockedCreateClient.mockResolvedValue(client);
  return client;
}

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/** Ejecuta la acción, exige que termine en redirect y devuelve la URL destino. */
async function destino(p: Promise<unknown>): Promise<URL> {
  await expect(p).rejects.toThrow('NEXT_REDIRECT:');
  const url = mockedRedirect.mock.calls.at(-1)?.[0] as string;
  return new URL(url, 'http://localhost');
}

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('pide el correo de recuperación hacia /auth/confirm y responde el mensaje genérico', async () => {
    const client = clienteFalso();

    const url = await destino(forgotPasswordAction(formulario({ email: CORREO })));

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(CORREO, {
      redirectTo: REDIRECT_TO,
    });
    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('message')).toBe(MENSAJE_GENERICO);
    expect(url.searchParams.get('error')).toBeNull();
  });

  it('quita espacios alrededor del correo', async () => {
    const client = clienteFalso();

    await destino(forgotPasswordAction(formulario({ email: `  ${CORREO}  ` })));

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(CORREO, {
      redirectTo: REDIRECT_TO,
    });
  });

  it('límite de envíos: responde exactamente lo mismo y registra solo el code', async () => {
    clienteFalso();
    const exito = await destino(forgotPasswordAction(formulario({ email: CORREO })));

    clienteFalso({
      resetError: {
        message: 'For security purposes, you can only request this after 60 seconds.',
        code: 'over_email_send_rate_limit',
        status: 429,
      },
    });
    const fallo = await destino(forgotPasswordAction(formulario({ email: CORREO })));

    expect(fallo.href).toBe(exito.href);
    expect(fallo.searchParams.get('error')).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
      code: 'over_email_send_rate_limit',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(CORREO);
  });

  it('si resetPasswordForEmail lanza, se lo traga y responde lo mismo', async () => {
    clienteFalso({ resetThrows: new Error(`fetch failed para ${CORREO}`) });

    const url = await destino(forgotPasswordAction(formulario({ email: CORREO })));

    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('message')).toBe(MENSAJE_GENERICO);
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({ code: 'sin_codigo' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(CORREO);
  });

  it('correo con formato inválido → error y no llama a Supabase', async () => {
    const client = clienteFalso();

    const url = await destino(forgotPasswordAction(formulario({ email: 'no-es-correo' })));

    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('error')).toBe('Escribe un correo válido.');
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sin campo email → mismo error de validación', async () => {
    const client = clienteFalso();

    const url = await destino(forgotPasswordAction(new FormData()));

    expect(url.searchParams.get('error')).toBe('Escribe un correo válido.');
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/actions/auth-password.test.ts`
Expected: FAIL — `forgotPasswordAction is not a function` (o error de import equivalente) en los 6 tests.

- [x] **Step 3: Implementar**

En `src/lib/actions/auth.ts`:

1. Imports. Agrega los que falten (S04 ya importó `getSiteUrl` y `translateAuthError`; no los dupliques). Deben quedar presentes, respetando el orden de grupos del archivo:

```ts
import { z } from 'zod';

import { getSiteUrl } from '@/lib/site-url';
```

2. Al **final** del archivo agrega:

```ts
// ============================================
// RECUPERAR CONTRASEÑA (S05)
// ============================================

// Mismo texto exista o no el correo: no revelamos qué cuentas existen.
const FORGOT_PASSWORD_MESSAGE =
  'Si el correo está registrado, te enviamos un enlace.';

const INVALID_EMAIL_MESSAGE = 'Escribe un correo válido.';

const forgotPasswordEmailSchema = z
  .string()
  .trim()
  .email(INVALID_EMAIL_MESSAGE);

/** Arma `path?key=texto` con el texto codificado para la URL. */
function withQueryParam(
  path: string,
  key: 'error' | 'message',
  text: string,
): string {
  return `${path}?${key}=${encodeURIComponent(text)}`;
}

/** Solo el `code` del error (sin mensaje, que podría llevar el correo). */
function codigoDeError(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code
  ) {
    return error.code;
  }
  return 'sin_codigo';
}

/**
 * Server Action: envía el correo para restablecer la contraseña.
 * El enlace del correo (plantilla "Reset Password") pasa por /auth/confirm,
 * que deja la sesión y redirige a /auth/reset-password.
 *
 * Se traga todo error de resetPasswordForEmail, devuelto o lanzado, incluido
 * el límite de envíos: responder distinto revelaría que el correo existe
 * (contratos §5.2). Solo se registra el `code`.
 */
export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = forgotPasswordEmailSchema.safeParse(
    String(formData.get('email') ?? ''),
  );

  if (!parsed.success) {
    redirect(
      withQueryParam('/auth/forgot-password', 'error', INVALID_EMAIL_MESSAGE),
    );
  }

  const supabase = await createClient();
  let fallo: unknown = null;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${getSiteUrl()}/auth/confirm?type=recovery&next=/auth/reset-password`,
    });
    fallo = error;
  } catch (e) {
    fallo = e;
  }

  if (fallo) {
    console.error('forgotPasswordAction: resetPasswordForEmail falló', {
      code: codigoDeError(fallo),
    });
  }

  redirect(
    withQueryParam('/auth/forgot-password', 'message', FORGOT_PASSWORD_MESSAGE),
  );
}
```

Notas para el implementador:
- El único `try/catch` envuelve **solo** `resetPasswordForEmail`. Nunca pongas un `redirect` dentro de un `try`: `redirect` lanza `NEXT_REDIRECT` y un `catch` genérico lo tragaría.
- `redirect` es de tipo `never`, así que después del primer `if` TypeScript sabe que `parsed.success` es `true` y `parsed.data` es `string`.
- No exportes `FORGOT_PASSWORD_MESSAGE`, `withQueryParam` ni `codigoDeError` (archivo `'use server'`).

- [x] **Step 4: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/actions/auth-password.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Type-check**

Run: `builtin cd <raíz-del-repo> && bun run type-check`
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/actions/auth.ts src/lib/actions/auth-password.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): forgotPasswordAction con respuesta idéntica exista o no el correo

El enlace va a /auth/confirm (type=recovery, next=/auth/reset-password). Todo
error de Supabase, incluido el límite de envíos, se traga: solo se registra
el code y la respuesta no cambia.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `resetPasswordAction`

**Files:**
- Modify: `src/lib/actions/auth.ts` (imports; código nuevo al final, después de `forgotPasswordAction`)
- Test: `src/lib/actions/auth-password.test.ts` (import y bloque `describe` nuevos)

**Interfaces:**
- Consumes: `passwordSchema` de `@/lib/validations/schemas` (S06, verificado en Task 1); `translateAuthError(err: { message?: string; code?: string } | null | undefined): string` de `@/lib/auth/error-messages` (S04); `withQueryParam` (Task 2, privado); `revalidatePath` de `next/cache`.
- Produces: `export async function resetPasswordAction(formData: FormData): Promise<void>` en `@/lib/actions/auth`. Lee `password` y `confirmPassword`. Siempre termina en `redirect(...)`:
  - sin sesión → `/auth/forgot-password?error=<translateAuthError({ code: 'otp_expired' })>`
  - validación → `/auth/reset-password?error=<primer mensaje de Zod>`
  - error de `updateUser` → `/auth/reset-password?error=<translateAuthError(error)>`
  - éxito → `/dashboard`

- [x] **Step 1: Escribir el test que falla**

En `src/lib/actions/auth-password.test.ts`:

1. Reemplaza la línea `import { redirect } from 'next/navigation';` por:

```ts
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
```

2. Reemplaza la línea `import { forgotPasswordAction } from './auth';` por:

```ts
import { forgotPasswordAction, resetPasswordAction } from './auth';
```

3. Agrega al final del archivo:

```ts
describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const VALIDA = 'claveNueva123';

  it('sin sesión → vuelve a pedir el enlace y no cambia nada', async () => {
    const client = clienteFalso({ user: null });

    const url = await destino(
      resetPasswordAction(formulario({ password: VALIDA, confirmPassword: VALIDA })),
    );

    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('error')).toBe('El enlace venció. Pide uno nuevo.');
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('menos de 8 caracteres → error de passwordSchema', async () => {
    const client = clienteFalso();

    const url = await destino(
      resetPasswordAction(formulario({ password: 'corta', confirmPassword: 'corta' })),
    );

    expect(url.pathname).toBe('/auth/reset-password');
    expect(url.searchParams.get('error')).toBe('Usa al menos 8 caracteres');
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('más de 72 caracteres → error de passwordSchema', async () => {
    const client = clienteFalso();
    const larga = 'a'.repeat(73);

    const url = await destino(
      resetPasswordAction(formulario({ password: larga, confirmPassword: larga })),
    );

    expect(url.searchParams.get('error')).toBe('Usa como máximo 72 caracteres');
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('las contraseñas no coinciden → error y no llama updateUser', async () => {
    const client = clienteFalso();

    const url = await destino(
      resetPasswordAction(
        formulario({ password: VALIDA, confirmPassword: 'otraClave456' }),
      ),
    );

    expect(url.pathname).toBe('/auth/reset-password');
    expect(url.searchParams.get('error')).toBe('Las contraseñas no coinciden');
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('con sesión y contraseña válida → updateUser, revalida y va a /dashboard', async () => {
    const client = clienteFalso();

    const url = await destino(
      resetPasswordAction(formulario({ password: VALIDA, confirmPassword: VALIDA })),
    );

    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: VALIDA });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(url.pathname).toBe('/dashboard');
    expect(url.search).toBe('');
  });

  it('weak_password de Supabase → texto traducido', async () => {
    clienteFalso({
      updateError: { message: 'Password is known to be weak', code: 'weak_password', status: 422 },
    });

    const url = await destino(
      resetPasswordAction(formulario({ password: VALIDA, confirmPassword: VALIDA })),
    );

    expect(url.pathname).toBe('/auth/reset-password');
    expect(url.searchParams.get('error')).toBe(
      'La contraseña es muy débil. Usa al menos 8 caracteres.',
    );
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('same_password → texto propio de translateAuthError, nunca el mensaje crudo', async () => {
    const crudo = 'New password should be different from the old password.';
    clienteFalso({
      updateError: { message: crudo, code: 'same_password', status: 422 },
    });

    const url = await destino(
      resetPasswordAction(formulario({ password: VALIDA, confirmPassword: VALIDA })),
    );

    expect(url.pathname).toBe('/auth/reset-password');
    expect(url.searchParams.get('error')).toBe(
      'La contraseña nueva debe ser distinta de la anterior.',
    );
    expect(url.href).not.toContain(encodeURIComponent(crudo));
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('error desconocido → texto genérico, nunca el mensaje crudo', async () => {
    const crudo = 'detalle interno del servidor';
    clienteFalso({
      updateError: { message: crudo, code: 'unexpected_failure', status: 500 },
    });

    const url = await destino(
      resetPasswordAction(formulario({ password: VALIDA, confirmPassword: VALIDA })),
    );

    expect(url.searchParams.get('error')).toBe(
      'No pudimos completar la operación. Intenta de nuevo.',
    );
    expect(url.href).not.toContain(encodeURIComponent(crudo));
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/actions/auth-password.test.ts`
Expected: los 6 tests de `forgotPasswordAction` PASS; los 8 de `resetPasswordAction` FAIL con `resetPasswordAction is not a function`.

- [x] **Step 3: Implementar**

En `src/lib/actions/auth.ts`:

1. Imports. Deben quedar presentes (agrega solo lo que falte; `translateAuthError` ya lo importó S04, y la línea de `schemas` ya importa `loginSchema`/`registerSchema`: solo añade `passwordSchema`, que dejó S06, a esa lista):

```ts
import { translateAuthError } from '@/lib/auth/error-messages';
import { passwordSchema } from '@/lib/validations/schemas';
```

2. Al final del archivo, después de `forgotPasswordAction`, agrega:

```ts
const resetPasswordFormSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

/**
 * Server Action: guarda la contraseña nueva.
 * Requiere la sesión que deja /auth/confirm al abrir el enlace del correo.
 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      withQueryParam(
        '/auth/forgot-password',
        'error',
        translateAuthError({ code: 'otp_expired' }),
      ),
    );
  }

  const parsed = resetPasswordFormSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  });

  if (!parsed.success) {
    redirect(
      withQueryParam(
        '/auth/reset-password',
        'error',
        parsed.error.issues[0]?.message ?? 'Revisa la contraseña.',
      ),
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    console.error('resetPasswordAction: updateUser falló', {
      code: error.code,
      status: error.status,
    });
    redirect(
      withQueryParam('/auth/reset-password', 'error', translateAuthError(error)),
    );
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
```

Nota: la sesión se revisa **antes** de validar, para que un enlace vencido lleve a pedir otro en vez de mostrar errores de formulario.

- [x] **Step 4: Correr el test y verificar que pasa**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/actions/auth-password.test.ts`
Expected: PASS (14 tests).

- [x] **Step 5: Type-check**

Run: `builtin cd <raíz-del-repo> && bun run type-check`
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/actions/auth.ts src/lib/actions/auth-password.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): resetPasswordAction exige sesión, valida con passwordSchema y va al dashboard

Sin sesión devuelve a pedir otro enlace; los errores de updateUser (incluido
same_password) pasan por translateAuthError.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Página `/auth/forgot-password`

**Files:**
- Create: `src/app/auth/forgot-password/page.tsx`

**Interfaces:**
- Consumes: `forgotPasswordAction(formData: FormData): Promise<void>` (Task 2); átomos `Button`, `Card` (+ `CardContent`, `CardHeader`, `CardTitle`), `Input` como en `src/app/auth/login/page.tsx`.
- Produces: ruta `/auth/forgot-password` que muestra `?error=` en rojo y `?message=` en verde. El enlace "¿Olvidaste tu contraseña?" de login ya apunta aquí.

No hay tests de componentes en el proyecto (vitest corre en `node`, contratos §5.0); la verificación es `type-check`.

- [x] **Step 1: Crear la página**

Crea `src/app/auth/forgot-password/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import Input from '@/components/atoms/Input/Input';
import { forgotPasswordAction } from '@/lib/actions/auth';

/**
 * ForgotPasswordForm - Pide el correo para enviar el enlace de recuperación
 */
function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Obtener errores y mensajes de los query parameters
  useEffect(() => {
    setError(searchParams.get('error'));
    setMessage(searchParams.get('message'));
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await forgotPasswordAction(formData);
      // La Server Action termina siempre con una redirección
    } catch (error) {
      console.error('Error pidiendo el enlace de recuperación:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Fondo con efecto glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10" />

      <div className="relative w-full max-w-md">
        <Card variant="glass" className="p-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white mb-2">
              Recupera tu contraseña
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Escribe tu correo y te enviamos un enlace para crear una nueva.
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Correo */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-white"
                >
                  Correo
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  variant="glass"
                  placeholder="tu@correo.com"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-green-400 text-sm">{message}</p>
                </div>
              )}

              {/* Botón de Submit */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar enlace'}
              </Button>

              {/* Enlaces adicionales */}
              <div className="text-center">
                <div className="flex items-center justify-center space-x-1 text-sm">
                  <span className="text-gray-300">¿Ya la recordaste?</span>
                  <Link
                    href="/auth/login"
                    className="text-blue-400 hover:text-blue-300 hover:underline font-medium transition-colors"
                  >
                    Inicia sesión
                  </Link>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * ForgotPasswordPage - Página para pedir el enlace de recuperación
 * Componente de página (Pages level en Atomic Design) con Suspense boundary
 */
export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10" />
          <div className="relative">
            <Card variant="glass" className="p-8">
              <CardContent>
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Cargando...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <ForgotPasswordForm />
    </Suspense>
  );
}
```

- [x] **Step 2: Type-check**

Run: `builtin cd <raíz-del-repo> && bun run type-check`
Expected: sin errores.

Sin revisión manual con `bun run dev`: contratos §5.0 lo prohíben (`.env.local` apunta a producción y el formulario mandaría correos reales). La revisión visual la hace la persona después de desplegar.

- [x] **Step 3: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/app/auth/forgot-password/page.tsx && git commit -m "$(cat <<'EOF'
feat(auth): página /auth/forgot-password con el estilo de login

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Página `/auth/reset-password`

**Files:**
- Create: `src/app/auth/reset-password/page.tsx` (server component)
- Create: `src/app/auth/reset-password/ResetPasswordForm.tsx` (componente cliente)

**Interfaces:**
- Consumes: `resetPasswordAction(formData: FormData): Promise<void>` (Task 3); `createClient()` de `@/lib/supabase/server`; `translateAuthError` (S04); átomos `Button`, `Card`, `Input`.
- Produces: ruta `/auth/reset-password`. Sin sesión redirige (en el servidor) a `/auth/forgot-password?error=<"El enlace venció. Pide uno nuevo.">`, el mismo destino que usa la acción. Con sesión muestra el formulario con campos `password` y `confirmPassword`.

- [x] **Step 1: Crear el formulario cliente**

Crea `src/app/auth/reset-password/ResetPasswordForm.tsx`:

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import Input from '@/components/atoms/Input/Input';
import { resetPasswordAction } from '@/lib/actions/auth';

/**
 * ResetPasswordFields - Formulario de contraseña nueva que usa useSearchParams
 */
function ResetPasswordFields() {
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obtener errores de los query parameters
  useEffect(() => {
    setError(searchParams.get('error'));
  }, [searchParams]);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      await resetPasswordAction(formData);
      // La Server Action termina siempre con una redirección
    } catch (error) {
      console.error('Error guardando la contraseña nueva:', error);
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* Fondo con efecto glassmorphism */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-emerald-500/10" />

      <div className="relative w-full max-w-md">
        <Card variant="glass" className="p-8">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-white mb-2">
              Crea una contraseña nueva
            </CardTitle>
            <p className="text-gray-300 text-sm">
              Escríbela dos veces para confirmarla.
            </p>
          </CardHeader>

          <CardContent>
            <form action={handleSubmit} className="space-y-6">
              {/* Campo Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-white"
                >
                  Contraseña nueva
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  variant="glass"
                  placeholder="••••••••"
                  minLength={8}
                  maxLength={72}
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">Mínimo 8 caracteres.</p>
              </div>

              {/* Campo Confirmar Contraseña */}
              <div className="space-y-2">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-white"
                >
                  Confirmar contraseña
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  variant="glass"
                  placeholder="••••••••"
                  minLength={8}
                  maxLength={72}
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Botón de Submit */}
              <Button
                type="submit"
                variant="gradient"
                size="lg"
                className="w-full"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar contraseña'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * ResetPasswordForm - Formulario con Suspense boundary (useSearchParams lo exige)
 */
export default function ResetPasswordForm() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10" />
          <div className="relative">
            <Card variant="glass" className="p-8">
              <CardContent>
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                  <p>Cargando...</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      }
    >
      <ResetPasswordFields />
    </Suspense>
  );
}
```

- [x] **Step 2: Crear la página (server component)**

Crea `src/app/auth/reset-password/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

import { translateAuthError } from '@/lib/auth/error-messages';
import { createClient } from '@/lib/supabase/server';

import ResetPasswordForm from './ResetPasswordForm';

// Depende de la sesión en cookies: nunca se prerenderiza.
export const dynamic = 'force-dynamic';

/**
 * ResetPasswordPage - Página para crear la contraseña nueva
 * Requiere la sesión que deja /auth/confirm al abrir el enlace del correo.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(
        translateAuthError({ code: 'otp_expired' }),
      )}`,
    );
  }

  return <ResetPasswordForm />;
}
```

- [x] **Step 3: Type-check**

Run: `builtin cd <raíz-del-repo> && bun run type-check`
Expected: sin errores.

Sin revisión manual con `bun run dev` (contratos §5.0). La redirección sin sesión de la página usa el mismo destino que la acción, que sí está cubierta por el test "sin sesión" de la Task 3.

- [x] **Step 4: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/app/auth/reset-password/page.tsx src/app/auth/reset-password/ResetPasswordForm.tsx && git commit -m "$(cat <<'EOF'
feat(auth): página /auth/reset-password que exige la sesión del enlace

Sin sesión manda a pedir otro enlace; el formulario dice "Mínimo 8 caracteres."

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación final

**Files:** ninguno.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia de suite y typecheck en verde.

- [x] **Step 1: Suite completa y typecheck**

Run: `builtin cd <raíz-del-repo> && bun run test && bun run type-check`
Expected: todos los tests PASS (incluidos los 14 de `auth-password.test.ts`, más los de S04 y S06 que ya están en la rama); `tsc --noEmit` sin errores.

Run: `builtin cd <raíz-del-repo> && git log --oneline main..HEAD -- vitest.config.ts src/lib/validations/schemas.ts middleware.ts src/lib/auth/route-access.ts`
Expected: solo commits de S04/S06 (ninguno de esta historia): S05 no toca esos archivos (§5.0, §5.3).

- [x] **Step 2: Revisar que no quedaron datos personales ni mensajes crudos**

Run:
```bash
builtin cd <raíz-del-repo> && git diff main --stat -- src/app/auth src/lib/actions src/lib/validations && grep -n "error.message" src/lib/actions/auth.ts
```
Expected: solo los archivos de este plan (más los de S04/S06, que ya están en la rama). El `grep` no debe mostrar ningún uso de `error.message` dentro de `forgotPasswordAction` ni `resetPasswordAction`.

- [x] **Step 3: Recordar H4**

Sin commit. En el reporte final al orquestador, incluye que la tarea humana H4 debe pegar la plantilla de la sección siguiente.

---

## Tarea humana H4 — Plantilla "Reset Password"

Dónde: Supabase Dashboard → **Authentication → Emails → Templates → Reset Password** (en algunas versiones del panel: *Email Templates → Reset Password*).

Esta es la única plantilla de recuperación con `next` (contratos §5.2: "las plantillas de H4 no llevan `next` salvo recovery").

Prerrequisito (H3, lo detalla S04): en **Authentication → URL Configuration**, *Site URL* = dominio de producción (sin barra final) y en *Redirect URLs* las entradas de `/auth/confirm` para producción, `http://localhost:3001/**` y las previews de Vercel. La plantilla usa `{{ .SiteURL }}` (ADR-003), así que el enlace siempre abre el *Site URL*.

**Subject heading:**

```
Restablece tu contraseña
```

**Message body (HTML):**

```html
<h2>Restablece tu contraseña</h2>

<p>Hola:</p>

<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta en Presupuesto.</p>

<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset-password">
    Crear una contraseña nueva
  </a>
</p>

<p>El enlace sirve una sola vez y vence en poco tiempo. Si venció, pide otro en la página de inicio de sesión con «¿Olvidaste tu contraseña?».</p>

<p>Si no pediste este cambio, ignora este correo: tu contraseña sigue igual.</p>
```

Comprobación después de pegarla (la hace la persona, con su propio correo, cuando H1–H4 estén listas): pedir el enlace en `/auth/forgot-password`, abrir el correo, verificar que el enlace empieza por el dominio de producción seguido de `/auth/confirm?token_hash=` y contiene `type=recovery&next=/auth/reset-password`, crear la contraseña nueva y comprobar que se llega a `/dashboard` y que la contraseña nueva sirve para iniciar sesión.

---

## Autorrevisión

**Cobertura de criterios:**
- C1 (llamada con `redirectTo` + mensaje idéntico con y sin error, devuelto o lanzado) → Task 2, tests 1, 3 y 4.
- C2 (correo inválido) → Task 2, tests 5 y 6.
- C3 (sin sesión) → Task 3 test 1 (acción) + Task 5 Step 2 (página, mismo destino).
- C4 (passwordSchema 8–72 + coincidencia) → Task 1 (verifica el de S06) + Task 3 tests 2–4.
- C5 (éxito → `updateUser`, `revalidatePath`, `getPostLoginPath`) → Task 3 test 5 (ver Desviaciones).
- C6 (errores traducidos, nunca crudos; `same_password` con texto propio) → Task 3 tests 6, 7 y 8.
- C7 ("Mínimo 8 caracteres.") → Task 5 Step 1.
- C8 (logs sin correo; `forgotPasswordAction` solo `{ code }`) → Task 2 tests 3 y 4; los `console.error` de la Task 3 solo llevan `code`/`status`.
- C9 (plantilla H4) → sección "Tarea humana H4".
- C10 → Task 6.

**Marcadores:** ninguno; todo el código está escrito. El código v2 de las Tasks 2–5 se corrió sobre una copia de la rama con el código de S04 y S06 aplicado: `auth-password.test.ts` 14 tests en verde y `tsc --noEmit` limpio.

**Enmiendas v2 (§5):** orden S04 → S06 → S05, así que `passwordSchema` ya no se crea aquí (Task 1 solo verifica); `forgotPasswordAction` se traga todo error y registra solo el `code` (§5.2); `same_password` pasa por `translateAuthError` (§5.2); sin `bun run dev` (§5.0); sin tocar `vitest.config.ts`, `schemas.ts`, `middleware.ts` ni `route-access.ts`.

**Consistencia con S04/S06 (van antes en el flujo AUTH):** se usan exactamente `getSiteUrl()` (`@/lib/site-url`), `translateAuthError(err)` (`@/lib/auth/error-messages`), `passwordSchema` (`@/lib/validations/schemas`) y `/auth/confirm` con `type`/`next`, como en el contrato §2.1–§2.4 y §5.2. `safeRedirectPath` no se usa directamente: `/auth/confirm` (S04) lo aplica sobre `next=/auth/reset-password`, que el contrato permite explícitamente. El helper privado `withQueryParam` y el test `auth-password.test.ts` tienen nombres propios para no chocar con lo que agregue S04 en `auth.ts` y `auth.test.ts`.

---

## Desviaciones (implementación real; prevalece sobre el código de las Tasks 2–5)

El plan se escribió antes de que S04 y S06 fijaran el patrón de códigos en la URL. La implementación sigue ese patrón y contratos §5.2; el código de las Tasks 2–5 queda como referencia histórica.

1. **Códigos, no texto, en la URL.** En vez del helper `withQueryParam(path, key, texto)` (con 'Escribe un correo válido.', 'Si el correo está registrado…', `translateAuthError(error)` o el primer mensaje de Zod en la URL), `auth.ts` usa `urlConCodigo(path, params)` (el mismo helper que usan login y registro vía `urlConError`) y solo manda códigos:
   - `/auth/forgot-password`: `?error=correo_invalido`, `?message=enlace_enviado`, `?error=otp_expired` (sin sesión).
   - `/auth/reset-password`: `?error=` con `password_corta`, `password_larga`, `no_coinciden`, `confirmar_password`, `datos_invalidos` (validación, `resetPasswordValidationErrorCode`) o el código de `authErrorCode(error)` (errores de `updateUser`).
2. **La traducción la hacen las páginas** con `resolveForgotPasswordFeedback` y `resolveResetPasswordError` (`src/lib/auth/password-reset-feedback.ts`), desde listas cerradas (`Map`); un código fuera de la lista pasa por `translateAuthError` (desconocido → texto genérico) y un `?message=` desconocido no se muestra. Así nadie puede armar una URL con un texto engañoso.
3. **Éxito con `getPostLoginPath(supabase, user.id)`**, no `redirect('/dashboard')` fijo (contratos §5.2): el invitado que fija su contraseña ve `/bienvenida`.
4. **Regla de contraseña compartida.** La UI usa `PASSWORD_HINT`, `PASSWORD_MIN_LENGTH` y `PASSWORD_MAX_LENGTH` de `src/lib/validations/password-rules.ts` (S06) en vez del texto "Mínimo 8 caracteres." y los números escritos a mano. El esquema del formulario es `resetPasswordFormSchema`, exportado desde `src/lib/validations/schemas.ts` (no desde `auth.ts`, que es `'use server'`), para que el test de `resetPasswordValidationErrorCode` use el esquema real. Por eso sí se toca `schemas.ts` (solo se agrega ese esquema; `passwordSchema` no cambia).
5. **Archivos nuevos** no previstos: `src/lib/auth/password-reset-feedback.ts` y su test; `forgot-password-page.test.ts` y `reset-password-page.test.ts` (solo invariantes de seguridad sobre el código fuente: nada de `setError(searchParams.get…)`, `setMessage` solo con lo resuelto o `null`, uso de la regla compartida); `src/app/auth/AuthLoadingFallback.tsx` (fallback de Suspense que antes estaba copiado en login, registro y las dos páginas nuevas).
6. **Deuda de S06 resuelta aquí** (tres tareas):
   - `confirmar_password`: el registro (y el reset) con la confirmación vacía pide confirmarla en vez de decir que no coinciden.
   - `datos_login_invalidos`: el login con el formulario inválido manda su propio código (`LOGIN_VALIDATION_ERROR_CODE`), no el de credenciales.
   - Contratos §5.2: `registerAction` manda en `?error=` un código por campo que traduce `resolveRegisterError`.
7. **Sesión aceptada.** `resetPasswordAction` y `/auth/reset-password` aceptan cualquier sesión, no solo una de recuperación (lo usan la recuperación y la invitación). Queda documentado en contratos §5.2; si en Supabase se activa "Secure password change", `updateUser` devuelve `reauthentication_needed`, que ahora tiene fila propia en `error-messages.ts`: "Por seguridad, pide un enlace nuevo para cambiar la contraseña."
