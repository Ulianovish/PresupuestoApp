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
