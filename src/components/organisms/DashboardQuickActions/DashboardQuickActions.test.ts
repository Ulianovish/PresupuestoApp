import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node. La lógica
// del parámetro está probada en src/lib/onboarding/nuevo-gasto.test.ts.
const leer = (ruta: string) =>
  readFileSync(resolve(process.cwd(), ruta), 'utf8');

const quickActions = leer(
  'src/components/organisms/DashboardQuickActions/DashboardQuickActions.tsx',
);
const gastos = leer('src/app/gastos/page.tsx');

describe('Agregar Gasto (S10)', () => {
  it('es un enlace a NUEVO_GASTO_HREF, no un botón muerto', () => {
    expect(quickActions).not.toBe('');
    expect(quickActions).toMatch(
      /href=\{NUEVO_GASTO_HREF\}[\s\S]*?Agregar Gasto/,
    );
  });

  it('no envuelve un <Button> en un <Link> (deuda S10)', () => {
    expect(quickActions).not.toMatch(/<Link\b[\s\S]*?<Button\b/);
  });

  it('/gastos abre el formulario si llega el parámetro y limpia la URL', () => {
    expect(gastos).toContain('wantsNewExpenseForm(window.location.search)');
    expect(gastos).toContain('openModal();');
    expect(gastos).toContain('stripNewExpenseParam(');
  });
});
