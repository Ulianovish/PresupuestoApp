import { redirect } from 'next/navigation';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/whatsapp/format', () => ({ todayBogota: () => '2026-09-15' }));

import {
  applySuggestion,
  buildFirstExpense,
  FINISH_ERROR_MESSAGE,
  finishOnboarding,
  ingresoSinCambios,
  montosCambiados,
  saveBudgetStep,
  saveExpenseAndFinish,
  saveIncomeStep,
} from './wizard-steps';

/** Un error NEXT_REDIRECT real, como el que rechaza la acción en el cliente. */
function errorDeRedireccion(): unknown {
  try {
    redirect('/dashboard');
  } catch (e) {
    return e;
  }
  throw new Error('redirect() no lanzó');
}

describe('finishOnboarding', () => {
  it('propaga el NEXT_REDIRECT de la acción (así Next navega) y no muestra el toast', async () => {
    const redireccion = errorDeRedireccion();
    const notify = vi.fn();

    await expect(
      finishOnboarding({
        complete: () => Promise.reject(redireccion),
        notify,
      }),
    ).rejects.toBe(redireccion);
    expect(notify).not.toHaveBeenCalled();
  });

  it('con otro error (red) avisa con el toast y devuelve false', async () => {
    const notify = vi.fn();

    await expect(
      finishOnboarding({
        complete: () => Promise.reject(new Error('Failed to fetch')),
        notify,
      }),
    ).resolves.toBe(false);
    expect(notify).toHaveBeenCalledWith(FINISH_ERROR_MESSAGE, 'error');
  });

  it('si la acción resuelve devuelve true sin avisar', async () => {
    const notify = vi.fn();

    await expect(
      finishOnboarding({ complete: () => Promise.resolve(), notify }),
    ).resolves.toBe(true);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('saveIncomeStep', () => {
  it('guarda monto y fuente (sin espacios) y devuelve lo guardado', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const notify = vi.fn();

    const r = await saveIncomeStep({
      monto: 3_500_000,
      fuente: ' Salario ',
      guardado: null,
      save,
      notify,
    });

    expect(save).toHaveBeenCalledWith({ monto: 3_500_000, fuente: 'Salario' });
    expect(r).toEqual({ monto: 3_500_000, fuente: 'Salario' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('si ya se guardó con los mismos valores no vuelve a llamar la acción', async () => {
    const save = vi.fn();
    const guardado = { monto: 3_500_000, fuente: 'Salario' };

    const r = await saveIncomeStep({
      monto: 3_500_000,
      fuente: 'Salario ',
      guardado,
      save,
      notify: vi.fn(),
    });

    expect(save).not.toHaveBeenCalled();
    expect(r).toEqual(guardado);
  });

  it('si cambió el monto vuelve a llamar la acción (que actualiza la fila de hoy)', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });

    const r = await saveIncomeStep({
      monto: 4_000_000,
      fuente: 'Salario',
      guardado: { monto: 3_500_000, fuente: 'Salario' },
      save,
      notify: vi.fn(),
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ monto: 4_000_000, fuente: 'Salario' });
  });

  it('con { ok: false } avisa el error de la acción y devuelve null', async () => {
    const notify = vi.fn();

    const r = await saveIncomeStep({
      monto: 3_500_000,
      fuente: 'Salario',
      guardado: null,
      save: vi.fn().mockResolvedValue({ ok: false, error: 'No autenticado' }),
      notify,
    });

    expect(r).toBeNull();
    expect(notify).toHaveBeenCalledWith('No autenticado', 'error');
  });

  it('si la acción lanza avisa un error genérico y devuelve null', async () => {
    const notify = vi.fn();

    const r = await saveIncomeStep({
      monto: 3_500_000,
      fuente: 'Salario',
      guardado: null,
      save: vi.fn().mockRejectedValue(new Error('red')),
      notify,
    });

    expect(r).toBeNull();
    expect(notify).toHaveBeenCalledWith(
      'No pudimos guardar tu ingreso. Intenta de nuevo.',
      'error',
    );
  });
});

describe('ingresoSinCambios', () => {
  it('compara monto y fuente sin espacios', () => {
    const guardado = { monto: 1_000_000, fuente: 'Salario' };
    expect(ingresoSinCambios(guardado, 1_000_000, ' Salario')).toBe(true);
    expect(ingresoSinCambios(guardado, 1_000_001, 'Salario')).toBe(false);
    expect(ingresoSinCambios(guardado, 1_000_000, 'Negocio')).toBe(false);
    expect(ingresoSinCambios(null, 1_000_000, 'Salario')).toBe(false);
  });
});

describe('saveBudgetStep', () => {
  it('guarda los montos y devuelve true', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const notify = vi.fn();

    await expect(
      saveBudgetStep({ montos: { a: 1000 }, cargados: {}, save, notify }),
    ).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith({ a: 1000 });
    expect(notify).not.toHaveBeenCalled();
  });

  it('con { ok: false } avisa y devuelve false', async () => {
    const notify = vi.fn();

    await expect(
      saveBudgetStep({
        montos: { a: 1000 },
        cargados: {},
        save: vi.fn().mockResolvedValue({ ok: false, error: 'Mal' }),
        notify,
      }),
    ).resolves.toBe(false);
    expect(notify).toHaveBeenCalledWith('Mal', 'error');
  });

  it('si la acción lanza avisa un error genérico y devuelve false', async () => {
    const notify = vi.fn();

    await expect(
      saveBudgetStep({
        montos: { a: 1000 },
        cargados: {},
        save: vi.fn().mockRejectedValue(new Error('red')),
        notify,
      }),
    ).resolves.toBe(false);
    expect(notify).toHaveBeenCalledWith(
      'No pudimos guardar tu presupuesto. Intenta de nuevo.',
      'error',
    );
  });
});

describe('montosCambiados', () => {
  it('deja solo los rubros cuyo monto cambió respecto a lo cargado', () => {
    expect(
      montosCambiados(
        { a: 1000, b: 2000, c: 0 },
        { a: 1000, b: 2500, c: 0, d: 300 },
      ),
    ).toEqual({ b: 2500, d: 300 });
  });

  it('sin cambios devuelve un objeto vacío', () => {
    expect(montosCambiados({ a: 1000 }, { a: 1000 })).toEqual({});
  });
});

describe('saveBudgetStep (solo lo que cambió)', () => {
  it('envía solo los rubros editados: no pisa montos de otra pestaña ni decimales', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      saveBudgetStep({
        // 'a' llegó redondeado (1500.5 → 1501) y no se tocó; 'b' se editó.
        cargados: { a: 1501, b: 0 },
        montos: { a: 1501, b: 200_000 },
        save,
        notify: vi.fn(),
      }),
    ).resolves.toBe(true);
    expect(save).toHaveBeenCalledWith({ b: 200_000 });
  });

  it('si nada cambió no llama la acción y sigue', async () => {
    const save = vi.fn();
    const notify = vi.fn();

    await expect(
      saveBudgetStep({
        cargados: { a: 1000 },
        montos: { a: 1000 },
        save,
        notify,
      }),
    ).resolves.toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('applySuggestion', () => {
  const items = [
    { id: 'basico', classificationName: 'Basico' },
    { id: 'deseo', classificationName: 'Estilo de Vida' },
    { id: 'impuestos', classificationName: 'Impuestos' },
    { id: 'rara', classificationName: 'Otra cosa' },
  ];

  it('llena los rubros de la regla y conserva los de Impuestos o desconocidos', () => {
    const r = applySuggestion(
      { basico: 5, deseo: 7, impuestos: 250_000, rara: 30_000 },
      1_000_000,
      items,
    );

    expect(r.montos).toEqual({
      basico: 500_000,
      deseo: 300_000,
      impuestos: 250_000,
      rara: 30_000,
    });
    expect(r.ahorroSinAsignar).toBe(200_000);
  });
});

describe('buildFirstExpense', () => {
  it('usa la cuenta por defecto, la fecha de hoy en Bogotá y la descripción sin espacios', () => {
    expect(
      buildFirstExpense({
        monto: 40_000,
        descripcion: '  Almuerzo ',
        categoria: 'OTROS',
      }),
    ).toEqual({
      description: 'Almuerzo',
      amount: 40_000,
      transaction_date: '2026-09-15',
      category_name: 'OTROS',
      account_name: 'Efectivo',
    });
  });
});

describe('saveExpenseAndFinish', () => {
  const expense = buildFirstExpense({
    monto: 40_000,
    descripcion: 'Almuerzo',
    categoria: 'OTROS',
  });

  it('guarda el gasto, lo marca como guardado, avisa y después termina', async () => {
    const orden: string[] = [];
    const create = vi.fn(async () => {
      orden.push('create');
    });
    const onSaved = vi.fn(() => orden.push('onSaved'));
    const finish = vi.fn(async () => {
      orden.push('finish');
    });
    const notify = vi.fn();

    await saveExpenseAndFinish({
      gastoGuardado: false,
      expense,
      create,
      onSaved,
      finish,
      notify,
    });

    expect(create).toHaveBeenCalledWith(expense);
    expect(orden).toEqual(['create', 'onSaved', 'finish']);
    expect(notify).toHaveBeenCalledWith(
      '¡Listo! Guardamos tu primer gasto.',
      'success',
    );
  });

  it('si el gasto ya se guardó no lo vuelve a crear: solo reintenta terminar', async () => {
    const create = vi.fn();
    const finish = vi.fn().mockResolvedValue(undefined);

    await saveExpenseAndFinish({
      gastoGuardado: true,
      expense,
      create,
      onSaved: vi.fn(),
      finish,
      notify: vi.fn(),
    });

    expect(create).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('si crear el gasto falla avisa y no termina', async () => {
    const onSaved = vi.fn();
    const finish = vi.fn();
    const notify = vi.fn();

    await saveExpenseAndFinish({
      gastoGuardado: false,
      expense,
      create: vi.fn().mockRejectedValue(new Error('red')),
      onSaved,
      finish,
      notify,
    });

    expect(onSaved).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      'No pudimos guardar el gasto. Intenta de nuevo.',
      'error',
    );
  });

  it('propaga el NEXT_REDIRECT de terminar sin avisar un error', async () => {
    const redireccion = errorDeRedireccion();
    const notify = vi.fn();

    await expect(
      saveExpenseAndFinish({
        gastoGuardado: false,
        expense,
        create: vi.fn().mockResolvedValue('id'),
        onSaved: vi.fn(),
        finish: () =>
          finishOnboarding({
            complete: () => Promise.reject(redireccion),
            notify,
          }),
        notify,
      }),
    ).rejects.toBe(redireccion);
    expect(notify).not.toHaveBeenCalledWith(expect.any(String), 'error');
  });
});
