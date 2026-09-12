import { describe, it, expect } from 'vitest';

import {
  fechaPorDefectoDelMes,
  ingresosDelMes,
  totalIngresosDelMes,
} from './ingresos-mes';

const INGRESOS = [
  {
    descripcion: 'Ingreso mensual agosto 2026',
    fecha: '2026-08-31',
    monto: 17750000,
  },
  { descripcion: 'Parking', fecha: '2026-02-26', monto: 100000 },
  { descripcion: 'Club Gasolina', fecha: '2026-02-05', monto: 50000 },
];

describe('ingresosDelMes', () => {
  it('devuelve solo los ingresos del mes pedido', () => {
    expect(ingresosDelMes(INGRESOS, '2026-02').map(i => i.descripcion)).toEqual(
      ['Parking', 'Club Gasolina'],
    );
  });

  it('devuelve vacío cuando el mes no tiene ingresos', () => {
    expect(ingresosDelMes(INGRESOS, '2026-09')).toEqual([]);
  });

  it('devuelve vacío si no se indica el mes', () => {
    expect(ingresosDelMes(INGRESOS, '')).toEqual([]);
  });
});

describe('totalIngresosDelMes', () => {
  it('suma los montos del mes', () => {
    expect(totalIngresosDelMes(INGRESOS, '2026-02')).toBe(150000);
    expect(totalIngresosDelMes(INGRESOS, '2026-08')).toBe(17750000);
  });

  it('es 0 en un mes sin ingresos', () => {
    expect(totalIngresosDelMes(INGRESOS, '2026-09')).toBe(0);
  });
});

describe('fechaPorDefectoDelMes', () => {
  const hoy = new Date(2026, 8, 12); // 12 de septiembre de 2026

  it('usa el día de hoy cuando el mes elegido es el actual', () => {
    expect(fechaPorDefectoDelMes('2026-09', hoy)).toBe('2026-09-12');
  });

  it('usa el primer día cuando es otro mes', () => {
    expect(fechaPorDefectoDelMes('2026-08', hoy)).toBe('2026-08-01');
    expect(fechaPorDefectoDelMes('2026-12', hoy)).toBe('2026-12-01');
  });

  it('cae en hoy si no hay mes', () => {
    expect(fechaPorDefectoDelMes('', hoy)).toBe('2026-09-12');
  });
});
