import { describe, it, expect } from 'vitest';

import {
  formatearTiempo,
  horasDeVida,
  montoEnTiempo,
  precioHora,
} from './horas-de-vida';

describe('precioHora', () => {
  it('divide el ingreso trabajado entre las horas trabajadas', () => {
    expect(precioHora(16_000_000, 160)).toBe(100_000);
  });

  it('sin horas no hay precio', () => {
    expect(precioHora(16_000_000, null)).toBeNull();
    expect(precioHora(16_000_000, 0)).toBeNull();
  });

  it('sin ingreso trabajado tampoco', () => {
    expect(precioHora(0, 160)).toBeNull();
  });
});

describe('horasDeVida', () => {
  it('convierte el monto en horas', () => {
    expect(horasDeVida(200_000, 100_000)).toBe(2);
  });

  it('sin precio de hora no convierte', () => {
    expect(horasDeVida(200_000, null)).toBeNull();
  });
});

describe('formatearTiempo', () => {
  it('usa minutos para lo pequeño', () => {
    expect(formatearTiempo(0.5)).toBe('30 min de trabajo');
  });

  it('usa horas por debajo de una jornada', () => {
    expect(formatearTiempo(3)).toBe('3.0 h de trabajo');
  });

  it('usa días de jornada', () => {
    expect(formatearTiempo(16)).toBe('2.0 días de trabajo');
  });

  it('usa meses cuando la cifra se vuelve enorme', () => {
    // 2.260 horas: un saldo así en horas no dice nada.
    expect(formatearTiempo(2260)).toBe('14.1 meses de trabajo');
  });

  it('sin dato no inventa', () => {
    expect(formatearTiempo(null)).toBe('—');
  });
});

describe('montoEnTiempo', () => {
  it('el caso real: el leasing del FNA a $100.000 la hora', () => {
    expect(montoEnTiempo(236_646_966, 100_000)).toBe('14.8 meses de trabajo');
  });

  it('un mercado de $200.000', () => {
    expect(montoEnTiempo(200_000, 100_000)).toBe('2.0 h de trabajo');
  });

  it('sin precio de hora lo dice', () => {
    expect(montoEnTiempo(200_000, null)).toBe('—');
  });
});
