import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Limpieza de S07 (contratos §5.2): archivos del dueño que ya no deben
// existir ni ser importados. Test de texto: vitest corre en `node` desde la
// raíz del repo.
const raiz = process.cwd();
const leer = (ruta: string) => readFileSync(resolve(raiz, ruta), 'utf8');

describe('sin datos del dueño en el código (S07)', () => {
  it.each([
    'src/scripts/migrate-july-data.ts',
    'src/scripts/migrate-july-expenses.ts',
    'src/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel.tsx',
    'src/components/organisms/BudgetMigrationPanel/BudgetMigrationPanel.tsx',
    'src/hooks/useBudgetData.ts',
  ])('%s ya no existe', ruta => {
    expect(existsSync(resolve(raiz, ruta))).toBe(false);
  });

  it.each([
    'src/components/templates/ExpensePageTemplate/ExpensePageTemplate.tsx',
    'src/components/templates/BudgetPageTemplate/BudgetPageTemplate.tsx',
  ])('%s no importa los paneles de migración borrados', ruta => {
    expect(leer(ruta)).not.toMatch(
      /from ['"]@\/components\/organisms\/(Expense|Budget)MigrationPanel/,
    );
  });
});
