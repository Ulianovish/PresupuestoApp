# S03 — Allowlist de registro Implementation Plan

> **Alineado con contratos v2 (§5).** §5.0: el test de texto vive en `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts` (helpers dentro del archivo; lee el `.sql` con `path.resolve(process.cwd(), …)`); los grants "solo `supabase_auth_admin`" revocan también a `service_role`. §5.1 (§1.1): hook **y** trigger a la vez (el hook no corre en `auth.admin.createUser` ni en "Add user"; el trigger cubre eso y el tiempo entre H8 y H5), hook disponible en Free, backfill `lower(btrim(email))` con `WHERE email IS NOT NULL AND btrim(email) <> ''`, tabla `text` + CHECK (sin `citext`). El plan ya lo hacía así; solo cambió la ruta del test.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que solo los correos de `public.signup_allowlist` puedan crear una cuenta en Supabase Auth, sin importar si el registro entra por el formulario, por la API pública o por una invitación.

**Architecture:** Una migración SQL (`20260930120000_signup_allowlist.sql`) crea la tabla sin acceso para clientes, la función `is_signup_allowed` (SECURITY DEFINER, solo la ejecuta `supabase_auth_admin`), el hook `hook_before_user_created` (barrera principal, responde 403 `signup_not_allowed`) y el trigger de respaldo `enforce_signup_allowlist` `BEFORE INSERT ON auth.users` (cubre el tiempo entre aplicar la migración y activar el hook, y la API de admin, que no pasa por el hook). La migración se valida con un test de texto en vitest; nada toca una base real. Al final se completa ADR-002 con lo verificado.

**Tech Stack:** PostgreSQL 17 (Supabase), Supabase Auth Hooks (Postgres function), vitest 4 (tests de texto con `node:fs`), bun.

## Global Constraints

- Contratos: `docs/agile/contracts.md` §0 y §1.1, con las enmiendas v2 de §5.0/§5.1 (prevalecen), son la fuente de verdad. Nombres exactos: `public.signup_allowlist`, `public.is_signup_allowed(p_email text) RETURNS boolean`, `public.hook_before_user_created(event jsonb) RETURNS jsonb`, trigger `enforce_signup_allowlist`.
- Mensaje literal del rechazo: **`signup_not_allowed`**. Lo traduce `translateAuthError` (S04); S03 no toca TypeScript de la app.
- Toda SECURITY DEFINER lleva `SET search_path = public, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC, anon` y `GRANT EXECUTE` solo a quien la llama.
- Migración idempotente (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP … IF EXISTS`), con bloque comentado de verificación manual al final.
- **Ninguna migración se aplica a producción durante la implementación** (tarea humana H8). Ningún agente escribe en la base remota.
- Datos personales: ningún correo real en SQL, tests ni docs. Solo `usuario@ejemplo.com`, `otro@ejemplo.com`, `no-invitado@ejemplo.com`.
- Verificación del proyecto: `bun run test && bun run type-check`. Commits de solo docs/SQL: `git commit --no-verify` (husky/lint-staged puede descartar cambios en commits sin archivos de `src/`).
- Commits en español, terminados con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ejecutar comandos con `builtin cd /Users/migue/Repos/personal/PresupuestoApp && …` (o la ruta del worktree asignado).
- Dependencia: S01 (`20260930100000`) va antes en la serie de migraciones; S03 no toca sus archivos.

---

## Decisión hook / trigger (verificada)

Se usan **los dos**: hook como barrera principal y trigger como respaldo. Fuentes y razones completas en la Tarea 4 (texto de ADR-002). En corto:

- El hook "Before User Created" está disponible en **Free y Pro** (tabla "Available on Plan" de https://supabase.com/docs/guides/auth/auth-hooks), así que aplica sea cual sea el plan del proyecto.
- En el código de Supabase Auth (`github.com/supabase/auth`, commit `ce9a8eee0cc0`, 2026-09-22) el hook se invoca en signup, invitaciones (`invite.go`), `generateLink` (`mail.go`), OAuth/OIDC/SAML/Web3 y anónimos, pero **no** en `adminUserCreate` (`admin.go`: `auth.admin.createUser` y "Add user → Create new user" del dashboard).
- El hook solo actúa después de activarlo a mano (H5); la migración se aplica en H8. El trigger cierra ese hueco y el de la API de admin.
- No duplica el rechazo: con el hook activo, un registro rechazado nunca llega al `INSERT`, así que el trigger no se dispara y el cliente ve un solo mensaje (`signup_not_allowed`). Costo: una función de trigger de 8 líneas.

## Archivos

- Crear: `supabase/migrations/20260930120000_signup_allowlist.sql` — tabla, `is_signup_allowed`, backfill, hook, trigger, bloque de verificación.
- Crear (test): `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts` — test de texto de la migración.
- Modificar: `docs/agile/decisions/ADR-002-allowlist-registro.md` — completar con lo verificado.

## Criterios de aceptación

- [ ] Tabla `public.signup_allowlist(email text PK CHECK (email = lower(btrim(email))), note text, created_at timestamptz NOT NULL DEFAULT now())`, RLS habilitado, sin políticas, `REVOKE ALL` para `PUBLIC, anon, authenticated`.
- [ ] `is_signup_allowed(p_email text) RETURNS boolean`: SECURITY DEFINER, `search_path` fijo, compara `lower(btrim(p_email))`; EXECUTE solo para `supabase_auth_admin` (y el dueño).
- [ ] `hook_before_user_created(event jsonb) RETURNS jsonb`: `'{}'::jsonb` si `is_signup_allowed(event->'user'->>'email')`; si no, `{"error":{"http_code":403,"message":"signup_not_allowed"}}`. `GRANT EXECUTE … TO supabase_auth_admin`; `REVOKE … FROM authenticated, anon, public` (y `service_role`).
- [ ] Trigger de respaldo `enforce_signup_allowlist` `BEFORE INSERT ON auth.users` con `RAISE EXCEPTION 'signup_not_allowed'`.
- [ ] Backfill idempotente de los correos existentes de `auth.users` (`ON CONFLICT DO NOTHING`).
- [ ] Test de texto de la migración en verde (RLS, revokes, grants a `supabase_auth_admin`, literal `signup_not_allowed`, backfill idempotente, sin correos reales).
- [ ] ADR-002 completa con la verificación del hook (plan, formato, grants, flujos cubiertos) y la decisión.
- [ ] Instrucciones exactas de H5 y H6 en esta historia (sección final).
- [ ] `bun run test && bun run type-check` en verde.

---

### Task 1: Tabla, `is_signup_allowed` y backfill

**Files:**
- Create: `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
- Create: `supabase/migrations/20260930120000_signup_allowlist.sql`

**Interfaces:**
- Consumes: nada.
- Produces (en el test, usados por las Tareas 2 y 3):
  - `MIGRATION_PATH: string` — ruta absoluta de la migración.
  - `raw: string` — contenido completo del archivo (`''` si no existe).
  - `sql: string` — SQL ejecutable: sin comentarios `--`, espacios colapsados a uno, en minúsculas.
  - `functionBlock(name: string): string` — texto normalizado desde `create or replace function public.<name>(` hasta el `$$;` que la cierra (`''` si no existe).
- Produces (en SQL): `public.signup_allowlist`, `public.is_signup_allowed(text)`.

- [x] **Step 1: Write the failing test**

Crear `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay Postgres local. Se lee la migración y se verifica
// que tenga las piezas de seguridad del contrato §1.1 y ADR-002.
const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260930120000_signup_allowlist.sql',
);

const raw = existsSync(MIGRATION_PATH)
  ? readFileSync(MIGRATION_PATH, 'utf8')
  : '';

/** SQL ejecutable: sin comentarios `--`, espacios colapsados, minúsculas. */
function executableSql(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

const sql = executableSql(raw);

/** Desde `create or replace function public.<name>(` hasta el `$$;` que la cierra. */
function functionBlock(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  if (start === -1) return '';
  const end = sql.indexOf('$$;', start);
  return end === -1 ? sql.slice(start) : sql.slice(start, end + 3);
}

describe('migración 20260930120000_signup_allowlist', () => {
  it('existe el archivo de la migración', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });
});

describe('tabla signup_allowlist', () => {
  it('se crea idempotente con el correo normalizado como llave', () => {
    expect(sql).toContain(
      'create table if not exists public.signup_allowlist (',
    );
    expect(sql).toContain(
      'email text primary key check (email = lower(btrim(email)))',
    );
    expect(sql).toContain('note text');
    expect(sql).toContain('created_at timestamptz not null default now()');
  });

  it('tiene RLS habilitado y ninguna política', () => {
    expect(sql).toContain(
      'alter table public.signup_allowlist enable row level security;',
    );
    expect(sql).not.toContain('create policy');
  });

  it('quita todos los privilegios a los roles de cliente', () => {
    expect(sql).toContain(
      'revoke all on table public.signup_allowlist from public, anon, authenticated;',
    );
  });
});

describe('is_signup_allowed', () => {
  const fn = functionBlock('is_signup_allowed');

  it('es security definer, con search_path fijo, y devuelve boolean', () => {
    expect(fn).toContain('is_signup_allowed(p_email text) returns boolean');
    expect(fn).toContain('security definer');
    expect(fn).toContain('set search_path = public, pg_temp');
  });

  it('compara el correo normalizado contra la tabla', () => {
    expect(fn).toContain('from public.signup_allowlist');
    expect(fn).toContain('email = lower(btrim(p_email))');
  });

  it('solo supabase_auth_admin la puede ejecutar', () => {
    expect(sql).toContain(
      'revoke execute on function public.is_signup_allowed(text) from public, anon, authenticated, service_role;',
    );
    expect(sql).toContain(
      'grant execute on function public.is_signup_allowed(text) to supabase_auth_admin;',
    );
    expect(sql).not.toMatch(
      /grant execute on function public\.is_signup_allowed\(text\) to [^;]*(anon|authenticated)/,
    );
  });
});

describe('backfill de usuarios existentes', () => {
  it('inserta los correos de auth.users normalizados y es idempotente', () => {
    expect(sql).toMatch(
      /insert into public\.signup_allowlist \(email, note\) select lower\(btrim\(u\.email\)\), '[^']+' from auth\.users u where u\.email is not null and btrim\(u\.email\) <> '' on conflict \(email\) do nothing;/,
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: FAIL — `existe el archivo de la migración` con `expected false to be true`, y el resto con `expected '' to contain …` / `to match`.

- [x] **Step 3: Write minimal implementation**

Crear `supabase/migrations/20260930120000_signup_allowlist.sql`:

```sql
-- S03 — Allowlist de registro (contratos §1.1, ADR-002).
--
-- Solo los correos de public.signup_allowlist pueden crear una cuenta.
-- Doble barrera:
--   1) Hook "Before User Created" (public.hook_before_user_created): rechaza
--      con HTTP 403 y mensaje 'signup_not_allowed'. Cubre signup, invitaciones,
--      generateLink, OAuth/SSO y anónimos. Se activa a mano en el dashboard (H5).
--   2) Trigger BEFORE INSERT ON auth.users (enforce_signup_allowlist): respaldo
--      que protege desde que se aplica la migración (antes de H5) y cubre
--      auth.admin.createUser / "Add user" del dashboard, que no pasan por el hook.
--      Con el hook activo, un registro rechazado nunca llega al INSERT, así que
--      el trigger no repite el rechazo.
-- Invitar = insertar el correo en la tabla (H6), por SQL o desde el dashboard.

-- 1) Tabla. Correo guardado en minúsculas y sin espacios (citext no está
--    instalada en el proyecto; el CHECK obliga a normalizar al insertar).
CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email))),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS sin políticas a propósito: ningún cliente (anon/authenticated) la lee ni
-- la escribe. La consulta pasa por is_signup_allowed (SECURITY DEFINER).
ALTER TABLE public.signup_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signup_allowlist FROM PUBLIC, anon, authenticated;

-- 2) ¿Este correo puede registrarse? NULL o vacío → false.
CREATE OR REPLACE FUNCTION public.is_signup_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.signup_allowlist
    WHERE email = lower(btrim(p_email))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_signup_allowed(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_signup_allowed(text) TO supabase_auth_admin;

-- 3) Backfill: quien ya tiene cuenta queda en la lista. Idempotente.
--    Se omiten usuarios sin correo (teléfono/anónimos: la app no los usa).
INSERT INTO public.signup_allowlist (email, note)
SELECT lower(btrim(u.email)), 'usuario existente (backfill S03)'
FROM auth.users u
WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
ON CONFLICT (email) DO NOTHING;
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Commit**

El commit incluye un archivo de `src/`, así que va sin `--no-verify` (lint-staged formatea el test).

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930120000_signup_allowlist.sql src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): tabla signup_allowlist, is_signup_allowed y backfill de usuarios

Primera parte de S03: la allowlist vive en una tabla con RLS y sin acceso
para clientes; is_signup_allowed es SECURITY DEFINER y solo la ejecuta
supabase_auth_admin. Los usuarios existentes quedan en la lista.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Hook `hook_before_user_created`

**Files:**
- Modify: `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts` (agregar al final)
- Modify: `supabase/migrations/20260930120000_signup_allowlist.sql` (agregar al final)

**Interfaces:**
- Consumes (del test, Tarea 1): `sql: string`, `functionBlock(name: string): string`, `describe/it/expect` ya importados.
- Consumes (SQL, Tarea 1): `public.is_signup_allowed(text)`.
- Produces: `public.hook_before_user_created(jsonb) RETURNS jsonb` — la función que H5 selecciona en el dashboard.

Formato verificado (https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook): la entrada trae `event.user.email` (el usuario aún no existe en `auth.users`); `{}` permite; `{"error":{"http_code":…,"message":…}}` rechaza y el mensaje llega al cliente. La documentación desaconseja `SECURITY DEFINER` en el hook: por eso es INVOKER y la lectura de la tabla pasa por `is_signup_allowed`.

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`:

```ts
describe('hook_before_user_created', () => {
  const fn = functionBlock('hook_before_user_created');

  it('recibe el evento jsonb y devuelve jsonb', () => {
    expect(fn).toContain(
      'hook_before_user_created(event jsonb) returns jsonb',
    );
  });

  it('lee el correo de event.user.email y consulta la allowlist', () => {
    expect(fn).toContain(
      "public.is_signup_allowed(event->'user'->>'email')",
    );
  });

  it("permite con '{}' y rechaza con 403 y el literal signup_not_allowed", () => {
    expect(fn).toContain("return '{}'::jsonb;");
    expect(fn).toMatch(
      /jsonb_build_object\( ?'error', ?jsonb_build_object\( ?'http_code', ?403, ?'message', ?'signup_not_allowed' ?\) ?\)/,
    );
  });

  it('no es security definer (Supabase lo desaconseja) y fija search_path', () => {
    expect(fn).not.toContain('security definer');
    expect(fn).toContain('set search_path = public, pg_temp');
  });

  it('solo supabase_auth_admin la ejecuta', () => {
    expect(sql).toContain('grant usage on schema public to supabase_auth_admin;');
    expect(sql).toContain(
      'revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;',
    );
    expect(sql).toContain(
      'grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: FAIL — los 5 tests de `hook_before_user_created` fallan (`expected '' to contain 'hook_before_user_created(event jsonb) returns jsonb'`, etc.); `5 failed | 8 passed (13)`. Los de la Tarea 1 siguen en verde.

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `supabase/migrations/20260930120000_signup_allowlist.sql`:

```sql

-- 4) Hook "Before User Created" (se activa en H5: Authentication → Auth Hooks,
--    tipo Postgres, public.hook_before_user_created).
--    Entrada: { metadata: {...}, user: { email, ... } }. Salida: '{}' permite;
--    { error: { http_code, message } } rechaza y el mensaje llega al cliente.
--    INVOKER a propósito (la documentación de Supabase desaconseja SECURITY
--    DEFINER en hooks): corre como supabase_auth_admin y lee la tabla solo a
--    través de is_signup_allowed.
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_signup_allowed(event->'user'->>'email') THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed')
  );
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930120000_signup_allowlist.sql src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): hook Before User Created que rechaza correos sin invitación

hook_before_user_created devuelve '{}' si el correo está en la allowlist y
un error 403 'signup_not_allowed' si no. Solo lo ejecuta supabase_auth_admin.
Se activa a mano en el dashboard (H5).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Trigger de respaldo, reglas de idempotencia y bloque de verificación

**Files:**
- Modify: `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts` (agregar al final)
- Modify: `supabase/migrations/20260930120000_signup_allowlist.sql` (agregar al final)

**Interfaces:**
- Consumes (del test, Tarea 1): `raw: string`, `sql: string`, `functionBlock(name: string): string`.
- Consumes (SQL, Tarea 1): `public.is_signup_allowed(text)`.
- Produces: `public.enforce_signup_allowlist() RETURNS trigger` y el trigger `enforce_signup_allowlist` en `auth.users`.

Verificado con SELECT de solo lectura (2026-09-30): `postgres` tiene privilegio TRIGGER sobre `auth.users` y ya existe `on_auth_user_created` (AFTER INSERT → `handle_new_user`), así que el trigger se puede crear por migración. Un trigger BEFORE corre siempre antes de uno AFTER: si rechaza, `handle_new_user` no se ejecuta.

- [ ] **Step 1: Write the failing test**

Agregar al final de `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`:

```ts
describe('trigger de respaldo enforce_signup_allowlist', () => {
  const fn = functionBlock('enforce_signup_allowlist');

  it('es una función de trigger security definer con search_path fijo', () => {
    expect(fn).toContain('enforce_signup_allowlist() returns trigger');
    expect(fn).toContain('security definer');
    expect(fn).toContain('set search_path = public, pg_temp');
  });

  it('rechaza con el literal signup_not_allowed si el correo no está permitido', () => {
    expect(fn).toContain('if not public.is_signup_allowed(new.email) then');
    expect(fn).toContain(
      "raise exception 'signup_not_allowed' using errcode = '42501';",
    );
    expect(fn).toContain('return new;');
  });

  it('se engancha BEFORE INSERT en auth.users de forma idempotente', () => {
    const drop =
      'drop trigger if exists enforce_signup_allowlist on auth.users;';
    const create =
      'create trigger enforce_signup_allowlist before insert on auth.users for each row execute function public.enforce_signup_allowlist();';
    expect(sql).toContain(drop);
    expect(sql).toContain(create);
    expect(sql.indexOf(drop)).toBeLessThan(sql.indexOf(create));
  });

  it('nadie la ejecuta directo salvo supabase_auth_admin', () => {
    expect(sql).toContain(
      'revoke execute on function public.enforce_signup_allowlist() from public, anon, authenticated, service_role;',
    );
    expect(sql).toContain(
      'grant execute on function public.enforce_signup_allowlist() to supabase_auth_admin;',
    );
  });
});

describe('idempotencia y datos', () => {
  it('toda función es create or replace y toda tabla if not exists', () => {
    expect(sql).not.toMatch(/create function /);
    expect(sql).not.toMatch(/create table (?!if not exists)/);
  });

  it('no borra ni vacía datos', () => {
    expect(sql).not.toMatch(/\b(drop table|truncate|delete from)\b/);
  });

  it('el literal signup_not_allowed aparece en el hook y en el trigger', () => {
    const matches = sql.match(/'signup_not_allowed'/g) ?? [];
    expect(matches).toHaveLength(2);
  });

  it('solo usa correos de ejemplo (en todo el archivo, incluidos comentarios)', () => {
    const emails = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) {
      expect(email.toLowerCase()).toMatch(/@ejemplo\.com$/);
    }
  });

  it('termina con el bloque comentado de verificación manual', () => {
    expect(raw).toContain('-- VERIFICACIÓN MANUAL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: FAIL — `7 failed | 15 passed (22)`: los 4 tests del trigger, `el literal signup_not_allowed aparece…` (`expected [ …1 item ] to have a length of 2`), `solo usa correos de ejemplo` (`expected 0 to be greater than 0`) y `termina con el bloque…`. Los de idempotencia y "no borra" pasan.

- [ ] **Step 3: Write minimal implementation**

Agregar al final de `supabase/migrations/20260930120000_signup_allowlist.sql`:

```sql

-- 5) Trigger de respaldo. Protege antes de activar el hook (H5) y cubre
--    auth.admin.createUser / "Add user" del dashboard, que no llaman al hook.
--    El cliente ve 'Database error saving new user' (translateAuthError lo
--    traduce). Con el hook activo, un correo no invitado nunca llega aquí.
CREATE OR REPLACE FUNCTION public.enforce_signup_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_signup_allowed(NEW.email) THEN
    RAISE EXCEPTION 'signup_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_signup_allowlist() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_signup_allowlist() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS enforce_signup_allowlist ON auth.users;
CREATE TRIGGER enforce_signup_allowlist
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_allowlist();

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN MANUAL (después de aplicar en H8; SQL Editor como postgres).
-- Todo es lectura salvo el bloque 4, que termina en ROLLBACK.
--
-- 1) RLS activo y sin políticas (esperado: true y 0):
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_allowlist'::regclass;
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signup_allowlist';
--
-- 2) Privilegios (esperado: false, false, false, true, true, true):
-- SELECT has_table_privilege('anon', 'public.signup_allowlist', 'SELECT');
-- SELECT has_table_privilege('authenticated', 'public.signup_allowlist', 'SELECT');
-- SELECT has_function_privilege('anon', 'public.is_signup_allowed(text)', 'EXECUTE');
-- SELECT has_function_privilege('supabase_auth_admin', 'public.is_signup_allowed(text)', 'EXECUTE');
-- SELECT has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'EXECUTE');
-- SELECT has_schema_privilege('supabase_auth_admin', 'public', 'USAGE');
--
-- 3) Backfill: ningún usuario existente quedó fuera (esperado: 0):
-- SELECT count(*) FROM auth.users u
-- WHERE u.email IS NOT NULL AND NOT public.is_signup_allowed(u.email);
--
-- 4) Hook con un correo de ejemplo (esperado: {} y luego el error 403):
-- BEGIN;
--   INSERT INTO public.signup_allowlist (email) VALUES ('usuario@ejemplo.com');
--   SELECT public.hook_before_user_created('{"user":{"email":" Usuario@Ejemplo.com "}}'::jsonb);
--   SELECT public.hook_before_user_created('{"user":{"email":"otro@ejemplo.com"}}'::jsonb);
-- ROLLBACK;
--
-- 5) Triggers de auth.users (esperado: enforce_signup_allowlist y on_auth_user_created):
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
--
-- 6) Advisors: get_advisors(security) puede listar rls_enabled_no_policy para
--    signup_allowlist (INFO). Es intencional: nadie salvo el dueño la toca.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`
Expected: PASS (22 tests).

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930120000_signup_allowlist.sql src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): trigger de respaldo de la allowlist en auth.users

enforce_signup_allowlist (BEFORE INSERT) rechaza con 'signup_not_allowed'
cuando el hook no actuó: antes de activarlo (H5) y en auth.admin.createUser,
que no pasa por el hook. Bloque de verificación manual al final.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Completar ADR-002 y verificación final

**Files:**
- Modify: `docs/agile/decisions/ADR-002-allowlist-registro.md` (reemplazo completo)

**Interfaces:**
- Consumes: la migración de las Tareas 1–3 (nombres de funciones y trigger).
- Produces: ADR-002 cerrada; S04 la lee para `translateAuthError`.

- [ ] **Step 1: Reemplazar el contenido de ADR-002**

Sobrescribir `docs/agile/decisions/ADR-002-allowlist-registro.md` con:

```markdown
# ADR-002 — Allowlist de registro en Supabase Auth

Estado: aceptada (2026-09-30). Registro con allowlist: decisión de la persona. Mecanismo: orquestador; verificado y cerrado en S03 (2026-09-30).

## Contexto
`disable_signup = false` y la anon key es pública: cualquiera puede llamar `/auth/v1/signup` sin pasar por el formulario. Cada usuario gasta IA, Twilio y el scraper DIAN, sin cuotas.

## Opciones
1. Validar en el server action: se salta llamando a la API directo.
2. Hook "Before User Created": oficial, error 403 con mensaje propio; requiere activarlo en el dashboard y que el plan lo permita.
3. Trigger `BEFORE INSERT ON auth.users`: funciona en cualquier plan; el cliente ve "Database error saving new user".

## Decisión
Tabla `signup_allowlist` administrada por SQL/dashboard y función `is_signup_allowed`. Enforcement con **hook (2) como barrera principal y trigger (3) como respaldo**, ambos en `supabase/migrations/20260930120000_signup_allowlist.sql`:
- `public.hook_before_user_created(event jsonb)`: `{}` si el correo está en la lista; si no, `{"error":{"http_code":403,"message":"signup_not_allowed"}}`.
- Trigger `enforce_signup_allowlist` `BEFORE INSERT ON auth.users`: `RAISE EXCEPTION 'signup_not_allowed'`.

En ambos casos `translateAuthError` (S04) traduce el mensaje.

## Verificación (S03, 2026-09-30)
- **Plan.** "Before User Created" está disponible en Free y Pro (tabla "Available on Plan" de https://supabase.com/docs/guides/auth/auth-hooks). No depende del plan del proyecto.
- **Entrada.** `{ metadata: { uuid, time, name: "before-user-created", ip_address }, user: { id, aud, role, email, phone, app_metadata, user_metadata, identities, created_at, updated_at, is_anonymous } }`. El usuario todavía no existe en `auth.users` (https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).
- **Salida.** `{}` permite. `{ "error": { "http_code": 4xx, "message": "…" } }` rechaza y el mensaje llega al cliente; sin `http_code`, Auth responde 500. En el código de Auth (`internal/hooks/hookserrors/hookserrors.go`) el error sale sin `error_code`: supabase-js entrega `status 403`, `message 'signup_not_allowed'` y ningún `code` propio. El rechazo del trigger llega como `500`, `code 'unexpected_failure'`, `message 'Database error saving new user'` (en la API de admin: `'Database error creating new user'`).
- **Grants.** Auth llama la función como `supabase_auth_admin`: `GRANT EXECUTE … TO supabase_auth_admin`, `GRANT USAGE ON SCHEMA public TO supabase_auth_admin`, `REVOKE EXECUTE … FROM authenticated, anon, public`. La documentación desaconseja `SECURITY DEFINER` en el hook; por eso el hook es INVOKER y lee la tabla solo a través de `is_signup_allowed` (SECURITY DEFINER, EXECUTE solo para `supabase_auth_admin`). Así no hace falta política RLS para `supabase_auth_admin`.
- **Flujos cubiertos por el hook.** La documentación no los enumera; se verificó en el código de `github.com/supabase/auth` (commit `ce9a8eee0cc0`, 2026-09-22): `triggerBeforeUserCreated` se llama en `signup.go`, `invite.go` (`inviteUserByEmail` e "Invite user" del dashboard), `mail.go` (`generateLink` de tipo signup e invite), `external.go`, `token_oidc.go`, `samlacs.go`, `web3.go` (OAuth, OIDC, SAML, Web3) y `anonymous.go`. **No** se llama en `admin.go` → `adminUserCreate` (`auth.admin.createUser` y "Add user → Create new user" del dashboard).
- **Proyecto** (SELECT de solo lectura, 2026-09-30): Postgres 17.4; `citext` no instalada (por eso `text` con CHECK de minúsculas); `supabase_auth_admin` ya tiene USAGE en `public`; `postgres` tiene privilegio TRIGGER sobre `auth.users`, donde ya existe `on_auth_user_created`; los usuarios actuales tienen el correo normalizado y ninguno es anónimo.

## Por qué también el trigger
1. El hook solo actúa después de activarlo a mano (H5) y la migración se aplica antes (H8). Sin trigger, entre H8 y H5 el registro seguiría abierto.
2. `auth.admin.createUser` y "Add user" del dashboard no pasan por el hook.
3. Si alguien desactiva el hook, el registro no queda abierto en silencio.

No repite el rechazo: con el hook activo, un registro rechazado nunca llega al `INSERT`, así que el trigger no se dispara y el cliente ve un solo mensaje (`signup_not_allowed`). El trigger solo actúa cuando el hook no lo hizo. Costo: una función de trigger de 8 líneas.

## Consecuencias
- Invitar = insertar el correo en la tabla (H6) **antes** de que la persona se registre o de invitarla desde el dashboard. Sin UI de administración por ahora.
- Quitar un correo de la lista no borra una cuenta ya creada.
- Usuarios sin correo (teléfono, anónimos) quedan bloqueados; la app no los usa.
- `translateAuthError` debe mirar `message` aunque `code` venga con un valor que no está en su tabla (`unexpected_failure`) o no venga.
```

- [ ] **Step 2: Verificación completa del proyecto**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: todos los tests en verde (incluidos los 22 de `src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts`) y `tsc --noEmit` sin errores.

- [ ] **Step 3: Revisar que no quedaron correos reales**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && grep -EnoI "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" supabase/migrations/20260930120000_signup_allowlist.sql src/lib/supabase/migrations/20260930120000_signup_allowlist.test.ts docs/agile/decisions/ADR-002-allowlist-registro.md`
Expected: solo direcciones `@ejemplo.com` (o ninguna en la ADR).

- [ ] **Step 4: Commit**

Solo docs: va con `--no-verify`.

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add docs/agile/decisions/ADR-002-allowlist-registro.md && git commit --no-verify -m "$(cat <<'EOF'
docs(adr): ADR-002 cerrada con la verificación del hook Before User Created

Hook disponible en Free y Pro; formato, grants y flujos cubiertos
verificados en la documentación y en el código de Supabase Auth. Se usa
el hook como barrera principal y el trigger como respaldo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Tareas humanas

Orden: **H8 (aplicar la migración) → H6 (invitar) → H5 (activar el hook)**. El trigger protege desde H8; el hook se activa después porque la función tiene que existir para poder elegirla.

### H6 — Agregar un correo a la allowlist

Dónde: Supabase Dashboard → proyecto PresupuestoApp → **SQL Editor** → New query (corre como `postgres`, que es dueño de la tabla). Los usuarios que ya tenían cuenta quedaron en la lista por el backfill; no hace falta agregarlos.

Agregar (o cambiar la nota de) un invitado. Cambiar solo el correo y la nota:

```sql
INSERT INTO public.signup_allowlist (email, note)
VALUES (lower(btrim('usuario@ejemplo.com')), 'invitado el 2026-10-01')
ON CONFLICT (email) DO UPDATE SET note = EXCLUDED.note;
```

Ver la lista:

```sql
SELECT email, note, created_at FROM public.signup_allowlist ORDER BY created_at;
```

Quitar una invitación (no borra la cuenta si la persona ya se registró):

```sql
DELETE FROM public.signup_allowlist WHERE email = lower(btrim('usuario@ejemplo.com'));
```

Después de agregarlo, avísale a la persona que se registre en `/auth/register` con **ese mismo correo**. Agregarlo a la tabla no envía ningún correo. Si prefieres invitarla desde el dashboard (Authentication → Users → Invite user), primero agrégala a la tabla; si no, la invitación falla con `signup_not_allowed`.

### H5 — Activar el hook "Before User Created"

Requisito: la migración `20260930120000_signup_allowlist.sql` ya está aplicada (H8).

1. Supabase Dashboard → proyecto PresupuestoApp → **Authentication** → **Auth Hooks** (https://supabase.com/dashboard/project/hlgmurtmqlzmjarmryzp/auth/hooks).
2. Clic en **Add a new hook** (o "Add hook") → elegir **Before User Created**.
3. **Hook type:** `Postgres`.
4. **Postgres Schema:** `public`.
5. **Postgres function:** `hook_before_user_created`.
6. Dejarlo habilitado (**Enable**) y guardar (**Create hook** / **Save**). El dashboard vuelve a aplicar los grants a `supabase_auth_admin`; no importa, la migración ya los dejó iguales.
7. Probar desde una terminal con la anon key (sale de Project Settings → API; no la pegues en el repo). El correo no está invitado, así que no se crea cuenta ni se envía correo:

   ```bash
   curl -s -w '\nHTTP %{http_code}\n' -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/signup" \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     -H 'Content-Type: application/json' \
     -d '{"email":"no-invitado@ejemplo.com","password":"prueba-12345"}'
   ```

   Esperado con el hook activo: `HTTP 403` y `signup_not_allowed` en el cuerpo.
   Si sale `HTTP 500` con `Database error saving new user`, el hook no está activo y rechazó el trigger de respaldo: revisar los pasos 2–6.
8. Opcional: Authentication → Logs, filtrar por `before-user-created` para ver la llamada.

---

## Autorrevisión

- **Cobertura:** tabla + RLS + revokes (T1), `is_signup_allowed` (T1), backfill (T1), hook (T2), trigger (T3), idempotencia y datos de ejemplo (T3), bloque de verificación (T3), ADR-002 (T4), H5/H6 (sección final), `bun run test && bun run type-check` (T4). Todos los criterios de la épica S03 tienen tarea.
- **Marcadores:** ninguno; todo el SQL, los tests y el texto de la ADR están completos.
- **Consistencia:** nombres iguales a contratos §1.1 (`signup_allowlist`, `is_signup_allowed(p_email text)`, `hook_before_user_created(event jsonb)`, `enforce_signup_allowlist`) y literal `signup_not_allowed`. Los helpers del test (`raw`, `sql`, `functionBlock`) se definen en T1 y se usan igual en T2 y T3. No depende de tipos de otras historias; S04 consume el literal y el mensaje del trigger, ya en la tabla de §2.2.
