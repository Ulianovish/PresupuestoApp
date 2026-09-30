import { describe, expect, it } from 'vitest';

import { DEFAULT_ACCOUNT_NAME } from '@/lib/constants/expense-categories';

import {
  buildAccountOptions,
  NO_CATEGORIES_LABEL,
  pickDefaultAccount,
  pickDefaultCategory,
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
