# Contratos — Multiusuario (v1)

Fuente de verdad para todas las historias. Diseño: `docs/superpowers/specs/2026-09-30-multiusuario-design.md`. Las ADR en `docs/agile/decisions/` prevalecen sobre los planes.

## 0. Convenciones

- Idioma: código y nombres nuevos en inglés técnico o español como el archivo que se toca; textos de UI y mensajes en **español colombiano, tuteo** ("tú", no "vos").
- Zona horaria: mes actual = `todayBogota().slice(0, 7)` (`src/lib/whatsapp/format.ts`) en TS; `to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM')` en SQL. `month_year` es `'YYYY-MM'`.
- Reloj y azar en tests: inyectar (`now?: () => Date`, `random?: () => number`) en funciones puras; nunca depender de la hora real en asserts.
- Supabase: `createClient()` (cookie, RLS) y `createAdminClient()` (service role) de `src/lib/supabase/server.ts`; `createClient()` de `src/lib/supabase/client.ts` en el navegador. Los tests mockean el cliente; ningún test toca una base real.
- Guard de funciones SECURITY DEFINER (patrón de `20260929000000`):
  ```sql
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;
  ```
  Toda SECURITY DEFINER lleva `SET search_path = public, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC, anon` y `GRANT EXECUTE` solo a quien la llama.
- Migraciones: `supabase/migrations/<timestamp>_<slug>.sql`, idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`). **Ninguna se aplica a producción durante la implementación** (tarea humana H8). Timestamps reservados por historia:

  | Historia | Timestamp |
  |---|---|
  | S01 | `20260930100000` |
  | S02 | `20260930110000` |
  | S03 | `20260930120000` |
  | S09 | `20260930130000` |

- Tests de SQL: no hay Postgres local. Las migraciones se validan con tests de texto (vitest lee el `.sql` y verifica guard, grants, `search_path`, idempotencia) y quedan con un bloque comentado de verificación manual al final.
- Verificación del proyecto: `bun run test && bun run type-check`. Commits de solo docs/SQL: `git commit --no-verify`.
- Datos personales: ningún correo, teléfono, cédula o nombre real en código, tests, fixtures o logs. Usar `usuario@ejemplo.com`, `+573000000000`, UUIDs inventados.

## 1. Base de datos

### 1.1 Allowlist de registro (S03, ADR-002)

```sql
CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email))),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS habilitado, SIN políticas; REVOKE ALL FROM anon, authenticated.

CREATE OR REPLACE FUNCTION public.is_signup_allowed(p_email text) RETURNS boolean
  -- SECURITY DEFINER, search_path fijo; lower(btrim(p_email)) contra la tabla.
  -- EXECUTE solo para supabase_auth_admin (y el dueño).
```

Enforcement, en este orden de preferencia (S03 verifica cuál aplica al plan del proyecto y lo registra en ADR-002):
- **Hook** `public.hook_before_user_created(event jsonb) RETURNS jsonb`: si `is_signup_allowed(event->'user'->>'email')` devuelve `'{}'::jsonb`; si no, `jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed'))`. `GRANT EXECUTE … TO supabase_auth_admin`; `REVOKE … FROM authenticated, anon, public`.
- **Trigger** de respaldo `enforce_signup_allowlist` `BEFORE INSERT ON auth.users` que hace `RAISE EXCEPTION 'signup_not_allowed'` si no está permitido.

El mensaje literal que ve la API es **`signup_not_allowed`** (con hook) o `Database error saving new user` (con trigger). Ambos se traducen en `translateAuthError` (§2.2).

La migración inserta en la allowlist a los usuarios ya existentes: `INSERT INTO signup_allowlist(email) SELECT lower(email) FROM auth.users ON CONFLICT DO NOTHING`.

### 1.2 Perfil y onboarding (S09)

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;
-- Backfill: usuarios existentes quedan con ambas = now() (no ven la bienvenida ni la checklist).
```

Las columnas se actualizan con el cliente de cookie. La política UPDATE de `profiles` ya es `auth.uid() = id`.

### 1.3 Kit inicial (S09, ADR-001)

```sql
-- Interna: sin guard, sin EXECUTE para nadie salvo el dueño (postgres).
CREATE OR REPLACE FUNCTION public._seed_starter_kit(p_user_id uuid, p_month_year text) RETURNS boolean
  -- SECURITY DEFINER, search_path fijo.
  -- Idempotencia: si el usuario YA tiene alguna fila en categories → RETURN false (no hace nada).
  -- Si no: inserta todo en la misma transacción y RETURN true.
  -- NO llama upsert_monthly_budget (su guard falla dentro del trigger de signup, donde auth.uid() es NULL):
  -- inserta budget_templates directamente con ON CONFLICT (user_id, month_year) DO NOTHING.

-- Pública: sin parámetro de usuario, no se puede apuntar a otro.
CREATE OR REPLACE FUNCTION public.ensure_starter_kit() RETURNS boolean
  -- SECURITY DEFINER; auth.uid() NULL → RAISE 42501.
  -- RETURN _seed_starter_kit(auth.uid(), <mes actual Bogotá>).
  -- EXECUTE solo authenticated.
```

`handle_new_user()` se reemplaza para que, **después** de insertar en `profiles`, haga:
```sql
BEGIN
  PERFORM public._seed_starter_kit(NEW.id, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'seed_starter_kit falló para %: %', NEW.id, SQLERRM;
END;
```
El cuerpo actual del perfil se conserva idéntico (tomarlo de `pg_get_functiondef` en el plan; el repo tiene `supabase_schema.sql:344-356`).

**Contenido del kit** (catálogos por `name`, que ya existen en producción):

| Categoría | Rubro | Clasificación | Control | alerts_enabled |
|---|---|---|---|---|
| VIVIENDA | Arriendo o cuota | Basico | Necesario | null |
| VIVIENDA | Servicios públicos | Basico | Necesario | true |
| VIVIENDA | Internet | Calidad de Vida | Simplificar | null |
| MERCADO | Mercado | Basico | Necesario | true |
| MERCADO | Aseo del hogar | Basico | Necesario | true |
| TRANSPORTE | Transporte | Basico | Necesario | true |
| TRANSPORTE | Vehículo | Basico | Reducir | true |
| SALUD | Salud | Basico | Necesario | null |
| SALUD | Droguería | Basico | Necesario | true |
| DEUDAS | Tarjetas | Basico | Necesario | null |
| DEUDAS | Créditos | Basico | Necesario | null |
| OTROS | Otros | Estilo de Vida | Reducir | true |

- Categorías en MAYÚSCULAS, `is_active = true`. Rubros con `budgeted_amount = 0`, `status` = `'Activo'`, `template_id` = plantilla del mes, `user_id` = el usuario.
- Cuenta: `accounts(user_id, name='Efectivo', type='cash', is_active=true)` si no existe una con ese nombre.
- Plantilla: `budget_templates(user_id, name='Presupuesto ' || mes, month_year=mes)`.
- Si un catálogo por nombre no existe, la función falla (y en el trigger queda en WARNING). No se inventan catálogos.

### 1.4 Funciones remotas (S01)

- `get_previous_month_overspend`: traer su definición real (`pg_get_functiondef`, lectura) a la migración; agregar el guard; `REVOKE … FROM PUBLIC, anon`; `GRANT … TO authenticated, service_role` solo si tiene llamadores en `src/`, si no, solo `service_role`.
- `copy_budget_items_from_template`, `fix_templates_without_items`, `check_cufe_exists`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier`: traer sus definiciones al repo **sin cambiar el cuerpo** salvo que no filtren por el usuario; en ese caso, agregar el filtro y el guard.
- `get_budget_by_month`: agregar el guard (sigue siendo INVOKER).
- Auditoría: bloque comentado que lista tablas `public` con `relrowsecurity = false`.

Las lecturas de `pg_get_functiondef` contra producción las hace **el planificador de S01 con SELECT**; el implementador trabaja sobre el texto del plan.

### 1.5 Vinculación de WhatsApp (S02)

```sql
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq
  ON public.whatsapp_link_codes (code) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_link_attempts (
  id bigserial PRIMARY KEY,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_phone_created_idx
  ON public.whatsapp_link_attempts (phone_e164, created_at DESC);
-- RLS on, sin políticas; solo service-role.
```

- Generar código: antes de insertar, borrar los códigos **vencidos y no usados** del propio usuario; si el insert choca con `23505`, reintentar con otro código (máximo 5 intentos, luego error).
- Canjear: el UPDATE por `code` afecta como mucho una fila gracias al índice único.
- Límite: **5 intentos fallidos por número en 15 minutos**. Un intento fallido = un `VINCULAR <n>` cuyo código no existe o venció. Al pasar el límite no se consulta el código y se responde `MSG_TOO_MANY_ATTEMPTS`.
- Revincular: si el número pasa de un `user_id` a otro, borrar su fila de `whatsapp_conversations`.

## 2. TypeScript

### 2.1 URLs y redirecciones (S04)

```ts
// src/lib/site-url.ts
export function getSiteUrl(env?: Record<string, string | undefined>): string
// NEXT_PUBLIC_SITE_URL → https://${VERCEL_URL} → 'http://localhost:3001'. Sin barra final.

// src/lib/auth/safe-redirect.ts
export function safeRedirectPath(input: string | null | undefined, fallback?: string): string
// fallback por defecto '/dashboard'. Acepta solo rutas que empiezan con '/' y no con '//' ni '/\'.
// Rechaza esquemas (http:, javascript:) y rutas de /auth/* salvo /auth/reset-password.
```

### 2.2 Errores de auth (S04; S03 depende del literal)

```ts
// src/lib/auth/error-messages.ts
export function translateAuthError(err: { message?: string; code?: string } | null | undefined): string
```

| Entrada (code o message) | Texto |
|---|---|
| `signup_not_allowed`, `Database error saving new user` | Este correo no tiene invitación. Pídele acceso a quien administra la app. |
| `invalid_credentials`, `Invalid login credentials` | Correo o contraseña incorrectos. |
| `email_not_confirmed` | Confirma tu correo antes de entrar. Revisa tu bandeja de entrada. |
| `user_already_exists`, `User already registered` | Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña. |
| `weak_password` | La contraseña es muy débil. Usa al menos 8 caracteres. |
| `over_email_send_rate_limit`, `email rate limit exceeded` | Enviamos demasiados correos. Intenta de nuevo en unos minutos. |
| `email_address_not_authorized` | No pudimos enviar el correo a esta dirección. Escríbele a quien administra la app. |
| `signup_disabled` | El registro está cerrado por ahora. |
| `otp_expired` | El enlace venció. Pide uno nuevo. |
| cualquier otro | No pudimos completar la operación. Intenta de nuevo. |

Se compara primero `code`, luego `message` (sin distinguir mayúsculas). Nunca se muestra el mensaje crudo de Supabase.

### 2.3 Rutas de auth (S04, S05)

- `src/app/auth/confirm/route.ts` — `GET`. Query: `token_hash`, `type` (`EmailOtpType`: `signup` | `email` | `recovery` | `invite` | `email_change`), `next`. Llama `supabase.auth.verifyOtp({ type, token_hash })` con el cliente de cookie. Éxito: `redirect(safeRedirectPath(next, type === 'recovery' ? '/auth/reset-password' : await getPostLoginPath(...)))`. Error o parámetros faltantes: `redirect('/auth/login?error=enlace_invalido')`.
- `src/app/auth/callback/page.tsx` se **elimina** y se reemplaza por `src/app/auth/callback/route.ts` (`GET`, `code` → `exchangeCodeForSession`, mismo manejo de `next`/`redirectTo` seguro), por compatibilidad con enlaces viejos.
- `registerAction`: `signUp` con `options.emailRedirectTo = ${getSiteUrl()}/auth/confirm?next=/bienvenida`.
- `loginAction`: respeta `redirectTo` vía `safeRedirectPath`; sin `redirectTo`, usa `getPostLoginPath`.
- `src/app/auth/forgot-password/page.tsx` + `forgotPasswordAction(formData)`: `resetPasswordForEmail(email, { redirectTo: ${getSiteUrl()}/auth/confirm?type=recovery&next=/auth/reset-password })`. Responde siempre el mismo mensaje exista o no el correo: "Si el correo está registrado, te enviamos un enlace."
- `src/app/auth/reset-password/page.tsx` + `resetPasswordAction(formData)`: requiere sesión (la deja `/auth/confirm`); `updateUser({ password })`; luego `/dashboard`.
- `src/middleware.ts` (ADR-004): `/auth/confirm` y `/auth/reset-password` accesibles; `/bienvenida` protegida; `/terms` y `/privacy` públicas.

```ts
// src/lib/onboarding/post-login.ts
export async function getPostLoginPath(
  supabase: SupabaseClient, userId: string
): Promise<'/bienvenida' | '/dashboard'>
// '/bienvenida' si profiles.onboarding_completed_at IS NULL; '/dashboard' si no o si la consulta falla.
```

### 2.4 Contraseña (S06)

```ts
// src/lib/validations/schemas.ts
export const passwordSchema: z.ZodString // z.string().min(8, 'Usa al menos 8 caracteres').max(72, 'Usa como máximo 72 caracteres')
```
Lo usan el registro y el reset. El texto de ayuda de la UI dice "Mínimo 8 caracteres." y nada más.

### 2.5 Valores por defecto de rubros (S08)

```ts
// src/lib/constants/budget-defaults.ts
export const DEFAULT_ITEM_CLASSIFICATION = 'Estilo de Vida'
export const DEFAULT_ITEM_CONTROL = 'Reducir'
export const DEUDA_ITEM_CLASSIFICATION = 'Basico'
export const DEUDA_ITEM_CONTROL = 'Necesario'
export const DEFAULT_ITEM_STATUS = 'Activo'
```
`createDefaultBudgetItemForCategory`, `createBudgetItemInMonth` (`src/lib/actions/categories.ts`) y `deudas-budget.ts` buscan los catálogos **por nombre** con estas constantes. Si el nombre no existe, caen al primer activo y lo registran con `console.warn` (sin datos personales).

### 2.6 Cuentas en /gastos (S07)

- `ACCOUNT_TYPES` se **elimina** de `src/lib/constants/expense-categories.ts`. Se agrega `export const DEFAULT_ACCOUNT_NAME = 'Efectivo'`.
- `/gastos` usa solo las cuentas activas del usuario. La cuenta por defecto es `DEFAULT_ACCOUNT_NAME` si existe, si no la primera. Sin cuentas: `DEFAULT_ACCOUNT_NAME` (la RPC la crea).
- `category_name` inicial del formulario = primera categoría activa del usuario; si no tiene, el botón de guardar se deshabilita con el texto "Primero crea una categoría".
- Se eliminan `inicializarDatosEjemplo` y sus llamadas; el sidebar deja de usar el presupuesto mock de `useBudgetData` (se borra el mock; si el hook queda sin uso, se borra).

### 2.7 Onboarding (S11, S12)

```ts
// src/lib/onboarding/budget-503020.ts
export type KitItem = { id: string; classificationName: string }
export function suggest503020(income: number, items: KitItem[]):
  { amounts: Record<string, number>; ahorroSinAsignar: number }
// Grupos: 'Basico' → 50 %; 'Estilo de Vida' | 'Caprichos' → 30 %; 'Calidad de Vida' → 20 %; 'Impuestos' → 0 (queda en 0).
// Reparto igual entre los ítems del grupo, redondeado hacia abajo a múltiplos de 1.000 COP.
// Si un grupo no tiene ítems, su porcentaje va a ahorroSinAsignar. income <= 0 → todo en 0.

// src/lib/onboarding/checklist.ts
export type ChecklistInput = {
  accountCount: number; deudaCount: number; linkedPhoneCount: number;
  hasDocumento: boolean; hasExplicitAlerts: boolean;
}
export type ChecklistItemId = 'cuentas' | 'deudas' | 'whatsapp' | 'documento' | 'alertas'
export type ChecklistItem = { id: ChecklistItemId; label: string; href: string; done: boolean }
export function computeChecklist(input: ChecklistInput): ChecklistItem[]
// cuentas: accountCount > 1 → /settings · deudas: deudaCount > 0 → /deudas · whatsapp: linkedPhoneCount > 0 → /settings
// documento: hasDocumento → /settings · alertas: hasExplicitAlerts → /presupuesto
export async function loadChecklistInput(supabase: SupabaseClient, userId: string): Promise<ChecklistInput>

// src/lib/actions/onboarding.ts  ('use server'; todas con cliente de cookie y auth.getUser())
export async function ensureStarterKitAction(): Promise<{ seeded: boolean }>           // rpc('ensure_starter_kit')
export async function saveOnboardingIncomeAction(input: { monto: number; fuente: string }): Promise<{ ok: boolean; error?: string }>
export async function saveOnboardingBudgetAction(amounts: Record<string, number>): Promise<{ ok: boolean; error?: string }>
// Solo actualiza budgeted_amount de rubros del usuario (filtro user_id); montos enteros >= 0.
export async function completeOnboardingAction(): Promise<void>   // onboarding_completed_at = now(); redirect('/dashboard')
export async function dismissChecklistAction(): Promise<void>     // onboarding_dismissed_at = now()
```

- `/bienvenida` (`src/app/bienvenida/page.tsx`): server component. Sin sesión → login. Si `onboarding_completed_at` no es null → `/dashboard`. Llama `ensureStarterKitAction()` antes de renderizar. Tres pasos en un componente cliente `src/components/organisms/OnboardingWizard/OnboardingWizard.tsx`, cada uno con "Saltar". El paso 3 reusa `generateWhatsAppLinkCodeAction` y `buildWhatsAppLinkUrl`.
- El dashboard llama `ensureStarterKitAction()` una vez al cargar (repara usuarios a los que el trigger les falló) y muestra `OnboardingChecklist` si `onboarding_dismissed_at` es null y hay algún ítem pendiente.

### 2.8 WhatsApp en Ajustes (S13)

```ts
// src/lib/whatsapp/link-url.ts
export function buildWhatsAppLinkUrl(botNumber: string | undefined, code: string): string | null
// botNumber E.164 ('+573000000000'); quita '+', espacios y 'whatsapp:'. Sin número → null.
// → `https://wa.me/573000000000?text=VINCULAR%20123456`
```
- Variable pública `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`. Sin ella, el panel muestra el código sin enlace, como hoy.
- `MSG_LINKED_OK` (`src/lib/whatsapp/handle-linking.ts`) pasa a: "¡Listo! Tu número quedó vinculado. Ya puedes mandarme una foto de la factura, el código CUFE o escribir algo como «40 mil almuerzo». También puedes preguntarme «¿cuánto llevo en mercado?»."
- `MSG_TOO_MANY_ATTEMPTS` (S02): "Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes."
- Desvincular: `unlinkWhatsAppPhoneAction(phoneE164: string)` en `src/lib/actions/whatsapp.ts`, borra con el cliente de cookie (RLS permite DELETE del dueño).

## 3. Variables de entorno nuevas

Se agregan a `.env.example` con valores de ejemplo:
```
NEXT_PUBLIC_SITE_URL=http://localhost:3001
NEXT_PUBLIC_WHATSAPP_BOT_NUMBER=+573000000000
```

## 4. Propiedad de archivos por flujo (evitar choques)

| Flujo | Historias | Archivos principales |
|---|---|---|
| SEG | S01, S02, S03 | `supabase/migrations/2026093010*…12*`, `src/lib/services/whatsapp-links.ts`, `src/lib/whatsapp/handle-linking.ts` (solo S02) |
| AUTH | S04, S05, S06 | `src/app/auth/**`, `src/lib/actions/auth.ts`, `src/lib/auth/**`, `src/lib/site-url.ts`, `src/lib/onboarding/post-login.ts`, `src/lib/validations/schemas.ts`, `src/middleware.ts`, `src/app/terms`, `src/app/privacy` |
| LIMPIEZA | S07, S08 | `src/lib/services/ingresos-deudas.ts`, `src/hooks/useIngresosDeudas.ts`, `src/hooks/useBudgetData.ts`, `Sidebar.tsx`, `src/app/gastos/page.tsx`, `expense-categories.ts`, `src/lib/actions/categories.ts`, `src/lib/actions/deudas-budget.ts`, `budget-defaults.ts` |
| ONB | S09, S10, S11, S12, S13 | `supabase/migrations/20260930130000_*`, `src/lib/onboarding/**` (salvo post-login), `src/lib/actions/onboarding.ts`, `src/app/bienvenida/**`, `OnboardingWizard`, `OnboardingChecklist`, `MobileSidebar.tsx`, `DashboardQuickActions.tsx`, `BudgetStatusPanels.tsx`, `WhatsAppLinkPanel.tsx`, `src/lib/whatsapp/link-url.ts` |

Choques previstos y orden: `Sidebar.tsx` (S07 antes de S10); `handle-linking.ts` (S02 antes de S13); `src/lib/actions/whatsapp.ts` (S13 solo); `.env.example` (S04 y S13 agregan al final: conservar ambos lados).

## 5. Enmiendas v2 (prevalecen sobre §0–§4)

Resuelven los huecos que reportaron los 13 planificadores. Donde choquen con el texto de arriba, gana esta sección.

### 5.0 Convenciones
- **Tests de texto de migraciones**: `src/lib/supabase/migrations/<timestamp>_<slug>.test.ts`, con sus helpers dentro del archivo (vitest solo recoge `src/**`). Aplica a S01, S02, S03 y S09.
- **Grants "solo X"**: Supabase da EXECUTE a `service_role` por default privileges. Cuando el contrato dice "solo authenticated" o "solo el dueño", se revoca también a `service_role`.
- **Sin tests de render**: vitest corre en `node`, sin Testing Library ni JSX. Los componentes se cubren con type-check; la lógica va en funciones puras testeadas; si hace falta, tests que leen el texto del archivo. No se toca `vitest.config.ts`.
- **Tipos**: `src/types/database.ts` está desactualizado. **Nunca** correr `bun run db:types`. Si una tabla o columna nueva no compila, tipar a mano en el módulo que la usa.
- **Prohibido** `bun run dev` y `next build` contra `.env.local` (apunta a producción).
- SQL directo sin JWT (SQL editor como `postgres`) no puede llamar funciones con guard: simular con `set_config('request.jwt.claims', …, true)`.

### 5.1 Base de datos
- **§1.1 allowlist**: se usan **hook y trigger a la vez** (el hook no corre en `auth.admin.createUser` ni en "Add user" del dashboard; el trigger cubre eso y el tiempo entre H8 y H5). Hook disponible en plan Free. Backfill: `lower(btrim(email))` con `WHERE email IS NOT NULL AND btrim(email) <> ''`. La tabla usa `text` + CHECK (no `citext`, que no está instalado).
- **§1.2 backfill**: solo si las columnas se crean en esa ejecución (bloque `DO` que detecta si ya existían), para que re-ejecutar no marque como onboardeados a usuarios nuevos.
- **§1.3 kit**:
  - Idempotencia: `_seed_starter_kit` no hace nada si el usuario tiene alguna categoría **activa** (`is_active = true`). Así quien borró todas puede recargar el kit.
  - Categorías: `INSERT … ON CONFLICT (name, user_id) DO UPDATE SET is_active = true` (reactiva las inactivas con el mismo nombre).
  - Rubros: se insertan con `NOT EXISTS` sobre `(template_id, category_id, lower(name))`. Antes de insertar se verifica que los 12 pares clasificación/control/estado resuelvan por nombre; si falta alguno, excepción (nada a medias).
  - Se mantienen el `pg_advisory_xact_lock` por usuario y la validación `YYYY-MM`.
  - Las FK `user_id` de `accounts`, `budget_templates` y `budget_items` apuntan a `profiles(id)` (`categories` a `auth.users`): sin perfil, la siembra falla con 23503 (ver §5.2 `ensureStarterKitAction`).
- **§1.4 funciones**: `copy_budget_items_from_template` **no validaba dueño**: guard + las dos plantillas deben ser de `p_user_id`. `get_previous_month_overspend` solo `service_role` (se revoca también `authenticated`). `get_budget_by_month`: guard, `search_path` fijo, sin EXECUTE para `PUBLIC`/`anon`, EXECUTE a `authenticated, service_role`. Las del grupo B ya tenían grants correctos: se traen al repo con el cuerpo intacto, salvo `copy_budget_items_from_template` (guard + chequeo de dueño, arriba).
- **§1.5 WhatsApp**: revincular se decide por `whatsapp_conversations.user_id <> <usuario nuevo>` (un número ya vinculado nunca llega al flujo de vinculación). Límite **fail-open**: si la tabla de intentos no se puede leer o escribir, no bloquea. `RedeemResult` suma `'link_failed'` (error de base; no cuenta como intento; el usuario ve `MSG_CODE_INVALID`). La migración borra códigos pendientes vencidos y duplicados antes de crear el índice.

### 5.2 TypeScript
- **§2.2 `translateAuthError`**: primero `code` **si es uno conocido**; si no hay `code` o no está en la tabla, `message`. El rechazo del hook llega sin `code` (message `signup_not_allowed`, 403); el del trigger con `code: 'unexpected_failure'` y message `Database error saving new user`: ambos casos con test. Filas nuevas:

  | Entrada | Texto |
  |---|---|
  | `enlace_invalido` | El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión. |
  | `same_password` | La contraseña nueva debe ser distinta de la anterior. |
  | `reauthentication_needed` | Por seguridad, pide un enlace nuevo para cambiar la contraseña. |

  Exporta `INVALID_LINK_ERROR_CODE`, `INVALID_LINK_LOGIN_PATH`, `GENERIC_AUTH_ERROR`. Implementación con `Map` (sin lookups en el prototipo).
- **§2.3 auth**:
  - `/auth/confirm` acepta también `?code=` (`exchangeCodeForSession`) por si la plantilla usa `{{ .ConfirmationURL }}`.
  - Sin `next` válido, `/auth/confirm` decide con `getPostLoginPath` (recovery → `/auth/reset-password`). Las plantillas de H4 no llevan `next` salvo recovery.
  - `forgotPasswordAction` **se traga todo error** de `resetPasswordForEmail` (incluido el límite de envíos: revelaría que el correo existe) y solo registra el `code`.
  - `registerAction` manda en `?error=` un código por campo y la página lo traduce con `resolveRegisterError` desde una lista cerrada.
  - La plantilla "Invite user" lleva `next=/auth/reset-password` (excepción a "sin next"): no invitar antes de desplegar S05, y el correo debe estar en la allowlist.
  - `resetPasswordAction`, tras `updateUser` exitoso, redirige con `getPostLoginPath` (no fijo a `/dashboard`): así el invitado que fija su contraseña ve `/bienvenida`.
  - `resetPasswordAction` y `/auth/reset-password` aceptan **cualquier** sesión, no solo una de recuperación: es intencional, porque las usan tanto el enlace de recuperación como la invitación, y no se distingue el tipo de sesión. Un usuario con sesión normal puede cambiar su contraseña sin dar la actual; si en Supabase se activa "Secure password change", `updateUser` devuelve `reauthentication_needed` y la página muestra el texto de esa fila (pedir un enlace nuevo).
  - Lógica de rutas del middleware en `src/lib/auth/route-access.ts` (S04).
- **§2.6 limpieza (S07)**: además borra `src/scripts/migrate-july-data.ts`, `src/scripts/migrate-july-expenses.ts`, los paneles sin uso `ExpenseMigrationPanel` y `BudgetMigrationPanel`, y el botón ligado a `'2025-07'` de `ExpenseHeader.tsx` (verificar con grep que nada los importe). "Primero crea una categoría" es la etiqueta del botón deshabilitado, más un aviso con enlace a `/settings`.
- **§2.7 onboarding**:
  - `ensureStarterKitAction(): Promise<{ seeded: boolean; error?: string }>` **nunca lanza**, no llama `revalidatePath` ni `redirect` (se ejecuta durante el render). Sin sesión → `{ seeded: false, error: 'no_session' }`; error de RPC (incluido 23503 o la función inexistente antes de H8) → `{ seeded: false, error: <code> }` y `console.warn` solo con el code. Los llamadores no necesitan try/catch.
  - `suggest503020`: `'Basico'` → 50 %; `'Estilo de Vida' | 'Caprichos' | 'Calidad de Vida'` → 30 %; el **20 % va siempre** a `ahorroSinAsignar` (más el porcentaje de cualquier grupo sin ítems). `'Impuestos'` → 0.
  - Checklist: el ítem `'alertas'` se **reemplaza** por `'presupuesto'` ("Ponle montos a tu presupuesto" → `/presupuesto`), hecho si hay algún `budget_items` del mes actual con `budgeted_amount > 0`. `ChecklistInput.hasExplicitAlerts` → `hasBudgetAmounts`. `deudaCount` cuenta solo deudas activas (verificar el nombre real de la columna de actividad en `supabase_ingresos_deudas.sql`).
  - Extras aceptados: `loadDashboardChecklist` (S12, nunca lanza, `null` = no mostrar), `src/lib/onboarding/wizard-data.ts` (S11), `src/lib/onboarding/budget-empty-state.ts` (S10). El paso 3 de la bienvenida reusa `createExpenseTransaction`.
  - `src/lib/actions/onboarding.ts` y su test los **crea S10** (solo `ensureStarterKitAction`); S11 y S12 los extienden.
- **§2.8 WhatsApp**: `unlinkWhatsAppPhoneAction(phoneE164)` se reemplaza por **`unlinkWhatsAppLinkAction(linkId: string): Promise<UnlinkLinkResult>`** con `UnlinkLinkResult = { ok: true } | { ok: false; error: string }`. Borra por `id` y `user_id` con el cliente de cookie; así el número completo no llega al navegador. `key` de la lista = `l.id`. S13 también actualiza `MSG_ALREADY_LINKED` (texto viejo "llegará muy pronto").

### 5.3 Orden y propiedad (reemplaza la tabla de §4)

Tres flujos en worktrees separados; dentro de cada uno, en serie:

| Flujo | Orden | Archivos adicionales a §4 |
|---|---|---|
| SEG | S01 → S02 → S03 → S09 | tests en `src/lib/supabase/migrations/`; `src/lib/onboarding/` **no** (S09 solo SQL + su test) |
| AUTH | S04 → S06 → S05 | `src/lib/auth/route-access.ts`, `src/app/auth/login/page.tsx`, `src/app/auth/reset-password/ResetPasswordForm.tsx`, `src/lib/constants/legal.ts` y contenidos legales |
| APP | S07 → S08 → S10 → S13 → S11 → S12 | `ExpenseModal.tsx`, `services/expenses.ts`, `src/lib/expense-form-defaults.ts`, `src/lib/budget/**`, `src/app/presupuesto/page.tsx`, `DashboardContent.tsx`, `UnlinkPhoneButton` (molecules), `settings/page.tsx`, `src/lib/actions/whatsapp.ts` |

Choques al integrar: `handle-linking.ts` (S02 en SEG, S13 en APP: líneas distintas), `.env.example` (S04 y S13: conservar ambos lados), `src/middleware.ts` (S04 y S15, flujo AUTH). S05 depende de `passwordSchema` de S06 (mismo flujo, va después).

### 5.4 Tareas humanas nuevas
- **H9**: cambiar `CONTACT_EMAIL` (`src/lib/constants/legal.ts`) por un buzón real antes de abrir el registro.
- **H10** (ADR-004) — **resuelta** el 2026-09-30: el middleware de la raíz no corría; S15 lo movió a `src/middleware.ts` (ver ADR-004 y `docs/agile/stories/S15-activar-middleware.md`). Texto original: en un preview de Vercel, abrir `/gastos` y `/bienvenida` en ventana privada sin sesión y revisar si el build muestra "ƒ Middleware". Si no redirigen al login, abrir la historia de bug de S04 que mueve `middleware.ts` a `src/middleware.ts`; si redirigen, anotarlo en ADR-004. Hasta entonces ninguna historia declara protección por middleware en sus criterios.

## Registro de cambios

- v2.3 (2026-09-30): H10 resuelta; el middleware vive en `src/middleware.ts` (§2.3, §4, §5.3) según [ADR-004](decisions/ADR-004-middleware-en-src.md) y [S15](stories/S15-activar-middleware.md). Las guardias de página redirigen a `/auth/login?redirectTo=<ruta>` para no formar bucle con el middleware.
- v2.2 (2026-09-30): fila `reauthentication_needed` en §2.2 y regla de sesión de `resetPasswordAction` (cualquier sesión, intencional) en §5.2 (S05).
- v2.1 (2026-09-30): tarea humana H10 y regla de no declarar protección por middleware hasta resolverla (ADR-004).
- v2 (2026-09-30): enmiendas §5 tras la planificación (13 planes, huecos consolidados).
- v1 (2026-09-30): versión inicial.
