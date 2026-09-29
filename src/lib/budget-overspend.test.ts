import { describe, it, expect } from 'vitest';

import {
  mensajeSobregasto,
  porItem,
  type Sobregasto,
} from './budget-overspend';

const sobregasto = (itemId: string, excess: number): Sobregasto => ({
  itemId,
  previousMonth: '2026-09',
  budgeted: 350000,
  spent: 350000 + excess,
  excess,
});

describe('mensajeSobregasto', () => {
  it('dice el mes y cuánto se excedió', () => {
    // El formato es-CO separa el símbolo con espacio duro (U+00A0).
    expect(mensajeSobregasto('Octubre 2026', 100000)).toBe(
      'En Octubre 2026 excediste el presupuesto en $\u00a0100.000.',
    );
  });

  it('redondea a pesos, sin decimales', () => {
    expect(mensajeSobregasto('Septiembre 2026', 268828.45)).toContain(
      '268.828',
    );
  });
});

describe('porItem', () => {
  it('indexa por ítem', () => {
    const mapa = porItem([sobregasto('a', 1000), sobregasto('b', 2000)]);
    expect(Object.keys(mapa).sort()).toEqual(['a', 'b']);
    expect(mapa.a.excess).toBe(1000);
  });

  it('descarta los que no se excedieron', () => {
    expect(porItem([sobregasto('a', 0), sobregasto('b', -500)])).toEqual({});
  });

  it('sin datos devuelve vacío', () => {
    expect(porItem([])).toEqual({});
  });
});
