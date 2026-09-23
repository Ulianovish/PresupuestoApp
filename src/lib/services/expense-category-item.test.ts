import { describe, it, expect } from 'vitest';

import { itemSigueEnCategoria } from './expense-category-item';

describe('itemSigueEnCategoria', () => {
  it('el ítem sigue valiendo si es de la misma categoría', () => {
    expect(itemSigueEnCategoria('ALICE', 'ALICE')).toBe(true);
  });

  it('el caso real: prenda de ALICE con ítem de GASTOS PERSONALES', () => {
    expect(itemSigueEnCategoria('ALICE', 'GASTOS PERSONALES')).toBe(false);
  });

  it('ignora mayúsculas, acentos y espacios', () => {
    expect(itemSigueEnCategoria('Educación', 'EDUCACION')).toBe(true);
    expect(itemSigueEnCategoria('  Mercado ', 'MERCADO')).toBe(true);
  });

  it('un gasto sin ítem no tiene nada que soltar', () => {
    expect(itemSigueEnCategoria('ALICE', null)).toBe(true);
    expect(itemSigueEnCategoria(null, null)).toBe(true);
  });

  it('con ítem pero sin categoría de gasto, se suelta', () => {
    expect(itemSigueEnCategoria(null, 'MERCADO')).toBe(false);
    expect(itemSigueEnCategoria('', 'MERCADO')).toBe(false);
  });
});
