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
  'AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN',
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

  it('la ejecutan authenticated (getPreviousMonthOverspend en services/budget.ts, desde el navegador) y service_role; anon no', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['authenticated', 'service_role']);
  });
});

describe('copy_budget_items_from_template', () => {
  const NAME = 'copy_budget_items_from_template';

  it('conserva la firma de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid)',
      ' RETURNS integer',
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

  it('exige que la plantilla fuente y la destino sean del usuario antes de copiar', () => {
    const block = functionBlock(readMigration(), NAME);
    const source = block.search(
      /bt\.id = p_source_template_id\s+AND bt\.user_id = p_user_id/,
    );
    const target = block.search(
      /bt\.id = p_target_template_id\s+AND bt\.user_id = p_user_id/,
    );
    const insert = block.indexOf('INSERT INTO budget_items');
    expect(source).toBeGreaterThan(-1);
    expect(target).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(source).toBeLessThan(insert);
    expect(target).toBeLessThan(insert);
  });

  it('conserva el resto del cuerpo de producción', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('RETURN 0;');
    expect(block).toContain('0.00 as spent_amount,');
    expect(block).toContain('0.00 as real_amount,');
    expect(block).toMatch(
      /FROM budget_items\s+WHERE template_id = p_source_template_id\s+AND is_active = true;/,
    );
    expect(block).toContain('GET DIAGNOSTICS items_copied = ROW_COUNT;');
    expect(block).toContain('RETURN items_copied;');
  });

  it('solo service_role la ejecuta', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['service_role']);
  });
});

const UNCHANGED_FUNCTIONS = [
  {
    name: 'fix_templates_without_items',
    argTypes: 'uuid',
    header:
      'CREATE OR REPLACE FUNCTION public.fix_templates_without_items(p_user_id uuid)',
    returns:
      ' RETURNS TABLE(template_id uuid, month_year character varying, items_copied integer)',
    bodyMarkers: [
      'WHERE bt.user_id = p_user_id',
      'WHERE bt2.user_id = p_user_id',
      'SELECT copy_budget_items_from_template(',
      'RETURN NEXT;',
    ],
  },
  {
    name: 'check_cufe_exists',
    argTypes: 'uuid, character varying',
    header:
      'CREATE OR REPLACE FUNCTION public.check_cufe_exists(p_user_id uuid, p_cufe_code character varying)',
    returns: ' RETURNS boolean',
    bodyMarkers: [
      'FROM electronic_invoices',
      'WHERE user_id = p_user_id',
      'AND cufe_code = p_cufe_code',
    ],
  },
  {
    name: 'get_electronic_invoices_by_date_range',
    argTypes: 'uuid, date, date',
    header:
      'CREATE OR REPLACE FUNCTION public.get_electronic_invoices_by_date_range(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)',
    returns:
      ' RETURNS TABLE(id uuid, cufe_code character varying, supplier_name character varying, supplier_nit character varying, invoice_date date, total_amount numeric, processed_at timestamp with time zone, has_expenses boolean)',
    bodyMarkers: [
      'WHERE ei.user_id = p_user_id',
      'WHERE t.electronic_invoice_id = ei.id',
      'ORDER BY ei.invoice_date DESC, ei.created_at DESC;',
    ],
  },
  {
    name: 'get_invoice_stats_by_supplier',
    argTypes: 'uuid, date, date',
    header:
      'CREATE OR REPLACE FUNCTION public.get_invoice_stats_by_supplier(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)',
    returns:
      ' RETURNS TABLE(supplier_name character varying, supplier_nit character varying, invoice_count bigint, total_amount numeric, avg_amount numeric, last_invoice_date date)',
    bodyMarkers: [
      'WHERE ei.user_id = p_user_id',
      'GROUP BY ei.supplier_name, ei.supplier_nit',
      'ORDER BY total_amount DESC;',
    ],
  },
];

describe.each(UNCHANGED_FUNCTIONS)(
  '$name (ya filtraba: cuerpo sin cambios)',
  ({ name, argTypes, header, returns, bodyMarkers }) => {
    it('conserva la firma de producción (no crea overload)', () => {
      expectSignature(functionBlock(readMigration(), name), header, returns);
    });

    it('es SECURITY DEFINER con search_path fijo', () => {
      const block = functionBlock(readMigration(), name);
      expect(block).toContain('\n SECURITY DEFINER\n');
      expect(block).toContain(SEARCH_PATH);
    });

    it('filtra por el usuario con el cuerpo de producción y sin guard nuevo', () => {
      const block = functionBlock(readMigration(), name);
      for (const marker of bodyMarkers) expect(block).toContain(marker);
      expect(block).not.toContain('auth.uid()');
    });

    it('solo service_role la ejecuta', () => {
      const code = codeOnly(readMigration());
      expect(code).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(${argTypes}) FROM PUBLIC, anon, authenticated;`,
      );
      expect(grantedRoles(code, name)).toEqual(['service_role']);
    });
  },
);

describe('get_budget_by_month', () => {
  const NAME = 'get_budget_by_month';

  it('conserva la firma y el RETURNS TABLE de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.get_budget_by_month(p_user_id uuid, p_month_year character varying)',
      ' RETURNS TABLE(template_id uuid, template_name character varying, category_id uuid, category_name character varying, category_color character varying, category_icon character varying, item_id uuid, item_name character varying, item_description text, due_date character varying, classification_name character varying, classification_color character varying, control_name character varying, control_color character varying, budgeted_amount numeric, real_amount numeric, spent_amount numeric, deuda_id uuid, alerts_enabled boolean)',
    );
  });

  it('sigue siendo INVOKER, con search_path fijo', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('\n LANGUAGE plpgsql\n');
    expect(block).not.toContain('SECURITY DEFINER');
    expect(block).toContain(SEARCH_PATH);
  });

  it('valida al usuario antes de todo', () => {
    expectGuardFirst(functionBlock(readMigration(), NAME));
  });

  it('conserva la consulta de producción', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('WHERE bt.user_id = p_user_id');
    expect(block).toContain('AND (bi.is_active = true OR bi.id IS NULL)');
    expect(block).toContain('bi.alerts_enabled');
    expect(block).toContain('ORDER BY c.name, bi.name;');
  });

  it('solo authenticated y service_role la ejecutan', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) FROM PUBLIC, anon;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['authenticated', 'service_role']);
  });
});

const ALL_FUNCTIONS = [
  'check_cufe_exists',
  'copy_budget_items_from_template',
  'fix_templates_without_items',
  'get_budget_by_month',
  'get_electronic_invoices_by_date_range',
  'get_invoice_stats_by_supplier',
  'get_previous_month_overspend',
];

describe('migración 20260930100000 completa', () => {
  it('reemplaza exactamente las 7 funciones, sin DROP ni CREATE sin OR REPLACE', () => {
    const code = codeOnly(readMigration());
    const created = [
      ...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g),
    ]
      .map(m => m[1])
      .sort();
    expect(created).toEqual(ALL_FUNCTIONS);
    expect(code).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+FUNCTION\b/i);
  });

  it('fuera de las funciones solo hay REVOKE y GRANT de EXECUTE', () => {
    const sql = readMigration();
    let rest = codeOnly(sql);
    for (const name of ALL_FUNCTIONS) {
      rest = rest.replace(functionBlock(sql, name), '');
    }
    const stray = rest
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')
      .filter(
        line => !/^(REVOKE|GRANT) EXECUTE ON FUNCTION public\.\w+\(/.test(line),
      );
    expect(stray).toEqual([]);
  });

  it('el guard compara con IS DISTINCT FROM: un p_user_id NULL es "no autorizado"', () => {
    // Con `auth.uid() <> NULL` la condición es NULL, el IF no entra y la
    // función sigue con p_user_id NULL; IS DISTINCT FROM la vuelve true.
    const code = codeOnly(readMigration());
    expect(code).not.toMatch(/auth\.uid\(\)\s*<>/);
    expect(
      code.match(/auth\.uid\(\) IS DISTINCT FROM p_user_id/g),
    ).toHaveLength(3);
  });

  it('ningún GRANT le da EXECUTE a anon ni a PUBLIC', () => {
    const code = codeOnly(readMigration());
    for (const name of ALL_FUNCTIONS) {
      const roles = grantedRoles(code, name);
      expect(roles).not.toContain('anon');
      expect(roles).not.toContain('PUBLIC');
    }
  });

  it('la verificación compara el cuerpo en producción (md5) y prueba plantillas de otro usuario (7b)', () => {
    const sql = readMigration();
    expect(sql).toMatch(
      /^-- SELECT proname, md5\(prosrc\) FROM pg_proc WHERE proname IN \(/m,
    );
    const caso7b = sql.slice(sql.indexOf('-- 7b)'));
    expect(sql).toContain('-- 7b)');
    const hasta8 = caso7b.slice(0, caso7b.indexOf('-- 8)'));
    expect(hasta8).toContain('42501');
    expect(hasta8.match(/^-- BEGIN;/gm)?.length).toBeGreaterThanOrEqual(2);
    expect(hasta8.match(/^-- ROLLBACK;/gm)?.length).toBeGreaterThanOrEqual(2);
    expect(hasta8.match(/copy_budget_items_from_template\(/g)).toHaveLength(2);
    expect(hasta8).toContain('<plantilla ajena>');
    expect(hasta8).toContain('<plantilla propia>');
  });

  it('deja comentado el bloque de verificación (overloads, grants y tablas sin RLS)', () => {
    const sql = readMigration();
    expect(sql).toContain('-- VERIFICACIÓN');
    expect(sql).toMatch(/^-- .*HAVING count\(\*\) > 1/m);
    expect(sql).toMatch(/^-- .*aclexplode/m);
    expect(sql).toMatch(/^-- .*c\.relrowsecurity = false/m);
    const code = codeOnly(sql);
    expect(code).not.toContain('aclexplode');
    expect(code).not.toContain('relrowsecurity');
    expect(code).not.toContain('ROLLBACK');
  });
});
