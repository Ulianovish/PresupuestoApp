import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// El entorno de vitest es `node` (sin DOM ni Testing Library): se verifica
// el código fuente. vitest corre desde la raíz del repo.
const raiz = process.cwd();
const sidebar = readFileSync(
  resolve(raiz, 'src/components/organisms/Sidebar/Sidebar.tsx'),
  'utf8',
);

describe('Sidebar sin presupuesto de ejemplo', () => {
  it('no usa el hook del presupuesto mock', () => {
    expect(sidebar).not.toContain('useBudgetData');
  });

  it('no muestra montos de presupuesto', () => {
    expect(sidebar).not.toContain('formatCurrency');
    expect(sidebar).not.toContain('summary.');
  });

  it('el hook del mock ya no existe', () => {
    expect(existsSync(resolve(raiz, 'src/hooks/useBudgetData.ts'))).toBe(false);
  });
});
