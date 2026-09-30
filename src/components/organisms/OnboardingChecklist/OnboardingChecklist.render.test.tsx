import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// La server action importa el cliente de Supabase de servidor; aquí no se
// llama (solo se renderiza).
vi.mock('@/lib/actions/onboarding', () => ({
  dismissChecklistAction: vi.fn(),
}));

import { computeChecklist } from '@/lib/onboarding/checklist';

import OnboardingChecklist from './OnboardingChecklist';

const ITEMS = computeChecklist({
  accountCount: 1,
  deudaCount: 2,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
});

describe('OnboardingChecklist (marcado)', () => {
  const html = renderToStaticMarkup(<OnboardingChecklist items={ITEMS} />);

  it('muestra el título, el avance y el botón "Ocultar"', () => {
    expect(html).toContain('Termina de configurar tu presupuesto');
    expect(html).toContain('1 de 5 listos');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toMatch(/<button[^>]*>[\s\S]*?Ocultar/);
  });

  it('los pendientes enlazan a su página y los hechos van tachados sin enlace', () => {
    expect(html).toContain('href="/presupuesto"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/deudas"');
    expect(html).toMatch(/line-through[^>]*>Registra tarjetas y deudas/);
  });

  it('sin ítems no pinta nada', () => {
    expect(renderToStaticMarkup(<OnboardingChecklist items={[]} />)).toBe('');
  });

  it('"Ocultar" usa hideChecklist con dismissChecklistAction (restaura si ok:false)', () => {
    const fuente = readFileSync(
      resolve(__dirname, 'OnboardingChecklist.tsx'),
      'utf8',
    );
    expect(fuente).toContain('hideChecklist({');
    expect(fuente).toContain('dismiss: dismissChecklistAction');
    expect(fuente).not.toContain('await dismissChecklistAction(');
  });
});
