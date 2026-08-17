import { describe, it, expect } from 'vitest';

import { runAgent, type AgentRunDeps } from './run';

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
