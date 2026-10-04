import { describe, it, expect } from 'vitest';

import {
  buildExtractoPrompt,
  filasATexto,
  numeroColombiano,
  parseExtractoResponse,
} from './extracto';

describe('buildExtractoPrompt', () => {
  it('nombra la deuda y pide el formato de mes', () => {
    const p = buildExtractoPrompt('texto', {
      descripcion: 'Leasing',
      acreedor: 'FNA',
    });
    expect(p).toContain('Leasing · FNA');
    expect(p).toContain('YYYY-MM');
    expect(p).toContain('texto');
  });

  it('prohíbe inventar datos que no estén', () => {
    const p = buildExtractoPrompt('x', { descripcion: 'a', acreedor: 'b' });
    expect(p).toContain('No lo inventes');
  });
});

describe('parseExtractoResponse', () => {
  const respuesta = JSON.stringify({
    filas: [
      {
        mes: '2025-01',
        saldo: 237820998.86,
        cuota: 2744318.52,
        cuotasPagas: 3,
        cuotasFaltantes: 237,
      },
      {
        mes: '2024-12',
        saldo: 238135913.81,
        cuota: 2744318.52,
        cuotasPagas: 2,
        cuotasFaltantes: 238,
      },
    ],
  });

  it('lee las filas y las ordena de más antigua a más reciente', () => {
    const r = parseExtractoResponse(respuesta);
    expect(r.map(f => f.mes)).toEqual(['2024-12', '2025-01']);
    expect(r[1].saldo).toBe(237820998.86);
  });

  it('tolera que venga entre cercos de código', () => {
    const r = parseExtractoResponse(`\`\`\`json\n${respuesta}\n\`\`\``);
    expect(r).toHaveLength(2);
  });

  it('descarta filas sin un mes válido', () => {
    const r = parseExtractoResponse(
      JSON.stringify({
        filas: [
          { mes: 'enero', saldo: 100 },
          { mes: '2025-13', saldo: 100 },
        ],
      }),
    );
    expect(r).toEqual([]);
  });

  it('descarta meses repetidos y se queda con el primero', () => {
    const r = parseExtractoResponse(
      JSON.stringify({
        filas: [
          { mes: '2025-01', saldo: 100 },
          { mes: '2025-01', saldo: 999 },
        ],
      }),
    );
    expect(r).toHaveLength(1);
    expect(r[0].saldo).toBe(100);
  });

  it('descarta filas sin ningún dato', () => {
    const r = parseExtractoResponse(
      JSON.stringify({ filas: [{ mes: '2025-01', saldo: null, cuota: null }] }),
    );
    expect(r).toEqual([]);
  });

  it('limpia separadores de miles y rechaza negativos', () => {
    const r = parseExtractoResponse(
      JSON.stringify({
        filas: [{ mes: '2025-01', saldo: '2.744.318', cuota: -5 }],
      }),
    );
    expect(r[0].saldo).toBe(2744318);
    expect(r[0].cuota).toBeNull();
  });

  it('ante basura devuelve vacío en vez de fallar', () => {
    expect(parseExtractoResponse(null)).toEqual([]);
    expect(parseExtractoResponse('no es json')).toEqual([]);
    expect(parseExtractoResponse('{"otra":"cosa"}')).toEqual([]);
  });
});

describe('filasATexto', () => {
  it('une las celdas con separador legible', () => {
    expect(
      filasATexto([
        ['Fecha', 'Saldo'],
        ['12/19/2024', 238135913.81],
      ]),
    ).toBe('Fecha | Saldo\n12/19/2024 | 238135913.81');
  });

  it('recorta para no mandar hojas enormes', () => {
    const muchas = Array.from({ length: 100 }, (_, i) => [i]);
    expect(filasATexto(muchas, 10).split('\n')).toHaveLength(10);
  });

  it('las celdas vacías no rompen la fila', () => {
    expect(filasATexto([['a', null, undefined, 'b']])).toBe('a |  |  | b');
  });
});

describe('numeroColombiano', () => {
  it('punto como separador de miles', () => {
    expect(numeroColombiano('2.744.318')).toBe(2744318);
    expect(numeroColombiano('238.135.913')).toBe(238135913);
  });

  it('punto de miles y coma decimal', () => {
    expect(numeroColombiano('2.744.318,52')).toBe(2744318.52);
  });

  it('formato inglés: coma de miles y punto decimal', () => {
    expect(numeroColombiano('2,744,318.52')).toBe(2744318.52);
  });

  it('un punto que es decimal, no miles', () => {
    expect(numeroColombiano('18.8')).toBe(18.8);
  });

  it('una coma que es decimal', () => {
    expect(numeroColombiano('18,8')).toBe(18.8);
  });

  it('números tal cual', () => {
    expect(numeroColombiano(2744318.52)).toBe(2744318.52);
  });

  it('descarta negativos, vacíos y basura', () => {
    expect(numeroColombiano(-5)).toBeNull();
    expect(numeroColombiano('')).toBeNull();
    expect(numeroColombiano(null)).toBeNull();
    expect(numeroColombiano('N/A')).toBeNull();
  });

  it('limpia el símbolo de moneda', () => {
    expect(numeroColombiano('$ 2.744.318')).toBe(2744318);
  });
});
