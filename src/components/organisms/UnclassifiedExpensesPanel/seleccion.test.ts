import { describe, expect, it } from 'vitest';

import type { BudgetItemRef } from '@/lib/services/expenses-rollup';

import {
  asignacionesAGuardar,
  mensajeClasificacion,
  sugerenciaVisible,
  valorDelSelect,
  type SugerenciasPorGasto,
} from './seleccion';

const ITEMS: BudgetItemRef[] = [
  { id: 'cine', name: 'Cine', category_name: 'GASTOS PERSONALES' },
  { id: 'rest', name: 'Restaurantes', category_name: 'GASTOS PERSONALES' },
  { id: 'arriendo', name: 'Arriendo', category_name: 'VIVIENDA' },
];

const GASTOS = [
  { id: 'g1', category_name: 'GASTOS PERSONALES' },
  { id: 'g2', category_name: 'VIVIENDA' },
  { id: 'g3', category_name: 'GASTOS PERSONALES' },
];

describe('valorDelSelect', () => {
  it('sin sugerencia ni selección queda en "Sin asignar" (no el primer ítem de la categoría)', () => {
    // Antes: una cena salía con "Cine" preseleccionado solo porque era el
    // primer ítem alfabético de GASTOS PERSONALES.
    expect(valorDelSelect(GASTOS[0], {}, {}, ITEMS)).toBe('');
  });

  it('usa la sugerencia real (historial/IA) si existe', () => {
    const sug: SugerenciasPorGasto = {
      g2: { budgetItemId: 'arriendo', source: 'historial' },
    };
    expect(valorDelSelect(GASTOS[1], {}, sug, ITEMS)).toBe('arriendo');
  });

  it('lo que el usuario eligió gana sobre la sugerencia, incluido "Sin asignar"', () => {
    const sug: SugerenciasPorGasto = {
      g1: { budgetItemId: 'cine', source: 'ai' },
    };
    expect(valorDelSelect(GASTOS[0], { g1: 'rest' }, sug, ITEMS)).toBe('rest');
    expect(valorDelSelect(GASTOS[0], { g1: '' }, sug, ITEMS)).toBe('');
  });

  it('ignora una sugerencia que no es un ítem del mes', () => {
    const sug: SugerenciasPorGasto = {
      g1: { budgetItemId: 'item-de-otro-mes', source: 'historial' },
    };
    expect(valorDelSelect(GASTOS[0], {}, sug, ITEMS)).toBe('');
  });
});

describe('sugerenciaVisible', () => {
  it('marca la sugerencia mientras el usuario no haya tocado el desplegable', () => {
    const sug: SugerenciasPorGasto = {
      g2: { budgetItemId: 'arriendo', source: 'historial' },
    };
    expect(sugerenciaVisible(GASTOS[1], {}, sug, ITEMS)).toEqual({
      budgetItemId: 'arriendo',
      source: 'historial',
    });
    expect(
      sugerenciaVisible(GASTOS[1], { g2: 'arriendo' }, sug, ITEMS),
    ).toBeNull();
    expect(sugerenciaVisible(GASTOS[0], {}, sug, ITEMS)).toBeNull();
  });
});

describe('asignacionesAGuardar', () => {
  it('no guarda las filas sin valor', () => {
    expect(asignacionesAGuardar(GASTOS, {}, {}, ITEMS)).toEqual([]);
  });

  it('una sugerencia aceptada sin tocar se guarda con el origen de la sugerencia', () => {
    const sug: SugerenciasPorGasto = {
      g2: { budgetItemId: 'arriendo', source: 'historial' },
      g3: { budgetItemId: 'rest', source: 'ai' },
    };
    expect(asignacionesAGuardar(GASTOS, {}, sug, ITEMS)).toEqual([
      { expenseId: 'g2', budgetItemId: 'arriendo', source: 'historial' },
      { expenseId: 'g3', budgetItemId: 'rest', source: 'ai' },
    ]);
  });

  it("'manual' solo cuando el usuario cambió el desplegable", () => {
    const sug: SugerenciasPorGasto = {
      g3: { budgetItemId: 'rest', source: 'ai' },
    };
    const seleccion = { g1: 'rest', g3: 'cine' };
    expect(asignacionesAGuardar(GASTOS, seleccion, sug, ITEMS)).toEqual([
      { expenseId: 'g1', budgetItemId: 'rest', source: 'manual' },
      { expenseId: 'g3', budgetItemId: 'cine', source: 'manual' },
    ]);
  });

  it('si el usuario puso "Sin asignar" sobre una sugerencia, no se guarda', () => {
    const sug: SugerenciasPorGasto = {
      g2: { budgetItemId: 'arriendo', source: 'historial' },
    };
    expect(asignacionesAGuardar(GASTOS, { g2: '' }, sug, ITEMS)).toEqual([]);
  });
});

describe('mensajeClasificacion', () => {
  it('reporta el número REAL asignado y el desglose', () => {
    expect(
      mensajeClasificacion({
        total: 5,
        assigned: 2,
        byHistory: 1,
        byAi: 1,
        skippedNoBudget: 0,
        unmatched: 3,
        recategorized: 0,
      }),
    ).toBe(
      'Se asignaron 2 de 5 gastos (1 por tu historial, 1 por IA). 3 quedan para asignar a mano.',
    );
  });

  it('dice cuántos se saltaron por no haber presupuesto en el mes', () => {
    expect(
      mensajeClasificacion({
        total: 3,
        assigned: 0,
        byHistory: 0,
        byAi: 0,
        skippedNoBudget: 3,
        unmatched: 0,
        recategorized: 0,
      }),
    ).toBe(
      'No se asignó ningún gasto. 3 son de un mes sin presupuesto (créalo primero).',
    );
  });

  it('avisa cuántos cambiaron de categoría por el historial', () => {
    expect(
      mensajeClasificacion({
        total: 2,
        assigned: 2,
        byHistory: 2,
        byAi: 0,
        skippedNoBudget: 0,
        unmatched: 0,
        recategorized: 1,
      }),
    ).toBe(
      'Se asignaron 2 de 2 gastos (2 por tu historial). 1 cambió de categoría según tu historial.',
    );
  });
});
