import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  buildCategorizationPrompt,
  categorizeInvoiceItems,
  parseCategorizationResponse,
} from './categorizer';

const CATS = ['VIVIENDA', 'DEUDAS', 'TRANSPORTE', 'MERCADO', 'OTROS'];

describe('buildCategorizationPrompt', () => {
  it('incluye las categorías y las descripciones', () => {
    const prompt = buildCategorizationPrompt(
      [{ description: 'Arroz 1kg' }, { description: 'Gasolina' }],
      CATS,
    );
    expect(prompt).toContain('MERCADO');
    expect(prompt).toContain('Arroz 1kg');
    expect(prompt).toContain('Gasolina');
  });

  it('incluye el proveedor cuando se conoce', () => {
    const prompt = buildCategorizationPrompt([{ description: 'Arroz' }], CATS, {
      supplier: 'Tiendas D1',
    });
    expect(prompt).toContain('Tiendas D1');
  });

  it('incluye ejemplos del historial del usuario como "descripción → CATEGORÍA"', () => {
    const prompt = buildCategorizationPrompt(
      [{ description: 'Gaseosa' }],
      CATS,
      {
        examples: [
          { description: 'Jabón en polvo', category: 'MERCADO' },
          { description: 'Arriendo Persona Ejemplo', category: 'VIVIENDA' },
        ],
      },
    );
    expect(prompt).toContain('Jabón en polvo → MERCADO');
    expect(prompt).toContain('Arriendo Persona Ejemplo → VIVIENDA');
  });

  it('no empuja a OTROS ante la duda (solo como último recurso)', () => {
    const prompt = buildCategorizationPrompt([{ description: 'Arroz' }], CATS);
    expect(prompt).not.toMatch(/si dudas, usa OTROS/i);
    expect(prompt).toMatch(/OTROS solo si/i);
  });

  it('sin proveedor ni ejemplos no agrega esas secciones', () => {
    const prompt = buildCategorizationPrompt([{ description: 'Arroz' }], CATS);
    expect(prompt).not.toContain('Proveedor');
    expect(prompt).not.toContain('→');
  });
});

describe('parseCategorizationResponse', () => {
  it('mapea categorías válidas por índice', () => {
    const raw = JSON.stringify({ categories: ['MERCADO', 'TRANSPORTE'] });
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'MERCADO',
      'TRANSPORTE',
    ]);
  });

  it('reemplaza categorías inválidas por OTROS', () => {
    const raw = JSON.stringify({ categories: ['COMIDA', 'TRANSPORTE'] });
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'OTROS',
      'TRANSPORTE',
    ]);
  });

  it('rellena con OTROS si faltan elementos', () => {
    const raw = JSON.stringify({ categories: ['MERCADO'] });
    expect(parseCategorizationResponse(raw, 3, CATS)).toEqual([
      'MERCADO',
      'OTROS',
      'OTROS',
    ]);
  });

  it('devuelve todo OTROS si el contenido es null o inválido', () => {
    expect(parseCategorizationResponse(null, 2, CATS)).toEqual([
      'OTROS',
      'OTROS',
    ]);
    expect(parseCategorizationResponse('no-json', 2, CATS)).toEqual([
      'OTROS',
      'OTROS',
    ]);
  });

  it('extrae JSON envuelto en fences markdown (MiniMax)', () => {
    const raw = '```json\n{"categories":["MERCADO","DEUDAS"]}\n```';
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'MERCADO',
      'DEUDAS',
    ]);
  });

  it('extrae JSON aunque venga precedido de razonamiento del modelo', () => {
    const raw =
      'The user wants categories. Let me think...\n{"categories":["TRANSPORTE","OTROS"]}';
    expect(parseCategorizationResponse(raw, 2, CATS)).toEqual([
      'TRANSPORTE',
      'OTROS',
    ]);
  });
});

describe('fallback a OTROS: distinguible en los logs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('avisa (console.warn) cuando la respuesta no se puede parsear', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseCategorizationResponse('no es json', 1, CATS)).toEqual([
      'OTROS',
    ]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('OTROS'));
  });

  it('avisa cuando el modelo devuelve categorías que no existen', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseCategorizationResponse('{"categories":["COMIDA"]}', 1, CATS);
    expect(warn).toHaveBeenCalled();
  });

  it('no avisa si el modelo eligió OTROS a propósito', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    parseCategorizationResponse('{"categories":["OTROS"]}', 1, CATS);
    expect(warn).not.toHaveBeenCalled();
  });

  it('avisa cuando cae a OTROS por error de la IA', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 500 })),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const cats = await categorizeInvoiceItems([{ description: 'x' }], CATS);

    expect(cats).toEqual(['OTROS']);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('OTROS'),
      expect.anything(),
    );
  });

  it('manda proveedor y ejemplos al modelo', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test');
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ text: '{"categories":["MERCADO"]}' }] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await categorizeInvoiceItems([{ description: 'Arroz' }], CATS, {
      supplier: 'Éxito',
      examples: [{ description: 'Gaseosa', category: 'MERCADO' }],
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1]
        .body,
    );
    expect(body.messages[0].content).toContain('Éxito');
    expect(body.messages[0].content).toContain('Gaseosa → MERCADO');
  });
});
