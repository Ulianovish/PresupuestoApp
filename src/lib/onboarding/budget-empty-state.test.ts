import { describe, expect, it, vi } from 'vitest';

import {
  STARTER_KIT_ERROR_MESSAGE,
  STARTER_KIT_RELOAD_ERROR_MESSAGE,
  getBudgetPanelState,
  loadStarterKitAndNotify,
  shouldReloadAfterStarterKit,
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

describe('shouldReloadAfterStarterKit', () => {
  it('recarga cuando se sembró el kit', () => {
    expect(shouldReloadAfterStarterKit({ seeded: true })).toBe(true);
  });

  it('recarga sin error aunque no se haya sembrado (ya tenía categorías)', () => {
    expect(shouldReloadAfterStarterKit({ seeded: false })).toBe(true);
  });

  it('no recarga si hubo error', () => {
    expect(
      shouldReloadAfterStarterKit({ seeded: false, error: 'no_session' }),
    ).toBe(false);
  });
});

describe('loadStarterKitAndNotify', () => {
  function deps(
    ensureStarterKit: () => Promise<{ seeded: boolean; error?: string }>,
  ) {
    return {
      ensureStarterKit: vi.fn(ensureStarterKit),
      reload: vi.fn(async () => {}),
      notify: vi.fn(),
      viewedMonth: '2026-09',
      currentMonth: '2026-09',
    };
  }

  it('sembró: avisa con éxito y recarga', async () => {
    const d = deps(async () => ({ seeded: true }));

    await loadStarterKitAndNotify(d);

    expect(d.notify).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledWith(
      expect.stringContaining('cargamos las categorías sugeridas'),
      'success',
    );
    expect(d.reload).toHaveBeenCalledTimes(1);
  });

  it('ya tenía categorías (seeded: false sin error): avisa y recarga para mostrárselas', async () => {
    const d = deps(async () => ({ seeded: false }));

    await loadStarterKitAndNotify(d);

    expect(d.notify).toHaveBeenCalledWith(
      expect.stringContaining('Ya tienes categorías'),
      'success',
    );
    expect(d.reload).toHaveBeenCalledTimes(1);
  });

  it('la acción devuelve error: aviso de error y no recarga', async () => {
    const d = deps(async () => ({ seeded: false, error: 'PGRST202' }));

    await loadStarterKitAndNotify(d);

    expect(d.notify).toHaveBeenCalledWith(STARTER_KIT_ERROR_MESSAGE, 'error');
    expect(d.reload).not.toHaveBeenCalled();
  });

  it('catch: si la acción lanza, aviso de error, no recarga y no propaga', async () => {
    const d = deps(async () => {
      throw new Error('red caída');
    });

    await expect(loadStarterKitAndNotify(d)).resolves.toBeUndefined();

    expect(d.notify).toHaveBeenCalledTimes(1);
    expect(d.notify).toHaveBeenCalledWith(STARTER_KIT_ERROR_MESSAGE, 'error');
    expect(d.reload).not.toHaveBeenCalled();
  });

  it('catch: si la recarga lanza, avisa que recargue la página y no propaga', async () => {
    const d = deps(async () => ({ seeded: true }));
    d.reload.mockRejectedValueOnce(new Error('fallo al refrescar'));

    await expect(loadStarterKitAndNotify(d)).resolves.toBeUndefined();

    expect(d.notify).toHaveBeenLastCalledWith(
      STARTER_KIT_RELOAD_ERROR_MESSAGE,
      'error',
    );
  });

  it('usa los meses que recibe para el aviso', async () => {
    const d = {
      ...deps(async () => ({ seeded: true })),
      viewedMonth: '2026-08',
    };

    await loadStarterKitAndNotify(d);

    expect(d.notify).toHaveBeenCalledWith(
      expect.stringContaining('presupuesto del mes actual'),
      'success',
    );
  });
});
