import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (vitest corre en `node`, sin DOM): se verifica el código
// fuente. vitest corre desde la raíz del repo.
const header = readFileSync(
  resolve(
    process.cwd(),
    'src/components/organisms/ExpenseHeader/ExpenseHeader.tsx',
  ),
  'utf8',
);

describe('ExpenseHeader', () => {
  it('no tiene el botón de migración atado a julio 2025 (contratos §5.2)', () => {
    expect(header).not.toMatch(/selectedMonth === ['"]2025-07['"]/);
    expect(header).not.toMatch(/\bonShowMigration\b/);
    expect(header).not.toContain('Migrar Julio');
  });

  it('«Importar Excel» se puede deshabilitar desde la página', () => {
    expect(header).toMatch(/importDisabled\?: boolean/);
    expect(header).toMatch(
      /disabled=\{isLoading \|\| isImporting \|\| importDisabled\}/,
    );
  });
});
