import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// El entorno de vitest es `node` (sin DOM ni Testing Library): se verifica
// el código fuente. vitest corre desde la raíz del repo. Que el hook del mock
// ya no exista lo cubre src/__tests__/sin-datos-del-dueno.test.ts.
const sidebar = readFileSync(
  resolve(process.cwd(), 'src/components/organisms/Sidebar/Sidebar.tsx'),
  'utf8',
);

describe('Sidebar sin presupuesto de ejemplo', () => {
  it('no importa el hook del presupuesto mock', () => {
    expect(sidebar).not.toMatch(/from ['"]@\/hooks\/useBudgetData['"]/);
    expect(sidebar).not.toMatch(/\buseBudgetData\s*\(/);
  });

  it('no formatea montos de presupuesto', () => {
    expect(sidebar).not.toMatch(/\bformatCurrency\s*\(/);
  });
});
