import { describe, expect, it } from 'vitest';

import {
  editCurrencyText,
  formatCurrencyDisplay,
  pasteCurrencyText,
} from './currency-input-format';

describe('formatCurrencyDisplay', () => {
  it('formatea con agrupación es-CO y deja vacío el cero', () => {
    expect(formatCurrencyDisplay(0)).toBe('');
    expect(formatCurrencyDisplay(5630)).toBe('$5.630');
    expect(formatCurrencyDisplay(1900000)).toBe('$1.900.000');
  });
});

describe('editCurrencyText (lo que queda en el input tras teclear)', () => {
  it('reagrupa los dígitos tecleados', () => {
    expect(editCurrencyText('$1.2345')).toEqual({
      display: '$12.345',
      value: 12345,
    });
  });

  it('vacío o solo "$" → 0', () => {
    expect(editCurrencyText('')).toEqual({ display: '', value: 0 });
    expect(editCurrencyText('$')).toEqual({ display: '', value: 0 });
  });

  it('deja escribir la coma decimal sin perderla', () => {
    expect(editCurrencyText('$1.234,')).toEqual({
      display: '$1.234,',
      value: 1234,
    });
  });

  it('con decimales muestra la coma y emite pesos redondeados', () => {
    expect(editCurrencyText('$563.091,09')).toEqual({
      display: '$563.091,09',
      value: 563091,
    });
    expect(editCurrencyText('$1.234,5')).toEqual({
      display: '$1.234,5',
      value: 1235,
    });
  });

  it('máximo 2 decimales y una sola coma', () => {
    expect(editCurrencyText('$1.234,567')).toEqual({
      display: '$1.234,56',
      value: 1235,
    });
    expect(editCurrencyText('$1.234,5,6')).toEqual({
      display: '$1.234,56',
      value: 1235,
    });
  });

  it('una coma sin parte entera arranca en 0', () => {
    expect(editCurrencyText(',5')).toEqual({ display: '$0,5', value: 1 });
  });

  it('borrar el último dígito es edición normal (no multiplica por 100)', () => {
    // $56.309.109 → backspace → "$56.309.10"
    expect(editCurrencyText('$56.309.10')).toEqual({
      display: '$5.630.910',
      value: 5630910,
    });
  });

  it('borrar un decimal no toca la parte entera', () => {
    expect(editCurrencyText('$563.091,0')).toEqual({
      display: '$563.091,0',
      value: 563091,
    });
    expect(editCurrencyText('$563.091,')).toEqual({
      display: '$563.091,',
      value: 563091,
    });
  });

  it('ignora letras y demás basura', () => {
    expect(editCurrencyText('$12a3')).toEqual({ display: '$123', value: 123 });
  });
});

describe('pasteCurrencyText', () => {
  it('pegar "563.091,09" da 563091 (antes daba 56309109)', () => {
    expect(pasteCurrencyText('563.091,09')).toEqual({
      display: '$563.091',
      value: 563091,
    });
  });

  it('pegar un monto con miles da el valor correcto', () => {
    expect(pasteCurrencyText('$ 1.900.000')).toEqual({
      display: '$1.900.000',
      value: 1900000,
    });
    expect(pasteCurrencyText('45.400,00')?.value).toBe(45400);
    expect(pasteCurrencyText('40k')?.value).toBe(40000);
  });

  it('texto que no es monto → null (el input no cambia)', () => {
    expect(pasteCurrencyText('hola')).toBeNull();
    expect(pasteCurrencyText('1.23.456')).toBeNull();
  });
});
