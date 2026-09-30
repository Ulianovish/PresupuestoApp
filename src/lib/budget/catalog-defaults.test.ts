import { describe, expect, it } from 'vitest';

import {
  DEFAULT_ITEM_CLASSIFICATION,
  DEFAULT_ITEM_CONTROL,
  DEFAULT_ITEM_STATUS,
  DEUDA_ITEM_CLASSIFICATION,
  DEUDA_ITEM_CONTROL,
} from '@/lib/constants/budget-defaults';

import {
  defaultItemFormNames,
  itemDefaultNamesFor,
  pickCatalogId,
} from './catalog-defaults';

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

describe('defaultItemFormNames', () => {
  const CONTROLES = [
    { id: 'ctl-eliminar', name: 'Eliminar' },
    { id: 'ctl-necesario', name: 'Necesario' },
    { id: 'ctl-reducir', name: 'Reducir' },
  ];

  it('catálogos aún sin cargar → nombres del contrato', () => {
    expect(defaultItemFormNames([], [])).toEqual({
      clasificacion: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('con catálogos → el nombre del contrato tal como está en el catálogo', () => {
    expect(
      defaultItemFormNames(CLASIFICACIONES, CONTROLES, 'VIVIENDA'),
    ).toEqual({
      clasificacion: 'Estilo de Vida',
      control: 'Reducir',
    });
  });

  it('categoría DEUDAS → Basico / Necesario', () => {
    expect(defaultItemFormNames(CLASIFICACIONES, CONTROLES, 'DEUDAS')).toEqual({
      clasificacion: 'Basico',
      control: 'Necesario',
    });
  });

  it('DEUDAS con catálogos aún sin cargar → Basico / Necesario', () => {
    // /presupuesto le pasa el nombre que ya conoce la tarjeta: no depende de
    // que la lista de categorías ni los catálogos hayan cargado.
    expect(defaultItemFormNames([], [], 'DEUDAS')).toEqual({
      clasificacion: 'Basico',
      control: 'Necesario',
    });
  });

  it('si el nombre no está en el catálogo → el primero de la lista', () => {
    const sinEstilo = [{ id: 'cls-basico', name: 'Basico' }];
    expect(defaultItemFormNames(sinEstilo, CONTROLES)).toEqual({
      clasificacion: 'Basico',
      control: 'Reducir',
    });
  });
});
