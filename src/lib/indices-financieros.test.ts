import { describe, it, expect } from 'vitest';

import {
  calcularIndices,
  dependencia,
  edadDesde,
  endeudamiento,
  flujoDeDeuda,
  flujoEfectivoMensual,
  patrimonioLiquido,
  precioHoraDeVida,
  progresoFinanciero,
  prosperidadFinanciera,
  riqueza,
  scoreCrediticio,
  termostatoFinanciero,
  trabajoVsVida,
  type DatosFinancieros,
} from './indices-financieros';

/** Caso base sano, para variar un dato por prueba. */
const BASE: DatosFinancieros = {
  ingresosMes: 10_000_000,
  ingresoResidualMes: 0,
  gastosMes: 6_000_000,
  cuotasMensuales: 1_000_000,
  totalActivos: 100_000_000,
  totalDeudas: 20_000_000,
};

const con = (cambios: Partial<DatosFinancieros>): DatosFinancieros => ({
  ...BASE,
  ...cambios,
});

describe('1. Flujo de Efectivo Mensual', () => {
  it('positivo cuando sobra dinero', () => {
    const r = flujoEfectivoMensual(BASE);
    expect(r.valor).toBe(4_000_000);
    expect(r.nivel).toBe('bien');
  });

  it('negativo cuando se gasta de más', () => {
    const r = flujoEfectivoMensual(con({ gastosMes: 12_000_000 }));
    expect(r.valor).toBe(-2_000_000);
    expect(r.nivel).toBe('critico');
  });

  it('en cero avisa que no queda nada', () => {
    const r = flujoEfectivoMensual(con({ gastosMes: 10_000_000 }));
    expect(r.valor).toBe(0);
    expect(r.nivel).toBe('alerta');
  });
});

describe('2. Patrimonio Líquido', () => {
  it('activos menos deudas', () => {
    expect(patrimonioLiquido(BASE).valor).toBe(80_000_000);
  });

  it('negativo si se debe más de lo que se tiene', () => {
    const r = patrimonioLiquido(con({ totalDeudas: 150_000_000 }));
    expect(r.nivel).toBe('critico');
  });

  it('en tablas cuando empatan', () => {
    const r = patrimonioLiquido(con({ totalDeudas: 100_000_000 }));
    expect(r.valor).toBe(0);
    expect(r.nivel).toBe('alerta');
  });
});

describe('3. Prosperidad Financiera', () => {
  it('cuenta los meses de autonomía', () => {
    const r = prosperidadFinanciera(BASE);
    expect(r.valor).toBeCloseTo(13.33, 2);
    expect(r.nivel).toBe('bien');
  });

  it('hasta 3 meses sigue en urgencias', () => {
    const r = prosperidadFinanciera(
      con({ totalActivos: 38_000_000, totalDeudas: 20_000_000 }),
    );
    expect(r.valor).toBe(3);
    expect(r.nivel).toBe('critico');
  });

  it('sin gastos registrados no se puede calcular', () => {
    expect(prosperidadFinanciera(con({ gastosMes: 0 })).nivel).toBe('sin-dato');
  });
});

describe('4. Flujo de Deuda', () => {
  it('aplica los tramos del documento', () => {
    expect(flujoDeDeuda(con({ cuotasMensuales: 6_000_000 })).nivel).toBe(
      'critico',
    );
    expect(flujoDeDeuda(con({ cuotasMensuales: 4_000_000 })).nivel).toBe(
      'alerta',
    );
    expect(flujoDeDeuda(con({ cuotasMensuales: 2_000_000 })).nivel).toBe(
      'bien',
    );
    expect(flujoDeDeuda(con({ cuotasMensuales: 500_000 })).nivel).toBe(
      'excelente',
    );
  });

  it('sin ingreso no se puede calcular', () => {
    expect(flujoDeDeuda(con({ ingresosMes: 0 })).nivel).toBe('sin-dato');
  });
});

describe('5. Endeudamiento', () => {
  it('aplica los tramos del documento', () => {
    expect(endeudamiento(con({ totalDeudas: 70_000_000 })).nivel).toBe(
      'critico',
    );
    expect(endeudamiento(con({ totalDeudas: 50_000_000 })).nivel).toBe(
      'alerta',
    );
    expect(endeudamiento(con({ totalDeudas: 20_000_000 })).nivel).toBe('bien');
    expect(endeudamiento(con({ totalDeudas: 10_000_000 })).nivel).toBe(
      'excelente',
    );
  });

  it('sin activos registrados no se puede calcular', () => {
    expect(endeudamiento(con({ totalActivos: 0 })).nivel).toBe('sin-dato');
  });
});

describe('6. Riqueza', () => {
  const datos = con({
    edad: 40,
    ingresoAnualPromedio10a: 20_000_000,
    totalActivos: 100_000_000,
    totalDeudas: 20_000_000,
  });

  it('calcula el patrimonio esperado: promedio x edad / 10', () => {
    expect(riqueza(datos).valor).toBe(80_000_000);
  });

  it('a la par de lo esperado está bien', () => {
    expect(riqueza(datos).nivel).toBe('bien');
  });

  it('el doble de lo esperado es excelente', () => {
    expect(riqueza({ ...datos, totalActivos: 180_000_000 }).nivel).toBe(
      'excelente',
    );
  });

  it('por debajo avisa que se destruyó patrimonio', () => {
    expect(riqueza({ ...datos, totalActivos: 50_000_000 }).nivel).toBe(
      'alerta',
    );
  });

  it('sin edad ni promedio no se puede calcular', () => {
    expect(riqueza(BASE).nivel).toBe('sin-dato');
  });
});

describe('7. Precio Hora de Vida', () => {
  it('divide el ingreso trabajado entre las horas', () => {
    const r = precioHoraDeVida(con({ horasTrabajadasMes: 160 }));
    expect(r.valor).toBe(62_500);
  });

  it('descuenta el ingreso residual, que no se trabaja', () => {
    const r = precioHoraDeVida(
      con({ horasTrabajadasMes: 100, ingresoResidualMes: 2_000_000 }),
    );
    expect(r.valor).toBe(80_000);
  });

  it('sin horas no se puede calcular', () => {
    expect(precioHoraDeVida(BASE).nivel).toBe('sin-dato');
  });
});

describe('8. Score Crediticio', () => {
  it('aplica los tramos del documento', () => {
    expect(scoreCrediticio(con({ scoreCrediticio: 550 })).nivel).toBe(
      'critico',
    );
    expect(scoreCrediticio(con({ scoreCrediticio: 650 })).nivel).toBe('alerta');
    expect(scoreCrediticio(con({ scoreCrediticio: 750 })).nivel).toBe('bien');
    expect(scoreCrediticio(con({ scoreCrediticio: 850 })).nivel).toBe(
      'excelente',
    );
  });

  it('sin score no se puede calcular', () => {
    expect(scoreCrediticio(BASE).nivel).toBe('sin-dato');
  });
});

describe('9. Dependencia', () => {
  it('da 1 cuando se depende por completo del trabajo', () => {
    const r = dependencia(
      con({ ingresosMes: 6_000_000, gastosMes: 6_000_000 }),
    );
    expect(r.valor).toBe(1);
    expect(r.nivel).toBe('critico');
  });

  it('entre 0 y 1 hay que trabajar por una parte', () => {
    const r = dependencia(
      con({ ingresosMes: 6_000_000, ingresoResidualMes: 2_000_000 }),
    );
    expect(r.nivel).toBe('alerta');
  });

  it('cero o negativo: los residuales cubren los gastos', () => {
    const r = dependencia(
      con({ ingresosMes: 6_000_000, ingresoResidualMes: 3_000_000 }),
    );
    expect(r.valor).toBe(0);
    expect(r.nivel).toBe('excelente');
  });
});

describe('10. Progreso Financiero', () => {
  it('hámster cuando los residuales no alcanzan', () => {
    const r = progresoFinanciero(con({ ingresoResidualMes: 1_000_000 }));
    expect(r.etapa).toBe('HÁMSTER');
  });

  it('delfín cuando igualan los gastos', () => {
    const r = progresoFinanciero(con({ ingresoResidualMes: 6_000_000 }));
    expect(r.etapa).toBe('DELFÍN');
  });

  it('águila con 3 veces los gastos', () => {
    const r = progresoFinanciero(con({ ingresoResidualMes: 18_000_000 }));
    expect(r.etapa).toBe('ÁGUILA');
  });

  it('rinoceronte con 10 veces los gastos', () => {
    const r = progresoFinanciero(con({ ingresoResidualMes: 60_000_000 }));
    expect(r.etapa).toBe('RINOCERONTE');
  });
});

describe('11 y 12. Termostato y Trabajo vs Vida', () => {
  it('el termostato es el monto registrado', () => {
    expect(
      termostatoFinanciero(con({ termostatoFinanciero: 5_000_000 })).valor,
    ).toBe(5_000_000);
  });

  it('trabajo vs vida avisa cuando queda poco día', () => {
    expect(trabajoVsVida(con({ horasVidaDia: 1 })).nivel).toBe('critico');
    expect(trabajoVsVida(con({ horasVidaDia: 3 })).nivel).toBe('alerta');
    expect(trabajoVsVida(con({ horasVidaDia: 6 })).nivel).toBe('bien');
  });

  it('sin registrar, no se inventan', () => {
    expect(termostatoFinanciero(BASE).nivel).toBe('sin-dato');
    expect(trabajoVsVida(BASE).nivel).toBe('sin-dato');
  });
});

describe('calcularIndices', () => {
  it('devuelve los 12 en el orden del documento', () => {
    const ids = calcularIndices(BASE).map(i => i.id);
    expect(ids).toEqual([
      'fem',
      'pl',
      'ipf',
      'ifd',
      'ide',
      'idr',
      'phv',
      'sc',
      'idd',
      'pf',
      'tf',
      'tvv',
    ]);
  });

  it('los que no se pueden calcular dicen qué falta', () => {
    const faltantes = calcularIndices(BASE).filter(i => i.nivel === 'sin-dato');
    expect(faltantes.length).toBeGreaterThan(0);
    for (const i of faltantes) {
      expect(i.valor).toBeNull();
      expect(i.faltante).toBeTruthy();
    }
  });
});

describe('edadDesde', () => {
  it('calcula la edad cumplida', () => {
    expect(edadDesde('1990-05-10', new Date(2026, 9, 3))).toBe(36);
  });

  it('resta un año si todavía no cumple', () => {
    expect(edadDesde('1990-12-25', new Date(2026, 9, 3))).toBe(35);
  });

  it('sin fecha devuelve null', () => {
    expect(edadDesde(null)).toBeNull();
    expect(edadDesde('no-es-fecha')).toBeNull();
  });
});
