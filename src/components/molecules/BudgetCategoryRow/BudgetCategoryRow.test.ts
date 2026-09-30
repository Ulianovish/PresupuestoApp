import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: vitest corre en node y no hay cómo simular el clic. La
// elección de clasificación/control por nombre está probada en
// src/lib/budget/catalog-defaults.test.ts (incluido DEUDAS sin catálogos).
const leer = (ruta: string) =>
  readFileSync(resolve(process.cwd(), ruta), 'utf8');

const row = leer(
  'src/components/molecules/BudgetCategoryRow/BudgetCategoryRow.tsx',
);
const table = leer('src/components/organisms/BudgetTable/BudgetTable.tsx');
const page = leer('src/app/presupuesto/page.tsx');

describe('agregar rubro recibe el nombre de la categoría desde la tarjeta', () => {
  it('la fila pasa id y nombre', () => {
    expect(row).toContain('onAddItem(category.id, category.nombre)');
    expect(row).toContain(
      'onAddItem: (categoryId: string, categoryName: string) => void;',
    );
  });

  it('la tabla declara la misma firma', () => {
    expect(table).toContain(
      'onAddItem: (categoryId: string, categoryName: string) => void;',
    );
  });

  it('/presupuesto usa el nombre recibido, no lo busca en la lista cargada', () => {
    expect(page).toContain(
      'const openAddModal = (categoriaId: string, categoryName: string) => {',
    );
    expect(page).not.toContain(
      'categories.find(cat => cat.id === categoriaId)?.nombre',
    );
  });
});
