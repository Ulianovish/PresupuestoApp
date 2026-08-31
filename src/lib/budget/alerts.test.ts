import { describe, it, expect } from 'vitest';

import { evaluarRubro, formatearAlerta, dispararAlertas, rubrosEnRiesgo, type RubroEstado, type AlertDeps } from './alerts';

const rubro = (over: Partial<RubroEstado> = {}): RubroEstado => ({
  budgetItemId: 'item-1',
  itemName: 'Dulces',
  categoryName: 'MERCADO',
  budgeted: 150000,
  spent: 0,
  ...over,
});

describe('evaluarRubro', () => {
  it('no alerta por debajo del 80%', () => {
    expect(evaluarRubro(rubro({ spent: 100000 }))).toBeNull();
  });

  it('alerta al cruzar el 80%', () => {
    const a = evaluarRubro(rubro({ spent: 123000 }));
    expect(a).not.toBeNull();
    expect(a!.threshold).toBe(80);
    expect(Math.round(a!.pct)).toBe(82);
  });

  it('alerta al pasarse', () => {
    expect(evaluarRubro(rubro({ spent: 195000 }))!.threshold).toBe(100);
  });

  it('un rubro sin presupuesto es silencio, no división por cero', () => {
    expect(evaluarRubro(rubro({ budgeted: 0, spent: 50000 }))).toBeNull();
  });
});

describe('formatearAlerta', () => {
  const hoy = new Date(2026, 8, 22); // 22-sep-2026, quedan 9 días

  it('al 80% dice cuánto queda y para cuántos días', () => {
    const msg = formatearAlerta(evaluarRubro(rubro({ spent: 123000 }))!, hoy);
    expect(msg).toContain('⚠️');
    expect(msg).toContain('Dulces');
    expect(msg).toContain('82%');
    expect(msg).toContain('27.000');
    expect(msg).toContain('9 días');
  });

  it('al pasarse dice por cuánto', () => {
    const msg = formatearAlerta(evaluarRubro(rubro({ spent: 195000 }))!, hoy);
    expect(msg).toContain('🔴');
    expect(msg).toContain('130%');
    expect(msg).toContain('45.000');
    expect(msg).not.toContain('Te quedan');
  });

  it('no muestra 100% mientras siga por debajo del umbral', () => {
    // 99,6% redondearía a 100 y contradiría el "te quedan" de la misma frase.
    const msg = formatearAlerta(evaluarRubro(rubro({ spent: 149400 }))!, hoy);
    expect(msg).toContain('99%');
    expect(msg).toContain('Te quedan');
    expect(msg).not.toContain('100%');
  });
});

function depsFake(
  estado: RubroEstado[],
  yaEnviados: Record<string, number> = {},
): AlertDeps {
  return {
    cargarEstado: async () => estado,
    // Réplica en memoria del ON CONFLICT ... WHERE last_threshold < excluded:
    // solo "entra" si sube el umbral.
    marcarEnviado: async (_u, _m, id, threshold) => {
      if ((yaEnviados[id] ?? 0) >= threshold) return false;
      yaEnviados[id] = threshold;
      return true;
    },
  };
}

describe('dispararAlertas', () => {
  const hoy = new Date(2026, 8, 22);
  const args = {
    userId: 'u1',
    monthYear: '2026-09',
    budgetItemIds: ['item-1'],
    hoy,
  };

  it('avisa la primera vez que cruza el 80%', async () => {
    const msgs = await dispararAlertas(depsFake([rubro({ spent: 123000 })]), args);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('82%');
  });

  it('no repite el mismo umbral', async () => {
    const enviados = {};
    const deps = depsFake([rubro({ spent: 123000 })], enviados);
    expect(await dispararAlertas(deps, args)).toHaveLength(1);
    expect(await dispararAlertas(deps, args)).toHaveLength(0);
  });

  it('vuelve a avisar cuando sube de escalón', async () => {
    const enviados = {};
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 123000 })], enviados), args),
    ).toHaveLength(1);
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(1); // cruzó el 100
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 200000 })], enviados), args),
    ).toHaveLength(0); // sigue en 100, no repite
  });

  it('cruzar 80 y 100 de un solo golpe manda un solo aviso, el del 100', async () => {
    const msgs = await dispararAlertas(depsFake([rubro({ spent: 195000 })]), args);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('🔴');
  });

  it('solo mira los rubros que tocó el gasto', async () => {
    const estado = [
      rubro({ budgetItemId: 'item-1', spent: 123000 }),
      rubro({ budgetItemId: 'item-2', itemName: 'Cine', spent: 999000 }),
    ];
    const msgs = await dispararAlertas(depsFake(estado), args); // solo item-1
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Dulces');
  });

  it('junta las alertas de una factura que toca varios rubros', async () => {
    const estado = [
      rubro({ budgetItemId: 'item-1', spent: 123000 }),
      rubro({ budgetItemId: 'item-2', itemName: 'Cine', budgeted: 60000, spent: 90000 }),
    ];
    const msgs = await dispararAlertas(depsFake(estado), {
      ...args,
      budgetItemIds: ['item-1', 'item-2'],
    });
    expect(msgs).toHaveLength(2);
  });

  it('un rubro que no está vigilado no aparece en el estado y no alerta', async () => {
    const msgs = await dispararAlertas(depsFake([]), args);
    expect(msgs).toHaveLength(0);
  });

  it('una corrección que baja el gasto no "des-avisa" ni re-avisa al volver a subir', async () => {
    const enviados = {};
    // Se pasó: avisa el 100.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(1);
    // Corrige a la baja: vuelve al 82%. No se des-avisa nada.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 123000 })], enviados), args),
    ).toHaveLength(0);
    // Vuelve a pasarse al mismo escalón: tampoco repite.
    expect(
      await dispararAlertas(depsFake([rubro({ spent: 195000 })], enviados), args),
    ).toHaveLength(0);
  });

  it('un rubro que falla no se lleva puestos los avisos que los otros ya ganaron', async () => {
    const estado = [
      rubro({ budgetItemId: 'item-1', spent: 123000 }),
      rubro({ budgetItemId: 'item-2', itemName: 'Cine', spent: 123000 }),
    ];
    const deps: AlertDeps = {
      cargarEstado: async () => estado,
      marcarEnviado: async (_u, _m, id) => {
        if (id === 'item-2') throw new Error('timeout contra Supabase');
        return true;
      },
    };
    const msgs = await dispararAlertas(deps, {
      ...args,
      budgetItemIds: ['item-1', 'item-2'],
    });
    // El aviso de item-1 ya quedó marcado en la base: perderlo sería perderlo
    // para siempre.
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Dulces');
  });
});

describe('rubrosEnRiesgo', () => {
  it('deja fuera los que van bien y ordena por porcentaje descendente', () => {
    const estado: RubroEstado[] = [
      rubro({ budgetItemId: 'a', itemName: 'Aseo', spent: 50000 }), // 33%
      rubro({ budgetItemId: 'b', itemName: 'Dulces', spent: 195000 }), // 130%
      rubro({ budgetItemId: 'c', itemName: 'Cine', spent: 123000 }), // 82%
    ];
    const r = rubrosEnRiesgo(estado);
    expect(r.map(x => x.itemName)).toEqual(['Dulces', 'Cine']);
  });

  it('devuelve vacío cuando todo va bien: el panel entonces no se pinta', () => {
    expect(rubrosEnRiesgo([rubro({ spent: 1000 })])).toEqual([]);
  });
});
