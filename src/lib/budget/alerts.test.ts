import { describe, it, expect } from 'vitest';

import { evaluarRubro, formatearAlerta, type RubroEstado } from './alerts';

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
