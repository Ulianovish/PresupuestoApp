import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de humo de texto: no hay Postgres local. Se lee la migración y se
// verifica que tenga las piezas de seguridad del contrato §1.1 y ADR-002. El
// comportamiento real (el trigger rechaza un email NULL, el hook responde '{}'
// o el 403) queda en los 6 bloques de verificación manual del final del .sql,
// pendientes de H8. Si algún día hay Postgres efímero (pglite o
// `supabase start`), conviene convertirlo en un test de comportamiento.
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

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Roles del `REVOKE <privilegio> ON <objeto> FROM …;`, ordenados: el orden en
 * que la migración los escriba no importa.
 */
function revokedRoles(privilege: string, objeto: string): string[] {
  const m = sql.match(
    new RegExp(
      `revoke ${escapeRegex(privilege)} on ${escapeRegex(objeto)} from ([^;]+);`,
    ),
  );
  return m
    ? m[1]
        .split(',')
        .map(r => r.trim())
        .sort()
    : [];
}

const ROLES_CLIENTE = ['anon', 'authenticated', 'public'];
const ROLES_CLIENTE_Y_SERVICE = [...ROLES_CLIENTE, 'service_role'].sort();

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
    expect(revokedRoles('all', 'table public.signup_allowlist')).toEqual(
      ROLES_CLIENTE,
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
    expect(
      revokedRoles('execute', 'function public.is_signup_allowed(text)'),
    ).toEqual(ROLES_CLIENTE_Y_SERVICE);
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
      /insert into public\.signup_allowlist \(email, note\) select lower\(btrim\((\w+\.)?email\)\), '[^']+' from auth\.users( (as )?\w+)? where (\w+\.)?email is not null and btrim\((\w+\.)?email\) <> '' on conflict \(email\) do nothing;/,
    );
  });
});

describe('hook_before_user_created', () => {
  const fn = functionBlock('hook_before_user_created');

  it('recibe el evento jsonb y devuelve jsonb', () => {
    expect(fn).toContain('hook_before_user_created(event jsonb) returns jsonb');
  });

  it('lee el correo de event.user.email y consulta la allowlist', () => {
    expect(fn).toContain("public.is_signup_allowed(event->'user'->>'email')");
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
    expect(sql).toContain(
      'grant usage on schema public to supabase_auth_admin;',
    );
    expect(
      revokedRoles(
        'execute',
        'function public.hook_before_user_created(jsonb)',
      ),
    ).toEqual(ROLES_CLIENTE_Y_SERVICE);
    expect(sql).toContain(
      'grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;',
    );
  });
});

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
    expect(
      revokedRoles('execute', 'function public.enforce_signup_allowlist()'),
    ).toEqual(ROLES_CLIENTE_Y_SERVICE);
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
