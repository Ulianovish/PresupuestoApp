import { describe, it, expect } from 'vitest';

import {
  itemPorRegla,
  palabrasDe,
  REGLAS_CASA,
  resolverPorReglas,
} from './reglas-casa';

describe('palabrasDe', () => {
  it('quita tildes y parte por cualquier símbolo', () => {
    expect(palabrasDe('Pan Bimbo*360g*4und H\nAmbur/Dorado')).toEqual([
      'pan',
      'bimbo',
      '360g',
      '4und',
      'h',
      'ambur',
      'dorado',
    ]);
  });

  it('normaliza la eñe y las tildes', () => {
    expect(palabrasDe('Buñuelos Doña María')).toEqual([
      'bunuelos',
      'dona',
      'maria',
    ]);
  });
});

describe('itemPorRegla', () => {
  it.each([
    'Pan Tajado Multigran',
    'PAN HOJALDRADO 50 G',
    'Galleta Saltin Noel',
    'Galletas María',
    'Buñuelos',
    'buñuelo de la esquina',
    'Croissant de almendras',
    'Pandebono x5',
  ])('manda "%s" a Parva', descripcion => {
    expect(itemPorRegla(descripcion)).toBe('Parva');
  });

  it.each([
    'Pantalón Migue',
    'Pantalla LED',
    'Panela',
    'Pañales',
    'Compañía de seguros',
    'Panamerican Airways',
  ])('no toca "%s"', descripcion => {
    expect(itemPorRegla(descripcion)).toBeNull();
  });

  it('un guion sí separa la palabra: "pan-tajado" es pan', () => {
    expect(itemPorRegla('pan-tajado')).toBe('Parva');
  });

  it('sin descripción no hay regla', () => {
    expect(itemPorRegla('')).toBeNull();
    expect(itemPorRegla(null)).toBeNull();
    expect(itemPorRegla(undefined)).toBeNull();
  });

  it('acepta reglas propias', () => {
    const reglas = [{ item: 'Café', palabras: ['tinto'] }];
    expect(itemPorRegla('Tinto de la esquina', reglas)).toBe('Café');
    expect(itemPorRegla('Pan', reglas)).toBeNull();
  });

  it('las palabras de las reglas van sin tildes, para que el match funcione', () => {
    for (const regla of REGLAS_CASA) {
      for (const palabra of regla.palabras) {
        expect(palabra).toBe(palabra.normalize('NFD').replace(/[̀-ͯ]/g, ''));
        expect(palabra).toBe(palabra.toLowerCase());
      }
    }
  });
});

describe('resolverPorReglas', () => {
  it('devuelve el nombre tal como está escrito en el presupuesto', () => {
    expect(resolverPorReglas(['Pan Tajado'], ['Lacena', 'PARVA'])).toEqual([
      'PARVA',
    ]);
  });

  it('si el ítem de la regla no existe ese mes, no fuerza nada', () => {
    expect(resolverPorReglas(['Pan Tajado'], ['Lacena', 'Dulces'])).toEqual([
      null,
    ]);
  });

  it('deja pasar lo que ninguna regla cubre', () => {
    expect(
      resolverPorReglas(['Pan Tajado', 'Leche Entera'], ['Parva', 'Lacteos']),
    ).toEqual(['Parva', null]);
  });
});
