import { test, expect } from 'vitest';

import { resolveItemNameToId } from './expenses-rollup';

const items = [
  { id: 'a', name: 'Carnes', category_name: 'MERCADO' },
  { id: 'b', name: 'Frutas', category_name: 'MERCADO' },
];

test('resuelve nombre exacto a id', () => {
  expect(resolveItemNameToId('Carnes', items)).toBe('a');
});

test('nombre no encontrado o null -> null', () => {
  expect(resolveItemNameToId('Aseo', items)).toBeNull();
  expect(resolveItemNameToId(null, items)).toBeNull();
});

test('resuelve sin distinguir mayúsculas ni tildes (el modelo no copia exacto)', () => {
  const conTildes = [
    ...items,
    { id: 'c', name: 'Verduras y frutas', category_name: 'MERCADO' },
    { id: 'd', name: 'Lácteos', category_name: 'MERCADO' },
  ];
  expect(resolveItemNameToId('VERDURAS Y FRUTAS', conTildes)).toBe('c');
  expect(resolveItemNameToId('lacteos', conTildes)).toBe('d');
  expect(resolveItemNameToId(' carnes ', conTildes)).toBe('a');
});

test('prefiere el match exacto si hay varios equivalentes', () => {
  const dup = [
    { id: 'x', name: 'ASEO', category_name: 'MERCADO' },
    { id: 'y', name: 'Aseo', category_name: 'MERCADO' },
  ];
  expect(resolveItemNameToId('Aseo', dup)).toBe('y');
});
