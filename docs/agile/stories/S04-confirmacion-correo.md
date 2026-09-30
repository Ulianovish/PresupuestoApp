# S04 — Confirmación de correo y sesión · Implementation Plan

> **Alineado con contratos v2 (§5).** Donde §5 de `docs/agile/contracts.md` choca con §0–§4, gana §5. Flujo AUTH en serie: **S04 → S06 → S05**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el enlace del correo de confirmación (e invitación) deje la sesión guardada en cookies aunque se abra en otro dispositivo, y que login, registro y callback redirijan solo a rutas internas seguras con errores siempre en español.

**Architecture:** Cuatro funciones puras con tests (`getSiteUrl`, `safeRedirectPath`, `translateAuthError`, `getPostLoginPath`) y dos route handlers (`GET /auth/confirm` con `verifyOtp({ type, token_hash })` o, si llega `?code=`, `exchangeCodeForSession`; `GET /auth/callback` con `exchangeCodeForSession`) que usan el cliente de cookie de `src/lib/supabase/server.ts` y `redirect()` de `next/navigation` (en un route handler Next agrega las cookies de sesión a la respuesta de redirección). Las server actions de login/registro pasan a `safeParse` + `translateAuthError`; el middleware delega la clasificación de rutas a una función pura `getRouteAccess`. Todo sigue ADR-003, contratos §2.1–§2.3 y §3, y las enmiendas v2 (§5.0 y §5.2).

**Tech Stack:** Next.js 15.5 App Router, `@supabase/ssr` 0.6.1, `@supabase/supabase-js` 2.50.5 (`@supabase/auth-js` 2.70.0: `EmailOtpType`, `VerifyTokenHashParams`), Zod 4, vitest 4 (environment `node`), bun.

## Global Constraints

- Fuente de verdad: `docs/agile/contracts.md` v2 (§2.1, §2.2, §2.3, §3 **y §5, que prevalece**) y `docs/agile/decisions/ADR-003-confirmacion-token-hash.md`. Nombres exactos: `getSiteUrl`, `safeRedirectPath`, `translateAuthError`, `getPostLoginPath`, `INVALID_LINK_ERROR_CODE`, `INVALID_LINK_LOGIN_PATH`, `GENERIC_AUTH_ERROR`.
- Contratos §5.0: vitest corre en `node` sin tests de render; no se toca `vitest.config.ts`; **nunca** `bun run db:types`; **prohibido** `bun run dev` y `next build` contra `.env.local` (apunta a producción).
- Orden del flujo AUTH (§5.3): esta historia va primero; S06 (`passwordSchema`) y S05 (recuperar contraseña) se construyen sobre ella en el mismo worktree.
- Textos de UI en **español colombiano, tuteo**. Nunca se muestra el mensaje crudo de Supabase.
- Datos personales: ningún correo, teléfono, cédula o nombre real en código, tests, fixtures o logs. Tests usan `usuario@ejemplo.com` y UUIDs inventados. Los `console.error` registran solo `code`/`status`, nunca el objeto de error completo ni el correo.
- Ningún test toca una base real ni la red: se mockean `@/lib/supabase/server`, `next/navigation`, `next/cache` y `@/lib/onboarding/post-login` donde aplica.
- `src/lib/actions/auth.ts` es un archivo `'use server'`: **solo puede exportar funciones async**. Constantes y helpers quedan sin `export`.
- En los route handlers de App Router solo se exportan `GET` (no constantes): lo compartido vive en `src/lib/auth/error-messages.ts`.
- La columna `profiles.onboarding_completed_at` la crea S09; mientras no exista, la consulta falla y `getPostLoginPath` devuelve `'/dashboard'`. Los tests la mockean.
- No se toca la base de producción. No se envían correos reales. No usar el puerto 3001 si la app ya está corriendo.
- Verificación: `bun run test <archivo>` por tarea; al final `bun run test && bun run type-check`.
- Commits en español, terminando con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Si el hook de husky/lint-staged revierte cambios (gotcha conocido del repo), correr `bunx prettier --write <archivos>` y `bunx eslint --fix <archivos>`, volver a `git add` y commitear con `--no-verify`.

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Crear | `src/lib/site-url.ts` | `getSiteUrl(env?)` (§2.1) |
| Crear | `src/lib/site-url.test.ts` | tests |
| Crear | `src/lib/auth/safe-redirect.ts` | `safeRedirectPath(input, fallback?)` (§2.1) |
| Crear | `src/lib/auth/safe-redirect.test.ts` | tests |
| Crear | `src/lib/auth/error-messages.ts` | `translateAuthError(err)` (§2.2) + `GENERIC_AUTH_ERROR`, `INVALID_LINK_ERROR_CODE`, `INVALID_LINK_LOGIN_PATH` |
| Crear | `src/lib/auth/error-messages.test.ts` | tests |
| Crear | `src/lib/onboarding/post-login.ts` | `getPostLoginPath(supabase, userId)` (§2.3) |
| Crear | `src/lib/onboarding/post-login.test.ts` | tests |
| Crear | `src/app/auth/confirm/route.ts` | `GET /auth/confirm` con `verifyOtp` (§2.3, ADR-003) |
| Crear | `src/app/auth/confirm/route.test.ts` | tests |
| Eliminar | `src/app/auth/callback/page.tsx` | Server Component que perdía la sesión |
| Crear | `src/app/auth/callback/route.ts` | `GET /auth/callback` con `exchangeCodeForSession` |
| Crear | `src/app/auth/callback/route.test.ts` | tests |
| Modificar | `src/lib/actions/auth.ts` | `loginAction` y `registerAction` (se conservan `logoutAction`, `getCurrentUser`, `isAuthenticated`; se borra `getAuthErrorMessage`) |
| Crear | `src/lib/actions/auth.test.ts` | tests |
| Modificar | `src/app/auth/login/page.tsx` | campo oculto `redirectTo` + texto de `?error=enlace_invalido` |
| Crear | `src/lib/auth/route-access.ts` | `getRouteAccess`, `redirectsSignedInUser` (lógica pura del middleware) |
| Crear | `src/lib/auth/route-access.test.ts` | tests |
| Modificar | `middleware.ts` | `/auth/confirm` accesible, `/bienvenida` protegida, sin correo en logs |
| Modificar | `.env.example` | `NEXT_PUBLIC_SITE_URL` al final (§3) |

Todos están en el flujo AUTH (contratos §4). `.env.example` también lo toca S13 al final: al integrar, conservar ambos bloques.

## Criterios de aceptación

1. `getSiteUrl`, `safeRedirectPath`, `translateAuthError` y `getPostLoginPath` existen con las firmas de contratos §2.1–§2.3 y tienen tests (orden de variables y barra final; rutas `//`, `/\`, esquemas, caracteres de control, `/auth/*` salvo `/auth/reset-password`; cada fila de la tabla §2.2 más las filas v2 `enlace_invalido` y `same_password` (§5.2), sin mayúsculas; `code` solo si es conocido, si no `message`; rechazo por hook (sin `code`, message `signup_not_allowed`) y por trigger (`code: 'unexpected_failure'`, message `Database error saving new user`) con test propio; genérico para lo demás; implementación con `Map`; exporta `INVALID_LINK_ERROR_CODE`, `INVALID_LINK_LOGIN_PATH`, `GENERIC_AUTH_ERROR`; `/bienvenida` solo si `onboarding_completed_at` es null, `/dashboard` si no o si la consulta falla).
2. `GET /auth/confirm` valida `token_hash` y `type ∈ {signup, email, recovery, invite, email_change}` y llama `verifyOtp({ type, token_hash })` con el cliente de cookie; si no hay `token_hash` pero sí `?code=` (plantilla con `{{ .ConfirmationURL }}`, §5.2), llama `exchangeCodeForSession(code)`. Redirige a `safeRedirectPath(next, type === 'recovery' ? '/auth/reset-password' : await getPostLoginPath(...))`: sin `next` válido decide `getPostLoginPath`. Error o parámetros faltantes → `/auth/login?error=enlace_invalido`.
3. `src/app/auth/callback/page.tsx` ya no existe; `GET /auth/callback` canjea `code` con `exchangeCodeForSession` y redirige con `safeRedirectPath(next ?? redirectTo, await getPostLoginPath(...))`; error → `/auth/login?error=enlace_invalido`; sin `code` → `/auth/login`.
4. `registerAction` llama `signUp` con `options.emailRedirectTo = ${getSiteUrl()}/auth/confirm?next=/bienvenida`. Sin sesión → `/auth/login?message=Te enviamos un correo…`. Si Zod rechaza el formulario, muestra el **primer mensaje de Zod** (nunca "Datos inválidos"; §5.2), con test.
5. `loginAction` respeta `redirectTo` vía `safeRedirectPath`; sin `redirectTo` usa `getPostLoginPath`. La página de login envía `redirectTo` en un campo oculto.
6. Todos los errores de Supabase en login y registro pasan por `translateAuthError`; nunca se muestra el texto crudo. `?error=enlace_invalido` se ve traducido en el login.
7. `middleware.ts`: `/auth/confirm` y `/auth/reset-password` accesibles sin sesión; `/bienvenida` protegida; `/terms` y `/privacy` públicas; el log de desarrollo ya no imprime el correo.
8. `.env.example` tiene `NEXT_PUBLIC_SITE_URL=http://localhost:3001`.
9. Esta historia trae el texto exacto de las plantillas "Confirm signup" e "Invite user" (H4) y la configuración de URLs (H3). "Confirm signup" no lleva `next` (§5.2); "Invite user" lleva a `/auth/reset-password` (ver la nota de H4).
10. `bun run test && bun run type-check` en verde.

---

### Task 1: `getSiteUrl` y `NEXT_PUBLIC_SITE_URL`

**Files:**
- Create: `src/lib/site-url.ts`
- Test: `src/lib/site-url.test.ts`
- Modify: `.env.example` (agregar al final)

**Interfaces:**
- Consumes: nada.
- Produces: `export function getSiteUrl(env?: Record<string, string | undefined>): string` — `NEXT_PUBLIC_SITE_URL` → `https://${VERCEL_URL}` → `'http://localhost:3001'`, sin barra final, vacío = ausente. Por defecto lee `process.env` en el momento de la llamada (solo servidor).

- [x] **Step 1: Write the failing test**

Crear `src/lib/site-url.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSiteUrl } from './site-url';

describe('getSiteUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('usa NEXT_PUBLIC_SITE_URL cuando está definida', () => {
    expect(
      getSiteUrl({
        NEXT_PUBLIC_SITE_URL: 'https://app.ejemplo.com',
        VERCEL_URL: 'presupuesto-abc123.vercel.app',
      }),
    ).toBe('https://app.ejemplo.com');
  });

  it('quita las barras finales y los espacios', () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: ' https://app.ejemplo.com// ' })).toBe(
      'https://app.ejemplo.com',
    );
  });

  it('sin NEXT_PUBLIC_SITE_URL usa https://VERCEL_URL', () => {
    expect(getSiteUrl({ VERCEL_URL: 'presupuesto-abc123.vercel.app' })).toBe(
      'https://presupuesto-abc123.vercel.app',
    );
  });

  it('trata las variables vacías como ausentes', () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: '', VERCEL_URL: '  ' })).toBe(
      'http://localhost:3001',
    );
  });

  it('sin variables usa http://localhost:3001', () => {
    expect(getSiteUrl({})).toBe('http://localhost:3001');
  });

  it('sin argumento lee process.env', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://desde-env.ejemplo.com/');
    expect(getSiteUrl()).toBe('https://desde-env.ejemplo.com');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/site-url.test.ts`
Expected: FAIL con `Failed to resolve import "./site-url"` (el archivo no existe).

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/site-url.ts`:

```ts
/**
 * URL pública de la app, sin barra final. Solo para código de servidor
 * (server actions, route handlers): arma los enlaces que Supabase pone en los
 * correos.
 *
 * Orden: NEXT_PUBLIC_SITE_URL → https://${VERCEL_URL} → http://localhost:3001.
 * Una variable vacía cuenta como ausente.
 */
const LOCAL_SITE_URL = 'http://localhost:3001';

function limpiar(valor: string | undefined): string {
  return (valor ?? '').trim();
}

export function getSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const explicita = limpiar(env.NEXT_PUBLIC_SITE_URL);
  const vercel = limpiar(env.VERCEL_URL);
  const url = explicita || (vercel ? `https://${vercel}` : LOCAL_SITE_URL);
  return url.replace(/\/+$/, '');
}
```

Agregar **al final** de `.env.example` (después de `TWILIO_CONTENT_SID_CUENTAS=`), dejando una línea en blanco antes:

```
# === Sitio ===
# URL pública de la app, sin barra final. La usan los enlaces de los correos de
# Supabase (confirmar cuenta, invitación). En Vercel: la URL de producción.
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/site-url.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/site-url.ts src/lib/site-url.test.ts .env.example
git commit -m "feat(auth): getSiteUrl para los enlaces de los correos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `safeRedirectPath`

**Files:**
- Create: `src/lib/auth/safe-redirect.ts`
- Test: `src/lib/auth/safe-redirect.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `export function safeRedirectPath(input: string | null | undefined, fallback?: string): string` — fallback por defecto `'/dashboard'`. Devuelve la ruta normalizada (`pathname + search + hash`) o `fallback`. Con `fallback = ''` sirve para preguntar "¿es segura?" (lo usa Task 7).

- [x] **Step 1: Write the failing test**

Crear `src/lib/auth/safe-redirect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  it('sin entrada devuelve /dashboard', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath('')).toBe('/dashboard');
  });

  it('usa el fallback que se le pasa', () => {
    expect(safeRedirectPath(null, '/bienvenida')).toBe('/bienvenida');
    expect(safeRedirectPath('//otro.ejemplo.com', '/auth/reset-password')).toBe(
      '/auth/reset-password',
    );
  });

  it.each([
    ['/gastos', '/gastos'],
    ['/presupuesto', '/presupuesto'],
    ['/gastos?mes=2026-09#nuevo', '/gastos?mes=2026-09#nuevo'],
    ['/auth/reset-password', '/auth/reset-password'],
    ['/bienvenida', '/bienvenida'],
  ])('acepta la ruta interna %s', (entrada, esperado) => {
    expect(safeRedirectPath(entrada)).toBe(esperado);
  });

  it.each([
    ['//otro.ejemplo.com'],
    ['/\\otro.ejemplo.com'],
    ['/gastos\\..\\..\\otro'],
    ['https://otro.ejemplo.com'],
    ['javascript:alert(1)'],
    ['gastos'],
    ['/\t/otro.ejemplo.com'],
    ['/\n/otro.ejemplo.com'],
    ['/auth'],
    ['/auth/login'],
    ['/auth/register'],
    ['/auth/confirm?token_hash=abc&type=email'],
    ['/auth/callback?code=abc'],
    ['/AUTH/login'],
    ['/dashboard/../auth/login'],
  ])('rechaza %j', entrada => {
    expect(safeRedirectPath(entrada)).toBe('/dashboard');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/safe-redirect.test.ts`
Expected: FAIL con `Failed to resolve import "./safe-redirect"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/auth/safe-redirect.ts`:

```ts
/**
 * Convierte un destino que viene de la URL o de un formulario (`next`,
 * `redirectTo`) en una ruta interna segura. Si no lo es, devuelve `fallback`.
 *
 * Acepta solo rutas que empiezan con '/' y no con '//' ni '/\'. Rechaza
 * esquemas, barras invertidas, caracteres de control (el navegador borra
 * tabs y saltos de línea: '/\t/otro.sitio' terminaría en '//otro.sitio') y
 * rutas de /auth/* salvo /auth/reset-password.
 */
const DEFAULT_FALLBACK = '/dashboard';
const BASE = 'http://safe-redirect.invalid';
const RUTAS_AUTH_PERMITIDAS = new Set(['/auth/reset-password']);

function tieneCaracteresDeControl(texto: string): boolean {
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

export function safeRedirectPath(
  input: string | null | undefined,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (typeof input !== 'string' || input.length === 0) return fallback;
  if (!input.startsWith('/') || input.startsWith('//')) return fallback;
  if (input.includes('\\') || tieneCaracteresDeControl(input)) return fallback;

  let url: URL;
  try {
    url = new URL(input, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE) return fallback;

  // Se revisa la ruta ya normalizada: '/dashboard/../auth/login' → '/auth/login'.
  const ruta = url.pathname.toLowerCase();
  const esAuth = ruta === '/auth' || ruta.startsWith('/auth/');
  if (esAuth && !RUTAS_AUTH_PERMITIDAS.has(ruta)) return fallback;

  return `${url.pathname}${url.search}${url.hash}`;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/safe-redirect.test.ts`
Expected: PASS (todos los casos de `it.each`).

- [x] **Step 5: Commit**

```bash
git add src/lib/auth/safe-redirect.ts src/lib/auth/safe-redirect.test.ts
git commit -m "feat(auth): safeRedirectPath solo deja redirigir a rutas internas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `translateAuthError`

**Files:**
- Create: `src/lib/auth/error-messages.ts`
- Test: `src/lib/auth/error-messages.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `export function translateAuthError(err: { message?: string; code?: string } | null | undefined): string` — tabla de contratos §2.2 + las filas `enlace_invalido` y `same_password` de §5.2. Compara `code` **solo si es uno conocido** (está en el `Map`); si no hay `code` o no está en la tabla, compara `message` (§5.2). S05 usa la fila `same_password` en `resetPasswordAction`.
  - `export const GENERIC_AUTH_ERROR = 'No pudimos completar la operación. Intenta de nuevo.'`
  - `export const INVALID_LINK_ERROR_CODE = 'enlace_invalido'`
  - `export const INVALID_LINK_LOGIN_PATH = '/auth/login?error=enlace_invalido'` (lo usan Task 5, Task 6 y la página de login en Task 7).

- [x] **Step 1: Write the failing test**

Crear `src/lib/auth/error-messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  GENERIC_AUTH_ERROR,
  INVALID_LINK_ERROR_CODE,
  INVALID_LINK_LOGIN_PATH,
  translateAuthError,
} from './error-messages';

const SIN_INVITACION =
  'Este correo no tiene invitación. Pídele acceso a quien administra la app.';
const CREDENCIALES = 'Correo o contraseña incorrectos.';
const YA_EXISTE =
  'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.';
const LIMITE = 'Enviamos demasiados correos. Intenta de nuevo en unos minutos.';

describe('translateAuthError', () => {
  it.each([
    ['signup_not_allowed', SIN_INVITACION],
    ['invalid_credentials', CREDENCIALES],
    [
      'email_not_confirmed',
      'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
    ],
    ['user_already_exists', YA_EXISTE],
    ['weak_password', 'La contraseña es muy débil. Usa al menos 8 caracteres.'],
    ['over_email_send_rate_limit', LIMITE],
    [
      'email_address_not_authorized',
      'No pudimos enviar el correo a esta dirección. Escríbele a quien administra la app.',
    ],
    ['signup_disabled', 'El registro está cerrado por ahora.'],
    ['otp_expired', 'El enlace venció. Pide uno nuevo.'],
    [
      'enlace_invalido',
      'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
    ],
    ['same_password', 'La contraseña nueva debe ser distinta de la anterior.'],
  ])('code %s', (code, texto) => {
    expect(translateAuthError({ code, message: 'algo en inglés' })).toBe(texto);
  });

  it.each([
    ['signup_not_allowed', SIN_INVITACION],
    ['Database error saving new user', SIN_INVITACION],
    ['Invalid login credentials', CREDENCIALES],
    ['User already registered', YA_EXISTE],
    ['Email rate limit exceeded', LIMITE],
  ])('message %s', (message, texto) => {
    expect(translateAuthError({ message })).toBe(texto);
  });

  it('no distingue mayúsculas', () => {
    expect(translateAuthError({ message: 'INVALID LOGIN CREDENTIALS' })).toBe(
      CREDENCIALES,
    );
    expect(translateAuthError({ code: 'Weak_Password' })).toBe(
      'La contraseña es muy débil. Usa al menos 8 caracteres.',
    );
  });

  it('el code gana sobre el message', () => {
    expect(
      translateAuthError({
        code: 'weak_password',
        message: 'Invalid login credentials',
      }),
    ).toBe('La contraseña es muy débil. Usa al menos 8 caracteres.');
  });

  it('rechazo por el hook: sin code, message signup_not_allowed (403)', () => {
    // Forma real del AuthApiError del hook: sin `code`, con status 403.
    const errorDelHook = { message: 'signup_not_allowed', status: 403 };
    expect(translateAuthError(errorDelHook)).toBe(SIN_INVITACION);
  });

  it('rechazo por el trigger: code unexpected_failure (desconocido) cae al message', () => {
    expect(
      translateAuthError({
        code: 'unexpected_failure',
        message: 'Database error saving new user',
      }),
    ).toBe(SIN_INVITACION);
  });

  it('un code desconocido sin message conocido → genérico', () => {
    expect(
      translateAuthError({ code: 'unexpected_failure', message: 'detalle interno' }),
    ).toBe(GENERIC_AUTH_ERROR);
  });

  it('reconoce el literal del hook dentro de un mensaje más largo', () => {
    expect(
      translateAuthError({ message: 'Hook requires authorization: signup_not_allowed' }),
    ).toBe(SIN_INVITACION);
  });

  it('enlace_invalido tiene texto propio y constantes exportadas', () => {
    expect(INVALID_LINK_ERROR_CODE).toBe('enlace_invalido');
    expect(translateAuthError({ code: INVALID_LINK_ERROR_CODE })).toBe(
      'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
    );
    expect(INVALID_LINK_LOGIN_PATH).toBe('/auth/login?error=enlace_invalido');
  });

  it('same_password (updateUser con la misma clave) tiene texto propio', () => {
    expect(
      translateAuthError({
        code: 'same_password',
        message: 'New password should be different from the old password.',
      }),
    ).toBe('La contraseña nueva debe ser distinta de la anterior.');
  });

  it.each([
    [null],
    [undefined],
    [{}],
    [{ code: '', message: '' }],
    [{ message: 'Internal server error: tabla x no existe' }],
    [{ code: 'constructor' }],
    [{ message: 'toString' }],
  ])('cualquier otro caso → texto genérico (%j)', err => {
    expect(translateAuthError(err)).toBe(GENERIC_AUTH_ERROR);
  });

  it('el texto genérico es el del contrato', () => {
    expect(GENERIC_AUTH_ERROR).toBe(
      'No pudimos completar la operación. Intenta de nuevo.',
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/error-messages.test.ts`
Expected: FAIL con `Failed to resolve import "./error-messages"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/auth/error-messages.ts`:

```ts
/**
 * Traduce los errores de Supabase Auth a textos en español para la UI
 * (contratos §2.2 + §5.2).
 *
 * Compara `code` solo si es uno conocido; si no hay `code` o no está en la
 * tabla, compara `message`. Sin distinguir mayúsculas. El rechazo del hook de
 * la allowlist llega sin `code` (message 'signup_not_allowed', 403) y el del
 * trigger con `code: 'unexpected_failure'` y message 'Database error saving
 * new user': ambos terminan en el texto de "sin invitación".
 * Nunca devuelve el mensaje crudo de Supabase.
 */
export const GENERIC_AUTH_ERROR =
  'No pudimos completar la operación. Intenta de nuevo.';

/** Código que usan /auth/confirm y /auth/callback en `?error=` del login. */
export const INVALID_LINK_ERROR_CODE = 'enlace_invalido';
export const INVALID_LINK_LOGIN_PATH = `/auth/login?error=${INVALID_LINK_ERROR_CODE}`;

const SIN_INVITACION =
  'Este correo no tiene invitación. Pídele acceso a quien administra la app.';
const CREDENCIALES = 'Correo o contraseña incorrectos.';
const YA_EXISTE =
  'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.';
const LIMITE_CORREOS =
  'Enviamos demasiados correos. Intenta de nuevo en unos minutos.';

// Claves en minúsculas. Map (no objeto) para que 'constructor' o
// 'toString' no encuentren nada en el prototipo.
const MENSAJES = new Map<string, string>([
  ['signup_not_allowed', SIN_INVITACION],
  ['database error saving new user', SIN_INVITACION],
  ['invalid_credentials', CREDENCIALES],
  ['invalid login credentials', CREDENCIALES],
  [
    'email_not_confirmed',
    'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
  ],
  ['user_already_exists', YA_EXISTE],
  ['user already registered', YA_EXISTE],
  ['weak_password', 'La contraseña es muy débil. Usa al menos 8 caracteres.'],
  ['over_email_send_rate_limit', LIMITE_CORREOS],
  ['email rate limit exceeded', LIMITE_CORREOS],
  [
    'email_address_not_authorized',
    'No pudimos enviar el correo a esta dirección. Escríbele a quien administra la app.',
  ],
  ['signup_disabled', 'El registro está cerrado por ahora.'],
  ['otp_expired', 'El enlace venció. Pide uno nuevo.'],
  [
    INVALID_LINK_ERROR_CODE,
    'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
  ],
  ['same_password', 'La contraseña nueva debe ser distinta de la anterior.'],
]);

function normalizar(valor: string | undefined): string {
  return (valor ?? '').trim().toLowerCase();
}

export function translateAuthError(
  err: { message?: string; code?: string } | null | undefined,
): string {
  if (!err) return GENERIC_AUTH_ERROR;

  // 1) `code` solo si es conocido (p. ej. 'unexpected_failure' no lo es).
  const code = normalizar(err.code);
  const porCodigo = code ? MENSAJES.get(code) : undefined;
  if (porCodigo) return porCodigo;

  // 2) Si no, `message`.
  const message = normalizar(err.message);
  if (!message) return GENERIC_AUTH_ERROR;

  const exacto = MENSAJES.get(message);
  if (exacto) return exacto;

  // El hook de registro puede venir envuelto ("... signup_not_allowed ...").
  for (const [clave, texto] of MENSAJES) {
    if (message.includes(clave)) return texto;
  }
  return GENERIC_AUTH_ERROR;
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/error-messages.test.ts`
Expected: PASS (todos los casos, incluidos hook, trigger, `enlace_invalido` y `same_password`).

- [x] **Step 5: Commit**

```bash
git add src/lib/auth/error-messages.ts src/lib/auth/error-messages.test.ts
git commit -m "feat(auth): translateAuthError con los textos en español del contrato" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `getPostLoginPath`

**Files:**
- Create: `src/lib/onboarding/post-login.ts`
- Test: `src/lib/onboarding/post-login.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` de `@supabase/supabase-js` (se le pasa el cliente de cookie de `createClient()`; el tipo `SupabaseClient<Database>` es asignable, verificado con `tsc`).
- Produces: `export async function getPostLoginPath(supabase: SupabaseClient, userId: string): Promise<'/bienvenida' | '/dashboard'>`. Consulta `from('profiles').select('onboarding_completed_at').eq('id', userId).maybeSingle()`.

- [x] **Step 1: Write the failing test**

Crear `src/lib/onboarding/post-login.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { getPostLoginPath } from './post-login';

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';

/** Cliente falso: from('profiles').select(...).eq(...).maybeSingle(). */
function clienteFalso(resultado: { data: unknown; error: unknown } | Error) {
  const maybeSingle =
    resultado instanceof Error
      ? vi.fn().mockRejectedValue(resultado)
      : vi.fn().mockResolvedValue(resultado);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const client = { from } as unknown as SupabaseClient;
  return { client, from, select, eq, maybeSingle };
}

describe('getPostLoginPath', () => {
  it('onboarding sin terminar → /bienvenida, consultando el perfil del usuario', async () => {
    const { client, from, select, eq } = clienteFalso({
      data: { onboarding_completed_at: null },
      error: null,
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/bienvenida');
    expect(from).toHaveBeenCalledWith('profiles');
    expect(select).toHaveBeenCalledWith('onboarding_completed_at');
    expect(eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it('onboarding terminado → /dashboard', async () => {
    const { client } = clienteFalso({
      data: { onboarding_completed_at: '2026-09-30T15:00:00.000Z' },
      error: null,
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('error de la consulta (columna aún no existe) → /dashboard', async () => {
    const { client } = clienteFalso({
      data: null,
      error: {
        code: '42703',
        message: 'column profiles.onboarding_completed_at does not exist',
      },
    });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('sin fila de perfil → /dashboard', async () => {
    const { client } = clienteFalso({ data: null, error: null });

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });

  it('si la consulta lanza → /dashboard', async () => {
    const { client } = clienteFalso(new Error('fetch failed'));

    await expect(getPostLoginPath(client, USER_ID)).resolves.toBe('/dashboard');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/onboarding/post-login.test.ts`
Expected: FAIL con `Failed to resolve import "./post-login"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/onboarding/post-login.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A dónde mandar a alguien que acaba de iniciar sesión o de confirmar su
 * correo: '/bienvenida' si nunca terminó el onboarding, '/dashboard' si ya lo
 * terminó o si la consulta falla (p. ej. antes de que exista la columna
 * `profiles.onboarding_completed_at`, que crea S09).
 */
export async function getPostLoginPath(
  supabase: SupabaseClient,
  userId: string,
): Promise<'/bienvenida' | '/dashboard'> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return '/dashboard';
    return data.onboarding_completed_at == null ? '/bienvenida' : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/onboarding/post-login.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/onboarding/post-login.ts src/lib/onboarding/post-login.test.ts
git commit -m "feat(onboarding): getPostLoginPath decide entre bienvenida y dashboard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `GET /auth/confirm`

**Files:**
- Create: `src/app/auth/confirm/route.ts`
- Test: `src/app/auth/confirm/route.test.ts`

**Interfaces:**
- Consumes: `createClient()` de `@/lib/supabase/server`; `safeRedirectPath` (Task 2); `INVALID_LINK_LOGIN_PATH` (Task 3); `getPostLoginPath` (Task 4); `supabase.auth.verifyOtp({ type: EmailOtpType, token_hash: string })` y `supabase.auth.exchangeCodeForSession(code: string)` → `{ data: { user, session }, error }`.
- Produces: `export async function GET(request: Request): Promise<never>` (siempre termina en `redirect()`). Ruta pública `/auth/confirm?token_hash=…&type=…&next=…` que usan las plantillas de H4 y `emailRedirectTo` de Task 7. También acepta `/auth/confirm?code=…[&type=recovery][&next=…]` (§5.2: por si una plantilla usa `{{ .ConfirmationURL }}`, que vuelve con `code` al `redirectTo`/`emailRedirectTo`). Con `token_hash` el `type` es obligatorio y de la lista; con `code` el `type` es opcional y solo sirve para saber si es `recovery`. Si llegan los dos, gana `token_hash`.

Nota: se usa `redirect()` de `next/navigation` (como pide contratos §2.3). En un route handler Next responde 307 y copia a esa respuesta las cookies que escribió `createClient()` vía `cookies()`, así que la sesión queda guardada. Es el mismo efecto que `NextResponse.redirect` del ejemplo oficial de Supabase (`app/auth/confirm/route.ts`).

- [x] **Step 1: Write the failing test**

Crear `src/app/auth/confirm/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));

import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { GET } from './route';

const mockedCreateClient = vi.mocked(createClient);
const mockedPostLogin = vi.mocked(getPostLoginPath);

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';
const BASE = 'http://localhost:3001/auth/confirm';
const ENLACE_INVALIDO = '/auth/login?error=enlace_invalido';

function clienteFalso(
  resultado: { data: { user: { id: string } | null }; error: unknown } = {
    data: { user: { id: USER_ID } },
    error: null,
  },
) {
  const verifyOtp = vi.fn().mockResolvedValue(resultado);
  const exchangeCodeForSession = vi.fn().mockResolvedValue(resultado);
  const client = { auth: { verifyOtp, exchangeCodeForSession } };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, verifyOtp, exchangeCodeForSession };
}

/** Ejecuta GET y devuelve la ruta a la que redirigió. */
async function destino(query: string): Promise<string> {
  try {
    await GET(new Request(`${BASE}${query}`));
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith('NEXT_REDIRECT:')) {
      return mensaje.slice('NEXT_REDIRECT:'.length);
    }
    throw e;
  }
  throw new Error('GET no redirigió');
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('sin token_hash ni code → login con enlace_invalido, sin tocar Supabase', async () => {
    await expect(destino('?type=email')).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin type → enlace_invalido', async () => {
    await expect(destino('?token_hash=hash-de-prueba')).resolves.toBe(
      ENLACE_INVALIDO,
    );
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('type fuera de la lista (magiclink) → enlace_invalido', async () => {
    await expect(
      destino('?token_hash=hash-de-prueba&type=magiclink'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('confirmación sin next → verifica y usa getPostLoginPath', async () => {
    const { client, verifyOtp } = clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=email'),
    ).resolves.toBe('/bienvenida');
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'hash-de-prueba',
    });
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('acepta type=signup', async () => {
    const { verifyOtp } = clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=signup'),
    ).resolves.toBe('/bienvenida');
    expect(verifyOtp).toHaveBeenCalledWith({
      type: 'signup',
      token_hash: 'hash-de-prueba',
    });
  });

  it('respeta un next interno', async () => {
    clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=email&next=%2Fpresupuesto'),
    ).resolves.toBe('/presupuesto');
  });

  it('un next externo cae al destino de getPostLoginPath', async () => {
    clienteFalso();
    mockedPostLogin.mockResolvedValue('/dashboard');

    await expect(
      destino(
        '?token_hash=hash-de-prueba&type=email&next=%2F%2Fotro.ejemplo.com',
      ),
    ).resolves.toBe('/dashboard');
  });

  it('recovery sin next → /auth/reset-password, sin consultar el perfil', async () => {
    clienteFalso();

    await expect(
      destino('?token_hash=hash-de-prueba&type=recovery'),
    ).resolves.toBe('/auth/reset-password');
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('invite con next=/auth/reset-password → /auth/reset-password', async () => {
    clienteFalso();

    await expect(
      destino(
        '?token_hash=hash-de-prueba&type=invite&next=%2Fauth%2Freset-password',
      ),
    ).resolves.toBe('/auth/reset-password');
  });

  it('verifyOtp con error (enlace vencido) → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: { code: 'otp_expired', message: 'Email link is invalid or has expired' },
    });

    await expect(
      destino('?token_hash=hash-de-prueba&type=email'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('?code= (plantilla con ConfirmationURL) → exchangeCodeForSession y getPostLoginPath', async () => {
    const { client, verifyOtp, exchangeCodeForSession } = clienteFalso();

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe('/bienvenida');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('codigo-de-prueba');
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('?code= con type=recovery → /auth/reset-password, sin consultar el perfil', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&type=recovery'),
    ).resolves.toBe('/auth/reset-password');
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('?code= con next interno lo respeta', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&next=%2Fgastos'),
    ).resolves.toBe('/gastos');
  });

  it('?code= que no se puede canjear → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: { code: 'bad_code_verifier', message: 'code verifier mismatch' },
    });

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('si llegan token_hash y code, gana token_hash', async () => {
    const { verifyOtp, exchangeCodeForSession } = clienteFalso();

    await destino('?token_hash=hash-de-prueba&type=email&code=codigo-de-prueba');
    expect(verifyOtp).toHaveBeenCalled();
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/auth/confirm/route.test.ts`
Expected: FAIL con `Failed to resolve import "./route"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/app/auth/confirm/route.ts`:

```ts
import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

import { INVALID_LINK_LOGIN_PATH } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /auth/confirm?token_hash=…&type=…&next=…
 * GET /auth/confirm?code=…[&type=recovery][&next=…]
 *
 * Destino de los enlaces de los correos de Supabase (confirmar registro,
 * invitación, recuperar contraseña, cambio de correo). `verifyOtp` con el
 * cliente de cookie deja la sesión guardada, así que funciona aunque el
 * correo se abra en otro dispositivo (ADR-003). `?code=` cubre plantillas que
 * usen `{{ .ConfirmationURL }}` (contratos §5.2); ese flujo PKCE sí exige el
 * mismo navegador.
 *
 * Sin `next` válido: recovery → /auth/reset-password; lo demás → getPostLoginPath.
 */
const TIPOS_PERMITIDOS: readonly string[] = [
  'signup',
  'email',
  'recovery',
  'invite',
  'email_change',
];

function esTipoPermitido(valor: string | null): valor is EmailOtpType {
  return valor !== null && TIPOS_PERMITIDOS.includes(valor);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Enlace = { tokenHash: string; type: EmailOtpType } | { code: string };

/** Lee el enlace de la URL. null = parámetros faltantes o inválidos. */
function leerEnlace(searchParams: URLSearchParams): Enlace | null {
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');

  if (tokenHash) {
    return esTipoPermitido(type) ? { tokenHash, type } : null;
  }
  return code ? { code } : null;
}

/** Canjea el enlace (deja la sesión en cookies). Devuelve el usuario o null. */
async function canjear(supabase: Supabase, enlace: Enlace) {
  const { data, error } =
    'tokenHash' in enlace
      ? await supabase.auth.verifyOtp({
          type: enlace.type,
          token_hash: enlace.tokenHash,
        })
      : await supabase.auth.exchangeCodeForSession(enlace.code);

  if (error || !data.user) {
    console.error('No se pudo verificar el enlace del correo:', {
      via: 'tokenHash' in enlace ? 'token_hash' : 'code',
      code: error?.code ?? 'sin_usuario',
    });
    return null;
  }
  return data.user;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const next = searchParams.get('next');

  const enlace = leerEnlace(searchParams);
  if (!enlace) {
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  const supabase = await createClient();
  const user = await canjear(supabase, enlace);
  if (!user) {
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  const fallback =
    type === 'recovery'
      ? '/auth/reset-password'
      : await getPostLoginPath(supabase, user.id);

  redirect(safeRedirectPath(next, fallback));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `bun run test src/app/auth/confirm/route.test.ts`
Expected: PASS (15 tests).

- [x] **Step 5: Commit**

```bash
git add src/app/auth/confirm/route.ts src/app/auth/confirm/route.test.ts
git commit -m "feat(auth): /auth/confirm verifica el token_hash (o canjea el code) del correo y guarda la sesión" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `/auth/callback` como route handler

**Files:**
- Delete: `src/app/auth/callback/page.tsx`
- Create: `src/app/auth/callback/route.ts`
- Test: `src/app/auth/callback/route.test.ts`

**Interfaces:**
- Consumes: `createClient()`; `safeRedirectPath` (Task 2); `INVALID_LINK_LOGIN_PATH` (Task 3); `getPostLoginPath` (Task 4); `supabase.auth.exchangeCodeForSession(code: string)` → `{ data: { user, session }, error }`.
- Produces: `export async function GET(request: Request): Promise<never>`. Acepta `next` o, por compatibilidad, `redirectTo`.

Un segmento de App Router no puede tener `page.tsx` y `route.ts` a la vez: la página se borra en el mismo paso en que se crea el route handler.

- [ ] **Step 1: Write the failing test**

Crear `src/app/auth/callback/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));

import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { GET } from './route';

const mockedCreateClient = vi.mocked(createClient);
const mockedPostLogin = vi.mocked(getPostLoginPath);

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';
const BASE = 'http://localhost:3001/auth/callback';
const ENLACE_INVALIDO = '/auth/login?error=enlace_invalido';

function clienteFalso(
  resultado: { data: { user: { id: string } | null }; error: unknown } = {
    data: { user: { id: USER_ID } },
    error: null,
  },
) {
  const exchangeCodeForSession = vi.fn().mockResolvedValue(resultado);
  const client = { auth: { exchangeCodeForSession } };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, exchangeCodeForSession };
}

async function destino(query: string): Promise<string> {
  try {
    await GET(new Request(`${BASE}${query}`));
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith('NEXT_REDIRECT:')) {
      return mensaje.slice('NEXT_REDIRECT:'.length);
    }
    throw e;
  }
  throw new Error('GET no redirigió');
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('canjea el code y usa getPostLoginPath sin next', async () => {
    const { client, exchangeCodeForSession } = clienteFalso();

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe('/bienvenida');
    expect(exchangeCodeForSession).toHaveBeenCalledWith('codigo-de-prueba');
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
  });

  it('respeta next interno', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&next=%2Fgastos'),
    ).resolves.toBe('/gastos');
  });

  it('respeta redirectTo interno (enlaces viejos)', async () => {
    clienteFalso();

    await expect(
      destino('?code=codigo-de-prueba&redirectTo=%2Fpresupuesto'),
    ).resolves.toBe('/presupuesto');
  });

  it('un redirectTo externo cae al destino de getPostLoginPath', async () => {
    clienteFalso();
    mockedPostLogin.mockResolvedValue('/dashboard');

    await expect(
      destino('?code=codigo-de-prueba&redirectTo=https%3A%2F%2Fotro.ejemplo.com'),
    ).resolves.toBe('/dashboard');
  });

  it('error al canjear → enlace_invalido', async () => {
    clienteFalso({
      data: { user: null },
      error: { code: 'bad_code_verifier', message: 'code verifier mismatch' },
    });

    await expect(destino('?code=codigo-de-prueba')).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('Supabase manda error en la URL → enlace_invalido sin tocar Supabase', async () => {
    await expect(
      destino('?error=access_denied&error_code=otp_expired'),
    ).resolves.toBe(ENLACE_INVALIDO);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it('sin code → /auth/login', async () => {
    await expect(destino('')).resolves.toBe('/auth/login');
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/app/auth/callback/route.test.ts`
Expected: FAIL con `Failed to resolve import "./route"`.

- [ ] **Step 3: Write minimal implementation**

Borrar la página vieja:

```bash
git rm src/app/auth/callback/page.tsx
```

Crear `src/app/auth/callback/route.ts`:

```ts
import { redirect } from 'next/navigation';

import { INVALID_LINK_LOGIN_PATH } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /auth/callback?code=…&next=… (o &redirectTo=…)
 *
 * Compatibilidad con enlaces viejos del flujo PKCE. Es un route handler (no
 * una página) para que `exchangeCodeForSession` pueda escribir las cookies de
 * sesión. Los correos nuevos usan /auth/confirm (ADR-003).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? searchParams.get('redirectTo');

  if (searchParams.get('error') || searchParams.get('error_code')) {
    console.error('Callback de auth con error:', {
      code: searchParams.get('error_code') ?? 'sin_codigo',
    });
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  if (!code) {
    redirect('/auth/login');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error('No se pudo canjear el código de auth:', {
      code: error?.code ?? 'sin_usuario',
    });
    redirect(INVALID_LINK_LOGIN_PATH);
  }

  redirect(safeRedirectPath(next, await getPostLoginPath(supabase, data.user.id)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/app/auth/callback/route.test.ts`
Expected: PASS (7 tests).

Run: `ls src/app/auth/callback`
Expected: `route.test.ts  route.ts` (sin `page.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/callback/route.ts src/app/auth/callback/route.test.ts
git commit -m "fix(auth): /auth/callback pasa a route handler para que guarde la sesión" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `loginAction`, `registerAction` y página de login

**Files:**
- Modify: `src/lib/actions/auth.ts` (reemplazo completo; `logoutAction`, `getCurrentUser` e `isAuthenticated` quedan iguales; `getAuthErrorMessage` se borra)
- Modify: `src/app/auth/login/page.tsx`
- Test: `src/lib/actions/auth.test.ts`

**Interfaces:**
- Consumes: `getSiteUrl` (Task 1), `safeRedirectPath` (Task 2), `translateAuthError`, `INVALID_LINK_ERROR_CODE` (Task 3), `getPostLoginPath` (Task 4), `loginSchema`/`registerSchema` de `@/lib/validations/schemas` (S06 cambia su regla de contraseña; los tests usan claves de 19 caracteres para no depender de eso).
- Produces (sin cambio de firma): `loginAction(formData: FormData)`, `registerAction(formData: FormData)`. `loginAction` lee el campo opcional `redirectTo`. Los errores llegan a la página como `?error=<texto traducido>`; si había `redirectTo` seguro, se conserva en la URL de error. Los errores de validación muestran el **primer mensaje de Zod** (`parsed.error.issues[0].message`), nunca "Datos inválidos" (§5.2).

- [ ] **Step 1: Write the failing test**

Crear `src/lib/actions/auth.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));

import { revalidatePath } from 'next/cache';

import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { loginAction, registerAction } from './auth';

const mockedCreateClient = vi.mocked(createClient);
const mockedPostLogin = vi.mocked(getPostLoginPath);
const mockedRevalidate = vi.mocked(revalidatePath);

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';
const EMAIL = 'usuario@ejemplo.com';
const PASSWORD = 'clave-de-prueba-123';

type Resultado = {
  data: { user: { id: string } | null; session: object | null };
  error: { code?: string; message?: string; status?: number } | null;
};

const OK: Resultado = { data: { user: { id: USER_ID }, session: {} }, error: null };

function clienteFalso({
  signIn = OK,
  signUp = OK,
}: { signIn?: Resultado; signUp?: Resultado } = {}) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue(signIn),
    signUp: vi.fn().mockResolvedValue(signUp),
  };
  const client = { auth };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, auth };
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/** Ejecuta la acción y devuelve la URL a la que redirigió. */
async function destino(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith('NEXT_REDIRECT:')) {
      return mensaje.slice('NEXT_REDIRECT:'.length);
    }
    throw e;
  }
  throw new Error('la acción no redirigió');
}

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('sin redirectTo usa getPostLoginPath', async () => {
    const { client, auth } = clienteFalso();

    const url = await destino(loginAction(form({ email: EMAIL, password: PASSWORD })));

    expect(url).toBe('/bienvenida');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('con redirectTo interno vuelve a esa ruta', async () => {
    clienteFalso();

    const url = await destino(
      loginAction(form({ email: EMAIL, password: PASSWORD, redirectTo: '/presupuesto' })),
    );

    expect(url).toBe('/presupuesto');
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it('con redirectTo externo va a /dashboard', async () => {
    clienteFalso();

    const url = await destino(
      loginAction(
        form({ email: EMAIL, password: PASSWORD, redirectTo: '//otro.ejemplo.com' }),
      ),
    );

    expect(url).toBe('/dashboard');
  });

  it('credenciales malas → texto traducido y conserva redirectTo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
      },
    });

    const url = await destino(
      loginAction(form({ email: EMAIL, password: PASSWORD, redirectTo: '/gastos' })),
    );

    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('error')).toBe('Correo o contraseña incorrectos.');
    expect(query(url).get('redirectTo')).toBe('/gastos');
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('correo sin confirmar → pide confirmarlo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
      },
    });

    const url = await destino(loginAction(form({ email: EMAIL, password: PASSWORD })));

    expect(query(url).get('error')).toBe(
      'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
    );
    expect(query(url).get('redirectTo')).toBeNull();
  });

  it('un error desconocido nunca muestra el mensaje crudo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: { code: 'unexpected_failure', message: 'detalle interno del servidor' },
      },
    });

    const url = await destino(loginAction(form({ email: EMAIL, password: PASSWORD })));

    expect(query(url).get('error')).toBe(
      'No pudimos completar la operación. Intenta de nuevo.',
    );
  });

  it('correo inválido → mensaje de validación, sin llamar a Supabase', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      loginAction(form({ email: 'no-es-correo', password: PASSWORD })),
    );

    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('error')).toBe('Debe ser un email válido');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('registerAction', () => {
  const campos = {
    email: EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    fullName: 'Persona de Prueba',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ejemplo.com');
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('manda emailRedirectTo a /auth/confirm y pide revisar el correo', async () => {
    const { auth } = clienteFalso({
      signUp: { data: { user: { id: USER_ID }, session: null }, error: null },
    });

    const url = await destino(registerAction(form(campos)));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: {
        emailRedirectTo: 'https://app.ejemplo.com/auth/confirm?next=/bienvenida',
        data: { full_name: 'Persona de Prueba' },
      },
    });
    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('message')).toBe(
      'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.',
    );
  });

  it('si Supabase devuelve sesión (confirmación apagada) va a getPostLoginPath', async () => {
    const { client } = clienteFalso();

    const url = await destino(registerAction(form(campos)));

    expect(url).toBe('/bienvenida');
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it.each([
    // Hook (§5.2): sin code, message 'signup_not_allowed', 403.
    [{ message: 'signup_not_allowed', status: 403 }],
    // Trigger (§5.2): code 'unexpected_failure', message 'Database error saving new user'.
    [{ code: 'unexpected_failure', message: 'Database error saving new user', status: 500 }],
  ])('correo fuera de la allowlist (%j) → sin invitación', async error => {
    clienteFalso({ signUp: { data: { user: null, session: null }, error } });

    const url = await destino(registerAction(form(campos)));

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe(
      'Este correo no tiene invitación. Pídele acceso a quien administra la app.',
    );
  });

  it('límite de correos → texto traducido', async () => {
    clienteFalso({
      signUp: {
        data: { user: null, session: null },
        error: { code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' },
      },
    });

    const url = await destino(registerAction(form(campos)));

    expect(query(url).get('error')).toBe(
      'Enviamos demasiados correos. Intenta de nuevo en unos minutos.',
    );
  });

  it('contraseñas distintas → mensaje de validación, sin llamar a Supabase', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      registerAction(form({ ...campos, confirmPassword: 'otra-clave-de-prueba' })),
    );

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe('Las contraseñas no coinciden');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('correo inválido → primer mensaje de Zod, nunca "Datos inválidos"', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      registerAction(form({ ...campos, email: 'no-es-correo' })),
    );

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe('Debe ser un email válido');
    expect(query(url).get('error')).not.toBe('Datos inválidos');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/actions/auth.test.ts`
Expected: FAIL en varios tests; por ejemplo `sin redirectTo usa getPostLoginPath` recibe `'/dashboard'` en vez de `'/bienvenida'`, `credenciales malas` recibe `'Email o contraseña incorrectos'`, `manda emailRedirectTo…` falla porque `signUp` se llama sin `emailRedirectTo`, y `contraseñas distintas` / `correo inválido → primer mensaje de Zod` reciben `'Datos inválidos'` (el `catch` actual de `registerAction`).

- [ ] **Step 3: Write minimal implementation**

Reemplazar el contenido completo de `src/lib/actions/auth.ts` por:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { translateAuthError } from '@/lib/auth/error-messages';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { getSiteUrl } from '@/lib/site-url';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, registerSchema } from '@/lib/validations/schemas';

const MENSAJE_REVISA_CORREO =
  'Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada.';

function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : '';
}

/** '/auth/login?error=…' (y redirectTo si es una ruta interna segura). */
function urlConError(
  base: '/auth/login' | '/auth/register',
  mensaje: string,
  redirectTo?: string,
): string {
  const params = new URLSearchParams({ error: mensaje });
  const seguro = redirectTo ? safeRedirectPath(redirectTo, '') : '';
  if (seguro) params.set('redirectTo', seguro);
  return `${base}?${params.toString()}`;
}

/**
 * Server Action para el login de usuarios.
 * Con `redirectTo` (lo pone el middleware) vuelve a esa ruta si es segura;
 * sin él, va a /bienvenida o /dashboard según el onboarding.
 */
export async function loginAction(formData: FormData) {
  const redirectTo = texto(formData, 'redirectTo');
  const parsed = loginSchema.safeParse({
    email: texto(formData, 'email'),
    password: texto(formData, 'password'),
  });

  if (!parsed.success) {
    redirect(
      urlConError(
        '/auth/login',
        parsed.error.issues[0]?.message ?? translateAuthError(null),
        redirectTo,
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    console.error('Error de login:', {
      code: error?.code ?? 'sin_usuario',
      status: error?.status,
    });
    redirect(urlConError('/auth/login', translateAuthError(error), redirectTo));
  }

  const destino = redirectTo
    ? safeRedirectPath(redirectTo)
    : await getPostLoginPath(supabase, data.user.id);

  revalidatePath('/', 'layout');
  redirect(destino);
}

/**
 * Server Action para el registro de usuarios.
 * El correo de confirmación vuelve a /auth/confirm (ADR-003).
 */
export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: texto(formData, 'email'),
    password: texto(formData, 'password'),
    confirmPassword: texto(formData, 'confirmPassword'),
    fullName: texto(formData, 'fullName'),
  });

  if (!parsed.success) {
    redirect(
      urlConError(
        '/auth/register',
        parsed.error.issues[0]?.message ?? translateAuthError(null),
      ),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/confirm?next=/bienvenida`,
      data: {
        full_name: parsed.data.fullName,
      },
    },
  });

  if (error) {
    console.error('Error de registro:', {
      code: error.code ?? 'sin_codigo',
      status: error.status,
    });
    redirect(urlConError('/auth/register', translateAuthError(error)));
  }

  // Con confirmación de correo activa no hay sesión: hay que abrir el enlace.
  if (data.session && data.user) {
    revalidatePath('/', 'layout');
    redirect(await getPostLoginPath(supabase, data.user.id));
  }

  redirect(
    `/auth/login?${new URLSearchParams({ message: MENSAJE_REVISA_CORREO }).toString()}`,
  );
}

/**
 * Server Action para logout
 * Cierra sesión y redirecciona al home
 */
export async function logoutAction() {
  try {
    const supabase = await createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Error de logout:', error);
      redirect('/?error=Error al cerrar sesión');
    }

    revalidatePath('/', 'layout');
    redirect('/');
  } catch (error) {
    console.error('Error en logoutAction:', error);

    if (error instanceof Error && error.message.includes('NEXT_REDIRECT')) {
      // Re-throw redirect errors
      throw error;
    }

    redirect('/?error=Error al cerrar sesión');
  }
}

/**
 * Función para obtener el usuario actual
 * Útil para verificar autenticación en Server Components
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error('Error obteniendo usuario:', error);
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

/**
 * Función para verificar si el usuario está autenticado
 * Útil para middleware y protección de rutas
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return !!user;
}
```

En `src/app/auth/login/page.tsx`, tres cambios:

1. Debajo de `import { loginAction } from '@/lib/actions/auth';` agregar:

```tsx
import {
  INVALID_LINK_ERROR_CODE,
  translateAuthError,
} from '@/lib/auth/error-messages';
```

2. Reemplazar este bloque:

```tsx
  const [message, setMessage] = useState<string | null>(null);

  // Obtener errores y mensajes de los query parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    setError(errorParam);
    setMessage(messageParam);
  }, [searchParams]);
```

por:

```tsx
  const [message, setMessage] = useState<string | null>(null);
  // Lo pone el middleware al mandar aquí desde una ruta protegida.
  const redirectTo = searchParams.get('redirectTo');

  // Obtener errores y mensajes de los query parameters
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');

    // /auth/confirm y /auth/callback mandan un código, no un texto.
    setError(
      errorParam === INVALID_LINK_ERROR_CODE
        ? translateAuthError({ code: errorParam })
        : errorParam,
    );
    setMessage(messageParam);
  }, [searchParams]);
```

3. Justo después de `<form action={handleSubmit} className="space-y-6">` agregar:

```tsx
              {redirectTo && (
                <input type="hidden" name="redirectTo" value={redirectTo} />
              )}

```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/actions/auth.test.ts`
Expected: PASS (14 tests).

Run: `bun run type-check`
Expected: sin errores (valida también `page.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/auth.ts src/lib/actions/auth.test.ts src/app/auth/login/page.tsx
git commit -m "feat(auth): registro con emailRedirectTo a /auth/confirm y login con redirectTo seguro y errores en español" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Middleware

**Files:**
- Create: `src/lib/auth/route-access.ts`
- Test: `src/lib/auth/route-access.test.ts`
- Modify: `middleware.ts` (reemplazo completo)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `export type RouteAccess = 'public' | 'auth' | 'protected' | 'open'`
  - `export const PUBLIC_ROUTES`, `AUTH_ROUTES`, `PROTECTED_ROUTES: readonly string[]`
  - `export function getRouteAccess(pathname: string): RouteAccess`
  - `export function redirectsSignedInUser(pathname: string): boolean`

`auth` y `protected` conservan `startsWith` como el middleware actual: `/ingresos-deudas` hoy está protegida por el prefijo `/ingresos` y debe seguir así (test incluido).

- [ ] **Step 1: Write the failing test**

Crear `src/lib/auth/route-access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { getRouteAccess, redirectsSignedInUser } from './route-access';

describe('getRouteAccess', () => {
  it.each(['/', '/terms', '/privacy', '/test'])('%s es pública', ruta => {
    expect(getRouteAccess(ruta)).toBe('public');
  });

  it.each([
    '/auth/login',
    '/auth/register',
    '/auth/callback',
    '/auth/confirm',
    '/auth/forgot-password',
    '/auth/reset-password',
  ])('%s es de auth (accesible sin sesión)', ruta => {
    expect(getRouteAccess(ruta)).toBe('auth');
  });

  it.each([
    '/dashboard',
    '/bienvenida',
    '/presupuesto',
    '/gastos',
    '/ingresos',
    '/ingresos-deudas',
    '/deudas',
    '/profile',
    '/settings',
    '/settings/whatsapp',
  ])('%s está protegida', ruta => {
    expect(getRouteAccess(ruta)).toBe('protected');
  });

  it('una ruta no listada queda abierta', () => {
    expect(getRouteAccess('/no-existe')).toBe('open');
  });
});

describe('redirectsSignedInUser', () => {
  it('solo login y registro', () => {
    expect(redirectsSignedInUser('/auth/login')).toBe(true);
    expect(redirectsSignedInUser('/auth/register')).toBe(true);
    expect(redirectsSignedInUser('/auth/confirm')).toBe(false);
    expect(redirectsSignedInUser('/auth/reset-password')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/auth/route-access.test.ts`
Expected: FAIL con `Failed to resolve import "./route-access"`.

- [ ] **Step 3: Write minimal implementation**

Crear `src/lib/auth/route-access.ts`:

```ts
/**
 * Clasifica las rutas para el middleware.
 *
 * - public: siempre accesibles (coincidencia exacta).
 * - auth: accesibles sin sesión; login/registro redirigen si ya hay sesión.
 * - protected: exigen sesión.
 * - open: todo lo demás (el middleware no hace nada).
 *
 * `auth` y `protected` usan `startsWith`, igual que el middleware anterior
 * (por eso '/ingresos-deudas' queda protegida por '/ingresos').
 */
export type RouteAccess = 'public' | 'auth' | 'protected' | 'open';

export const PUBLIC_ROUTES: readonly string[] = ['/', '/test', '/terms', '/privacy'];

export const AUTH_ROUTES: readonly string[] = [
  '/auth/login',
  '/auth/register',
  '/auth/callback',
  '/auth/confirm',
  '/auth/forgot-password',
  '/auth/reset-password',
];

export const PROTECTED_ROUTES: readonly string[] = [
  '/dashboard',
  '/bienvenida',
  '/presupuesto',
  '/gastos',
  '/ingresos',
  '/deudas',
  '/profile',
  '/settings',
];

export function getRouteAccess(pathname: string): RouteAccess {
  if (PUBLIC_ROUTES.includes(pathname)) return 'public';
  if (AUTH_ROUTES.some(route => pathname.startsWith(route))) return 'auth';
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) return 'protected';
  return 'open';
}

/** Login y registro no tienen sentido con sesión: se manda al dashboard. */
export function redirectsSignedInUser(pathname: string): boolean {
  return pathname === '/auth/login' || pathname === '/auth/register';
}
```

Reemplazar el contenido completo de `middleware.ts` (conserva su estilo sin punto y coma) por:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { getRouteAccess, redirectsSignedInUser } from '@/lib/auth/route-access'

/**
 * Middleware de Next.js para proteger rutas y manejar autenticación
 * Se ejecuta en todas las rutas antes del rendering
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verificar la sesión del usuario
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const access = getRouteAccess(pathname)

  // Log para debugging (solo en desarrollo). Sin correo: nada de datos personales en logs.
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔐 Middleware: ${pathname} - ${user ? 'con sesión' : 'sin sesión'}`)
  }

  if (access === 'public') {
    return supabaseResponse
  }

  // Rutas de auth: siempre accesibles (confirmar correo, recuperar contraseña…),
  // pero login y registro redirigen al dashboard si ya hay sesión.
  if (access === 'auth') {
    if (user && redirectsSignedInUser(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  if (access === 'protected' && !user) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirectTo', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

// Configurar en qué rutas debe ejecutarse el middleware
export const config = {
  matcher: [
    /*
     * Aplicar a todas las rutas excepto:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - archivos con extensión
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico|ttf|woff|woff2)$).*)',
  ],
}
```

Cambios respecto al anterior: `/auth/confirm` en rutas de auth; `/bienvenida` protegida; `redirectTo` incluye la query (`/gastos?nuevo=1` vuelve completo); el log de desarrollo dice "con sesión"/"sin sesión" en vez del correo.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/lib/auth/route-access.test.ts`
Expected: PASS.

Run: `bun run type-check`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/route-access.ts src/lib/auth/route-access.test.ts middleware.ts
git commit -m "feat(auth): middleware deja pasar /auth/confirm, protege /bienvenida y no registra el correo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Suite completa y tipos**

Run: `bun run test && bun run type-check`
Expected: todos los archivos de test en verde (los 7 nuevos de esta historia más los existentes) y `tsc --noEmit` sin errores.

- [ ] **Step 2: Build con variables de ejemplo (solo sin `.env.local`)**

Valida que `/auth/callback` ya no tiene `page.tsx` y `route.ts` a la vez y que los route handlers compilan. Contratos §5.0 prohíben `next build` contra `.env.local` (apunta a producción) y Next lo carga solo aunque se pasen variables: este paso **solo** corre en un worktree sin `.env.local`.

Run: `test -e .env.local && echo "hay .env.local: se salta el build" || NEXT_PUBLIC_SUPABASE_URL=https://ejemplo.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=clave-de-ejemplo SUPABASE_SERVICE_ROLE_KEY=clave-de-ejemplo bun run build`
Expected: o el aviso de que se salta, o build exitoso con `ƒ /auth/callback` y `ƒ /auth/confirm` en la tabla de rutas. Si falla por una variable de otro módulo que no es de auth, anotarlo en el reporte sin tocar ese módulo. Si se salta, el Step 1 (`tsc`) sigue siendo la verificación obligatoria.

- [ ] **Step 3: Revisión de datos personales**

Run: `git diff main --stat && git diff main -- src middleware.ts | grep -nE "@(gmail|hotmail|outlook|yahoo)\.|\+57[0-9]{10}" || echo "sin datos personales"`
Expected: `sin datos personales` (los tests solo usan `usuario@ejemplo.com`).

No hay commit en esta tarea.

---

## Tareas humanas

Estas tareas las hace la persona en el dashboard de Supabase. Ningún agente las ejecuta. Se hacen **después** de desplegar esta historia (si la plantilla apunta a `/auth/confirm` antes de que exista, los enlaces dan 404).

### H3 — Supabase → Authentication → URL Configuration

1. **Site URL**: la URL de producción de la app, tal como aparece en Vercel → Project → Settings → Domains (dominio principal), con `https://` y sin barra final. Debe ser el mismo valor que `NEXT_PUBLIC_SITE_URL` en Vercel (H7), porque las plantillas usan `{{ .SiteURL }}`.
2. **Redirect URLs** (una por línea):
   - `http://localhost:3001/**`
   - la Site URL de producción seguida de `/**`
   - para previews de Vercel: `https://*-<slug-del-equipo>.vercel.app/**`, donde el slug del equipo sale de Vercel → Settings → General ("Team URL").
3. Authentication → Providers → Email: **Confirm email** activado. En la misma pantalla, **Email OTP Expiration** en `3600` segundos (el texto de las plantillas dice "vence en una hora").

Prueba local: el correo trae un enlace a la Site URL (producción). Para probar `/auth/confirm` en local, copiar el enlace del correo y cambiar solo el origen por `http://localhost:3001` antes de abrirlo; `verifyOtp` funciona igual porque es el mismo proyecto de Supabase.

### H4 — Supabase → Authentication → Emails → Templates

Reemplazar asunto y cuerpo completos de estas dos plantillas. "Reset password" la entrega S05.

**Confirm signup**

Asunto:

```
Confirma tu correo para entrar a Presupuesto
```

Cuerpo (HTML):

```html
<h2>Confirma tu correo</h2>
<p>Hola:</p>
<p>Alguien (ojalá tú) creó una cuenta en Presupuesto con este correo. Para activarla, abre este enlace:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar mi correo</a></p>
<p>El enlace sirve una sola vez y vence en una hora. Puedes abrirlo en cualquier dispositivo.</p>
<p>Si no fuiste tú, ignora este mensaje: la cuenta no se activa sin confirmar.</p>
```

Sin `next` (contratos §5.2: las plantillas no llevan `next` salvo recovery): `/auth/confirm` decide con `getPostLoginPath` (primer ingreso → `/bienvenida`; si ya terminó el onboarding o S09 aún no está aplicada → `/dashboard`). `type=email` es el valor que usa la guía oficial de Supabase para SSR; `/auth/confirm` también acepta `type=signup`. Si se prefiere `{{ .ConfirmationURL }}`, `/auth/confirm` también acepta el `?code=` con que vuelve ese enlace (§5.2), aunque ese flujo exige abrirlo en el mismo navegador.

**Invite user**

Asunto:

```
Te invitaron a Presupuesto
```

Cuerpo (HTML):

```html
<h2>Te invitaron a Presupuesto</h2>
<p>Hola:</p>
<p>Te invitaron a usar Presupuesto, la app para llevar tus gastos y tu presupuesto del mes. Para aceptar la invitación y crear tu contraseña, abre este enlace:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/reset-password">Aceptar la invitación</a></p>
<p>El enlace sirve una sola vez y vence en una hora. Si no esperabas esta invitación, ignora este mensaje.</p>
```

La invitación lleva a `/auth/reset-password` para que la persona cree su contraseña (contratos §5.2; esa página la entrega S05: **no enviar invitaciones antes de desplegar S05**). El correo invitado debe estar antes en `signup_allowlist` (H6): la allowlist de S03 (hook y trigger a la vez, §5.1) también bloquea las invitaciones.

Nota v2: §5.2 dice que las plantillas no llevan `next` "salvo recovery", pero también que "Invite user" lleva a `/auth/reset-password`. Sin `next`, `/auth/confirm` mandaría al invitado (que aún no tiene contraseña) a `getPostLoginPath` → `/bienvenida`. Este plan conserva `next=/auth/reset-password` solo en "Invite user" (el mismo trato que recovery) hasta que el contrato lo aclare.

---

## Autorrevisión

- **Cobertura de criterios:** 1 → Tasks 1–4; 2 → Task 5; 3 → Task 6; 4, 5, 6 → Task 7; 7 → Task 8; 8 → Task 1; 9 → sección Tareas humanas; 10 → Task 9.
- **Enmiendas v2 (§5.2) cubiertas:** `translateAuthError` con `code` solo si es conocido, filas `enlace_invalido` y `same_password`, `Map`, exports `INVALID_LINK_ERROR_CODE`/`INVALID_LINK_LOGIN_PATH`/`GENERIC_AUTH_ERROR` y tests de hook y trigger → Task 3; `/auth/confirm` con `?code=` y `getPostLoginPath` sin `next` válido → Task 5; primer mensaje de Zod en `registerAction` → Task 7; `route-access.ts` → Task 8; plantillas sin `next` salvo recovery (e invitación, ver nota de H4) → Tareas humanas. §5.0: sin `vitest.config.ts`, sin `db:types`, sin `bun run dev`, build solo sin `.env.local`.
- **Marcadores:** ninguno; todo el código está completo. El código de las Tasks 1–8 se escribió y se corrió antes de publicar el plan (v1: 8 archivos de test, 112 tests en verde, `tsc --noEmit` limpio sobre los archivos nuevos y la página de login modificada); los cambios v2 de las Tasks 3, 5 y 7 se volvieron a correr.
- **Consistencia de tipos:** `getPostLoginPath(supabase: SupabaseClient, userId: string): Promise<'/bienvenida' | '/dashboard'>` igual en Tasks 4–7; `INVALID_LINK_LOGIN_PATH`/`INVALID_LINK_ERROR_CODE` definidos en Task 3 y usados en 5, 6 y 7; `safeRedirectPath(input, fallback = '/dashboard')` usado con fallback explícito en 5 y 6, y con `''` en Task 7. No hay historias previas de las que dependa S04; S06 (`passwordSchema`, va después en AUTH), S05 (reset-password y la fila `same_password`, va después de S06), S11 (`/bienvenida`) y S03 (literal `signup_not_allowed`) consumen lo que se produce aquí.
