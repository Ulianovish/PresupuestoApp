import { describe, it, expect } from 'vitest';

import { toTitleCase } from './text-case';

describe('toTitleCase', () => {
  it('pasa MAYÚSCULAS a cada palabra con inicial mayúscula', () => {
    expect(toTitleCase('MARTHA ISABEL GARCIA ECHEVERRI')).toBe(
      'Martha Isabel Garcia Echeverri',
    );
    expect(toTitleCase('LEC ENT PASTE 1 C')).toBe('Lec Ent Paste 1 C');
  });

  it('pasa minúsculas a inicial mayúscula', () => {
    expect(toTitleCase('gasolina moto')).toBe('Gasolina Moto');
  });

  it('respeta las siglas separadas por puntos', () => {
    expect(toTitleCase('JERONIMO MARTINS COLOMBIA S.A.S.')).toBe(
      'Jeronimo Martins Colombia S.A.S.',
    );
    expect(toTitleCase('D1 S A S')).toBe('D1 S A S');
  });

  it('mantiene acentos y maneja vacíos', () => {
    expect(toTitleCase('ALIMENTACIÓN ABRIL')).toBe('Alimentación Abril');
    expect(toTitleCase('')).toBe('');
    expect(toTitleCase(null)).toBe('');
  });
});
