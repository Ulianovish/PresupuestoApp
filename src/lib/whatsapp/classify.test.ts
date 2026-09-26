import { describe, expect, it } from 'vitest';

import {
  ackMessage,
  classifyText,
  extractCufe,
  extractQrNits,
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
  it('gasto de texto → agent', () => {
    expect(classifyText('20k taxi', 0)).toBe('agent');
  });
  it('no entendible → agent', () => {
    expect(classifyText('hola', 0)).toBe('agent');
  });
});

describe('classifyText — enrutado al agente', () => {
  it('el CUFE sigue siendo determinista, no pasa por el agente', () => {
    expect(classifyText('a'.repeat(96), 0)).toBe('cufe');
  });

  it('manda al agente lo que antes caía en unknown', () => {
    expect(classifyText('¿cuánto llevo en mercado?', 0)).toBe('agent');
  });

  it('manda al agente los gastos de texto: el parser acertaba mal en silencio', () => {
    expect(classifyText('2 empanadas 5000', 0)).toBe('agent');
  });

  it('"ayuda" sigue siendo respuesta fija: no gasta tokens', () => {
    expect(classifyText('ayuda', 0)).toBe('help');
  });

  it('una imagen sigue siendo imagen', () => {
    expect(classifyText('con la Davivienda', 1)).toBe('image');
  });
});

describe('ackMessage', () => {
  it('cufe tiene ack interino', () => {
    expect(ackMessage()).toMatch(/factura|consult/i);
    // La pantalla de aprobación se eliminó: el ack no puede seguir prometiendo
    // dejarla "lista para revisar".
    expect(ackMessage()).not.toMatch(/revisar/i);
  });
});

describe('simpleReply', () => {
  it('image avisa que las fotos llegan pronto', () => {
    expect(simpleReply('image')).toMatch(/foto|imagen|pronto/i);
  });
  it('help lista lo que puede hacer', () => {
    expect(simpleReply('help')).toMatch(/CUFE/i);
  });
});

describe('extractQrNits', () => {
  // Formato A: una sola línea con pares key="valor" (así lo devuelven algunos
  // lectores de QR).
  const QR_LINEA = [
    'NumFac="A958429444"',
    'QRCode="https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=257e"',
    'FecFac="20260731195011"',
    'DocAdq="1121818398"',
    'NitFac="800149695"',
    'ValIva="0.00"',
    'ValFac="138835.00"',
    'CUFE="257e017c3f28e23102fba2aa35a2c1b049c88efbef312c22b3d9cb24f3c3ae749dcd4a942c972bf80f9a2dc9770df0ee"',
  ].join(' ');
  // Formato B: una línea por campo, "Key: valor", con el CUFE en la línea
  // siguiente a su etiqueta.
  const QR_LINEAS = [
    'NumFac: B3828717',
    'FecFac: 2026-09-16',
    'HorFac: 13:28:48-05:00',
    'NitFac: 890922113',
    'DocAdq: 1018427689',
    'ValFac: 97400.00',
    'CUFE:',
    '2b1af0974d2ff13b97a46279b75ea9b3cd3dea3c0f1250791a75cdb2f74db5374d69582635cfa8774f48229dfffb79cf',
  ].join('\n');

  it('formato key="valor" en una línea → [NitFac, DocAdq]', () => {
    expect(extractQrNits(QR_LINEA)).toEqual(['800149695', '1121818398']);
  });
  it('formato "Key: valor" por líneas → [NitFac, DocAdq]', () => {
    expect(extractQrNits(QR_LINEAS)).toEqual(['890922113', '1018427689']);
  });
  it('tolera espacios alrededor del separador y la clave en otra caja', () => {
    expect(extractQrNits('nitfac = "800149695"\nDOCADQ :1121818398')).toEqual([
      '800149695',
      '1121818398',
    ]);
  });
  it('salta los genéricos de consumidor final (ya son el respaldo del scraper)', () => {
    expect(extractQrNits('NitFac: 900020293\nDocAdq: 222222222222')).toEqual([
      '900020293',
    ]);
    expect(extractQrNits('NitFac: 900020293\nDocAdq: 2222222222')).toEqual([
      '900020293',
    ]);
  });
  it('deduplica si emisor y comprador coinciden', () => {
    expect(extractQrNits('NitFac: 900020293\nDocAdq: 900020293')).toEqual([
      '900020293',
    ]);
  });
  it('sin NitFac/DocAdq (CUFE pelado o texto suelto) → []', () => {
    expect(extractQrNits(REAL_CUFE)).toEqual([]);
    expect(extractQrNits('hola mundo')).toEqual([]);
    expect(extractQrNits('')).toEqual([]);
  });
  it('solo el que venga, en su orden', () => {
    expect(extractQrNits(QR_BLOCK)).toEqual(['900020293']);
    expect(extractQrNits('DocAdq: 1018427689')).toEqual(['1018427689']);
  });
  it('ignora valores que no son un documento (muy cortos o no numéricos)', () => {
    expect(extractQrNits('NitFac: 123\nDocAdq: abc')).toEqual([]);
  });
});
