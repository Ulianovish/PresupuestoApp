import { describe, it, expect } from 'vitest';

import { highestThreshold, diasRestantesDelMes } from './thresholds';

describe('highestThreshold', () => {
  it('calla por debajo del 80%', () => {
    expect(highestThreshold(0)).toBe(0);
    expect(highestThreshold(79.9)).toBe(0);
  });

  it('avisa al 80 y se queda ahí hasta el 100', () => {
    expect(highestThreshold(80)).toBe(80);
    expect(highestThreshold(99.9)).toBe(80);
  });

  it('escalona de 50 en 50 después del 100', () => {
    expect(highestThreshold(100)).toBe(100);
    expect(highestThreshold(149)).toBe(100);
    expect(highestThreshold(150)).toBe(150);
    expect(highestThreshold(199)).toBe(150);
    expect(highestThreshold(200)).toBe(200);
  });

  it('sigue avisando en un rubro disparado: Dulces llegó al 938% en agosto 2026', () => {
    expect(highestThreshold(938)).toBe(900);
  });

  it('trata un porcentaje negativo o NaN como silencio, no como error', () => {
    expect(highestThreshold(-5)).toBe(0);
    expect(highestThreshold(NaN)).toBe(0);
  });
});

describe('diasRestantesDelMes', () => {
  it('cuenta el día de hoy incluido', () => {
    // 22 de septiembre de 2026: quedan 22..30 = 9 días.
    expect(diasRestantesDelMes(new Date(2026, 8, 22))).toBe(9);
  });

  it('el último día del mes queda en 1', () => {
    expect(diasRestantesDelMes(new Date(2026, 7, 31))).toBe(1);
  });

  it('funciona en febrero bisiesto', () => {
    expect(diasRestantesDelMes(new Date(2028, 1, 28))).toBe(2);
  });
});
