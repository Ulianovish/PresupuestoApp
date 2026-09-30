import { describe, expect, it } from 'vitest';

import { GENERIC_AUTH_ERROR, INVALID_LINK_ERROR_CODE } from './error-messages';
import {
  CHECK_EMAIL_MESSAGE,
  CHECK_EMAIL_MESSAGE_CODE,
  resolveLoginFeedback,
} from './login-feedback';

describe('resolveLoginFeedback', () => {
  it('sin parámetros no muestra nada', () => {
    expect(resolveLoginFeedback({ error: null, message: null })).toEqual({
      error: null,
      message: null,
    });
  });

  it('traduce un código de error conocido', () => {
    expect(
      resolveLoginFeedback({ error: 'invalid_credentials', message: null })
        .error,
    ).toBe('Correo o contraseña incorrectos.');
    expect(
      resolveLoginFeedback({ error: INVALID_LINK_ERROR_CODE, message: null })
        .error,
    ).toBe(
      'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
    );
  });

  it('un error con texto libre nunca se muestra: cae en el genérico', () => {
    const texto = 'Tu cuenta fue suspendida, llama al 000 para reactivarla';
    expect(resolveLoginFeedback({ error: texto, message: null }).error).toBe(
      GENERIC_AUTH_ERROR,
    );
  });

  it('un error vacío no muestra nada', () => {
    expect(resolveLoginFeedback({ error: '', message: null }).error).toBeNull();
  });

  it('traduce el mensaje de revisar el correo', () => {
    expect(CHECK_EMAIL_MESSAGE_CODE).toBe('revisa_correo');
    expect(
      resolveLoginFeedback({ error: null, message: CHECK_EMAIL_MESSAGE_CODE })
        .message,
    ).toBe(CHECK_EMAIL_MESSAGE);
  });

  it.each(['Ganaste un premio, entra a otro.sitio', 'constructor', 'toString'])(
    'un mensaje fuera de la lista cerrada no se muestra (%s)',
    message => {
      expect(resolveLoginFeedback({ error: null, message }).message).toBeNull();
    },
  );
});
