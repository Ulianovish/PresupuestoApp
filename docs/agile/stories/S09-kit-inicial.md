# S09 — Kit inicial y columnas de onboarding Implementation Plan

> **Alineado con contratos v2 (§5).** §5.0: el test de texto vive en `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts` (helpers dentro del archivo). §5.3: **S09 no toca `src/lib/onboarding/`** (ni ningún otro archivo de la app): solo la migración SQL y su test. §5.1 (§1.2/§1.3): backfill de `profiles` solo si las columnas son nuevas; idempotencia por categorías **activas**; categorías con `ON CONFLICT (name, user_id) DO UPDATE SET is_active = true`; rubros con `NOT EXISTS` sobre `(template_id, category_id, lower(name))`; verificación previa de que los 12 rubros resuelven clasificación y control por nombre (si no, excepción antes de insertar nada; ya no se usa `ROW_COUNT <> 12`); se mantienen el `pg_advisory_xact_lock` por usuario y la validación `YYYY-MM`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sola migración que agrega las columnas de onboarding a `profiles` (con backfill para los usuarios existentes), crea la siembra idempotente del kit inicial (`_seed_starter_kit` interna + `ensure_starter_kit` pública) y hace que `handle_new_user` siembre el kit sin poder bloquear el registro.

**Architecture:** Todo vive en `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` (ADR-001: el kit está en un solo lugar, en SQL). No hay Postgres local: la migración se valida con un test de texto en vitest que lee el `.sql` (sin comentarios) y verifica firma, `SECURITY DEFINER`, `search_path`, grants, idempotencia y el contenido exacto del kit. Al final del `.sql` queda un bloque comentado de verificación manual para después de aplicar (tarea humana H8).

**Tech Stack:** PostgreSQL / PL/pgSQL (Supabase), vitest 4, TypeScript, bun.

## Global Constraints

- Fuente de verdad: `docs/agile/contracts.md` §0, §1.2, §1.3, las enmiendas v2 de §5.0/§5.1/§5.3 (prevalecen) y `docs/agile/decisions/ADR-001-siembra-kit-inicial.md`. Nombres exactos: `onboarding_completed_at`, `onboarding_dismissed_at`, `public._seed_starter_kit(p_user_id uuid, p_month_year text) RETURNS boolean`, `public.ensure_starter_kit() RETURNS boolean`, `public.handle_new_user()`.
- Toda SECURITY DEFINER lleva `SET search_path = public, pg_temp`.
- Migraciones idempotentes (`IF NOT EXISTS`, `CREATE OR REPLACE`). **La migración NO se aplica a producción** durante la implementación (tarea humana H8). Nada de `supabase db push`, `apply_migration` ni `execute_sql` de escritura.
- Mes actual en SQL: `to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM')`.
- La siembra NO llama `upsert_monthly_budget` (su guard falla dentro del trigger de signup, donde `auth.uid()` es NULL).
- Si un catálogo por nombre no existe, la función falla **antes de insertar nada** (y en el trigger queda en WARNING). No se inventan catálogos.
- **No se toca `src/lib/onboarding/`** (contratos §5.3): ese directorio es del flujo APP (S10–S12). S09 solo crea la migración y su test en `src/lib/supabase/migrations/`.
- `src/types/database.ts` no se regenera: **nunca** correr `bun run db:types` (§5.0).
- Datos personales: ningún correo, teléfono, cédula o nombre real en código, tests ni comentarios. En la verificación manual se usa `usuario@ejemplo.com` y UUIDs inventados.
- Verificación del proyecto: `bun run test && bun run type-check`. Commits con archivos en `src/` van normales (husky corre lint-staged sobre el test); commits de solo SQL/docs van con `git commit --no-verify`.
- Mensajes de commit en español y terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Archivos

- Crear: `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` — la migración completa (4 secciones + verificación comentada). Se construye por secciones: cada tarea **agrega al final** del archivo.
- Crear (test): `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts` — test de texto de la migración, con sus helpers dentro del archivo (convención de contratos §5.0; vitest solo recoge `src/**`). Cada tarea agrega un `describe` al final.
- No se toca ningún otro archivo; en particular **nada bajo `src/lib/onboarding/`** (§5.3). `src/types/database.ts` NO se regenera (§5.0: las columnas nuevas de `profiles` las tipan a mano los módulos de S10–S12 que las consultan).

## Esquema real de producción (leído con SELECT el 2026-09-30)

Lo que el plan asume y por qué el SQL se ve como se ve:

- `handle_new_user()` hoy (exacto, de `pg_get_functiondef`): `RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'`, cuerpo = `INSERT INTO public.profiles (id, email, full_name, avatar_url) VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url'); RETURN NEW;` (en prod el cuerpo tiene fin de línea CRLF; la migración lo escribe con LF, mismo significado). Trigger: `on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW`. Dueño `postgres` con `BYPASSRLS` (la siembra se salta RLS al correr como dueño).
- No existen todavía `_seed_starter_kit` ni `ensure_starter_kit` (no hay overload que chocar).
- `categories`: `id uuid default uuid_generate_v4()`, `name varchar(100) NOT NULL`, `user_id uuid NOT NULL` (FK `auth.users`), `description/color/icon` NULL, `is_active bool default true`. Único: `categories_name_user_id_key UNIQUE (name, user_id)`.
- `accounts`: `user_id NOT NULL` (FK **`profiles(id)`**), `name varchar(255) NOT NULL`, `type varchar(50) default 'bank'`, `is_active default true`. **Sin** único por nombre → la siembra usa `WHERE NOT EXISTS`.
- `budget_templates`: `user_id NOT NULL` (FK **`profiles(id)`**), `name varchar(255) NOT NULL`, `month_year varchar(7) NOT NULL default '2025-07'` (default viejo: siempre se pasa explícito), `is_active default true`. Único: índice `idx_budget_templates_user_month UNIQUE (user_id, month_year)` → sirve para `ON CONFLICT (user_id, month_year)`.
- `budget_items`: NOT NULL sin default: `user_id` (FK **`profiles(id)`**), `category_id`, `classification_id`, `control_id`, `status_id`, `name`. NOT NULL con default 0: `budgeted_amount`, `spent_amount`. Nullable: `template_id`, `alerts_enabled` (sin default), `account_id`, `deuda_id`, `description`, `due_date`, `real_amount`, `is_active` (default true). Todo NOT NULL está cubierto por el contrato.
- `profiles`: `id` (PK, FK `auth.users`), `email varchar(255) NOT NULL UNIQUE`, `full_name`, `avatar_url`, `created_at`, `updated_at`. Trigger `update_profiles_updated_at BEFORE UPDATE` (el backfill también toca `updated_at`; aceptable).
- Catálogos (únicos por `name`): `classifications` activas `Basico`, `Calidad de Vida`, `Caprichos`, `Estilo de Vida`, `Impuestos` (inactivas: `Discrecional`, `Fijo`, `Variable`); `controls` activos `Eliminar`, `Necesario`, `Reducir`, `Simplificar` (inactivo: `Discrecional`); `budget_statuses` `Activo`, `Cancelado`, `Completado`, `Inactivo`. Todos los nombres que usa el kit existen y están activos.

## Criterios de aceptación

- [x] Migración `20260930130000_kit_inicial_y_onboarding.sql`: columnas `onboarding_completed_at` y `onboarding_dismissed_at` (`timestamptz`) en `profiles` con `ADD COLUMN IF NOT EXISTS`; los usuarios existentes quedan con ambas en `now()`; volver a correr la migración no marca a usuarios nuevos.
- [x] `_seed_starter_kit(p_user_id uuid, p_month_year text) RETURNS boolean`: SECURITY DEFINER, `search_path` fijo, sin EXECUTE para nadie salvo el dueño (`REVOKE … FROM PUBLIC, anon, authenticated, service_role`, sin `GRANT`).
- [x] Idempotente: si el usuario ya tiene alguna categoría **activa** (`is_active = true`) devuelve `false` sin insertar nada; quien las desactivó todas puede recargar el kit; siembras concurrentes del mismo usuario se serializan (`pg_advisory_xact_lock`).
- [x] Kit exacto de contratos §1.3: 6 categorías en MAYÚSCULAS activas (`ON CONFLICT (name, user_id) DO UPDATE SET is_active = true`: reactiva las que existían inactivas con el mismo nombre), 12 rubros con su clasificación, control y `alerts_enabled`, `budgeted_amount = 0`, estado `Activo`, plantilla del mes, insertados con `NOT EXISTS` sobre `(template_id, category_id, lower(name))` (recargar el kit no duplica rubros); cuenta `Efectivo` (`type='cash'`) solo si no existe; plantilla `'Presupuesto ' || mes` con `ON CONFLICT (user_id, month_year) DO NOTHING`.
- [x] Antes del primer `INSERT` se verifica que exista el estado `Activo` y que los 12 rubros resuelvan clasificación y control por nombre; si falta alguno, excepción y nada a medias (no se usa `ROW_COUNT <> 12`).
- [x] `ensure_starter_kit()` sin parámetro de usuario: SECURITY DEFINER, `search_path` fijo, `auth.uid()` NULL → `42501`; devuelve `_seed_starter_kit(auth.uid(), <mes Bogotá>)`; EXECUTE solo `authenticated`.
- [x] `handle_new_user()` conserva idéntico el insert de `profiles` y **después** llama la siembra dentro de `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END;`; mantiene sus grants.
- [x] Nada en la migración llama `upsert_monthly_budget`.
- [x] Bloque comentado de verificación manual al final (simulando `request.jwt.claims` como en `20260929000000`), todo con `ROLLBACK`.
- [x] `bun run test && bun run type-check` en verde.

---

### Task 1: Columnas de onboarding en `profiles` con backfill

**Files:**
- Create: `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql`
- Create (test): `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: columnas `public.profiles.onboarding_completed_at timestamptz` y `public.profiles.onboarding_dismissed_at timestamptz` (NULL = pendiente). En el test: constantes `rawSql`, `code` (SQL sin comentarios) y helpers `squash(s)` y `functionBlock(name)` que usan las tareas 2–4.

- [x] **Step 1: Write the failing test**

Crear `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay Postgres local (contratos §0). Se lee el .sql y se
// verifican las piezas que importan para la seguridad y el contenido del kit.
const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql',
);

const rawSql = readFileSync(MIGRATION_PATH, 'utf8');

/** SQL sin comentarios `--`: ningún assert debe pasar por texto comentado. */
const code = rawSql.replace(/--[^\n]*/g, '');

/** Colapsa espacios y saltos de línea para comparar frases de SQL. */
const squash = (s: string): string => s.replace(/\s+/g, ' ').trim();

/** Bloque `CREATE OR REPLACE FUNCTION public.<name>(` … `$function$;` (sin comentarios). */
function functionBlock(name: string): string {
  const start = code.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`No está la función ${name}`);
  const end = code.indexOf('$function$;', start);
  if (end === -1) throw new Error(`La función ${name} no cierra con $function$;`);
  return code.slice(start, end + '$function$;'.length);
}

describe('migración 20260930130000: columnas de onboarding en profiles', () => {
  it('agrega las dos columnas timestamptz de forma idempotente', () => {
    expect(code).toMatch(
      /ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz/,
    );
    expect(code).toMatch(
      /ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz/,
    );
  });

  it('hace backfill de ambas columnas con now()', () => {
    expect(squash(code)).toContain(
      'UPDATE public.profiles SET onboarding_completed_at = now(), onboarding_dismissed_at = now();',
    );
  });

  it('el backfill solo corre cuando las columnas son nuevas (re-ejecutar no marca usuarios nuevos)', () => {
    const flat = squash(code);
    expect(flat).toContain(
      "v_columnas_nuevas := NOT EXISTS ( SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed_at' );",
    );
    const detect = flat.indexOf('v_columnas_nuevas := NOT EXISTS');
    const alter = flat.indexOf('ALTER TABLE public.profiles');
    const guard = flat.indexOf('IF v_columnas_nuevas THEN');
    const update = flat.indexOf('UPDATE public.profiles');
    expect(detect).toBeGreaterThan(-1);
    expect(detect).toBeLessThan(alter);
    expect(alter).toBeLessThan(guard);
    expect(guard).toBeLessThan(update);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: FAIL — el archivo de test no carga: `ENOENT: no such file or directory, open '…/supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql'`.

- [x] **Step 3: Write minimal implementation**

Crear `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` con este contenido exacto:

```sql
-- Kit inicial y columnas de onboarding (S09).
-- Contratos: docs/agile/contracts.md §1.2, §1.3 y enmiendas v2 §5.1. Decisión: ADR-001.
--
-- 1. profiles gana onboarding_completed_at / onboarding_dismissed_at. Los
--    usuarios que ya existen quedan con ambas en now(): no ven la bienvenida ni
--    la checklist. El backfill solo corre la vez que se crean las columnas, así
--    que re-ejecutar la migración no marca como "ya hizo onboarding" a nadie
--    que se haya registrado después.
-- 2. _seed_starter_kit(p_user_id, p_month_year): interna, idempotente (si el
--    usuario ya tiene alguna categoría ACTIVA no hace nada y devuelve false;
--    quien las desactivó todas puede recargar el kit). Antes de insertar nada
--    verifica que el estado Activo y los 12 pares clasificación/control
--    resuelvan por nombre. Inserta (o reactiva) 6 categorías, la cuenta
--    Efectivo, la plantilla del mes y los rubros que falten (NOT EXISTS por
--    plantilla + categoría + lower(nombre)) en la misma transacción. NO usa
--    upsert_monthly_budget: su guard exige auth.uid() = p_user_id y dentro del
--    trigger de signup auth.uid() es NULL. Sin EXECUTE para nadie salvo el
--    dueño (postgres).
-- 3. ensure_starter_kit(): pública para authenticated, sin parámetro de
--    usuario (no se puede apuntar a otro). La llaman /bienvenida y el
--    dashboard para reparar a quien el trigger le falló.
-- 4. handle_new_user(): mismo insert de profiles y DESPUÉS la siembra dentro de
--    BEGIN … EXCEPTION WHEN OTHERS → WARNING: un error del kit nunca bloquea
--    el registro.
--
-- OJO: accounts, budget_templates y budget_items tienen FK user_id → profiles(id).
-- La siembra necesita que el perfil exista (en el trigger se inserta justo antes);
-- sin perfil falla con 23503 (ensureStarterKitAction lo devuelve como error, §5.2).


-- ============================================================================
-- 1. profiles: columnas de onboarding + backfill de usuarios existentes
-- ============================================================================
DO $migracion$
DECLARE
    v_columnas_nuevas boolean;
BEGIN
    v_columnas_nuevas := NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'onboarding_completed_at'
    );

    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

    IF v_columnas_nuevas THEN
        UPDATE public.profiles
           SET onboarding_completed_at = now(),
               onboarding_dismissed_at = now();
    END IF;
END
$migracion$;
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: PASS — 3 tests.

- [x] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): columnas de onboarding en profiles con backfill

Los usuarios existentes quedan con onboarding completado y checklist
oculta; el backfill solo corre la vez que se crean las columnas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `_seed_starter_kit` idempotente con el kit exacto

**Files:**
- Modify: `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` (agregar al final)
- Modify (test): `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts` (agregar al final)

**Interfaces:**
- Consumes: helpers del test de la Task 1 (`code`, `squash`, `functionBlock`).
- Produces: `public._seed_starter_kit(p_user_id uuid, p_month_year text) RETURNS boolean` — `true` si sembró (o recargó el kit a quien no tenía categorías activas), `false` si el usuario ya tenía alguna categoría activa; lanza excepción si el mes es inválido o falta un catálogo (antes de insertar nada). Solo la pueden ejecutar el dueño y otras funciones SECURITY DEFINER del dueño (`ensure_starter_kit`, `handle_new_user`).

- [x] **Step 1: Write the failing test**

Agregar al final de `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`:

```ts
// Kit exacto de contratos §1.3. 'NULL' = alerts_enabled null (hereda el
// comportamiento por defecto); 'true' = alertas activadas explícitamente.
const KIT_CATEGORIES = [
  'VIVIENDA',
  'MERCADO',
  'TRANSPORTE',
  'SALUD',
  'DEUDAS',
  'OTROS',
];

const KIT_ITEMS: Array<[string, string, string, string, 'NULL' | 'true']> = [
  ['VIVIENDA', 'Arriendo o cuota', 'Basico', 'Necesario', 'NULL'],
  ['VIVIENDA', 'Servicios públicos', 'Basico', 'Necesario', 'true'],
  ['VIVIENDA', 'Internet', 'Calidad de Vida', 'Simplificar', 'NULL'],
  ['MERCADO', 'Mercado', 'Basico', 'Necesario', 'true'],
  ['MERCADO', 'Aseo del hogar', 'Basico', 'Necesario', 'true'],
  ['TRANSPORTE', 'Transporte', 'Basico', 'Necesario', 'true'],
  ['TRANSPORTE', 'Vehículo', 'Basico', 'Reducir', 'true'],
  ['SALUD', 'Salud', 'Basico', 'Necesario', 'NULL'],
  ['SALUD', 'Droguería', 'Basico', 'Necesario', 'true'],
  ['DEUDAS', 'Tarjetas', 'Basico', 'Necesario', 'NULL'],
  ['DEUDAS', 'Créditos', 'Basico', 'Necesario', 'NULL'],
  ['OTROS', 'Otros', 'Estilo de Vida', 'Reducir', 'true'],
];

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('migración 20260930130000: _seed_starter_kit', () => {
  const seed = () => squash(functionBlock('_seed_starter_kit'));

  it('tiene la firma del contrato (uuid, text) y devuelve boolean', () => {
    expect(seed()).toMatch(
      /^CREATE OR REPLACE FUNCTION public\._seed_starter_kit\(p_user_id uuid, p_month_year text\) RETURNS boolean/,
    );
  });

  it('es SECURITY DEFINER con search_path fijo', () => {
    expect(seed()).toMatch(/\bSECURITY DEFINER\b/);
    expect(seed()).toContain('SET search_path = public, pg_temp');
  });

  it('no tiene EXECUTE para nadie salvo el dueño', () => {
    expect(squash(code)).toContain(
      'REVOKE EXECUTE ON FUNCTION public._seed_starter_kit(uuid, text) FROM PUBLIC, anon, authenticated, service_role;',
    );
    expect(code).not.toMatch(/GRANT EXECUTE ON FUNCTION public\._seed_starter_kit/);
  });

  it('no tiene guard de usuario (es interna) ni llama upsert_monthly_budget', () => {
    expect(seed()).not.toContain('auth.uid()');
    expect(code).not.toMatch(/upsert_monthly_budget/);
  });

  it('valida el mes con formato YYYY-MM antes de tocar nada', () => {
    const body = seed();
    const check = body.indexOf(
      "IF p_month_year IS NULL OR p_month_year !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION",
    );
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf('INSERT INTO'));
  });

  it('serializa siembras concurrentes del mismo usuario antes del chequeo de idempotencia', () => {
    const body = seed();
    const lock = body.indexOf(
      "PERFORM pg_advisory_xact_lock(hashtextextended('seed_starter_kit:' || p_user_id::text, 0));",
    );
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(
      body.indexOf('IF EXISTS (SELECT 1 FROM public.categories'),
    );
  });

  it('es idempotente por categorías ACTIVAS: si tiene alguna devuelve false sin insertar', () => {
    const body = seed();
    const check = body.indexOf(
      'IF EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND is_active = true) THEN RETURN false; END IF;',
    );
    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(body.indexOf('INSERT INTO'));
    expect(body).toMatch(/RETURN true; END;/);
  });

  it('crea exactamente las 6 categorías del kit, en MAYÚSCULAS y activas (reactiva las inactivas)', () => {
    const match = seed().match(
      /INSERT INTO public\.categories \(user_id, name, is_active\) SELECT p_user_id, c\.name, true FROM \(VALUES (.*?)\) AS c\(name\) ON CONFLICT \(name, user_id\) DO UPDATE SET is_active = true;/,
    );
    expect(match).not.toBeNull();
    const names = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      m => m[1],
    );
    expect(names).toEqual(KIT_CATEGORIES);
  });

  it('crea los 12 rubros exactos con su clasificación, control y alertas', () => {
    const body = seed();
    for (const [cat, rubro, clas, ctrl, alerts] of KIT_ITEMS) {
      const alertsSql = alerts === 'NULL' ? 'NULL::boolean' : 'true';
      const row = new RegExp(
        `\\('${escapeRegExp(cat)}', '${escapeRegExp(rubro)}', '${escapeRegExp(clas)}', '${escapeRegExp(ctrl)}', ${escapeRegExp(alertsSql)}\\)`,
      );
      expect(body, `${cat} / ${rubro}`).toMatch(row);
    }
    const rows =
      body.match(
        /\('(VIVIENDA|MERCADO|TRANSPORTE|SALUD|DEUDAS|OTROS)', '[^']+', '[^']+', '[^']+', (NULL::boolean|true)\)/g,
      ) ?? [];
    expect(rows).toHaveLength(12);
  });

  it('los rubros quedan en 0, activos, en estado Activo, del usuario y en la plantilla del mes', () => {
    const body = seed();
    expect(body).toContain(
      "SELECT id INTO v_status_id FROM public.budget_statuses WHERE name = 'Activo';",
    );
    expect(body).toContain(
      "INSERT INTO public.budget_items (user_id, template_id, category_id, classification_id, control_id, status_id, name, budgeted_amount, is_active, alerts_enabled) SELECT p_user_id, v_template_id, cat.id, (kit.item->>'classification_id')::uuid, (kit.item->>'control_id')::uuid, v_status_id, kit.item->>'rubro', 0, true, (kit.item->>'alerts')::boolean FROM jsonb_array_elements(v_kit) AS kit(item)",
    );
    expect(body).toContain(
      "JOIN public.categories cat ON cat.user_id = p_user_id AND cat.name = kit.item->>'categoria'",
    );
  });

  it('no duplica rubros: NOT EXISTS sobre (template_id, category_id, lower(name))', () => {
    const body = seed();
    const insert = body.indexOf('INSERT INTO public.budget_items');
    const notExists = body.indexOf(
      "WHERE NOT EXISTS ( SELECT 1 FROM public.budget_items bi WHERE bi.template_id = v_template_id AND bi.category_id = cat.id AND lower(bi.name) = lower(kit.item->>'rubro') );",
    );
    expect(insert).toBeGreaterThan(-1);
    expect(notExists).toBeGreaterThan(insert);
  });

  it('verifica los catálogos ANTES de insertar nada y falla en vez de inventarlos', () => {
    const body = seed();
    const firstInsert = body.indexOf('INSERT INTO');
    const status = body.search(/IF v_status_id IS NULL THEN RAISE EXCEPTION/);
    const resolve = body.indexOf(
      'LEFT JOIN public.classifications cl ON cl.name = k.clasificacion LEFT JOIN public.controls co ON co.name = k.control;',
    );
    const check = body.search(
      /IF v_total <> 12 OR v_resueltos <> 12 THEN RAISE EXCEPTION/,
    );
    expect(status).toBeGreaterThan(-1);
    expect(resolve).toBeGreaterThan(-1);
    expect(check).toBeGreaterThan(resolve);
    expect(status).toBeLessThan(firstInsert);
    expect(check).toBeLessThan(firstInsert);
    expect(body).toContain(
      'count(*) FILTER (WHERE cl.id IS NOT NULL AND co.id IS NOT NULL)',
    );
    // Con NOT EXISTS una recarga puede insertar menos de 12: el conteo posterior ya no sirve.
    expect(body).not.toContain('ROW_COUNT');
    expect(code).not.toMatch(
      /INSERT INTO public\.(classifications|controls|budget_statuses)/,
    );
  });

  it('crea la cuenta Efectivo (cash) solo si no existe una con ese nombre', () => {
    const body = seed();
    expect(body).toContain(
      "INSERT INTO public.accounts (user_id, name, type, is_active) SELECT p_user_id, 'Efectivo', 'cash', true WHERE NOT EXISTS ( SELECT 1 FROM public.accounts a WHERE a.user_id = p_user_id AND lower(btrim(a.name)) = 'efectivo' );",
    );
  });

  it('crea la plantilla del mes con ON CONFLICT y toma su id', () => {
    const body = seed();
    expect(body).toContain(
      "INSERT INTO public.budget_templates (user_id, name, month_year, is_active) VALUES (p_user_id, 'Presupuesto ' || p_month_year, p_month_year, true) ON CONFLICT (user_id, month_year) DO NOTHING;",
    );
    expect(body).toContain(
      'SELECT id INTO v_template_id FROM public.budget_templates WHERE user_id = p_user_id AND month_year = p_month_year;',
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: FAIL — los 14 tests nuevos fallan con `Error: No está la función _seed_starter_kit` (o, en el de REVOKE, con el `toContain` sin match); los 3 de la Task 1 siguen en PASS.

- [x] **Step 3: Write minimal implementation**

Agregar al final de `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql`:

```sql


-- ============================================================================
-- 2. _seed_starter_kit: siembra interna e idempotente del kit inicial
-- ============================================================================
CREATE OR REPLACE FUNCTION public._seed_starter_kit(p_user_id uuid, p_month_year text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_status_id   uuid;
    v_template_id uuid;
    v_kit         jsonb;
    v_total       integer;
    v_resueltos   integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'seed_starter_kit: falta el usuario' USING ERRCODE = '22004';
    END IF;
    IF p_month_year IS NULL OR p_month_year !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'seed_starter_kit: mes inválido %', p_month_year USING ERRCODE = '22023';
    END IF;

    -- Dos siembras del mismo usuario a la vez (bienvenida + dashboard) se
    -- esperan una a la otra; la segunda ve las categorías y devuelve false.
    PERFORM pg_advisory_xact_lock(hashtextextended('seed_starter_kit:' || p_user_id::text, 0));

    -- Idempotencia: quien ya tiene alguna categoría ACTIVA no se toca. Quien
    -- las desactivó todas puede recargar el kit.
    IF EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND is_active = true) THEN
        RETURN false;
    END IF;

    -- Catálogos ANTES de insertar nada: si falta uno, excepción y nada a medias.
    -- No se inventan catálogos.
    SELECT id INTO v_status_id FROM public.budget_statuses WHERE name = 'Activo';
    IF v_status_id IS NULL THEN
        RAISE EXCEPTION 'seed_starter_kit: no existe el estado Activo';
    END IF;

    -- Los 12 rubros del kit con su clasificación y control resueltos por nombre.
    -- v_total <> 12 = algún nombre de catálogo repetido; v_resueltos <> 12 =
    -- falta una clasificación o un control. El resultado queda en v_kit y el
    -- INSERT de rubros lo lee de ahí (el kit se escribe una sola vez).
    SELECT count(*),
           count(*) FILTER (WHERE cl.id IS NOT NULL AND co.id IS NOT NULL),
           jsonb_agg(jsonb_build_object(
               'categoria', k.categoria,
               'rubro', k.rubro,
               'classification_id', cl.id,
               'control_id', co.id,
               'alerts', k.alerts
           ))
      INTO v_total, v_resueltos, v_kit
    FROM (VALUES
        ('VIVIENDA',   'Arriendo o cuota',   'Basico',          'Necesario',   NULL::boolean),
        ('VIVIENDA',   'Servicios públicos', 'Basico',          'Necesario',   true),
        ('VIVIENDA',   'Internet',           'Calidad de Vida', 'Simplificar', NULL::boolean),
        ('MERCADO',    'Mercado',            'Basico',          'Necesario',   true),
        ('MERCADO',    'Aseo del hogar',     'Basico',          'Necesario',   true),
        ('TRANSPORTE', 'Transporte',         'Basico',          'Necesario',   true),
        ('TRANSPORTE', 'Vehículo',           'Basico',          'Reducir',     true),
        ('SALUD',      'Salud',              'Basico',          'Necesario',   NULL::boolean),
        ('SALUD',      'Droguería',          'Basico',          'Necesario',   true),
        ('DEUDAS',     'Tarjetas',           'Basico',          'Necesario',   NULL::boolean),
        ('DEUDAS',     'Créditos',           'Basico',          'Necesario',   NULL::boolean),
        ('OTROS',      'Otros',              'Estilo de Vida',  'Reducir',     true)
    ) AS k(categoria, rubro, clasificacion, control, alerts)
    LEFT JOIN public.classifications cl ON cl.name = k.clasificacion
    LEFT JOIN public.controls co ON co.name = k.control;

    IF v_total <> 12 OR v_resueltos <> 12 THEN
        RAISE EXCEPTION 'seed_starter_kit: de 12 rubros solo % resuelven clasificación y control por nombre (filas: %)', v_resueltos, v_total;
    END IF;

    -- Categorías (MAYÚSCULAS, activas). Si ya existían inactivas con el mismo
    -- nombre, se reactivan (único: categories_name_user_id_key).
    INSERT INTO public.categories (user_id, name, is_active)
    SELECT p_user_id, c.name, true
    FROM (VALUES
        ('VIVIENDA'),
        ('MERCADO'),
        ('TRANSPORTE'),
        ('SALUD'),
        ('DEUDAS'),
        ('OTROS')
    ) AS c(name)
    ON CONFLICT (name, user_id) DO UPDATE SET is_active = true;

    -- Cuenta Efectivo, si no hay una con ese nombre (accounts no tiene único por nombre)
    INSERT INTO public.accounts (user_id, name, type, is_active)
    SELECT p_user_id, 'Efectivo', 'cash', true
    WHERE NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.user_id = p_user_id
          AND lower(btrim(a.name)) = 'efectivo'
    );

    -- Plantilla del mes (único: idx_budget_templates_user_month)
    INSERT INTO public.budget_templates (user_id, name, month_year, is_active)
    VALUES (p_user_id, 'Presupuesto ' || p_month_year, p_month_year, true)
    ON CONFLICT (user_id, month_year) DO NOTHING;

    SELECT id INTO v_template_id
    FROM public.budget_templates
    WHERE user_id = p_user_id AND month_year = p_month_year;

    -- Rubros ya resueltos (v_kit). Los que ya estén en la plantilla (misma
    -- categoría y mismo nombre sin distinguir mayúsculas) no se repiten: una
    -- recarga del kit puede insertar menos de 12, y está bien.
    INSERT INTO public.budget_items (user_id, template_id, category_id, classification_id, control_id, status_id, name, budgeted_amount, is_active, alerts_enabled)
    SELECT p_user_id, v_template_id, cat.id, (kit.item->>'classification_id')::uuid, (kit.item->>'control_id')::uuid, v_status_id, kit.item->>'rubro', 0, true, (kit.item->>'alerts')::boolean
    FROM jsonb_array_elements(v_kit) AS kit(item)
    JOIN public.categories cat ON cat.user_id = p_user_id AND cat.name = kit.item->>'categoria'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.budget_items bi
        WHERE bi.template_id = v_template_id
          AND bi.category_id = cat.id
          AND lower(bi.name) = lower(kit.item->>'rubro')
    );

    RETURN true;
END;
$function$;

-- Interna: solo el dueño (postgres). ensure_starter_kit y handle_new_user la
-- llaman como SECURITY DEFINER, así que el chequeo de EXECUTE es contra el dueño.
-- service_role también se revoca: los default privileges de Supabase se lo dan.
REVOKE EXECUTE ON FUNCTION public._seed_starter_kit(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: PASS — 17 tests.

- [x] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): siembra idempotente del kit inicial

_seed_starter_kit crea (o reactiva) 6 categorías, la cuenta Efectivo,
la plantilla del mes y los 12 rubros que falten; no hace nada si el
usuario ya tiene categorías activas y falla antes de insertar si falta
un catálogo. Sin EXECUTE para nadie salvo el dueño.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `ensure_starter_kit()` para el usuario de la sesión

**Files:**
- Modify: `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` (agregar al final)
- Modify (test): `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `public._seed_starter_kit(uuid, text) RETURNS boolean` (Task 2).
- Produces: `public.ensure_starter_kit() RETURNS boolean` — RPC `supabase.rpc('ensure_starter_kit')` con el cliente de cookie (lo usará `ensureStarterKitAction()`, que crea S10 y extienden S11/S12, contratos §2.7 y §5.2; no se crea en esta historia). Sin sesión → error `42501 'no autorizado'`.

- [x] **Step 1: Write the failing test**

Agregar al final de `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`:

```ts
describe('migración 20260930130000: ensure_starter_kit', () => {
  const ensure = () => squash(functionBlock('ensure_starter_kit'));

  it('no recibe parámetros (no se puede apuntar a otro usuario) y devuelve boolean', () => {
    expect(ensure()).toMatch(
      /^CREATE OR REPLACE FUNCTION public\.ensure_starter_kit\(\) RETURNS boolean/,
    );
  });

  it('es SECURITY DEFINER con search_path fijo', () => {
    expect(ensure()).toMatch(/\bSECURITY DEFINER\b/);
    expect(ensure()).toContain('SET search_path = public, pg_temp');
  });

  it('exige sesión: auth.uid() NULL lanza 42501', () => {
    const body = ensure();
    expect(body).toContain('v_uid uuid := auth.uid();');
    expect(body).toContain(
      "IF v_uid IS NULL THEN RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501'; END IF;",
    );
  });

  it('siembra al usuario de la sesión con el mes actual de Bogotá', () => {
    expect(ensure()).toContain(
      "RETURN public._seed_starter_kit(v_uid, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));",
    );
  });

  it('EXECUTE solo para authenticated', () => {
    const flat = squash(code);
    expect(flat).toContain(
      'REVOKE EXECUTE ON FUNCTION public.ensure_starter_kit() FROM PUBLIC, anon, service_role;',
    );
    const grants = [
      ...flat.matchAll(
        /GRANT EXECUTE ON FUNCTION public\.ensure_starter_kit\(\) TO ([^;]+);/g,
      ),
    ].map(m => m[1].trim());
    expect(grants).toEqual(['authenticated']);
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: FAIL — los 5 tests nuevos fallan (`Error: No está la función ensure_starter_kit`, y el de grants con `expected [] to deeply equal [ 'authenticated' ]` o el `toContain` del REVOKE sin match); los 17 anteriores en PASS.

- [x] **Step 3: Write minimal implementation**

Agregar al final de `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql`:

```sql


-- ============================================================================
-- 3. ensure_starter_kit: reparación para el usuario de la sesión
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_starter_kit()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN public._seed_starter_kit(v_uid, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
END;
$function$;

-- Solo authenticated (cliente de cookie). service_role no tiene auth.uid():
-- se revoca también porque los default privileges de Supabase se lo dan.
REVOKE EXECUTE ON FUNCTION public.ensure_starter_kit() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_starter_kit() TO authenticated;
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: PASS — 22 tests.

- [x] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): ensure_starter_kit para reparar el kit desde la app

Sin parámetro de usuario: siembra a auth.uid() con el mes de Bogotá.
Sin sesión lanza 42501. EXECUTE solo para authenticated.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `handle_new_user` siembra el kit sin bloquear el registro + verificación manual

**Files:**
- Modify: `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql` (agregar al final)
- Modify (test): `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts` (agregar al final)

**Interfaces:**
- Consumes: `public._seed_starter_kit(uuid, text)` (Task 2); columnas de onboarding (Task 1) — un usuario nuevo queda con ambas en NULL (pendiente), que es lo que leen `getPostLoginPath` (S04) y la checklist (S12).
- Produces: `public.handle_new_user() RETURNS trigger` con la misma firma (el trigger `on_auth_user_created` no se toca).

- [x] **Step 1: Write the failing test**

Agregar al final de `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`:

```ts
describe('migración 20260930130000: handle_new_user', () => {
  const handle = () => squash(functionBlock('handle_new_user'));

  const PROFILE_INSERT =
    "INSERT INTO public.profiles (id, email, full_name, avatar_url) VALUES ( NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url' );";
  const SEED_BLOCK =
    "BEGIN PERFORM public._seed_starter_kit(NEW.id, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM')); EXCEPTION WHEN OTHERS THEN RAISE WARNING 'seed_starter_kit falló para %: %', NEW.id, SQLERRM; END;";

  it('conserva la firma de trigger, SECURITY DEFINER y search_path fijo', () => {
    expect(handle()).toMatch(
      /^CREATE OR REPLACE FUNCTION public\.handle_new_user\(\) RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS \$function\$/,
    );
  });

  it('conserva idéntico el insert de profiles', () => {
    expect(handle()).toContain(PROFILE_INSERT);
  });

  it('siembra el kit DESPUÉS del perfil, dentro de BEGIN … EXCEPTION WHEN OTHERS', () => {
    const body = handle();
    const profile = body.indexOf(PROFILE_INSERT);
    const seed = body.indexOf(SEED_BLOCK);
    const ret = body.indexOf('RETURN NEW;');
    expect(profile).toBeGreaterThan(-1);
    expect(seed).toBeGreaterThan(profile);
    expect(ret).toBeGreaterThan(seed);
  });

  it('el WARNING no incluye el correo del usuario', () => {
    expect(handle()).not.toMatch(/RAISE WARNING[^;]*NEW\.email/);
  });

  it('no toca el trigger on_auth_user_created y mantiene los grants de la función', () => {
    expect(code).not.toMatch(/DROP TRIGGER/);
    const flat = squash(code);
    expect(flat).toContain(
      'REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;',
    );
    expect(flat).toContain(
      'GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;',
    );
  });
});

describe('migración 20260930130000: verificación manual', () => {
  it('termina con un bloque de verificación totalmente comentado', () => {
    const marker = rawSql.indexOf('-- VERIFICACIÓN');
    expect(marker).toBeGreaterThan(-1);
    const tail = rawSql
      .slice(marker)
      .split('\n')
      .filter(line => line.trim() !== '');
    expect(tail.every(line => line.trimStart().startsWith('--'))).toBe(true);
  });

  it('simula jwt claims y deshace todo con ROLLBACK', () => {
    const tail = rawSql.slice(rawSql.indexOf('-- VERIFICACIÓN'));
    expect(tail).toContain('request.jwt.claims');
    expect(tail).toContain('ensure_starter_kit()');
    expect(tail).toContain('ROLLBACK;');
    expect(tail).toContain('usuario@ejemplo.com');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: FAIL — los 7 tests nuevos fallan (`Error: No está la función handle_new_user`, `expected -1 to be greater than -1` en el marcador de verificación, `toContain` sin match en los grants); los 22 anteriores en PASS.

- [x] **Step 3: Write minimal implementation**

Agregar al final de `supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql`:

```sql


-- ============================================================================
-- 4. handle_new_user: perfil (idéntico a producción) + kit inicial
--    El cuerpo del perfil es el de pg_get_functiondef leído el 2026-09-30.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Kit inicial (ADR-001). Un error aquí NUNCA bloquea el registro: el
    -- subbloque deshace solo la siembra y ensure_starter_kit la repara después.
    BEGIN
        PERFORM public._seed_starter_kit(NEW.id, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'seed_starter_kit falló para %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

-- Mismos grants que dejó 20260929000000 (CREATE OR REPLACE los conserva;
-- se repiten para que esta migración sea autosuficiente).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;


-- ============================================================================
-- VERIFICACIÓN (correr a mano DESPUÉS de aplicar — tarea H8; todo va con ROLLBACK)
-- ============================================================================
--
-- 1) Columnas y backfill (esperado: 0 y 0):
-- SELECT count(*) FILTER (WHERE onboarding_completed_at IS NULL) AS sin_completed,
--        count(*) FILTER (WHERE onboarding_dismissed_at IS NULL) AS sin_dismissed
-- FROM public.profiles;
--
-- 2) Grants y search_path (esperado: _seed_starter_kit = solo postgres;
--    ensure_starter_kit = postgres,authenticated; handle_new_user =
--    postgres,supabase_auth_admin,service_role; las tres con search_path=public, pg_temp):
-- SELECT p.oid::regprocedure AS fn, p.proconfig,
--        (SELECT string_agg(CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE g.grantee::regrole::text END, ',')
--           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
--          WHERE g.privilege_type = 'EXECUTE') AS execute_para
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.proname IN ('_seed_starter_kit', 'ensure_starter_kit', 'handle_new_user')
-- ORDER BY 1;
--
-- 3) anon no puede ejecutar ninguna (esperado: ERROR 42501 permission denied):
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SET LOCAL request.jwt.claims = '{"role":"anon"}';
--   SELECT public.ensure_starter_kit();
-- ROLLBACK;
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
--   SELECT public._seed_starter_kit('11111111-1111-1111-1111-111111111111', '2026-09');
-- ROLLBACK;   -- esperado: ERROR 42501 permission denied for function _seed_starter_kit
--
-- 4) authenticated sin sub (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
--   SELECT public.ensure_starter_kit();
-- ROLLBACK;
--
-- 5) Alta de un usuario de prueba: el trigger crea perfil + kit; ensure es
--    idempotente y repara a quien no tiene categorías. Todo se deshace.
--    Si S03 ya está aplicada, antes del INSERT en auth.users agregar:
--    INSERT INTO public.signup_allowlist(email) VALUES ('usuario@ejemplo.com');
-- BEGIN;
--   INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
--   VALUES ('22222222-2222-2222-2222-222222222222', 'usuario@ejemplo.com', '{}'::jsonb, 'authenticated', 'authenticated');
--   SELECT count(*) FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 6
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 12
--   SELECT count(*) FROM public.accounts     WHERE user_id = '22222222-2222-2222-2222-222222222222' AND name = 'Efectivo';  -- 1
--   SELECT name, month_year FROM public.budget_templates WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 'Presupuesto <mes>', mes de Bogotá
--   SELECT c.name, bi.name, cl.name, co.name, bi.alerts_enabled, bi.budgeted_amount
--   FROM public.budget_items bi
--   JOIN public.categories c ON c.id = bi.category_id
--   JOIN public.classifications cl ON cl.id = bi.classification_id
--   JOIN public.controls co ON co.id = bi.control_id
--   WHERE bi.user_id = '22222222-2222-2222-2222-222222222222'
--   ORDER BY 1, 2;                                                   -- tabla de contratos §1.3
--   SELECT onboarding_completed_at IS NULL, onboarding_dismissed_at IS NULL
--   FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222';  -- true, true
--
--   SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- false (ya tiene kit)
--   RESET ROLE;
--   SELECT count(*) FROM public.categories WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- sigue en 6
--
--   -- Desactivó todas sus categorías: puede recargar el kit sin duplicar rubros.
--   UPDATE public.categories SET is_active = false WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- true (reactivó)
--   RESET ROLE;
--   SELECT count(*) FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222' AND is_active;  -- 6
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- sigue en 12 (NOT EXISTS)
--
--   -- Sin categorías ni rubros: el kit se siembra completo otra vez.
--   DELETE FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   DELETE FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- true (reparó)
--   RESET ROLE;
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 12
--   SELECT count(*) FROM public.accounts     WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 1 (no duplicó Efectivo)
-- ROLLBACK;
--
-- 6) Advisors: get_advisors(security) no debe listar function_search_path_mutable
--    ni anon_security_definer_function_executable para estas tres funciones
--    (authenticated_security_definer_function_executable para ensure_starter_kit
--    es esperado: la protección es que no recibe usuario y usa auth.uid()).
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`
Expected: PASS — 29 tests.

- [x] **Step 5: Verificación completa del proyecto**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: toda la suite en PASS (incluidos los 29 de este archivo) y `tsc --noEmit` sin errores. Si `type-check` se queja de `node:fs`/`node:path`, confirmar que `@types/node` está en `devDependencies` (lo está: `"@types/node": "^20"`) y no cambiar imports a `require`.

- [x] **Step 6: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930130000_kit_inicial_y_onboarding.sql src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts && git commit -m "$(cat <<'EOF'
feat(onboarding): handle_new_user siembra el kit sin bloquear el registro

El insert de profiles queda idéntico; después se llama la siembra dentro
de BEGIN … EXCEPTION WHEN OTHERS (WARNING). Incluye el bloque comentado
de verificación manual para cuando se aplique la migración (H8).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Autorrevisión

- **Cobertura de criterios:** columnas + backfill guardado (solo si las columnas son nuevas) → Task 1; `_seed_starter_kit` (SECURITY DEFINER, `search_path`, REVOKE sin GRANT, idempotencia por categorías activas, lock, validación `YYYY-MM`, verificación previa de catálogos, 6 categorías con `ON CONFLICT … DO UPDATE SET is_active = true`, 12 rubros con clasificación/control/alerts y `NOT EXISTS`, `budgeted_amount = 0`, estado `Activo`, cuenta `Efectivo`, plantilla con `ON CONFLICT`, sin `upsert_monthly_budget`) → Task 2; `ensure_starter_kit` (sin parámetro, `auth.uid()`, 42501, GRANT solo `authenticated`) → Task 3; `handle_new_user` (insert idéntico, siembra después, `BEGIN … EXCEPTION WHEN OTHERS`, grants) + verificación manual con `request.jwt.claims` y `ROLLBACK` → Task 4; `bun run test && bun run type-check` → Task 4 Step 5.
- **Marcadores:** ninguno; todo el SQL y el TS están completos.
- **Consistencia:** los nombres coinciden con contratos §1.2/§1.3/§5.1 y con lo que consumirán S10–S12 (`rpc('ensure_starter_kit')` devuelve `boolean` → `{ seeded: boolean; error?: string }` de §5.2; `onboarding_completed_at`/`onboarding_dismissed_at`). Los textos que el test busca son exactamente los del SQL tras colapsar espacios (`squash`); el SQL no tiene `--` dentro de cadenas (los `->>` de jsonb no lo contienen), así que quitar comentarios no altera código.
- **Dependencias:** en el flujo SEG va después de S03 (§5.3); no depende de sus archivos. No toca `src/lib/onboarding/`. La verificación manual 5 menciona S03 solo por si su trigger de allowlist ya está aplicado.

---

## Deuda cerrada en S09b

Recarga del kit robusta (la migración `20260930130000` aún no está aplicada, así que se edita en sitio). Test de texto en `src/lib/supabase/migrations/20260930130000_kit_inicial_y_onboarding.test.ts`, TDD y un commit por punto.

- [x] **1. Plantilla del mes:** `ON CONFLICT (user_id, month_year) DO UPDATE SET is_active = true` (antes `DO NOTHING`); el id se sigue leyendo con el `SELECT` posterior.
- [x] **2. Rubros inactivos:** los rubros del kit que ya existen inactivos en la plantilla (misma categoría + `lower(name)`) se reactivan con un `UPDATE` antes del `INSERT … NOT EXISTS`.
- [x] **3. Categorías por `upper(btrim(name))`:** antes del `INSERT` se reactivan las categorías del usuario que coinciden con una del kit; solo se insertan las que no existen con ese criterio (no se duplica `Vivienda` vs `VIVIENDA`). Los rubros usan esas categorías por id.
- [ ] **4. Verificación manual:** caso con plantilla y un rubro del kit inactivos + categoría `Vivienda` en minúsculas → recargar → todo reactivado, sin duplicados.
- [ ] **5. Global Constraints:** commits siempre con `git commit --no-verify`; antes de cada commit que toque `src/`, `bunx eslint` y `bunx prettier --check`.
