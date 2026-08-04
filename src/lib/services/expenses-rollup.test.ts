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
