import { describe, expect, it } from 'vitest';

import { inRule503020, suggest503020, type KitItem } from './budget-503020';

const item = (id: string, classificationName: string): KitItem => ({
  id,
  classificationName,
});

describe('suggest503020', () => {
  it('50 % necesidades, 30 % deseos (con Calidad de Vida) y el 20 % siempre a ahorro', () => {
    const r = suggest503020(4_000_000, [
      item('basico', 'Basico'),
      item('deseo', 'Estilo de Vida'),
      item('calidad', 'Calidad de Vida'),
    ]);

    expect(r).toEqual({
      amounts: { basico: 2_000_000, deseo: 600_000, calidad: 600_000 },
      ahorroSinAsignar: 800_000,
    });
  });

  it('reparte igual dentro del grupo y redondea hacia abajo a múltiplos de 1.000', () => {
    const r = suggest503020(1_234_567, [
      item('a', 'Basico'),
      item('b', 'Basico'),
      item('c', 'Basico'),
      item('d', 'Estilo de Vida'),
      item('e', 'Calidad de Vida'),
    ]);

    // 617.283,5 / 3 = 205.761,1 → 205.000; 370.370,1 / 2 = 185.185 → 185.000;
    // ahorro 246.913,4 → 246.000
    expect(r.amounts).toEqual({
      a: 205_000,
      b: 205_000,
      c: 205_000,
      d: 185_000,
      e: 185_000,
    });
    expect(r.ahorroSinAsignar).toBe(246_000);
  });

  it('Estilo de Vida y Caprichos comparten el 30 %', () => {
    const r = suggest503020(1_000_000, [
      item('estilo', 'Estilo de Vida'),
      item('capricho', 'Caprichos'),
    ]);

    expect(r.amounts).toEqual({ estilo: 150_000, capricho: 150_000 });
    // Necesidades (50 %) no tiene ítems; el 20 % de ahorro va siempre sin asignar.
    expect(r.ahorroSinAsignar).toBe(700_000);
  });

  it('un grupo sin ítems manda su porcentaje a ahorroSinAsignar', () => {
    const r = suggest503020(2_000_000, [item('basico', 'Basico')]);

    expect(r.amounts).toEqual({ basico: 1_000_000 });
    expect(r.ahorroSinAsignar).toBe(1_000_000);
  });

  it('Impuestos y clasificaciones desconocidas quedan en 0 y no cuentan en ningún grupo', () => {
    const r = suggest503020(1_000_000, [
      item('impuesto', 'Impuestos'),
      item('rara', 'Otra cosa'),
      item('basico', 'Basico'),
    ]);

    expect(r.amounts).toEqual({ impuesto: 0, rara: 0, basico: 500_000 });
    expect(r.ahorroSinAsignar).toBe(500_000);
  });

  it('reconoce la clasificación sin importar tildes, mayúsculas ni espacios', () => {
    const r = suggest503020(1_000_000, [
      item('a', 'Básico'),
      item('b', ' ESTILO DE VIDA '),
      item('c', 'calidad de vida'),
    ]);

    expect(r.amounts).toEqual({ a: 500_000, b: 150_000, c: 150_000 });
    expect(r.ahorroSinAsignar).toBe(200_000);
  });

  it.each([0, -500_000, Number.NaN, Number.POSITIVE_INFINITY])(
    'ingreso %s → todo en 0',
    income => {
      const r = suggest503020(income, [
        item('a', 'Basico'),
        item('b', 'Calidad de Vida'),
      ]);

      expect(r).toEqual({ amounts: { a: 0, b: 0 }, ahorroSinAsignar: 0 });
    },
  );

  it('sin ítems, todo el ingreso queda sin asignar', () => {
    expect(suggest503020(1_000_000, [])).toEqual({
      amounts: {},
      ahorroSinAsignar: 1_000_000,
    });
  });

  it('kit inicial de 12 rubros (contratos §1.3): reparte según §5.2', () => {
    const kit = [
      item('arriendo', 'Basico'),
      item('servicios', 'Basico'),
      item('internet', 'Calidad de Vida'),
      item('mercado', 'Basico'),
      item('aseo', 'Basico'),
      item('transporte', 'Basico'),
      item('vehiculo', 'Basico'),
      item('salud', 'Basico'),
      item('drogueria', 'Basico'),
      item('tarjetas', 'Basico'),
      item('creditos', 'Basico'),
      item('otros', 'Estilo de Vida'),
    ];

    const r = suggest503020(5_000_000, kit);

    expect(r.amounts.arriendo).toBe(250_000);
    expect(r.amounts.creditos).toBe(250_000);
    // Deseos: Otros (Estilo de Vida) e Internet (Calidad de Vida) comparten el 30 %.
    expect(r.amounts.otros).toBe(750_000);
    expect(r.amounts.internet).toBe(750_000);
    expect(r.ahorroSinAsignar).toBe(1_000_000);
  });
});

describe('inRule503020', () => {
  it('necesidades y deseos entran; Impuestos y desconocidas no', () => {
    expect(inRule503020('Basico')).toBe(true);
    expect(inRule503020('Básico')).toBe(true);
    expect(inRule503020('Estilo de Vida')).toBe(true);
    expect(inRule503020('Caprichos')).toBe(true);
    expect(inRule503020('calidad de vida')).toBe(true);
    expect(inRule503020('Impuestos')).toBe(false);
    expect(inRule503020('Otra cosa')).toBe(false);
    expect(inRule503020('')).toBe(false);
  });
});
