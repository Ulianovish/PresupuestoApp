import { describe, it, expect } from 'vitest';

import {
  avisoHorasSospechosas,
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
  it('siempre habla en horas, nunca en días ni meses', () => {
    expect(formatearTiempo(16)).toBe('16 h de trabajo');
    expect(formatearTiempo(2260)).toContain('h de trabajo');
    expect(formatearTiempo(2260)).not.toMatch(/día|mes/);
  });

  it('con un decimal por debajo de 10 horas', () => {
    expect(formatearTiempo(0.5)).toBe('0.5 h de trabajo');
    expect(formatearTiempo(3)).toBe('3.0 h de trabajo');
    expect(formatearTiempo(2.4)).toBe('2.4 h de trabajo');
  });

  it('redondeado y con separador de miles por encima', () => {
    expect(formatearTiempo(18.83)).toBe('19 h de trabajo');
    // El separador de miles del es-CO es un punto.
    expect(formatearTiempo(2260).replace(/\u00a0/g, ' ')).toBe(
      '2.260 h de trabajo',
    );
  });

  it('sin dato no inventa', () => {
    expect(formatearTiempo(null)).toBe('—');
  });
});

describe('montoEnTiempo', () => {
  it('el caso real: el leasing del FNA a $100.000 la hora', () => {
    expect(montoEnTiempo(236_646_966, 100_000).replace(/\u00a0/g, ' ')).toBe(
      '2.366 h de trabajo',
    );
  });

  it('un mercado de $200.000', () => {
    expect(montoEnTiempo(200_000, 100_000)).toBe('2.0 h de trabajo');
  });

  it('sin precio de hora lo dice', () => {
    expect(montoEnTiempo(200_000, null)).toBe('—');
  });
});

describe('avisoHorasSospechosas', () => {
  it('avisa con el caso real de 46 horas al mes', () => {
    const a = avisoHorasSospechosas(46);
    expect(a).toContain('2.3 h al día');
    expect(a).toContain('199');
  });

  it('no molesta con una jornada normal', () => {
    expect(avisoHorasSospechosas(160)).toBeNull();
    expect(avisoHorasSospechosas(200)).toBeNull();
  });

  it('el límite son 3 horas diarias', () => {
    expect(avisoHorasSospechosas(60)).toBeNull();
    expect(avisoHorasSospechosas(59)).not.toBeNull();
  });

  it('sin dato no avisa nada', () => {
    expect(avisoHorasSospechosas(null)).toBeNull();
    expect(avisoHorasSospechosas(0)).toBeNull();
  });
});
