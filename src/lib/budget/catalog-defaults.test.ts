import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEFAULT_ITEM_STATUS,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';

import { itemDefaultNamesFor, pickCatalogId } from './catalog-defaults';

const CLASIFICACIONES = [
  { id: 'cls-basico', name: 'Basico' },
  { id: 'cls-caprichos', name: 'Caprichos' },
  { id: 'cls-estilo', name: 'Estilo de Vida' },
];

describe('constantes de budget-defaults (contratos §2.5)', () => {
  it('tienen los nombres exactos del contrato', () => {
    expect(DEFAULT_ITEM_CLASSIFICATION).toBe('Estilo de Vida');
    expect(DEFAULT_ITEM_CONTROL).toBe('Reducir');
    expect(DEUDA_ITEM_CLASSIFICATION).toBe('Basico');
    expect(DEUDA_ITEM_CONTROL).toBe('Necesario');
    expect(DEFAULT_ITEM_STATUS).toBe('Activo');
  });
});

describe('pickCatalogId', () => {
  it('devuelve el id del nombre preferido sin respaldo', () => {
    expect(pickCatalogId(CLASIFICACIONES, 'Estilo de Vida')).toEqual({
      id: 'cls-estilo',
      name: 'Estilo de Vida',
      usedFallback: false,
    });
  });

  it('encuentra el nombre ignorando mayúsculas, tildes y espacios de borde', () => {
    expect(pickCatalogId(CLASIFICACIONES, '  estilo de vida ')).toEqual({
      id: 'cls-estilo',
      name: 'Estilo de Vida',
      usedFallback: false,
    });
    expect(pickCatalogId(CLASIFICACIONES, 'Básico')).toEqual({
      id: 'cls-basico',
      name: 'Basico',
      usedFallback: false,
    });
  });

  it('prefiere la coincidencia exacta sobre la normalizada', () => {
    const filas = [
      { id: 'a', name: 'basico' },
      { id: 'b', name: 'Basico' },
    ];
    expect(pickCatalogId(filas, 'Basico')?.id).toBe('b');
  });

  it('si el nombre no existe cae a la primera fila y lo marca', () => {
    expect(pickCatalogId(CLASIFICACIONES, 'No Existe')).toEqual({
      id: 'cls-basico',
      name: 'Basico',
      usedFallback: true,
    });
  });

  it('catálogo vacío → null', () => {
    expect(pickCatalogId([], 'Estilo de Vida')).toBeNull();
  });
});

describe('itemDefaultNamesFor', () => {
  it('categoría común → Estilo de Vida / Reducir', () => {
    expect(itemDefaultNamesFor('VIVIENDA')).toEqual({
      classification: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('DEUDAS (sin importar mayúsculas ni espacios) → Basico / Necesario', () => {
    const esperado = { classification: 'Basico', control: 'Necesario' };
    expect(itemDefaultNamesFor('DEUDAS')).toEqual(esperado);
    expect(itemDefaultNamesFor(' deudas ')).toEqual(esperado);
    expect(itemDefaultNamesFor('Deudas')).toEqual(esperado);
  });

  it('sin categoría (null/undefined/vacía) → valores generales', () => {
    const esperado = { classification: 'Estilo de Vida', control: 'Reducir' };
    expect(itemDefaultNamesFor(null)).toEqual(esperado);
    expect(itemDefaultNamesFor(undefined)).toEqual(esperado);
    expect(itemDefaultNamesFor('')).toEqual(esperado);
  });
});
