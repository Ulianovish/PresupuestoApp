import { describe, it, expect } from 'vitest';

import {
  alertasEndeudamiento,
  calcularIndicadores,
  mensajeFlujoDeuda,
  nivelFlujoDeuda,
  esDeudaDeConsumo,
  ingresoNetoDelMes,
  type DeudaParaIndicador,
} from './indicadores-endeudamiento';

/** Deudas equivalentes a las reales tras mover las tarjetas a consumo. */
const DEUDAS: DeudaParaIndicador[] = [
  {
    tipo: 'deuda',
    valor_cuota: 456500,
    saldo_pendiente: 11517214,
    pagada: false,
    es_activo: true,
  },
  {
    tipo: 'deuda',
    valor_cuota: 2920203,
    saldo_pendiente: 238500000,
    pagada: false,
    es_activo: true,
  },
  {
    tipo: 'tarjeta_credito',
    valor_cuota: 1648000,
    saldo_pendiente: 3766430,
    pagada: false,
    es_activo: true,
  },
  {
    tipo: 'tarjeta_credito',
    valor_cuota: 2500000,
    saldo_pendiente: 6510559,
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
    saldoConsumo: 0,
    saldoActivos: 0,
    saldoTotal: 0,
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

describe('nivelFlujoDeuda', () => {
  it('hasta 30 % es sano', () => {
    expect(nivelFlujoDeuda(0)).toBe('sano');
    expect(nivelFlujoDeuda(29.9)).toBe('sano');
    expect(nivelFlujoDeuda(30)).toBe('sano');
  });

  it('entre 30 y 40 pide atención', () => {
    expect(nivelFlujoDeuda(30.1)).toBe('atencion');
    expect(nivelFlujoDeuda(39.9)).toBe('atencion');
  });

  it('desde 40 es alto riesgo', () => {
    expect(nivelFlujoDeuda(40)).toBe('riesgo');
    expect(nivelFlujoDeuda(61.8)).toBe('riesgo');
  });

  it('sin ingreso del mes no hay nivel', () => {
    expect(nivelFlujoDeuda(null)).toBe('sin-dato');
  });

  it('el ejemplo de la banca: 2 millones sobre 5 da 40 %', () => {
    const r = calcularIndicadores(
      [{ tipo: 'deuda', valor_cuota: 2000000, es_activo: true, pagada: false }],
      5000000,
    );
    expect(r.porcentajeTotal).toBe(40);
    expect(nivelFlujoDeuda(r.porcentajeTotal)).toBe('riesgo');
  });
});

describe('mensajeFlujoDeuda', () => {
  it('explica cada nivel', () => {
    expect(mensajeFlujoDeuda('riesgo')).toContain('alto riesgo');
    expect(mensajeFlujoDeuda('atencion')).toContain('30');
    expect(mensajeFlujoDeuda('sano')).toContain('manejable');
    expect(mensajeFlujoDeuda('sin-dato')).toContain('Falta el ingreso');
  });
});

describe('saldos: lo que se debe, no lo que se paga este mes', () => {
  it('separa el saldo de consumo del de activos', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.saldoConsumo).toBe(10276989);
    expect(r.saldoActivos).toBe(250017214);
  });

  it('consumo mas activos cuadra con el total', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.saldoConsumo + r.saldoActivos).toBe(r.saldoTotal);
    expect(r.saldoTotal).toBe(260294203);
  });

  it('el saldo es distinto de la cuota del mes', () => {
    const r = calcularIndicadores(DEUDAS, 17750000);
    expect(r.saldoTotal).not.toBe(r.pagosTotales);
  });

  it('excluye las pagadas y las inactivas, igual que las cuotas', () => {
    const r = calcularIndicadores(
      [
        ...DEUDAS,
        { tipo: 'deuda', saldo_pendiente: 9e9, pagada: true, es_activo: true },
        {
          tipo: 'deuda',
          saldo_pendiente: 9e9,
          pagada: false,
          es_activo: false,
        },
      ],
      17750000,
    );
    expect(r.saldoTotal).toBe(260294203);
  });

  it('tolera saldos nulos', () => {
    const r = calcularIndicadores(
      [{ tipo: 'deuda', valor_cuota: 100, es_activo: true, pagada: false }],
      1000,
    );
    expect(r.saldoTotal).toBe(0);
  });
});
