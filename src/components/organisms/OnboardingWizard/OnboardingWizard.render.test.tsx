import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Las server actions importan el cliente de Supabase de servidor; aquí no se
// llaman (solo se renderiza el primer paso).
vi.mock('@/lib/actions/onboarding', () => ({
  completeOnboardingAction: vi.fn(),
  saveOnboardingBudgetAction: vi.fn(),
  saveOnboardingIncomeAction: vi.fn(),
}));
vi.mock('@/lib/actions/whatsapp', () => ({
  generateWhatsAppLinkCodeAction: vi.fn(),
}));

import OnboardingWizard from './OnboardingWizard';

const ITEMS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Arriendo o cuota',
    categoryName: 'VIVIENDA',
    classificationName: 'Basico',
    budgetedAmount: 0,
  },
];

describe('OnboardingWizard (marcado inicial)', () => {
  const html = renderToStaticMarkup(
    <OnboardingWizard items={ITEMS} categoryNames={['OTROS']} />,
  );

  it('muestra los 3 pasos con el primero como actual', () => {
    expect(html).toContain('1. Tu ingreso');
    expect(html).toContain('2. Tu presupuesto');
    expect(html).toContain('3. Tu primer gasto');
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toMatch(
      /<li[^>]*aria-current="step"[^>]*>[\s\S]*?1\. Tu ingreso/,
    );
  });

  it('arranca en el paso 1 con "Saltar" y "Guardar y seguir"', () => {
    expect(html).toContain('id="paso-1-titulo"');
    expect(html).toContain('¿Cuánto te entra al mes?');
    expect(html).toContain('Saltar');
    expect(html).toContain('Guardar y seguir');
    expect(html).not.toContain('id="paso-2-titulo"');
    expect(html).not.toContain('id="paso-3-titulo"');
  });

  it('"Guardar y seguir" empieza deshabilitado (ingreso en 0)', () => {
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*>[\s\S]*?Guardar y seguir/,
    );
  });

  it('usa tuteo: nunca "vos"', () => {
    expect(html).not.toMatch(/\bvos\b/i);
  });
});
