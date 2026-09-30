import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (vitest corre en `node`, sin DOM): se verifica el código
// fuente. vitest corre desde la raíz del repo.
const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

describe('sin la migración de julio 2025 (contratos §5.2)', () => {
  it.each([
    'src/scripts/migrate-july-data.ts',
    'src/scripts/migrate-july-expenses.ts',
    'src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx',
    'src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx',
  ])('%s ya no existe', ruta => {
    expect(existsSync(resolve(raiz, ruta))).toBe(false);
  });

  it('ExpenseHeader no tiene el botón atado a 2025-07', () => {
    const header = leer(
      'src/components/organisms/ExpenseHeader/ExpenseHeader.tsx',
    );
    expect(header).not.toContain('2025-07');
    expect(header).not.toContain('onShowMigration');
    expect(header).not.toContain('Migrar Julio');
  });

  it('las plantillas ya no citan los paneles borrados', () => {
    for (const ruta of [
      'src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx',
      'src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx',
    ]) {
      const fuente = leer(ruta);
      expect(fuente).not.toContain('ExpenseMigrationPanel');
      expect(fuente).not.toContain('BudgetMigrationPanel');
    }
  });
});
