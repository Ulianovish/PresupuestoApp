import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ARCHIVO = '20260930110000_whatsapp_vinculacion_segura.sql';
const crudo = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', ARCHIVO),
  'utf8',
);
/** SQL sin comentarios de línea: el bloque de verificación no cuenta como código. */
const sql = crudo.replace(/--[^\n]*/g, '');

describe(`migración ${ARCHIVO}`, () => {
  it('crea el índice único parcial de códigos pendientes', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq\s+ON public\.whatsapp_link_codes \(code\)\s+WHERE used_at IS NULL;/,
    );
  });

  it('limpia vencidos y repetidos ANTES de crear el índice único (si no, CREATE UNIQUE INDEX falla)', () => {
    const vencidos = sql.search(
      /DELETE FROM public\.whatsapp_link_codes\s+WHERE used_at IS NULL\s+AND expires_at <= now\(\);/,
    );
    const repetidos = sql.search(
      /DELETE FROM public\.whatsapp_link_codes c\s+WHERE c\.used_at IS NULL\s+AND EXISTS/,
    );
    const indice = sql.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq',
    );
    expect(vencidos).toBeGreaterThanOrEqual(0);
    expect(repetidos).toBeGreaterThan(vencidos);
    expect(indice).toBeGreaterThan(repetidos);
  });

  it('solo borra códigos SIN usar (los canjeados son el historial de vínculos)', () => {
    const deletes = sql.match(/DELETE FROM[^;]+;/g) ?? [];
    expect(deletes).toHaveLength(2);
    for (const d of deletes) {
      expect(d).toMatch(/used_at IS NULL/);
    }
  });

  it('crea whatsapp_link_attempts con las columnas y el índice del contrato', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.whatsapp_link_attempts \(\s*id bigserial PRIMARY KEY,\s*phone_e164 text NOT NULL,\s*created_at timestamptz NOT NULL DEFAULT now\(\)\s*\);/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_phone_created_idx\s+ON public\.whatsapp_link_attempts \(phone_e164, created_at DESC\);/,
    );
  });

  it('indexa created_at: la purga borra lo anterior a la ventana de cualquier número', () => {
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_created_idx\s+ON public\.whatsapp_link_attempts \(created_at\);/,
    );
  });

  it('whatsapp_link_attempts: RLS activo, sin políticas y sin acceso para PUBLIC/anon/authenticated', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.whatsapp_link_attempts ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(
      /REVOKE ALL ON public\.whatsapp_link_attempts FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON SEQUENCE public\.whatsapp_link_attempts_id_seq FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).not.toMatch(
      /GRANT[^;]*\bTO\b[^;]*\b(anon|authenticated|PUBLIC)\b/i,
    );
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, DELETE ON public\.whatsapp_link_attempts TO service_role;/,
    );
    expect(sql).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE public\.whatsapp_link_attempts_id_seq TO service_role;/,
    );
  });

  it('es idempotente: todo CREATE TABLE/INDEX lleva IF NOT EXISTS y no hay DROP TABLE ni TRUNCATE', () => {
    expect(sql).not.toMatch(
      /CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+(?!\s|IF NOT EXISTS)/i,
    );
    expect(sql).not.toMatch(/\b(DROP\s+TABLE|TRUNCATE)\b/i);
  });

  it('deja un bloque comentado de verificación manual', () => {
    expect(crudo).toMatch(/-- Verificación manual/);
    expect(crudo).toMatch(/-- SELECT code, count\(\*\)/);
  });
});
