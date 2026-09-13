import { describe, it, expect } from 'vitest';

import { aColumnasDeActualizacion } from './deudas-columnas';

describe('aColumnasDeActualizacion', () => {
  it('traduce tipo_deuda a la columna real tipo', () => {
    const r = aColumnasDeActualizacion({
      descripcion: 'Tarjeta Nu Bank Milo',
      tipo_deuda: 'tarjeta_credito',
    });
    expect(r).toEqual({
      descripcion: 'Tarjeta Nu Bank Milo',
      tipo: 'tarjeta_credito',
    });
  });

  it('nunca envía tipo_deuda, que no existe en la tabla', () => {
    const r = aColumnasDeActualizacion({ tipo_deuda: 'banco', monto: 10 });
    expect(r).not.toHaveProperty('tipo_deuda');
  });

  it('si no viene tipo_deuda no toca tipo (actualización parcial)', () => {
    const r = aColumnasDeActualizacion({ pagada: true });
    expect(r).toEqual({ pagada: true });
    expect(r).not.toHaveProperty('tipo');
  });

  it('conserva el resto de campos tal cual', () => {
    const datos = {
      descripcion: 'Credito',
      acreedor: 'Nequi',
      monto: 456500,
      fecha_vencimiento: '2029-02-11',
      valor_cuota: 456500,
      fecha_corte: '',
      tasa_interes: 25.13,
    };
    expect(aColumnasDeActualizacion(datos)).toEqual(datos);
  });
});
