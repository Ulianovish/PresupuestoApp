import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NUEVO_GASTO_HREF } from '@/lib/onboarding/nuevo-gasto';

import DashboardQuickActions from './DashboardQuickActions';

// Deuda S10: un <button> dentro de un <a> es HTML inválido y crea dos
// elementos enfocables por acceso.
describe('DashboardQuickActions (marcado)', () => {
  const html = renderToStaticMarkup(<DashboardQuickActions />);

  it('no anida botones dentro de enlaces', () => {
    expect(html).not.toContain('<button');
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*<button/);
  });

  it('los tres accesos son enlaces con su destino', () => {
    const hrefs = [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map(m =>
      m[1].replace(/&amp;/g, '&'),
    );
    expect(hrefs).toEqual([NUEVO_GASTO_HREF, '/presupuesto', '/gastos']);
    expect(html).toContain('Agregar Gasto');
    expect(html).toContain('Editar Presupuesto');
    expect(html).toContain('Ver Gastos');
  });
});
