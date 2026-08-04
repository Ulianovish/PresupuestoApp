import { test, expect } from 'vitest';

import {
  buildExpenseItemPrompt,
  parseExpenseItemResponse,
} from './expense-item-classifier';

test('el prompt incluye las descripciones y los ítems válidos', () => {
  const prompt = buildExpenseItemPrompt(
    [{ description: 'Pernil' }, { description: 'Banano' }],
    ['Carnes', 'Frutas', 'Aseo'],
  );
  expect(prompt).toContain('Pernil');
  expect(prompt).toContain('Carnes, Frutas, Aseo');
  expect(prompt).toContain('NINGUNO');
});

test('parseo: nombres válidos se respetan; inválido y NINGUNO -> null', () => {
  const content = '{"items": ["Carnes", "NINGUNO", "Inexistente"]}';
  const result = parseExpenseItemResponse(content, 3, ['Carnes', 'Frutas']);
  expect(result).toEqual(['Carnes', null, null]);
});

test('parseo: contenido nulo -> todos null', () => {
  expect(parseExpenseItemResponse(null, 2, ['Carnes'])).toEqual([null, null]);
});
