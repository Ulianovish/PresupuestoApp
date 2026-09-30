import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node. La lógica de
// cada paso vive en src/lib/onboarding/wizard-steps.ts (con sus tests); aquí
// solo se asegura que el wizard la usa y no vuelve a tragarse la redirección.
const wizard = readFileSync(
  resolve(
    process.cwd(),
    'src/components/organisms/OnboardingWizard/OnboardingWizard.tsx',
  ),
  'utf8',
);

describe('OnboardingWizard (cableado con wizard-steps)', () => {
  it('termina con finishOnboarding, que relanza el NEXT_REDIRECT', () => {
    expect(wizard).toContain('finishOnboarding({');
    expect(wizard).toContain('complete: completeOnboardingAction');
    // Ninguna llamada directa a la acción: un catch alrededor la rompería.
    expect(wizard).not.toContain('await completeOnboardingAction(');
  });

  it('usa los manejadores de cada paso', () => {
    expect(wizard).toContain('saveIncomeStep({');
    expect(wizard).toContain('saveBudgetStep({');
    expect(wizard).toContain('applySuggestion(');
    expect(wizard).toContain('saveExpenseAndFinish({');
    expect(wizard).toContain('buildFirstExpense({');
  });

  it('recuerda el ingreso y el gasto ya guardados para no duplicarlos', () => {
    expect(wizard).toContain('guardado: ingresoGuardado');
    expect(wizard).toContain('setIngresoGuardado(guardado)');
    expect(wizard).toContain('onSaved: () => setGastoGuardado(true)');
    expect(wizard).toContain('gastoGuardado,');
  });
});
