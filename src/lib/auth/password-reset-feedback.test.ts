import { describe, expect, it } from 'vitest';

import { resetPasswordFormSchema } from '@/lib/validations/schemas';

import { GENERIC_AUTH_ERROR } from './error-messages';
import {
  FORGOT_PASSWORD_INVALID_EMAIL_CODE,
  FORGOT_PASSWORD_SENT_CODE,
  RESET_PASSWORD_VALIDATION_ERROR_CODES,
  resetPasswordValidationErrorCode,
  resolveForgotPasswordFeedback,
  resolveResetPasswordError,
} from './password-reset-feedback';

describe('resolveForgotPasswordFeedback', () => {
  it('sin parámetros no muestra nada', () => {
    expect(
      resolveForgotPasswordFeedback({ error: null, message: null }),
    ).toEqual({ error: null, message: null });
    expect(resolveForgotPasswordFeedback({ error: '', message: '' })).toEqual({
      error: null,
      message: null,
    });
  });

  it('traduce el mensaje genérico de enlace enviado', () => {
    expect(FORGOT_PASSWORD_SENT_CODE).toBe('enlace_enviado');
    expect(
      resolveForgotPasswordFeedback({
        error: null,
        message: FORGOT_PASSWORD_SENT_CODE,
      }).message,
    ).toBe('Si el correo está registrado, te enviamos un enlace.');
  });

  it('traduce el correo inválido', () => {
    expect(FORGOT_PASSWORD_INVALID_EMAIL_CODE).toBe('correo_invalido');
    expect(
      resolveForgotPasswordFeedback({
        error: FORGOT_PASSWORD_INVALID_EMAIL_CODE,
        message: null,
      }).error,
    ).toBe('Escribe un correo válido.');
  });

  it('traduce los códigos de Supabase (enlace vencido)', () => {
    expect(
      resolveForgotPasswordFeedback({ error: 'otp_expired', message: null })
        .error,
    ).toBe('El enlace venció. Pide uno nuevo.');
  });

  it.each([
    'Tu cuenta fue suspendida, llama al 000 para reactivarla',
    'constructor',
    'toString',
  ])('un error con texto libre cae en el genérico (%s)', texto => {
    expect(
      resolveForgotPasswordFeedback({ error: texto, message: null }).error,
    ).toBe(GENERIC_AUTH_ERROR);
  });

  it.each([
    'Si el correo está registrado, te enviamos un enlace.',
    'Ganaste un premio, entra a otro.sitio',
    'constructor',
  ])('un mensaje fuera de la lista cerrada no se muestra (%s)', message => {
    expect(
      resolveForgotPasswordFeedback({ error: null, message }).message,
    ).toBeNull();
  });
});

function codigoReset(password: string, confirmPassword: string): string {
  const r = resetPasswordFormSchema.safeParse({ password, confirmPassword });
  if (r.success) throw new Error('se esperaba un error de Zod');
  return resetPasswordValidationErrorCode(r.error.issues);
}

describe('resetPasswordValidationErrorCode', () => {
  it.each([
    ['corta', 'corta', 'password_corta'],
    ['a'.repeat(73), 'a'.repeat(73), 'password_larga'],
    ['claveNueva123', 'otraClave456', 'no_coinciden'],
    ['claveNueva123', '', 'confirmar_password'],
  ])('%s / %s → %s', (password, confirmPassword, codigo) => {
    expect(codigoReset(password, confirmPassword)).toBe(codigo);
  });

  it('sin issues reconocibles → datos_invalidos', () => {
    expect(resetPasswordValidationErrorCode([])).toBe('datos_invalidos');
    expect(
      resetPasswordValidationErrorCode([{ path: ['otro'], code: 'custom' }]),
    ).toBe('datos_invalidos');
  });

  it('todo código que produce está en la lista cerrada', () => {
    for (const codigo of [
      codigoReset('x', 'x'),
      codigoReset('a'.repeat(73), 'a'.repeat(73)),
      codigoReset('claveNueva123', 'otra'),
      codigoReset('claveNueva123', ''),
      resetPasswordValidationErrorCode([]),
    ]) {
      expect(RESET_PASSWORD_VALIDATION_ERROR_CODES.has(codigo)).toBe(true);
    }
  });
});

describe('resolveResetPasswordError', () => {
  it('sin error no muestra nada', () => {
    expect(resolveResetPasswordError(null)).toBeNull();
    expect(resolveResetPasswordError('')).toBeNull();
  });

  it.each([
    ['password_corta', 'La contraseña debe tener al menos 8 caracteres.'],
    ['password_larga', 'La contraseña puede tener como máximo 72 caracteres.'],
    ['no_coinciden', 'Las contraseñas no coinciden.'],
    ['confirmar_password', 'Confirma tu contraseña.'],
    ['datos_invalidos', 'Revisa la contraseña.'],
    ['same_password', 'La contraseña nueva debe ser distinta de la anterior.'],
    ['weak_password', 'La contraseña es muy débil. Usa al menos 8 caracteres.'],
    [
      'reauthentication_needed',
      'Por seguridad, pide un enlace nuevo para cambiar la contraseña.',
    ],
  ])('traduce %s', (codigo, texto) => {
    expect(resolveResetPasswordError(codigo)).toBe(texto);
  });

  it.each([
    'New password should be different from the old password.',
    'Las contraseñas no coinciden',
    'constructor',
  ])('texto libre en ?error= cae en el genérico (%s)', texto => {
    expect(resolveResetPasswordError(texto)).toBe(GENERIC_AUTH_ERROR);
  });
});
