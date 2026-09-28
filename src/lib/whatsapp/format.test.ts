import { describe, expect, it } from 'vitest';

import {
  enmascararTelefono,
  formatCOP,
  hoyBogotaDate,
  todayBogota,
} from './format';

describe('formatCOP', () => {
  it('formatea con separador de miles y sin decimales', () => {
    expect(formatCOP(20000)).toMatch(/20\.000/);
  });
  it('formatea montos chicos', () => {
    expect(formatCOP(2)).toMatch(/\$\D*2\b/);
  });
});

describe('hoyBogotaDate', () => {
  it('devuelve un Date local a medianoche con el mismo día que todayBogota', () => {
    const d = hoyBogotaDate();
    const [aa, mm, dd] = todayBogota().split('-').map(Number);

    expect(d.getFullYear()).toBe(aa);
    expect(d.getMonth()).toBe(mm - 1);
    expect(d.getDate()).toBe(dd);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe('enmascararTelefono', () => {
  it('celular colombiano → "+57 3XX ••• últimos 4"', () => {
    expect(enmascararTelefono('+573001234567')).toBe('+57 300 ••• 4567');
  });
  it('otro formato → deja el prefijo y los últimos 4', () => {
    expect(enmascararTelefono('+14155550123')).toBe('+141 ••• 0123');
  });
  it('muy corto → lo tapa entero salvo los últimos 2', () => {
    expect(enmascararTelefono('+5712')).toBe('••• 12');
  });
});
