import { describe, expect, it } from 'vitest';

import {
  NUEVO_GASTO_HREF,
  NUEVO_GASTO_PARAM,
  stripNewExpenseParam,
  wantsNewExpenseForm,
} from './nuevo-gasto';

describe('NUEVO_GASTO_HREF', () => {
  it('apunta a /gastos con nuevo=1', () => {
    expect(NUEVO_GASTO_PARAM).toBe('nuevo');
    expect(NUEVO_GASTO_HREF).toBe('/gastos?nuevo=1');
  });
});

describe('wantsNewExpenseForm', () => {
  it.each([
    ['?nuevo=1', true],
    ['nuevo=1', true],
    ['?mes=2026-09&nuevo=1', true],
    ['', false],
    ['?nuevo=0', false],
    ['?nuevo=', false],
    ['?otro=1', false],
  ])('%s → %s', (search, esperado) => {
    expect(wantsNewExpenseForm(search)).toBe(esperado);
  });

  it('reconoce el propio enlace del dashboard', () => {
    expect(wantsNewExpenseForm(NUEVO_GASTO_HREF.split('?')[1])).toBe(true);
  });
});

describe('stripNewExpenseParam', () => {
  it('quita nuevo=1 y deja la ruta limpia', () => {
    expect(stripNewExpenseParam('/gastos', '?nuevo=1')).toBe('/gastos');
  });

  it('conserva los demás parámetros', () => {
    expect(stripNewExpenseParam('/gastos', '?mes=2026-09&nuevo=1')).toBe(
      '/gastos?mes=2026-09',
    );
  });

  it('sin query devuelve la ruta tal cual', () => {
    expect(stripNewExpenseParam('/gastos', '')).toBe('/gastos');
  });
});
