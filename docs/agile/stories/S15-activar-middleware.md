# S15 — Activar el middleware (moverlo a `src/`)

Alineado con contratos v2 (§5). Escrito por el orquestador (sin planificador): historia corta.

**Goal:** que el middleware de Next.js se ejecute de verdad. Hoy `middleware.ts` está en la raíz, pero el proyecto usa `src/app/`, y Next.js solo lo busca en `src/middleware.ts`. Verificado el 2026-09-30: el build de producción no lista "ƒ Middleware" y `GET /gastos` sin sesión responde 200.

**Architecture:** mover el archivo sin cambiar su lógica, fijar con tests que la ubicación es la correcta y que el matcher no toca `/api` (el webhook de WhatsApp y los crons no deben redirigirse nunca), y cerrar la deuda de S05 y la decisión de la persona sobre `CONTACT_EMAIL`.

**Riesgo:** activarlo cambia el comportamiento en producción por primera vez (redirecciones de login, refresco de sesión). Antes de fusionar a `main` se prueba en un preview de Vercel (tarea de integración S14, con OK de la persona). Esta historia NO despliega nada.

## Archivos

| Acción | Ruta |
|---|---|
| Mover | `middleware.ts` → `src/middleware.ts` (`git mv`) |
| Modificar | `src/middleware.test.ts` (import `./middleware`) |
| Crear | `src/middleware-location.test.ts` |
| Modificar | `src/lib/constants/legal.ts`, `src/lib/constants/legal.test.ts` |
| Modificar (deuda S05) | `src/lib/auth/password-reset-feedback.ts`, `src/app/auth/reset-password/page.tsx`, `src/lib/actions/auth.ts`, `src/lib/auth/login-feedback.ts` y sus tests |

## Criterios de aceptación

- [x] CA1: `src/middleware.ts` existe y exporta `middleware` y `config`; `middleware.ts` en la raíz no existe (test).
- [x] CA2: el matcher NO coincide con `/api/whatsapp/webhook`, `/api/cron/alertas-pendientes`, `/_next/static/x.js`, `/favicon.ico`, `/logo.png`; SÍ coincide con `/gastos`, `/bienvenida`, `/auth/login`, `/` (test que compila el patrón de `config.matcher[0]` con `new RegExp('^' + patron + '$')`).
- [x] CA3: los tests existentes de `src/middleware.test.ts` siguen pasando con el import nuevo.
- [x] CA4: `assertContactEmailReady` ya no lanza: en producción con el correo de ejemplo hace `console.warn` con un texto sin datos personales ("CONTACT_EMAIL sigue siendo el de ejemplo: resuelve H9 antes de abrir el registro"). Decisión de la persona, 2026-09-30.
- [x] CA5 (deuda S05): constante `RESET_LINK_EXPIRED_PATH` en `password-reset-feedback.ts` usada por la página y por `resetPasswordAction`; el test comprueba el uso de la constante.
- [x] CA6 (deuda S05): el texto de `LOGIN_VALIDATION_ERROR_CODE` pasa a "Revisa tu correo y tu contraseña.".
- [x] CA7 (deuda S05): tests de `resetPasswordAction` cuando `auth.getUser()` devuelve `{ user: null, error }` y cuando lanza: registra solo el `code` (o el nombre del error) y redirige a `RESET_LINK_EXPIRED_PATH`.
- [x] CA8 (deuda S05): en `auth-password.test.ts` la aserción débil `not.toContain(encodeURIComponent(crudo))` se reemplazó por tres más fuertes: `url.searchParams.get('error')` es exactamente el código esperado, la URL solo lleva el parámetro `error` y `decodeURIComponent(url.href)` no contiene el mensaje crudo.
- [x] CA9: quitar el comentario de `src/middleware.test.ts` que remite a H10/ADR-004 (ya resuelto) y documentar en `docs/agile/decisions/ADR-004-middleware-en-src.md` (contexto, verificación del 2026-09-30, decisión, riesgo y prueba en preview).

## Tareas (TDD, un commit por tarea, siempre `git commit --no-verify` tras `bunx eslint` y `bunx prettier --check` de los archivos tocados)

- [x] **T1 — Ubicación.** Escribe `src/middleware-location.test.ts` con CA1 y CA2 (usa `fs.existsSync(path.join(process.cwd(), 'middleware.ts'))` y `import { config } from './middleware'`). Córrelo: falla (no existe `src/middleware.ts`). `git mv middleware.ts src/middleware.ts`; cambia el import de `src/middleware.test.ts` a `./middleware`. Corre `bun run test src/middleware` → verde. Commit `fix(auth): mover el middleware a src/ para que Next.js lo ejecute`.
- [x] **T2 — Aviso de CONTACT_EMAIL.** Cambia el test de `legal.test.ts` que espera que lance en producción: ahora espera `console.warn` (con `vi.spyOn(console, 'warn')`) y que no lance. Rojo → cambia `assertContactEmailReady` → verde. Commit.
- [x] **T3 — Deuda S05** (CA5–CA8), un commit por criterio o uno solo si son pequeños.
- [x] **T4 — ADR-004 y limpieza** (CA9). Commit de docs.
- [x] **T5 — Verificación.** `bun run test && bun run type-check` en verde; árbol limpio.

## Ronda de corrección 1 (revisión)

- El middleware ya no responde 500 si `createServerClient` o `getUser()` fallan: sigue sin usuario (públicas y auth pasan, protegidas al login) y registra solo el nombre o el `code` del error.
- Tests de sesión vencida fieles a Supabase (`refresh_token_not_found` + cookies de borrado): la protegida va al login con el borrado y el login pasa sin bucle.
- Bucle página ↔ middleware: las guardias de `dashboard`, `settings`, `deudas`, `ingresos` e `ingresos-deudas` redirigen a `/auth/login?redirectTo=<ruta>`, y el middleware no rebota ese login al dashboard (ADR-004).
- Server Actions y peticiones no GET/HEAD reciben 303 en vez de 307.
- Matcher: `(?!api/|api$|…)`; `/apiario` sí pasa por el middleware.
- `/test` pública queda como deuda en ADR-004 (S15 no cambia reglas de acceso).
- H9 (CA4): la guarda de `CONTACT_EMAIL` pasó de romper el build a un `console.warn` por decisión de la persona. El aviso no basta como única defensa: **antes de abrir el registro, comprobar a mano que `CONTACT_EMAIL` en `src/lib/constants/legal.ts` es un buzón real** (check previo de la integración S14; tarea H9 en contratos §5.4). Pendiente: crear la tarea en Plane.

## S15b — Deuda de S15 (middleware más observable y guardias con helper)

- [x] T1: el middleware registra `{ code: error.code ?? error.name, status }` para cualquier error de `getUser()` que no sea `AuthSessionMissingError` (sin el mensaje).
- [x] T2: helper `esFaltaDeSesion(error)` en `src/lib/auth/`, usado por el middleware y `resetPasswordAction`.
- [x] T3: el matcher excluye también `json|txt|xml|map|webmanifest`.
- [x] T4: helper `loginUrl(pathname, search?)` en `src/lib/auth/`, usado por las guardias de las páginas.
- [x] T5: CA8 ajustado a lo implementado y deuda cerrada documentada.

### Deuda cerrada en S15b

- Observabilidad: un error de `getUser()` sin `code` (p. ej. `AuthRetryableFetchError` cuando Supabase no responde) ya deja rastro en el log del middleware como `{ code: error.name, status }`; nunca se registra el mensaje.
- `AuthSessionMissingError` (visitante sin sesión) no se registra como fallo ni en el middleware ni en `resetPasswordAction`: ambos usan `esFaltaDeSesion` (`src/lib/auth/session-error.ts`).
- Matcher: `robots.txt`, `sitemap.xml`, `manifest.json`, `*.webmanifest` y los `.map` ya no pasan por el middleware. Se prueba con `RegExp` nativo y con `pathToRegexp` de `next/dist/compiled/path-to-regexp` (la misma copia que usa Next.js).
- Guardias de `dashboard`, `deudas`, `ingresos`, `ingresos-deudas` y `settings` construyen la URL de login con `loginUrl` (`src/lib/auth/login-url.ts`, con `URLSearchParams` y la query de origen conservada) en vez de literales.
