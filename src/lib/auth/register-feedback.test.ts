import { describe, expect, it } from 'vitest';

import { registerSchema } from '@/lib/validations/schemas';

import { GENERIC_AUTH_ERROR } from './error-messages';
import {
  REGISTER_VALIDATION_ERROR_CODES,
  registerValidationErrorCode,
  resolveRegisterError,
} from './register-feedback';

const validos = {
  email: 'persona@ejemplo.com',
  password: 'clave-de-prueba',
  confirmPassword: 'clave-de-prueba',
  fullName: 'Persona de Prueba',
};

function codigoDe(campos: Partial<typeof validos>): string {
  const resultado = registerSchema.safeParse({ ...validos, ...campos });
  if (resultado.success) throw new Error('se esperaba un error de Zod');
  return registerValidationErrorCode(resultado.error.issues);
}

describe('registerValidationErrorCode', () => {
  it.each([
    [{ email: 'no-es-correo' }, 'email_invalido'],
    [{ email: '' }, 'email_invalido'],
    [{ password: 'corta', confirmPassword: 'corta' }, 'password_corta'],
    [
      { password: 'a'.repeat(73), confirmPassword: 'a'.repeat(73) },
      'password_larga',
    ],
    [{ confirmPassword: 'otra-clave-de-prueba' }, 'no_coinciden'],
    [{ confirmPassword: '' }, 'no_coinciden'],
    [{ fullName: 'A' }, 'nombre_invalido'],
  ])('%j → %s', (campos, codigo) => {
    expect(codigoDe(campos)).toBe(codigo);
  });

  it('sin issues reconocibles → datos_invalidos', () => {
    expect(registerValidationErrorCode([])).toBe('datos_invalidos');
    expect(
      registerValidationErrorCode([{ path: ['otro'], code: 'custom' }]),
    ).toBe('datos_invalidos');
  });

  it('todo código que produce está en la lista cerrada', () => {
    for (const codigo of [
      codigoDe({ email: 'x' }),
      codigoDe({ password: 'x', confirmPassword: 'x' }),
      codigoDe({ fullName: 'A' }),
      registerValidationErrorCode([]),
    ]) {
      expect(REGISTER_VALIDATION_ERROR_CODES.has(codigo)).toBe(true);
    }
  });
});

describe('resolveRegisterError', () => {
  it('sin error no muestra nada', () => {
    expect(resolveRegisterError(null)).toBeNull();
    expect(resolveRegisterError('')).toBeNull();
  });

  it.each([
    ['email_invalido', 'Debe ser un email válido.'],
    ['password_corta', 'La contraseña debe tener al menos 8 caracteres.'],
    ['password_larga', 'La contraseña puede tener como máximo 72 caracteres.'],
    ['no_coinciden', 'Las contraseñas no coinciden.'],
    [
      'nombre_invalido',
      'Escribe tu nombre completo (entre 2 y 255 caracteres).',
    ],
    ['datos_invalidos', 'Revisa los datos del formulario.'],
  ])('traduce el código de validación %s', (codigo, texto) => {
    expect(resolveRegisterError(codigo)).toBe(texto);
  });

  it('traduce los códigos de Supabase con translateAuthError', () => {
    expect(resolveRegisterError('signup_not_allowed')).toBe(
      'Este correo no tiene invitación. Pídele acceso a quien administra la app.',
    );
    expect(resolveRegisterError('over_email_send_rate_limit')).toBe(
      'Enviamos demasiados correos. Intenta de nuevo en unos minutos.',
    );
  });

  it.each([
    'Tu cuenta fue suspendida, llama al 000 para reactivarla',
    'Las contraseñas no coinciden',
    'constructor',
    'toString',
  ])(
    'texto libre en ?error= nunca se muestra: cae en el genérico (%s)',
    texto => {
      expect(resolveRegisterError(texto)).toBe(GENERIC_AUTH_ERROR);
    },
  );
});
