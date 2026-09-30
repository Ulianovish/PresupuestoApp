import { describe, it, expect } from 'vitest';

import { passwordSchema, registerSchema } from './schemas';

const REGISTRO_VALIDO = {
  email: 'usuario@ejemplo.com',
  password: 'clavesegura',
  confirmPassword: 'clavesegura',
  fullName: 'Usuario Prueba',
};

function mensajeEn(
  issues: { path: PropertyKey[]; message: string }[] | undefined,
  campo: string,
): string | undefined {
  return issues?.find(issue => issue.path[0] === campo)?.message;
}

describe('passwordSchema', () => {
  it('rechaza 7 caracteres con el mismo texto que muestra la UI', () => {
    const resultado = passwordSchema.safeParse('a'.repeat(7));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      'Usa al menos 8 caracteres',
    );
  });

  it('acepta exactamente 8 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true);
  });

  it('acepta exactamente 72 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
  });

  it('rechaza 73 caracteres', () => {
    const resultado = passwordSchema.safeParse('a'.repeat(73));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      'Usa como máximo 72 caracteres',
    );
  });

  it('no exige mayúsculas, números ni símbolos', () => {
    expect(passwordSchema.safeParse('solominusculas').success).toBe(true);
    expect(passwordSchema.safeParse('una frase con espacios').success).toBe(
      true,
    );
  });
});

describe('registerSchema', () => {
  it('acepta un registro válido', () => {
    expect(registerSchema.safeParse(REGISTRO_VALIDO).success).toBe(true);
  });

  it('rechaza 6 y 7 caracteres (el mínimo viejo era 6)', () => {
    for (const largo of [6, 7]) {
      const clave = 'a'.repeat(largo);
      const resultado = registerSchema.safeParse({
        ...REGISTRO_VALIDO,
        password: clave,
        confirmPassword: clave,
      });
      expect(resultado.success).toBe(false);
      expect(mensajeEn(resultado.error?.issues, 'password')).toBe(
        'Usa al menos 8 caracteres',
      );
    }
  });

  it('rechaza 73 caracteres', () => {
    const clave = 'a'.repeat(73);
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      password: clave,
      confirmPassword: clave,
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'password')).toBe(
      'Usa como máximo 72 caracteres',
    );
  });

  it('pide confirmar la contraseña si viene vacía', () => {
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      confirmPassword: '',
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'confirmPassword')).toBe(
      'Confirma tu contraseña',
    );
  });

  it('rechaza contraseñas que no coinciden', () => {
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      confirmPassword: 'otraclavedistinta',
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'confirmPassword')).toBe(
      'Las contraseñas no coinciden',
    );
  });
});
