import { describe, expect, it } from 'vitest';

import { GENERIC_AUTH_ERROR } from './error-messages';
import {
  FORGOT_PASSWORD_INVALID_EMAIL_CODE,
  FORGOT_PASSWORD_SENT_CODE,
  resolveForgotPasswordFeedback,
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
