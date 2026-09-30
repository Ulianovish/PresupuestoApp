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
  if (end === -1)
    throw new Error(`La función ${name} no cierra con $function$;`);
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
    expect(code).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\._seed_starter_kit/,
    );
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
    const names = [...(match?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
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
