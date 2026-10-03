import { describe, it, expect } from 'vitest';

import { COLOR_GASTO, chip, estadoDeGasto } from './colores-dato';

describe('estadoDeGasto', () => {
  it('sin gasto no juzga nada', () => {
    expect(estadoDeGasto(500000, 0)).toBe('sin-gasto');
  });

  it('holgado por debajo del 80 %', () => {
    expect(estadoDeGasto(500000, 100000)).toBe('holgado');
    expect(estadoDeGasto(500000, 399999)).toBe('holgado');
  });

  it('atención entre el 80 y el 100 %', () => {
    expect(estadoDeGasto(500000, 400000)).toBe('cerca');
    expect(estadoDeGasto(500000, 500000)).toBe('cerca');
  });

  it('excedido por encima del presupuesto', () => {
    expect(estadoDeGasto(500000, 600000)).toBe('excedido');
  });

  it('gastar sin presupuesto pide atención, no es exceso demostrable', () => {
    expect(estadoDeGasto(0, 103700)).toBe('cerca');
  });
});

describe('COLOR_GASTO', () => {
  it('cada estado trae su par claro y oscuro', () => {
    for (const clases of Object.values(COLOR_GASTO)) {
      expect(clases).toMatch(/dark:/);
      expect(clases.split(' ')[0]).not.toMatch(/dark:/);
    }
  });

  it('el exceso es rojo y lo holgado verde', () => {
    expect(COLOR_GASTO.excedido).toContain('red');
    expect(COLOR_GASTO.holgado).toContain('emerald');
    expect(COLOR_GASTO.cerca).toContain('amber');
  });
});

describe('chip', () => {
  it('usa tonos oscuros de texto en claro y claros en oscuro', () => {
    expect(chip('blue')).toContain('text-blue-800');
    expect(chip('blue')).toContain('dark:text-blue-300');
  });

  it('una familia desconocida cae en pizarra', () => {
    expect(chip('inventado')).toBe(chip('slate'));
  });
});
