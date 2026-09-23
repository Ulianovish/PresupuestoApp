import { describe, it, expect } from 'vitest';

import { cuotaSugerida, esTarjetaDeCredito } from './cuotas';

describe('cuotaSugerida', () => {
  it('divide el total entre el número de cuotas', () => {
    expect(cuotaSugerida(215076, 2)).toBe(107538);
    expect(cuotaSugerida(131250, 2)).toBe(65625);
  });

  it('redondea a dos decimales', () => {
    expect(cuotaSugerida(100000, 3)).toBe(33333.33);
  });

  it('una sola cuota es el total', () => {
    expect(cuotaSugerida(53822, 1)).toBe(53822);
  });

  it('sin datos suficientes no sugiere nada', () => {
    expect(cuotaSugerida(0, 2)).toBeNull();
    expect(cuotaSugerida(215076, 0)).toBeNull();
    expect(cuotaSugerida(null, 2)).toBeNull();
    expect(cuotaSugerida(215076, undefined)).toBeNull();
    expect(cuotaSugerida(-100, 2)).toBeNull();
  });
});

describe('esTarjetaDeCredito', () => {
  const tarjetas = ['TC Falabella', 'TC Davivienda'];

  it('reconoce las cuentas de crédito', () => {
    expect(esTarjetaDeCredito('TC Falabella', tarjetas)).toBe(true);
  });

  it('el resto de cuentas no lo son', () => {
    expect(esTarjetaDeCredito('Efectivo', tarjetas)).toBe(false);
    expect(esTarjetaDeCredito('', tarjetas)).toBe(false);
  });
});
