import { describe, it, expect } from 'vitest';

import {
  buildCategorizationPrompt,
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
