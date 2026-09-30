import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';

import {
  buildAccountOptions,
  expenseSubmitGuard,
  isSaveBlockedByCategories,
  missingCategoryMessage,
  NO_CATEGORIES_LABEL,
  pickDefaultAccount,
  pickDefaultCategory,
  todayLocalISO,
  withFormDefaults,
} from './expense-form-defaults';

describe('DEFAULT_ACCOUNT_NAME', () => {
  it('es Efectivo', () => {
    expect(DEFAULT_ACCOUNT_NAME).toBe('Efectivo');
  });
});

describe('NO_CATEGORIES_LABEL', () => {
  it('es el texto del contrato', () => {
    expect(NO_CATEGORIES_LABEL).toBe('Primero crea una categoría');
  });
});

describe('pickDefaultAccount', () => {
  it('prefiere Efectivo si el usuario la tiene', () => {
    expect(pickDefaultAccount(['Cuenta A', 'Efectivo', 'Tarjeta B'])).toBe(
      'Efectivo',
    );
  });

  it('reconoce Efectivo sin importar mayúsculas y devuelve el nombre del usuario', () => {
    // La RPC busca la cuenta por nombre exacto: devolver 'Efectivo' aquí
    // crearía una cuenta duplicada.
    expect(pickDefaultAccount(['Cuenta A', 'efectivo'])).toBe('efectivo');
  });

  it('sin Efectivo, usa la primera cuenta del usuario', () => {
    expect(pickDefaultAccount(['Tarjeta B', 'Cuenta A'])).toBe('Tarjeta B');
  });

  it('sin cuentas, usa Efectivo (la RPC la crea al guardar)', () => {
    expect(pickDefaultAccount([])).toBe('Efectivo');
  });
});

describe('pickDefaultCategory', () => {
  it('usa la primera categoría del usuario', () => {
    expect(pickDefaultCategory(['HOGAR', 'COMIDA'])).toBe('HOGAR');
  });

  it('sin categorías, queda vacía', () => {
    expect(pickDefaultCategory([])).toBe('');
  });
});

describe('buildAccountOptions', () => {
  it('ofrece solo las cuentas del usuario', () => {
    expect(buildAccountOptions(['Cuenta A', 'Tarjeta B'])).toEqual([
      'Cuenta A',
      'Tarjeta B',
    ]);
  });

  it('sin cuentas, ofrece solo Efectivo', () => {
    expect(buildAccountOptions([])).toEqual(['Efectivo']);
  });

  it('agrega la cuenta actual si ya no está activa (edición de un gasto viejo)', () => {
    expect(buildAccountOptions(['Cuenta A'], 'Cuenta vieja')).toEqual([
      'Cuenta A',
      'Cuenta vieja',
    ]);
  });

  it('no duplica la cuenta actual ni agrega una vacía', () => {
    expect(buildAccountOptions(['Cuenta A'], 'Cuenta A')).toEqual(['Cuenta A']);
    expect(buildAccountOptions(['Cuenta A'], '')).toEqual(['Cuenta A']);
  });
});

describe('withFormDefaults', () => {
  const vacio = { description: '', category_name: '', account_name: '' };

  it('completa categoría y cuenta vacías con los valores por defecto', () => {
    expect(
      withFormDefaults(vacio, {
        categoryNames: ['HOGAR', 'COMIDA'],
        accountNames: ['Cuenta A', 'Efectivo'],
      }),
    ).toEqual({
      description: '',
      category_name: 'HOGAR',
      account_name: 'Efectivo',
    });
  });

  it('respeta lo que el usuario ya eligió y devuelve el mismo objeto', () => {
    const form = {
      ...vacio,
      category_name: 'COMIDA',
      account_name: 'Cuenta A',
    };
    const r = withFormDefaults(form, {
      categoryNames: ['HOGAR', 'COMIDA'],
      accountNames: ['Cuenta A', 'Efectivo'],
    });
    expect(r).toBe(form);
  });

  it('reemplaza una cuenta que no está entre las opciones del usuario', () => {
    // Pasa cuando el formulario arrancó con Efectivo antes de cargar las
    // cuentas y el usuario no tiene Efectivo.
    const form = { ...vacio, category_name: 'HOGAR', account_name: 'Efectivo' };
    expect(
      withFormDefaults(form, {
        categoryNames: ['HOGAR'],
        accountNames: ['Tarjeta B'],
      }).account_name,
    ).toBe('Tarjeta B');
  });

  it('reemplaza una categoría que el usuario no tiene', () => {
    const form = { ...vacio, category_name: 'OTRA', account_name: 'Efectivo' };
    expect(
      withFormDefaults(form, { categoryNames: ['HOGAR'], accountNames: [] })
        .category_name,
    ).toBe('HOGAR');
  });

  it('sin categorías, la categoría queda vacía y la cuenta en Efectivo', () => {
    expect(
      withFormDefaults(vacio, { categoryNames: [], accountNames: [] }),
    ).toEqual({ description: '', category_name: '', account_name: 'Efectivo' });
  });
});

describe('isSaveBlockedByCategories', () => {
  it('bloquea al crear cuando la carga terminó y no hay categorías', () => {
    expect(
      isSaveBlockedByCategories({
        isEditing: false,
        categoriesLoading: false,
        hasCategories: false,
      }),
    ).toBe(true);
  });

  it('no bloquea mientras las categorías cargan', () => {
    expect(
      isSaveBlockedByCategories({
        isEditing: false,
        categoriesLoading: true,
        hasCategories: false,
      }),
    ).toBe(false);
  });

  it('no bloquea si el usuario tiene categorías', () => {
    expect(
      isSaveBlockedByCategories({
        isEditing: false,
        categoriesLoading: false,
        hasCategories: true,
      }),
    ).toBe(false);
  });

  it('no bloquea la edición de un gasto viejo aunque no queden categorías', () => {
    expect(
      isSaveBlockedByCategories({
        isEditing: true,
        categoriesLoading: false,
        hasCategories: false,
      }),
    ).toBe(false);
  });
});

describe('expenseSubmitGuard', () => {
  it('al crear, mientras las categorías cargan: deshabilitado y sin texto (sin aviso)', () => {
    expect(
      expenseSubmitGuard({
        isEditing: false,
        categoriesLoading: true,
        hasCategories: false,
      }),
    ).toEqual({ disabled: true, disabledLabel: undefined });
  });

  it('al crear, sin categorías tras cargar: deshabilitado con el texto del contrato', () => {
    expect(
      expenseSubmitGuard({
        isEditing: false,
        categoriesLoading: false,
        hasCategories: false,
      }),
    ).toEqual({ disabled: true, disabledLabel: NO_CATEGORIES_LABEL });
  });

  it('al crear, con categorías: habilitado', () => {
    expect(
      expenseSubmitGuard({
        isEditing: false,
        categoriesLoading: false,
        hasCategories: true,
      }),
    ).toEqual({ disabled: false, disabledLabel: undefined });
  });

  it('al editar: habilitado aunque carguen o no haya categorías', () => {
    for (const categoriesLoading of [true, false]) {
      expect(
        expenseSubmitGuard({
          isEditing: true,
          categoriesLoading,
          hasCategories: false,
        }),
      ).toEqual({ disabled: false, disabledLabel: undefined });
    }
  });
});

describe('missingCategoryMessage', () => {
  it('mientras las categorías cargan no hay aviso (aún no se sabe si tiene)', () => {
    expect(missingCategoryMessage(true)).toBeNull();
  });

  it('con la carga terminada avisa con el texto del contrato', () => {
    expect(missingCategoryMessage(false)).toBe(NO_CATEGORIES_LABEL);
  });
});

describe('todayLocalISO', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a las 20:00 en Bogotá sigue siendo el mismo día (no el de UTC)', () => {
    vi.useFakeTimers();
    // 20:00 -05:00 del 15 de marzo = 01:00 UTC del 16 de marzo
    vi.setSystemTime(new Date('2026-03-15T20:00:00-05:00'));
    expect(todayLocalISO()).toBe('2026-03-15');
  });

  it('a las 00:30 en Bogotá ya es el día nuevo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-16T00:30:00-05:00'));
    expect(todayLocalISO()).toBe('2026-03-16');
  });
});
