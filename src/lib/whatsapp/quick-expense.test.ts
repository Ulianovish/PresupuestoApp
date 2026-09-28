import { describe, expect, it } from 'vitest';

import { parseQuickExpense } from './quick-expense';

describe('parseQuickExpense', () => {
  it('"20k taxi" → 20000 / taxi', () => {
    expect(parseQuickExpense('20k taxi')).toEqual({
      amount: 20000,
      description: 'taxi',
    });
  });

  it('"taxi 20k" → 20000 / taxi (monto al final)', () => {
    expect(parseQuickExpense('taxi 20k')).toEqual({
      amount: 20000,
      description: 'taxi',
    });
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
    expect(parseQuickExpense('2 mil pan')).toEqual({
      amount: 2000,
      description: 'pan',
    });
  });

  it('"1.5k café" → 1500 / café (k con decimal)', () => {
    expect(parseQuickExpense('1.5k café')).toEqual({
      amount: 1500,
      description: 'café',
    });
  });

  it('"$563.091,09 mercado" → 563091 (decimales con coma, no ×100 ni truncado raro)', () => {
    expect(parseQuickExpense('$563.091,09 mercado')).toEqual({
      amount: 563091,
      description: 'mercado',
    });
  });

  it('"1.900.000 arriendo" → 1900000 (varios puntos de miles)', () => {
    expect(parseQuickExpense('1.900.000 arriendo')).toEqual({
      amount: 1900000,
      description: 'arriendo',
    });
  });

  it('"1,5mm moto" → 1500000 (millones con decimal)', () => {
    expect(parseQuickExpense('1,5mm moto')).toEqual({
      amount: 1500000,
      description: 'moto',
    });
  });

  it('una "m" suelta no es millones: "gasolina 5m" / "5m de tela" no son $5.000.000', () => {
    expect(parseQuickExpense('gasolina 5m')).toBeNull();
    expect(parseQuickExpense('5m de tela')).toBeNull();
    expect(parseQuickExpense('cena 100m')).toBeNull();
  });

  it('"2 millones arriendo" → 2000000 (sufijo como palabra suelta)', () => {
    expect(parseQuickExpense('2 millones arriendo')).toEqual({
      amount: 2000000,
      description: 'arriendo',
    });
  });

  it('"20 lucas almuerzo" → 20000', () => {
    expect(parseQuickExpense('20 lucas almuerzo')).toEqual({
      amount: 20000,
      description: 'almuerzo',
    });
  });

  it('"1.5 mil pan" → 1500 (decimal antes de "mil")', () => {
    expect(parseQuickExpense('1.5 mil pan')).toEqual({
      amount: 1500,
      description: 'pan',
    });
  });

  it('"1.23.456 algo" → null (grupos de miles mal formados no son monto)', () => {
    expect(parseQuickExpense('1.23.456 algo')).toBeNull();
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

  it('el tope es exclusivo: 100 millones o más → null', () => {
    expect(parseQuickExpense('cena 100 millones')).toBeNull();
    expect(parseQuickExpense('100000000 cena')).toBeNull();
    expect(parseQuickExpense('99999999 carro')).toEqual({
      amount: 99999999,
      description: 'carro',
    });
  });

  it('monto grande pero válido (≤100M) sí pasa', () => {
    expect(parseQuickExpense('2000000 arriendo')).toEqual({
      amount: 2000000,
      description: 'arriendo',
    });
  });
});
