import { describe, it, expect } from 'vitest';

import {
  alertasEndeudamiento,
  calcularIndicadores,
  esDeudaDeConsumo,
  ingresoNetoDelMes,
  type DeudaParaIndicador,
} from './indicadores-endeudamiento';

/** Deudas equivalentes a las reales tras mover las tarjetas a consumo. */
const DEUDAS: DeudaParaIndicador[] = [
  { tipo: 'deuda', valor_cuota: 456500, pagada: false, es_activo: true },
  { tipo: 'deuda', valor_cuota: 2920203, pagada: false, es_activo: true },
  {
    tipo: 'tarjeta_credito',
    valor_cuota: 1648000,
    pagada: false,
    es_activo: true,
  },
  {
    tipo: 'tarjeta_credito',
    valor_cuota: 2500000,
    pagada: false,
    es_activo: true,
  },
  { tipo: 'tarjeta_credito', valor_cuota: 0, pagada: false, es_activo: true },
];

describe('ingresoNetoDelMes', () => {
  const ingresos = [
    { fecha: '2026-08-31', monto: 17750000 },
    { fecha: '2026-02-26', monto: 100000 },
    { fecha: '2026-08-02', monto: 250000 },
  ];

  it('suma solo los ingresos del mes pedido', () => {
    expect(ingresoNetoDelMes(ingresos, '2026-08')).toBe(18000000);
    expect(ingresoNetoDelMes(ingresos, '2026-02')).toBe(100000);
  });

  it('devuelve 0 cuando el mes no tiene ingresos', () => {
    expect(ingresoNetoDelMes(ingresos, '2026-09')).toBe(0);
  });

  it('devuelve 0 si no se indica el mes', () => {
    expect(ingresoNetoDelMes(ingresos, '')).toBe(0);
  });

  it('ignora ingresos sin fecha o sin monto', () => {
    expect(
      ingresoNetoDelMes(
        [
          { fecha: null, monto: 500 },
          { fecha: '2026-08-01', monto: null },
        ],
        '2026-08',
      ),
    ).toBe(0);
  });
});

describe('esDeudaDeConsumo', () => {
  it('reconoce la tarjeta de crédito por tipo', () => {
    expect(esDeudaDeConsumo({ tipo: 'tarjeta_credito' })).toBe(true);
    expect(esDeudaDeConsumo({ tipo_deuda: 'tarjeta_credito' })).toBe(true);
  });

  it('el resto son deudas de activos', () => {
    expect(esDeudaDeConsumo({ tipo: 'deuda' })).toBe(false);
    expect(esDeudaDeConsumo({})).toBe(false);
  });
});

describe('calcularIndicadores', () => {
  it('separa los pagos de consumo, de activos y el total', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.pagosConsumo).toBe(4148000);
    expect(r.pagosActivos).toBe(3376703);
    expect(r.pagosTotales).toBe(7524703);
  });

  it('consumo mas activos siempre cuadra con el total', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.pagosConsumo + r.pagosActivos).toBe(r.pagosTotales);
  });

  it('calcula los porcentajes sobre el ingreso neto', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.porcentajeConsumo).toBeCloseTo(23.37, 2);
    expect(r.porcentajeActivos).toBeCloseTo(19.02, 2);
    expect(r.porcentajeTotal).toBeCloseTo(42.39, 2);
  });

  it('excluye las deudas ya pagadas', () => {
    const conPagada = [
      ...DEUDAS,
      { tipo: 'deuda', valor_cuota: 2000000, pagada: true, es_activo: true },
    ];
    expect(calcularIndicadores(conPagada, 17750000).pagosTotales).toBe(7524703);
  });

  it('excluye las deudas inactivas', () => {
    const conInactiva = [
      ...DEUDAS,
      { tipo: 'deuda', valor_cuota: 45000000, pagada: false, es_activo: false },
    ];
    expect(calcularIndicadores(conInactiva, 17750000).pagosTotales).toBe(
      7524703,
    );
  });

  it('sin ingreso del mes deja los porcentajes en null, no en Infinity', () => {
    const r = calcularIndicadores(DEUDAS, 0);
    expect(r.porcentajeConsumo).toBeNull();
    expect(r.porcentajeActivos).toBeNull();
    expect(r.porcentajeTotal).toBeNull();
    expect(r.pagosTotales).toBe(7524703);
  });

  it('sin deudas los porcentajes son 0', () => {
    const r = calcularIndicadores([], 17750000);
    expect(r.porcentajeConsumo).toBe(0);
    expect(r.porcentajeActivos).toBe(0);
    expect(r.porcentajeTotal).toBe(0);
  });

  it('tolera cuotas nulas', () => {
    const r = calcularIndicadores(
      [{ tipo: 'deuda', valor_cuota: null, es_activo: true, pagada: false }],
      1000,
    );
    expect(r.pagosTotales).toBe(0);
  });
});

describe('alertasEndeudamiento', () => {
  const conConsumo = (porcentajeConsumo: number | null) => ({
    pagosConsumo: 0,
    pagosActivos: 0,
    pagosTotales: 0,
    ingresoNeto: porcentajeConsumo === null ? 0 : 100,
    porcentajeConsumo,
    porcentajeActivos: 0,
    porcentajeTotal: 0,
  });

  it('alerta cuando el consumo supera el 10 %', () => {
    const alertas = alertasEndeudamiento(conConsumo(23.4));
    expect(alertas).toHaveLength(1);
    expect(alertas[0].mensaje).toContain('por encima de tus posibilidades');
    expect(alertas[0].mensaje).toContain('Busca ayuda financiera');
  });

  it('no alerta en exactamente 10 % ni por debajo', () => {
    expect(alertasEndeudamiento(conConsumo(10))).toEqual([]);
    expect(alertasEndeudamiento(conConsumo(4))).toEqual([]);
  });

  it('no alerta si el mes no tiene ingreso', () => {
    expect(alertasEndeudamiento(conConsumo(null))).toEqual([]);
  });

  it('con los datos de agosto 2026 aparece la alerta', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(alertasEndeudamiento(r).map(a => a.id)).toEqual(['consumo-alto']);
  });
});
