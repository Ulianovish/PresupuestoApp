import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';

import { callGatewayReal, runAgent, type AgentRunDeps } from './run';

const CTX = {
  accounts: ['Efectivo', 'Nequi'],
  categories: ['MERCADO'],
  defaultAccount: 'Efectivo',
  today: '2026-08-17',
  pendingInvoice: null,
  lastEntity: null,
  turns: [],
};

/** Respuesta del Gateway con una llamada a herramienta. */
function conHerramienta(name: string, input: unknown) {
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', id: 'tu_1', name, input }],
  };
}

function conTexto(text: string) {
  return { stop_reason: 'end_turn', content: [{ type: 'text', text }] };
}

describe('runAgent', () => {
  it('ejecuta la herramienta que pide el modelo y devuelve su texto final', async () => {
    const respuestas = [
      conHerramienta('registrar_gasto', {
        monto: 45000,
        descripcion: 'mercado',
      }),
      conTexto('Anotado.'),
    ];
    const ejecutadas: string[] = [];
    const deps: AgentRunDeps = {
      callGateway: async () => respuestas.shift(),
      executeTool: async name => {
        ejecutadas.push(name);
        return { ok: true, summary: 'listo' };
      },
    };

    const r = await runAgent('45k mercado', CTX, deps);
    expect(ejecutadas).toEqual(['registrar_gasto']);
    if ('text' in r) expect(r.text).toBe('Anotado.');
  });

  it('corta a las 3 vueltas: un modelo en bucle no puede colgar la función', async () => {
    let vueltas = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => {
        vueltas++;
        return conHerramienta('registrar_gasto', {
          monto: 1,
          descripcion: 'x',
        });
      },
      executeTool: async () => ({ ok: true, summary: 'listo' }),
    };

    await runAgent('loop', CTX, deps);
    expect(vueltas).toBeLessThanOrEqual(3);
  });

  it('devuelve service_error si el Gateway falla, para no culpar al usuario', async () => {
    const deps: AgentRunDeps = {
      callGateway: async () => {
        throw new Error('429 Too Many Requests');
      },
      executeTool: async () => ({ ok: true, summary: 'listo' }),
    };

    const r = await runAgent('45k mercado', CTX, deps);
    expect('kind' in r && r.kind === 'service_error').toBe(true);
    // Nada se ejecutó todavía: el llamador SÍ puede intentar el modo degradado.
    if ('kind' in r) expect(r.huboEscrituras).toBe(false);
  });

  it('si el Gateway falla DESPUÉS de que una herramienta escribió, el service_error lo dice', async () => {
    // El bug crítico: el try envuelve todo el bucle. Con la vuelta 0 buena (la
    // herramienta YA escribió el gasto) y la vuelta 1 caída, el llamador leía
    // un service_error pelado, corría el modo degradado con el mismo mensaje y
    // registraba el gasto por segunda vez.
    let vuelta = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => {
        vuelta++;
        if (vuelta === 1) {
          return conHerramienta('registrar_gasto', {
            monto: 20000,
            descripcion: 'taxi',
          });
        }
        throw new Error('429 Too Many Requests');
      },
      executeTool: async () => ({
        ok: true,
        wrote: true,
        summary: 'Guardado: 20000 "taxi".',
      }),
    };

    const r = await runAgent('20k taxi', CTX, deps);
    expect('kind' in r && r.kind === 'service_error').toBe(true);
    if ('kind' in r) expect(r.huboEscrituras).toBe(true);
  });

  it('si el Gateway falla después de DOS escrituras, el service_error trae el resumen de lo guardado', async () => {
    // El incidente real: "40k carne desmechar / 14k huevos / Con davivienda".
    // Los dos registrar_gasto escribieron, la vuelta de cierre se cayó (429 en
    // ráfaga) y el usuario recibió un aviso genérico sin saber QUÉ se guardó:
    // las confirmaciones ya calculadas se tiraban a la basura.
    const respuestas = [
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'a',
            name: 'registrar_gasto',
            input: { monto: 40000, descripcion: 'carne desmechar' },
          },
          {
            type: 'tool_use',
            id: 'b',
            name: 'registrar_gasto',
            input: { monto: 14000, descripcion: 'huevos' },
          },
        ],
      },
    ];
    const deps: AgentRunDeps = {
      callGateway: async () => {
        const r = respuestas.shift();
        if (!r) throw new Error('Gateway 429: rate limited');
        return r;
      },
      executeTool: async (_name, input) => ({
        ok: true,
        wrote: true,
        summary: `Guardado: ${input.monto} "${input.descripcion}".`,
        userSummary: `✅ Anotado ${input.monto} · ${input.descripcion}.`,
      }),
    };

    const r = await runAgent('40k carne desmechar / 14k huevos', CTX, deps);
    if (!('kind' in r)) throw new Error('se esperaba service_error');
    expect(r.huboEscrituras).toBe(true);
    expect(r.resumen).toBe(
      '✅ Anotado 40000 · carne desmechar.\n✅ Anotado 14000 · huevos.',
    );
  });

  it('el resumen del corte deja afuera lo que falló sin escribir', async () => {
    const respuestas = [
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'a',
            name: 'registrar_gasto',
            input: { monto: 40000, descripcion: 'carne' },
          },
          {
            type: 'tool_use',
            id: 'b',
            name: 'registrar_gasto',
            input: { monto: 1, descripcion: 'x', cuenta: 'Bancolombia' },
          },
        ],
      },
    ];
    const deps: AgentRunDeps = {
      callGateway: async () => {
        const r = respuestas.shift();
        if (!r) throw new Error('Gateway 503');
        return r;
      },
      executeTool: async (_name, input) =>
        input.cuenta
          ? { ok: false, summary: 'La cuenta "Bancolombia" no existe.' }
          : {
              ok: true,
              wrote: true,
              summary: 'Guardado.',
              userSummary: '✅ Anotado carne.',
            },
    };

    const r = await runAgent('varios', CTX, deps);
    if (!('kind' in r)) throw new Error('se esperaba service_error');
    expect(r.resumen).toBe('✅ Anotado carne.');
  });

  it('un service_error sin escrituras no trae resumen', async () => {
    const deps: AgentRunDeps = {
      callGateway: async () => {
        throw new Error('Gateway 429');
      },
      executeTool: async () => ({ ok: true, summary: 'listo' }),
    };

    const r = await runAgent('45k mercado', CTX, deps);
    if (!('kind' in r)) throw new Error('se esperaba service_error');
    expect(r.resumen).toBeUndefined();
  });

  it('una herramienta que falló sin escribir no marca huboEscrituras: el modo degradado sigue disponible', async () => {
    let vuelta = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => {
        vuelta++;
        if (vuelta === 1) {
          return conHerramienta('registrar_gasto', {
            monto: 1000,
            descripcion: 'x',
            cuenta: 'Bancolombia',
          });
        }
        throw new Error('timeout');
      },
      executeTool: async () => ({
        ok: false,
        summary: 'La cuenta "Bancolombia" no existe.',
      }),
    };

    const r = await runAgent('1000 x', CTX, deps);
    if (!('kind' in r)) throw new Error('se esperaba service_error');
    expect(r.huboEscrituras).toBe(false);
  });

  it('le devuelve al modelo el error de la herramienta para que pueda reaccionar', async () => {
    const respuestas = [
      conHerramienta('registrar_gasto', {
        monto: 1000,
        descripcion: 'x',
        cuenta: 'Bancolombia',
      }),
      conTexto('¿Con cuál de tus cuentas fue?'),
    ];
    let recibidoPorElModelo = '';
    const deps: AgentRunDeps = {
      callGateway: async mensajes => {
        const ultimo = mensajes[mensajes.length - 1];
        if (Array.isArray(ultimo?.content)) {
          const res = ultimo.content.find(
            (c: { type?: string }) => c?.type === 'tool_result',
          ) as { content?: string } | undefined;
          if (res?.content) recibidoPorElModelo = res.content;
        }
        return respuestas.shift();
      },
      executeTool: async () => ({
        ok: false,
        summary: 'La cuenta "Bancolombia" no existe.',
      }),
    };

    await runAgent('1000 x con Bancolombia', CTX, deps);
    expect(recibidoPorElModelo).toContain('Bancolombia');
  });

  it('varios gastos en un mensaje ejecutan varias herramientas', async () => {
    const respuestas = [
      {
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'a',
            name: 'registrar_gasto',
            input: { monto: 20000, descripcion: 'taxi' },
          },
          {
            type: 'tool_use',
            id: 'b',
            name: 'registrar_gasto',
            input: { monto: 15000, descripcion: 'almuerzo' },
          },
        ],
      },
      conTexto('Anoté los dos.'),
    ];
    let n = 0;
    const deps: AgentRunDeps = {
      callGateway: async () => respuestas.shift(),
      executeTool: async () => {
        n++;
        return { ok: true, summary: 'listo' };
      },
    };

    await runAgent('20k taxi y 15k almuerzo', CTX, deps);
    expect(n).toBe(2);
  });

  it('no devuelve el comentario de una vuelta vieja si las últimas vueltas solo ejecutan herramientas', async () => {
    const respuestas = [
      {
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'Dejame revisar eso...' },
          {
            type: 'tool_use',
            id: 'a',
            name: 'registrar_gasto',
            input: { monto: 20000, descripcion: 'taxi' },
          },
        ],
      },
      conHerramienta('registrar_gasto', {
        monto: 15000,
        descripcion: 'almuerzo',
      }),
      conHerramienta('registrar_gasto', { monto: 10000, descripcion: 'cafe' }),
    ];
    const deps: AgentRunDeps = {
      callGateway: async () => respuestas.shift(),
      executeTool: async () => ({ ok: true, summary: 'Registré el gasto.' }),
    };

    const r = await runAgent('varios gastos', CTX, deps);
    if (!('text' in r)) throw new Error('se esperaba texto, no service_error');
    expect(r.text).not.toBe('Dejame revisar eso...');
    expect(r.text).toContain('Registré');
  });

  it('si se agotan las vueltas con herramientas exitosas, arma el texto final con lo que se registró', async () => {
    const deps: AgentRunDeps = {
      callGateway: async () =>
        conHerramienta('registrar_gasto', { monto: 1, descripcion: 'x' }),
      executeTool: async () => ({ ok: true, summary: 'Registré 1 en x.' }),
    };

    const r = await runAgent('loop', CTX, deps);
    if (!('text' in r)) throw new Error('se esperaba texto, no service_error');
    expect(r.text).not.toBe('');
    expect(r.text).toContain('Registré');
  });

  it('si se agotan las vueltas tras un registro parcial, el texto NO invita a reintentar', async () => {
    // El resultado parcial es `ok:false` y aun así dejó transacciones reales.
    // Dejarlo afuera del fallback hacía que el usuario leyera "No pude
    // completar la acción. Probá de nuevo" y reenviara la factura.
    const deps: AgentRunDeps = {
      callGateway: async () =>
        conHerramienta('registrar_factura', { cuenta: 'Nequi' }),
      executeTool: async () => ({
        ok: false,
        wrote: true,
        summary:
          'Se registraron 2 de 5 ítems en Nequi; el resto falló. Decile al usuario que revise la factura en la app, NO le sugieras reenviar la foto.',
        userSummary:
          '⚠️ Registré 2 de 5 ítems de tu factura en Nequi; el resto falló. Revisala en la app, no la reenvíes.',
      }),
    };

    const r = await runAgent('con Nequi', CTX, deps);
    if (!('text' in r)) throw new Error('se esperaba texto, no service_error');
    expect(r.text).not.toMatch(/probá de nuevo/i);
    expect(r.text).toContain('2 de 5');
    // El texto del usuario, no el escrito PARA EL MODELO.
    expect(r.text).not.toMatch(/decile al usuario/i);
  });

  it('el fallback usa el texto para el usuario (montos formateados), no el del modelo', async () => {
    const deps: AgentRunDeps = {
      callGateway: async () =>
        conHerramienta('registrar_gasto', {
          monto: 20000,
          descripcion: 'taxi',
        }),
      executeTool: async () => ({
        ok: true,
        wrote: true,
        summary: 'Guardado: 20000 "taxi" en TRANSPORTE (Nequi).',
        userSummary: '✅ Anotado $ 20.000 en TRANSPORTE (Nequi) · taxi.',
      }),
    };

    const r = await runAgent('20k taxi', CTX, deps);
    if (!('text' in r)) throw new Error('se esperaba texto, no service_error');
    expect(r.text).toContain('20.000');
    expect(r.text).not.toContain('Guardado: 20000');
  });

  it('una herramienta que lanza excepción no es un service_error: el modelo recibe el error y el bucle sigue', async () => {
    const respuestas = [
      conHerramienta('registrar_gasto', { monto: 1000, descripcion: 'x' }),
      conTexto('Tuve un problema, pero seguimos.'),
    ];
    let recibioErrorControlado = false;
    const deps: AgentRunDeps = {
      callGateway: async mensajes => {
        const ultimo = mensajes[mensajes.length - 1];
        if (Array.isArray(ultimo?.content)) {
          const res = ultimo.content.find(
            (c: { type?: string }) => c?.type === 'tool_result',
          ) as { is_error?: boolean } | undefined;
          if (res?.is_error) recibioErrorControlado = true;
        }
        return respuestas.shift();
      },
      executeTool: async () => {
        throw new Error('boom: bug de programación en la herramienta');
      },
    };

    const r = await runAgent('1000 x', CTX, deps);
    expect('kind' in r).toBe(false);
    expect(recibioErrorControlado).toBe(true);
  });
});

describe('callGatewayReal: reintentos', () => {
  const OK = {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: 'hola' }],
  };
  let esperas: number[];
  const dormir = async (ms: number) => {
    esperas.push(ms);
  };

  function respuesta(status: number, headers: Record<string, string> = {}) {
    return new Response(status === 200 ? JSON.stringify(OK) : 'rate limited', {
      status,
      headers,
    });
  }

  beforeEach(() => {
    esperas = [];
    vi.stubEnv('AI_GATEWAY_API_KEY', 'k-test');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('429 con Retry-After: respeta la espera que pide el Gateway y termina bien', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuesta(429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(respuesta(429, { 'Retry-After': '2' }))
      .mockResolvedValueOnce(respuesta(200));
    vi.stubGlobal('fetch', fetchMock);

    const r = await callGatewayReal([], 'sys', { dormir });

    expect(r).toEqual(OK);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(esperas).toHaveLength(2);
    for (const ms of esperas) {
      expect(ms).toBeGreaterThanOrEqual(2000);
      expect(ms).toBeLessThan(2600);
    }
  });

  it('sin Retry-After, el backoff crece (~2s, ~5s, ~10s) y al agotarse lanza con el status', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => respuesta(503));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGatewayReal([], 'sys', { dormir })).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(esperas).toHaveLength(3);
    expect(esperas[0]).toBeGreaterThanOrEqual(2000);
    expect(esperas[0]).toBeLessThan(2600);
    expect(esperas[1]).toBeGreaterThanOrEqual(5000);
    expect(esperas[1]).toBeLessThan(5600);
    expect(esperas[2]).toBeGreaterThanOrEqual(10_000);
    expect(esperas[2]).toBeLessThan(10_600);
  });

  it('un Retry-After enorme se recorta al tope por espera', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuesta(429, { 'Retry-After': '120' }))
      .mockResolvedValueOnce(respuesta(200));
    vi.stubGlobal('fetch', fetchMock);

    await callGatewayReal([], 'sys', { dormir });

    expect(esperas).toHaveLength(1);
    expect(esperas[0]).toBeLessThanOrEqual(15_000);
    expect(esperas[0]).toBeGreaterThanOrEqual(10_000);
  });

  it('400 no se reintenta: es un error del pedido, no del proveedor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuesta(400));
    vi.stubGlobal('fetch', fetchMock);

    await expect(callGatewayReal([], 'sys', { dormir })).rejects.toMatchObject({
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(esperas).toHaveLength(0);
  });

  it('un error de red (fetch lanza) se reintenta', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(respuesta(200));
    vi.stubGlobal('fetch', fetchMock);

    const r = await callGatewayReal([], 'sys', { dormir });

    expect(r).toEqual(OK);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(esperas).toHaveLength(1);
  });

  it('no reintenta si ya se fue el presupuesto total de tiempo (la función no puede morir muda)', async () => {
    // El primer intento "tarda" 56 s (p. ej. un Gateway colgado): con el
    // presupuesto de 60 s ya no queda margen para esperar y volver a probar.
    let reloj = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      reloj += 56_000;
      throw new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      callGatewayReal([], 'sys', { dormir, ahora: () => reloj }),
    ).rejects.toThrow(/TimeoutError/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(esperas).toHaveLength(0);
  });
});
