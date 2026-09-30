import { describe, expect, it } from 'vitest';

import {
  STARTER_KIT_ERROR_MESSAGE,
  getBudgetPanelState,
  starterKitToast,
} from './budget-empty-state';

describe('getBudgetPanelState', () => {
  it('el error manda sobre la carga y sobre el vacío', () => {
    expect(
      getBudgetPanelState({
        isLoading: true,
        error: 'falló',
        categoryCount: 0,
      }),
    ).toBe('error');
  });

  it('mientras carga muestra la carga aunque aún no haya categorías', () => {
    expect(
      getBudgetPanelState({ isLoading: true, error: null, categoryCount: 0 }),
    ).toBe('loading');
  });

  it('sin categorías activas es el estado vacío', () => {
    expect(
      getBudgetPanelState({ isLoading: false, error: null, categoryCount: 0 }),
    ).toBe('sin-categorias');
  });

  it('con al menos una categoría se muestra la tabla', () => {
    expect(
      getBudgetPanelState({ isLoading: false, error: null, categoryCount: 1 }),
    ).toBe('con-datos');
  });
});

describe('starterKitToast', () => {
  it('kit sembrado mirando el mes actual', () => {
    expect(starterKitToast({ seeded: true }, '2026-09', '2026-09')).toEqual({
      message:
        'Listo: cargamos las categorías sugeridas. Ajusta el monto de cada rubro cuando quieras.',
      type: 'success',
    });
  });

  it('kit sembrado mirando otro mes avisa dónde quedaron los rubros', () => {
    expect(starterKitToast({ seeded: true }, '2026-08', '2026-09')).toEqual({
      message:
        'Listo: cargamos las categorías sugeridas. Sus rubros quedaron en el presupuesto del mes actual.',
      type: 'success',
    });
  });

  it('si no sembró y no hubo error es porque ya tiene categorías activas', () => {
    expect(starterKitToast({ seeded: false }, '2026-09', '2026-09')).toEqual({
      message:
        'Ya tienes categorías, así que no cargamos las sugeridas. Te las mostramos ahora.',
      type: 'success',
    });
  });

  it.each(['no_session', 'PGRST202', '23503', 'unexpected'])(
    'con error (%s) el aviso es de error e invita a crear la categoría a mano',
    error => {
      expect(
        starterKitToast({ seeded: false, error }, '2026-09', '2026-09'),
      ).toEqual({ message: STARTER_KIT_ERROR_MESSAGE, type: 'error' });
    },
  );

  it('el mensaje de error invita a crear la categoría a mano', () => {
    expect(STARTER_KIT_ERROR_MESSAGE).toBe(
      'No pudimos cargar las categorías sugeridas. Crea una categoría a mano.',
    );
  });
});
