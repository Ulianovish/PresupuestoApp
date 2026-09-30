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
