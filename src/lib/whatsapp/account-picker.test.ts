import { describe, expect, it } from 'vitest';

import {
  armarIdOpcion,
  armarVariablesLista,
  interpretarRespuestaCuenta,
  pareceRespuestaDeCuenta,
  parsearIdOpcion,
  rankearCuentas,
  textoPreguntaCuenta,
  truncarTitulo,
  type CuentaActiva,
  type UsoCuenta,
} from './account-picker';

const PROMPT = '11111111-2222-4333-8444-555555555555';

function cuenta(name: string, extra: Partial<CuentaActiva> = {}): CuentaActiva {
  return {
    id: `id-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    type: 'bank',
    createdAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

const CUENTAS = [
  cuenta('Ahorros Nu'),
  cuenta('Davivienda'),
  cuenta('Efectivo', { type: 'cash' }),
  cuenta('Nequi Bruno'),
  cuenta('Nequi Coco'),
  cuenta('TC Davivienda', { type: 'credit' }),
  cuenta('TC Falabella', { type: 'credit' }),
  cuenta('TC Nu Bank Bruno', { type: 'credit' }),
];

function uso(
  name: string,
  usosTelefono: number,
  usosUsuario: number,
  ultimoUso: string | null = null,
): UsoCuenta {
  return { accountId: cuenta(name).id, usosTelefono, usosUsuario, ultimoUso };
}

const nombres = (cs: CuentaActiva[]) => cs.map(c => c.name);

describe('rankearCuentas', () => {
  it('primero lo que más usa ESTE número, después el ranking de todo el usuario', () => {
    const r = rankearCuentas(CUENTAS, [
      uso('TC Davivienda', 0, 170),
      uso('TC Falabella', 0, 88),
      uso('Nequi Coco', 12, 16),
      uso('TC Nu Bank Bruno', 3, 88),
    ]);
    expect(nombres(r).slice(0, 4)).toEqual([
      'Nequi Coco',
      'TC Nu Bank Bruno',
      'TC Davivienda',
      'TC Falabella',
    ]);
  });

  it('las cuentas sin uso quedan al final, por uso más reciente y después por creación', () => {
    const r = rankearCuentas(
      [
        cuenta('Vieja', { createdAt: '2025-01-01T00:00:00Z' }),
        cuenta('Nueva', { createdAt: '2026-09-01T00:00:00Z' }),
        cuenta('Usada', { createdAt: '2024-01-01T00:00:00Z' }),
        cuenta('Top'),
      ],
      [uso('Top', 0, 5), uso('Usada', 0, 0, '2026-09-20')],
    );
    expect(nombres(r)).toEqual(['Top', 'Usada', 'Nueva', 'Vieja']);
  });

  it('las candidatas (lo que matcheó el texto) van primero, ordenadas por uso', () => {
    const r = rankearCuentas(
      CUENTAS,
      [
        uso('TC Davivienda', 5, 170),
        uso('Nequi Bruno', 0, 2),
        uso('Nequi Coco', 1, 16),
      ],
      ['Nequi Bruno', 'Nequi Coco'],
    );
    expect(nombres(r).slice(0, 3)).toEqual([
      'Nequi Coco',
      'Nequi Bruno',
      'TC Davivienda',
    ]);
  });

  it('no inventa cuentas: el uso de una cuenta inactiva (que no vino en la lista) se ignora', () => {
    const r = rankearCuentas(
      [cuenta('Efectivo')],
      [
        {
          accountId: 'id-borrada',
          usosTelefono: 9,
          usosUsuario: 9,
          ultimoUso: null,
        },
      ],
    );
    expect(nombres(r)).toEqual(['Efectivo']);
  });
});

describe('truncarTitulo', () => {
  it('deja intacto un nombre de hasta 24 caracteres', () => {
    expect(truncarTitulo('TC Nu Bank Bruno')).toBe('TC Nu Bank Bruno');
    expect(truncarTitulo('x'.repeat(24))).toBe('x'.repeat(24));
  });

  it('corta un nombre largo a 24 con puntos suspensivos', () => {
    const t = truncarTitulo('Tarjeta de crédito Davivienda Oro');
    expect([...t].length).toBe(24);
    expect(t.endsWith('…')).toBe(true);
  });
});

describe('ids de opción', () => {
  it('armar y parsear son inversos', () => {
    const id = armarIdOpcion(PROMPT, '93b01c7a-5e70-43b6-8d1e-c7eb9122bb07');
    expect(id).toBe(`cta:${PROMPT}:93b01c7a-5e70-43b6-8d1e-c7eb9122bb07`);
    expect(parsearIdOpcion(id)).toEqual({
      promptId: PROMPT,
      accountId: '93b01c7a-5e70-43b6-8d1e-c7eb9122bb07',
    });
  });

  it.each([
    '',
    'cta:',
    `cta:${PROMPT}`,
    `cta:${PROMPT}:no-es-uuid`,
    `otra:${PROMPT}:${PROMPT}`,
    `cta:${PROMPT}:${PROMPT}:extra`,
    ` cta:${PROMPT}:${PROMPT}`,
    `cta:${PROMPT}:${PROMPT}' OR 1=1`,
  ])('rechaza un id que no es nuestro: %j', listId => {
    expect(parsearIdOpcion(listId)).toBeNull();
  });

  it('normaliza a minúsculas', () => {
    expect(parsearIdOpcion(`cta:${PROMPT.toUpperCase()}:${PROMPT}`)).toEqual({
      promptId: PROMPT,
      accountId: PROMPT,
    });
  });
});

describe('armarVariablesLista', () => {
  const seis = CUENTAS.slice(0, 6).map((c, i) => ({
    ...c,
    id: `0000000${i}-0000-4000-8000-000000000000`,
  }));

  it('arma exactamente 19 variables: cuerpo + (id, título, descripción) × 6', () => {
    const vars = armarVariablesLista('¿Con qué cuenta fue?', PROMPT, seis);
    expect(vars).not.toBeNull();
    expect(Object.keys(vars!).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: 19 }, (_, i) => String(i + 1)),
    );
    expect(vars!['1']).toBe('¿Con qué cuenta fue?');
    expect(vars!['2']).toBe(armarIdOpcion(PROMPT, seis[0].id));
    expect(vars!['3']).toBe('Ahorros Nu');
    expect(vars!['4']).toBe('Cuenta bancaria');
    expect(vars!['8']).toBe(armarIdOpcion(PROMPT, seis[2].id));
    expect(vars!['9']).toBe('Efectivo');
    expect(vars!['17']).toBe(armarIdOpcion(PROMPT, seis[5].id));
    expect(vars!['18']).toBe('TC Davivienda');
    expect(vars!['19']).toBe('Tarjeta de crédito');
  });

  it('ninguna variable queda vacía y se respetan los topes de WhatsApp', () => {
    const raras = seis.map((c, i) =>
      i === 0
        ? {
            ...c,
            name: 'Cuenta con un nombre larguísimo de verdad',
            type: null,
          }
        : c,
    );
    const vars = armarVariablesLista('x'.repeat(2000), PROMPT, raras)!;
    for (const v of Object.values(vars)) expect(v.trim()).not.toBe('');
    expect(vars['1'].length).toBeLessThanOrEqual(1024);
    expect([...vars['3']].length).toBeLessThanOrEqual(24);
    expect(vars['4'].length).toBeLessThanOrEqual(72);
  });

  it('con menos de 6 cuentas no arma nada (la plantilla tiene 6 ítems fijos)', () => {
    expect(armarVariablesLista('x', PROMPT, seis.slice(0, 5))).toBeNull();
  });
});

describe('textoPreguntaCuenta', () => {
  it('lista las opciones en orden y pide responder con el nombre', () => {
    const t = textoPreguntaCuenta('¿Con qué cuenta fue?', [
      cuenta('Nequi Bruno'),
      cuenta('Nequi Coco'),
    ]);
    expect(t).toContain('¿Con qué cuenta fue?');
    expect(t).toContain('Nequi Bruno, Nequi Coco');
    expect(t).toMatch(/respondé con el nombre/i);
  });
});

describe('pareceRespuestaDeCuenta / interpretarRespuestaCuenta', () => {
  const NOMBRES = nombres(CUENTAS);

  it('un nombre corto y exacto se aplica', () => {
    expect(interpretarRespuestaCuenta('Nequi Coco', NOMBRES)).toEqual({
      kind: 'ok',
      cuenta: 'Nequi Coco',
    });
    expect(interpretarRespuestaCuenta('con la nequi coco', NOMBRES)).toEqual({
      kind: 'ok',
      cuenta: 'Nequi Coco',
    });
    expect(interpretarRespuestaCuenta('efectivo', NOMBRES)).toEqual({
      kind: 'ok',
      cuenta: 'Efectivo',
    });
    expect(interpretarRespuestaCuenta('Falabella', NOMBRES)).toEqual({
      kind: 'ok',
      cuenta: 'TC Falabella',
    });
  });

  it('un nombre que matchea varias cuentas devuelve las candidatas', () => {
    expect(interpretarRespuestaCuenta('nequi', NOMBRES)).toEqual({
      kind: 'ambigua',
      candidatas: ['Nequi Bruno', 'Nequi Coco'],
    });
  });

  it('un gasto con monto NO es una respuesta de cuenta (va al agente)', () => {
    expect(pareceRespuestaDeCuenta('40k huevos')).toBe(false);
    expect(interpretarRespuestaCuenta('40k huevos', NOMBRES)).toEqual({
      kind: 'no-es-cuenta',
    });
    expect(interpretarRespuestaCuenta('20000 efectivo', NOMBRES)).toEqual({
      kind: 'no-es-cuenta',
    });
  });

  it('un mensaje largo o una pregunta no es una respuesta de cuenta', () => {
    expect(pareceRespuestaDeCuenta('pagué con la nequi de coco ayer')).toBe(
      false,
    );
    expect(pareceRespuestaDeCuenta('¿cuánto llevo en efectivo?')).toBe(false);
    expect(
      interpretarRespuestaCuenta('cuanto llevo en efectivo', NOMBRES),
    ).toEqual({ kind: 'no-es-cuenta' });
  });

  it('un texto sin cuenta no es una respuesta de cuenta', () => {
    expect(interpretarRespuestaCuenta('gracias', NOMBRES)).toEqual({
      kind: 'no-es-cuenta',
    });
    expect(interpretarRespuestaCuenta('hola', NOMBRES)).toEqual({
      kind: 'no-es-cuenta',
    });
  });
});
