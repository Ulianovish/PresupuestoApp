import { describe, expect, it } from 'vitest';

import {
  PASSWORD_HINT,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './password-rules';
import { passwordSchema } from './schemas';

describe('reglas de contraseña compartidas por Zod y la UI', () => {
  it('passwordSchema aplica exactamente los mismos límites', () => {
    const justo = 'a'.repeat(PASSWORD_MIN_LENGTH);
    expect(passwordSchema.safeParse(justo).success).toBe(true);
    expect(passwordSchema.safeParse(justo.slice(1)).success).toBe(false);
    expect(
      passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success,
    ).toBe(true);
    expect(
      passwordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH + 1)).success,
    ).toBe(false);
  });

  it('el texto de ayuda dice la regla mínima y nada más', () => {
    expect(PASSWORD_HINT).toBe(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres.`);
  });

  it('el texto de ayuda no pide reglas de composición que Zod no valida', () => {
    expect(PASSWORD_HINT).not.toMatch(/mayúscula|minúscula|número|símbolo/i);
  });
});
