import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node. La lógica
// vive en src/lib/onboarding/budget-empty-state.ts (con sus propios tests);
// aquí solo se asegura que el panel la usa y ofrece las dos salidas.
const panel = readFileSync(
  resolve(
    process.cwd(),
    'src/components/organisms/BudgetStatusPanels/BudgetStatusPanels.tsx',
  ),
  'utf8',
);
const page = readFileSync(
  resolve(process.cwd(), 'src/app/presupuesto/page.tsx'),
  'utf8',
);

describe('BudgetStatusPanels (S10)', () => {
  it('ya no habla de migrar datos de julio ni depende de 2025-07', () => {
    expect(panel).not.toContain('Migrar Datos de Julio');
    expect(panel).not.toContain('2025-07');
  });

  it('decide el estado con getBudgetPanelState', () => {
    expect(panel).toContain('getBudgetPanelState(');
  });

  it('el estado vacío ofrece cargar el kit y crear una categoría', () => {
    expect(panel).toContain('Cargar categorías sugeridas');
    expect(panel).toContain('Crear categoría');
    expect(panel).toContain('onLoadStarterKit');
    expect(panel).toContain('onCreateCategory');
  });

  it('ya no ofrece "Crear Presupuesto" (con 0 categorías era un callejón)', () => {
    expect(panel).not.toContain('Crear Presupuesto');
    expect(panel).not.toContain('onCreateBudget');
  });
});

describe('/presupuesto cablea el panel vacío (S10)', () => {
  it('llama ensureStarterKitAction y abre el CategoryModal existente', () => {
    expect(page).toContain('ensureStarterKitAction()');
    expect(page).toContain('starterKitToast(');
    expect(page).toContain(
      'onCreateCategory={() => setShowCategoryModal(true)}',
    );
    expect(page).toContain('onLoadStarterKit={handleLoadStarterKit}');
    expect(page).toContain('categoryCount={categories.length}');
  });
});
