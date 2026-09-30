/**
 * Test de contrato (contratos §2.5): los nombres por defecto de los rubros
 * tienen que existir ACTIVOS en los catálogos que dejan las migraciones.
 *
 * El resolver cae al primero activo por nombre si el nombre no existe, y en
 * producción ese es "Basico"/"Eliminar": justo el bug que quitó S08. Si alguien
 * desactiva o renombra una de estas filas en una migración, este test falla en
 * vez de dejar solo un console.warn en producción.
 *
 * budget_statuses no tiene siembra en supabase/migrations (vive en el esquema
 * remoto), así que "Activo" no se puede comprobar aquí.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from './budget-defaults';

type Tabla = 'classifications' | 'controls';

const MIGRACIONES = join(process.cwd(), 'supabase', 'migrations');

function sinComentarios(sql: string): string {
  return sql.replace(/--.*$/gm, '');
}

function nombres(lista: string): string[] {
  return [...lista.matchAll(/'([^']*)'/g)].map(m => m[1]);
}

/** Estado activo/inactivo de cada nombre tras aplicar todas las migraciones. */
function catalogosActivos(): Record<Tabla, Map<string, boolean>> {
  const estado: Record<Tabla, Map<string, boolean>> = {
    classifications: new Map(),
    controls: new Map(),
  };

  const archivos = readdirSync(MIGRACIONES)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const archivo of archivos) {
    const sql = sinComentarios(
      readFileSync(join(MIGRACIONES, archivo), 'utf8'),
    );
    const cambios: Array<{ pos: number; aplicar: () => void }> = [];

    for (const m of sql.matchAll(
      /UPDATE\s+(classifications|controls)\s+SET\s+is_active\s*=\s*(true|false)\s+WHERE\s+name\s*(?:IN\s*\(([^)]*)\)|=\s*'([^']*)')/gi,
    )) {
      const tabla = m[1].toLowerCase() as Tabla;
      const activo = m[2].toLowerCase() === 'true';
      const afectados = m[3] !== undefined ? nombres(m[3]) : [m[4]];
      cambios.push({
        pos: m.index ?? 0,
        aplicar: () => afectados.forEach(n => estado[tabla].set(n, activo)),
      });
    }

    for (const m of sql.matchAll(
      /INSERT\s+INTO\s+(classifications|controls)\s*\(\s*name\s*,\s*is_active\s*\)\s*VALUES([\s\S]*?);/gi,
    )) {
      const tabla = m[1].toLowerCase() as Tabla;
      const filas = [
        ...m[2].matchAll(/\(\s*'([^']*)'\s*,\s*(true|false)\s*\)/gi),
      ].map(f => [f[1], f[2].toLowerCase() === 'true'] as const);
      cambios.push({
        pos: m.index ?? 0,
        aplicar: () => filas.forEach(([n, a]) => estado[tabla].set(n, a)),
      });
    }

    cambios.sort((a, b) => a.pos - b.pos).forEach(c => c.aplicar());
  }

  return estado;
}

describe('contrato §2.5: nombres por defecto activos en los catálogos', () => {
  const estado = catalogosActivos();

  it.each([
    ['classifications', DEFAULT_ITEM_CLASSIFICATION],
    ['classifications', DEUDA_ITEM_CLASSIFICATION],
    ['controls', DEFAULT_ITEM_CONTROL],
    ['controls', DEUDA_ITEM_CONTROL],
  ] as const)('%s tiene "%s" activo', (tabla, nombre) => {
    expect(estado[tabla].get(nombre)).toBe(true);
  });
});
