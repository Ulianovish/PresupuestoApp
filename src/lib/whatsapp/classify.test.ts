import { describe, expect, it } from 'vitest';

import {
  ackMessage,
  classifyText,
  extractCufe,
  isCufe,
  simpleReply,
} from './classify';

// Un CUFE DIAN real es un hash hex de 96 caracteres.
const CUFE = 'a'.repeat(96);
// CUFE real (mismo del QR de prueba del usuario).
const REAL_CUFE =
  'd434a4e186eeaa19d67e27b796af6847db0cd0aa708698fbc42fb6c68e1062867a5d9090d1bc2a907f2a0c12439c3e8a';
// Bloque de texto tal como lo entrega el QR de una factura DIAN.
const QR_BLOCK = [
  'NumFac: E2MD091860',
  'FecFac: 2026-06-12',
  'NitFac: 900020293',
  'ValTolFac: 725200.28',
  `CUFE: ${REAL_CUFE}`,
].join('\n');

describe('isCufe', () => {
  it('acepta 96 hex', () => {
    expect(isCufe(CUFE)).toBe(true);
    expect(isCufe(`  ${CUFE}  `)).toBe(true);
  });
  it('rechaza longitudes/!hex', () => {
    expect(isCufe('a'.repeat(95))).toBe(false);
    expect(isCufe('z'.repeat(96))).toBe(false);
    expect(isCufe('hola')).toBe(false);
  });
});

describe('extractCufe', () => {
  it('extrae un CUFE suelto', () => {
    expect(extractCufe(REAL_CUFE)).toBe(REAL_CUFE);
    expect(extractCufe(`  ${REAL_CUFE}  `)).toBe(REAL_CUFE);
  });
  it('extrae el CUFE del bloque completo del QR', () => {
    expect(extractCufe(QR_BLOCK)).toBe(REAL_CUFE);
  });
  it('extrae el CUFE de una URL del catálogo DIAN', () => {
    expect(
      extractCufe(`https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${REAL_CUFE}`),
    ).toBe(REAL_CUFE);
  });
  it('normaliza a minúsculas', () => {
    expect(extractCufe(REAL_CUFE.toUpperCase())).toBe(REAL_CUFE);
  });
  it('no encuentra CUFE en texto sin uno → null', () => {
    expect(extractCufe('hola mundo')).toBeNull();
    expect(extractCufe('a'.repeat(95))).toBeNull();
  });
  it('no toma parte de un hash más largo que 96', () => {
    expect(extractCufe('a'.repeat(120))).toBeNull();
  });
});

describe('classifyText', () => {
  it('imagen (numMedia>0) → image', () => {
    expect(classifyText('', 1)).toBe('image');
    expect(classifyText(CUFE, 1)).toBe('image'); // media manda
  });
  it('CUFE → cufe', () => {
    expect(classifyText(CUFE, 0)).toBe('cufe');
  });
  it('bloque del QR con CUFE → cufe', () => {
    expect(classifyText(QR_BLOCK, 0)).toBe('cufe');
  });
  it('ayuda → help', () => {
    expect(classifyText('ayuda', 0)).toBe('help');
    expect(classifyText('HELP', 0)).toBe('help');
  });
  it('gasto rápido → quick_expense', () => {
    expect(classifyText('20k taxi', 0)).toBe('quick_expense');
  });
  it('no entendible → unknown', () => {
    expect(classifyText('hola', 0)).toBe('unknown');
  });
});

describe('ackMessage', () => {
  it('cufe y quick_expense tienen ack interino', () => {
    expect(ackMessage('cufe')).toMatch(/factura|proces/i);
    expect(ackMessage('quick_expense')).toMatch(/anot|registr|gast/i);
  });
});

describe('simpleReply', () => {
  it('image avisa que las fotos llegan pronto', () => {
    expect(simpleReply('image')).toMatch(/foto|imagen|pronto/i);
  });
  it('help lista lo que puede hacer', () => {
    expect(simpleReply('help')).toMatch(/CUFE/i);
  });
  it('unknown orienta al usuario', () => {
    expect(simpleReply('unknown')).toMatch(/CUFE|gasto/i);
  });
});
