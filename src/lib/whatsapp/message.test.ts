import { describe, expect, it } from 'vitest';

import { normalizeWhatsappFrom, parseCommand } from './message';

describe('normalizeWhatsappFrom', () => {
  it('quita el prefijo whatsapp: y espacios', () => {
    expect(normalizeWhatsappFrom('whatsapp:+573001234567')).toBe('+573001234567');
    expect(normalizeWhatsappFrom('  whatsapp:+573001234567  ')).toBe('+573001234567');
  });

  it('deja intacto un número ya normalizado', () => {
    expect(normalizeWhatsappFrom('+573001234567')).toBe('+573001234567');
  });
});

describe('parseCommand', () => {
  it('reconoce VINCULAR con código de 6 dígitos (case-insensitive)', () => {
    expect(parseCommand('VINCULAR 482913')).toEqual({ kind: 'link', code: '482913' });
    expect(parseCommand('vincular 000001')).toEqual({ kind: 'link', code: '000001' });
    expect(parseCommand('  Vincular   482913 ')).toEqual({ kind: 'link', code: '482913' });
  });

  it('NO reconoce VINCULAR con formato inválido', () => {
    expect(parseCommand('VINCULAR 12345').kind).toBe('other'); // 5 dígitos
    expect(parseCommand('VINCULAR abcdef').kind).toBe('other');
    expect(parseCommand('VINCULAR').kind).toBe('other');
  });

  it('reconoce ayuda', () => {
    expect(parseCommand('ayuda').kind).toBe('help');
    expect(parseCommand('HELP').kind).toBe('help');
  });

  it('cualquier otra cosa es other con el texto recortado', () => {
    expect(parseCommand('  hola mundo ')).toEqual({ kind: 'other', text: 'hola mundo' });
  });
});
