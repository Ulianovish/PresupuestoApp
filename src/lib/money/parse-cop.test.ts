import { describe, expect, it } from 'vitest';

import {
  isCopAmountSuffix,
  parseCopAmount,
  parseCopAmountAbs,
} from './parse-cop';

describe('parseCopAmount', () => {
  // Formato colombiano: "." de miles y "," de decimales. Todos los parsers de
  // la app pasan por acá, así que esta tabla es el contrato.
  const casos: Array<[string, number | null]> = [
    // Los casos del bug: cada parser devolvía algo distinto.
    ['$ 563.091,09', 563091],
    ['45.400,00', 45400],
    ['1.900.000', 1900000],
    ['40k', 40000],
    ['1,5M', 1500000],
    ['563091.09', 563091],
    // Montos típicos de facturas y extractos.
    ['$4.542.819,00', 4542819],
    ['1.234.567,8', 1234568],
    ['12,345.67', 12346],
    ['$ 9.000,00', 9000],
    ['120.000,00', 120000],
    ['$15.000', 15000],
    ['35000', 35000],
    ['1,900,000', 1900000],
    // Un solo separador seguido de 3 dígitos es de miles.
    ['5.630', 5630],
    ['45,400', 45400],
    // Un solo separador seguido de 1–2 dígitos es decimal.
    ['0,50', 1], // 0,5 redondea a 1 peso (Math.round)
    ['884,40', 884],
    ['99.5', 100],
    // Sufijos.
    ['2.5k', 2500],
    ['1,5k', 1500],
    ['20K', 20000],
    ['30 mil', 30000],
    ['30mil', 30000],
    ['1.5 mil', 1500],
    ['2m', 2000000],
    ['2 millones', 2000000],
    ['1 millón', 1000000],
    ['1 millon', 1000000],
    ['3 mill', 3000000],
    ['2 palos', 2000000],
    ['1 palo', 1000000],
    ['20 lucas', 20000],
    ['1 luca', 1000],
    ['1.500k', 1500000], // la base sigue las mismas reglas: "1.500" = 1500
    // Adornos que se ignoran.
    ['COP 45.000', 45000],
    ['45.000 cop', 45000],
    ['+45.000', 45000],
    ['$ 45.000', 45000],
    ['  12.000  ', 12000],
    // Inválidos.
    ['1.23.456', null],
    ['1.2345', null],
    ['15.', null],
    ['.5', null],
    ['1.234,5.6', null],
    ['abc', null],
    ['', null],
    ['   ', null],
    ['$', null],
    ['k', null],
    ['mil', null],
    ['-45.000', null],
    ['0', null],
    ['12abc', null],
    ['1e5', null],
  ];

  it.each(casos)('%j → %j', (input, esperado) => {
    expect(parseCopAmount(input)).toBe(esperado);
  });

  it('tolera null/undefined sin romper', () => {
    expect(parseCopAmount(undefined as unknown as string)).toBeNull();
    expect(parseCopAmount(null as unknown as string)).toBeNull();
  });
});

describe('isCopAmountSuffix', () => {
  it('reconoce las palabras sueltas que multiplican un monto', () => {
    for (const w of [
      'mil',
      'MIL',
      'k',
      'millones',
      'millón',
      'palos',
      'lucas',
    ]) {
      expect(isCopAmountSuffix(w)).toBe(true);
    }
  });

  it('no toma "m" suelta (puede ser metros) ni palabras comunes', () => {
    for (const w of ['m', 'pan', 'taxi', 'de', '']) {
      expect(isCopAmountSuffix(w)).toBe(false);
    }
  });
});

describe('parseCopAmountAbs (importación de extractos)', () => {
  it.each([
    ['1.900.000', 1900000],
    ['-45.000', 45000],
    ['$ -45.000', 45000],
    ['(45.000)', 45000],
    ['-4.175,89', 4176],
    ['884,40', 884],
    ['abc', null],
    ['', null],
  ])('%j → %j', (input, esperado) => {
    expect(parseCopAmountAbs(input)).toBe(esperado);
  });
});
