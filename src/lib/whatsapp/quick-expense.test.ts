import { describe, expect, it } from 'vitest';

import { parseQuickExpense } from './quick-expense';

describe('parseQuickExpense', () => {
  it('"20k taxi" → 20000 / taxi', () => {
    expect(parseQuickExpense('20k taxi')).toEqual({ amount: 20000, description: 'taxi' });
  });

  it('"taxi 20k" → 20000 / taxi (monto al final)', () => {
    expect(parseQuickExpense('taxi 20k')).toEqual({ amount: 20000, description: 'taxi' });
  });

  it('"gasté 35000 en mercado" → 35000 / mercado', () => {
    expect(parseQuickExpense('gasté 35000 en mercado')).toEqual({
      amount: 35000,
      description: 'mercado',
    });
  });

  it('"$15.000 almuerzo" → 15000 / almuerzo (separador de miles con punto)', () => {
    expect(parseQuickExpense('$15.000 almuerzo')).toEqual({
      amount: 15000,
      description: 'almuerzo',
    });
  });

  it('"2 mil pan" → 2000 / pan', () => {
    expect(parseQuickExpense('2 mil pan')).toEqual({ amount: 2000, description: 'pan' });
  });

  it('"1.5k café" → 1500 / café (k con decimal)', () => {
    expect(parseQuickExpense('1.5k café')).toEqual({ amount: 1500, description: 'café' });
  });

  it('sin monto → null', () => {
    expect(parseQuickExpense('hola')).toBeNull();
    expect(parseQuickExpense('')).toBeNull();
  });

  it('sin descripción usable → null (solo número)', () => {
    expect(parseQuickExpense('20000')).toBeNull();
  });

  it('monto absurdo (typo) → null', () => {
    expect(parseQuickExpense('999999k taxi')).toBeNull();
    expect(parseQuickExpense('500000 mil pan')).toBeNull();
  });

  it('monto grande pero válido (≤100M) sí pasa', () => {
    expect(parseQuickExpense('2000000 arriendo')).toEqual({
      amount: 2000000,
      description: 'arriendo',
    });
  });
});
