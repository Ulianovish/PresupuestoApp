import { describe, expect, it } from 'vitest';

import { ackMessage, classifyText, isCufe, simpleReply } from './classify';

// Un CUFE DIAN real es un hash hex de 96 caracteres.
const CUFE = 'a'.repeat(96);

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

describe('classifyText', () => {
  it('imagen (numMedia>0) → image', () => {
    expect(classifyText('', 1)).toBe('image');
    expect(classifyText(CUFE, 1)).toBe('image'); // media manda
  });
  it('CUFE → cufe', () => {
    expect(classifyText(CUFE, 0)).toBe('cufe');
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
