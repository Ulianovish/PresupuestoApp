import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

// Test de texto de la migración S01 (no hay Postgres local, contratos §0):
// lee el .sql y verifica firmas, guard, search_path y grants.
const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260930100000_blindar_funciones_remotas.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8');
}

/** El SQL sin líneas de comentario: lo que Postgres ejecuta. */
function codeOnly(sql: string): string {
  return sql
    .split('\n')
    .filter(line => !line.trimStart().startsWith('--'))
    .join('\n');
}

const FUNCTION_END = '$function$;';

/** Bloque `CREATE OR REPLACE FUNCTION public.<name>(` … `$function$;` (sin comentarios). */
function functionBlock(sql: string, name: string): string {
  const code = codeOnly(sql);
  const start = code.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`Falta CREATE OR REPLACE de ${name}`);
  const end = code.indexOf(FUNCTION_END, start);
  if (end === -1) throw new Error(`${name} no cierra con ${FUNCTION_END}`);
  return code.slice(start, end + FUNCTION_END.length);
}

/**
 * Primera línea (nombre + parámetros) y segunda (RETURNS) idénticas a
 * pg_get_functiondef de producción: así CREATE OR REPLACE reemplaza y no crea
 * un overload.
 */
function expectSignature(block: string, header: string, returns: string) {
  const [first, second] = block.split('\n');
  expect(first).toBe(header);
  expect(second).toBe(returns);
}

const GUARD_LINES = [
  "IF auth.role() IS DISTINCT FROM 'service_role'",
  'AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN',
  "RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';",
];

/** El guard de contratos §0 como primera sentencia después de BEGIN. */
function expectGuardFirst(block: string) {
  for (const line of GUARD_LINES) expect(block).toContain(line);
  expect(block).toMatch(
    /\nBEGIN\n\s*IF auth\.role\(\) IS DISTINCT FROM 'service_role'\n/,
  );
}

const SEARCH_PATH = '\n SET search_path = public, pg_temp\n';

/** Roles que reciben EXECUTE sobre public.<name> en los GRANT de la migración. */
function grantedRoles(code: string, name: string): string[] {
  const re = new RegExp(
    `GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO ([^;]+);`,
    'g',
  );
  return [...code.matchAll(re)]
    .flatMap(m => m[1].split(','))
    .map(role => role.trim())
    .sort();
}

describe('get_previous_month_overspend', () => {
  const NAME = 'get_previous_month_overspend';

  it('conserva la firma de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(p_user_id uuid, p_month_year character varying)',
      ' RETURNS TABLE(item_id uuid, previous_month character varying, budgeted numeric, spent numeric, excess numeric)',
    );
  });

  it('es SECURITY DEFINER con search_path fijo', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('\n SECURITY DEFINER\n');
    expect(block).toContain(SEARCH_PATH);
  });

  it('valida al usuario antes de todo', () => {
    expectGuardFirst(functionBlock(readMigration(), NAME));
  });

  it('sigue filtrando por el usuario en el mes anterior y en el actual', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block.match(/WHERE bt\.user_id = p_user_id/g)).toHaveLength(2);
  });

  it('solo service_role la ejecuta (no tiene llamadores en src/)', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon, authenticated;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['service_role']);
  });
});
