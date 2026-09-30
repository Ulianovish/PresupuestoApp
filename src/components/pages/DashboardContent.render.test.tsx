import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Render estático (vitest en node, sin DOM): los efectos no corren. Se
// simulan los datos y los organismos que no son la checklist.
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
  supabase: {},
}));
vi.mock('@/lib/actions/onboarding', () => ({
  dismissChecklistAction: vi.fn(),
}));
vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    summary: null,
    budgetData: null,
    isLoading: false,
    error: null,
    refreshData: vi.fn(),
    selectedMonth: '2026-09',
  }),
}));
vi.mock('@/lib/services/credit-cards', () => ({
  getCreditCardsSummary: vi.fn(),
}));
vi.mock('@/lib/services/expenses', () => ({
  formatMonthName: () => 'Septiembre 2026',
}));
const { stub } = vi.hoisted(() => ({
  stub: (nombre: string) => ({ default: () => <div>{nombre}</div> }),
}));
vi.mock('@/components/organisms/DashboardHeader/DashboardHeader', () =>
  stub('stub-header'),
);
vi.mock(
  '@/components/organisms/DashboardSummaryCards/DashboardSummaryCards',
  () => stub('stub-resumen'),
);
vi.mock(
  '@/components/organisms/DashboardQuickActions/DashboardQuickActions',
  () => stub('stub-acciones-rapidas'),
);
vi.mock(
  '@/components/organisms/DashboardMainContent/DashboardMainContent',
  () => stub('stub-contenido'),
);
vi.mock('@/components/organisms/CreditCardsSummary/CreditCardsSummary', () =>
  stub('stub-tarjetas'),
);

import { computeChecklist } from '@/lib/onboarding/checklist';

import DashboardContent from './DashboardContent';

const USER = { id: '00000000-0000-4000-8000-000000000001' };
const ITEMS = computeChecklist({
  accountCount: 1,
  deudaCount: 0,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
});
const TITULO = 'Termina de configurar tu presupuesto';

describe('DashboardContent (checklist)', () => {
  it('con ítems, pinta la checklist encima de las acciones rápidas', () => {
    const html = renderToStaticMarkup(
      <DashboardContent user={USER} checklist={ITEMS} />,
    );

    expect(html).toContain(TITULO);
    expect(html.indexOf(TITULO)).toBeLessThan(
      html.indexOf('stub-acciones-rapidas'),
    );
  });

  it('con checklist null o sin la prop, no la pinta', () => {
    for (const html of [
      renderToStaticMarkup(<DashboardContent user={USER} checklist={null} />),
      renderToStaticMarkup(<DashboardContent user={USER} />),
    ]) {
      expect(html).not.toContain(TITULO);
      expect(html).toContain('stub-acciones-rapidas');
    }
  });
});
