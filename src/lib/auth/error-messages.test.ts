import { describe, expect, it } from 'vitest';

import {
  authErrorCode,
  GENERIC_AUTH_ERROR,
  GENERIC_AUTH_ERROR_CODE,
  INVALID_LINK_ERROR_CODE,
  INVALID_LINK_LOGIN_PATH,
  translateAuthError,
} from './error-messages';

const SIN_INVITACION =
  'Este correo no tiene invitación. Pídele acceso a quien administra la app.';
const CREDENCIALES = 'Correo o contraseña incorrectos.';
const YA_EXISTE =
  'Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.';
const LIMITE = 'Enviamos demasiados correos. Intenta de nuevo en unos minutos.';

describe('translateAuthError', () => {
  it.each([
    ['signup_not_allowed', SIN_INVITACION],
    ['invalid_credentials', CREDENCIALES],
    [
      'email_not_confirmed',
      'Confirma tu correo antes de entrar. Revisa tu bandeja de entrada.',
    ],
    ['user_already_exists', YA_EXISTE],
    ['weak_password', 'La contraseña es muy débil. Usa al menos 8 caracteres.'],
    ['over_email_send_rate_limit', LIMITE],
    [
      'email_address_not_authorized',
      'No pudimos enviar el correo a esta dirección. Escríbele a quien administra la app.',
    ],
    ['signup_disabled', 'El registro está cerrado por ahora.'],
    ['otp_expired', 'El enlace venció. Pide uno nuevo.'],
    [
      'enlace_invalido',
      'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
    ],
    ['same_password', 'La contraseña nueva debe ser distinta de la anterior.'],
  ])('code %s', (code, texto) => {
    expect(translateAuthError({ code, message: 'algo en inglés' })).toBe(texto);
  });

  it.each([
    ['signup_not_allowed', SIN_INVITACION],
    ['Database error saving new user', SIN_INVITACION],
    ['Invalid login credentials', CREDENCIALES],
    ['User already registered', YA_EXISTE],
    ['Email rate limit exceeded', LIMITE],
  ])('message %s', (message, texto) => {
    expect(translateAuthError({ message })).toBe(texto);
  });

  it('no distingue mayúsculas', () => {
    expect(translateAuthError({ message: 'INVALID LOGIN CREDENTIALS' })).toBe(
      CREDENCIALES,
    );
    expect(translateAuthError({ code: 'Weak_Password' })).toBe(
      'La contraseña es muy débil. Usa al menos 8 caracteres.',
    );
  });

  it('el code gana sobre el message', () => {
    expect(
      translateAuthError({
        code: 'weak_password',
        message: 'Invalid login credentials',
      }),
    ).toBe('La contraseña es muy débil. Usa al menos 8 caracteres.');
  });

  it('rechazo por el hook: sin code, message signup_not_allowed (403)', () => {
    // Forma real del AuthApiError del hook: sin `code`, con status 403.
    const errorDelHook = { message: 'signup_not_allowed', status: 403 };
    expect(translateAuthError(errorDelHook)).toBe(SIN_INVITACION);
  });

  it('rechazo por el trigger: code unexpected_failure (desconocido) cae al message', () => {
    expect(
      translateAuthError({
        code: 'unexpected_failure',
        message: 'Database error saving new user',
      }),
    ).toBe(SIN_INVITACION);
  });

  it('un code desconocido sin message conocido → genérico', () => {
    expect(
      translateAuthError({
        code: 'unexpected_failure',
        message: 'detalle interno',
      }),
    ).toBe(GENERIC_AUTH_ERROR);
  });

  it('reconoce el literal del hook dentro de un mensaje más largo', () => {
    expect(
      translateAuthError({
        message: 'Hook requires authorization: signup_not_allowed',
      }),
    ).toBe(SIN_INVITACION);
  });

  it.each([
    'Something went wrong: invalid login credentials for this project',
    'weak_password_policy_disabled',
    'otp_expired_or_whatever',
    'no user_already_exists here',
  ])(
    'solo signup_not_allowed se busca como subcadena (%s → genérico)',
    message => {
      expect(translateAuthError({ message })).toBe(GENERIC_AUTH_ERROR);
    },
  );

  it('enlace_invalido tiene texto propio y constantes exportadas', () => {
    expect(INVALID_LINK_ERROR_CODE).toBe('enlace_invalido');
    expect(translateAuthError({ code: INVALID_LINK_ERROR_CODE })).toBe(
      'El enlace no es válido o ya venció. Si ya confirmaste tu correo, inicia sesión.',
    );
    expect(INVALID_LINK_LOGIN_PATH).toBe('/auth/login?error=enlace_invalido');
  });

  it('same_password (updateUser con la misma clave) tiene texto propio', () => {
    expect(
      translateAuthError({
        code: 'same_password',
        message: 'New password should be different from the old password.',
      }),
    ).toBe('La contraseña nueva debe ser distinta de la anterior.');
  });

  it('reauthentication_needed (updateUser con "Secure password change") pide un enlace nuevo', () => {
    expect(
      translateAuthError({
        code: 'reauthentication_needed',
        message: 'Password update requires reauthentication.',
      }),
    ).toBe('Por seguridad, pide un enlace nuevo para cambiar la contraseña.');
    expect(authErrorCode({ code: 'reauthentication_needed' })).toBe(
      'reauthentication_needed',
    );
  });

  it.each([
    [null],
    [undefined],
    [{}],
    [{ code: '', message: '' }],
    [{ message: 'Internal server error: tabla x no existe' }],
    [{ code: 'constructor' }],
    [{ message: 'toString' }],
  ])('cualquier otro caso → texto genérico (%j)', err => {
    expect(translateAuthError(err)).toBe(GENERIC_AUTH_ERROR);
  });

  it('el texto genérico es el del contrato', () => {
    expect(GENERIC_AUTH_ERROR).toBe(
      'No pudimos completar la operación. Intenta de nuevo.',
    );
  });
});

describe('authErrorCode', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'invalid_credentials'],
    [{ code: 'Weak_Password' }, 'weak_password'],
    [{ message: 'Invalid login credentials' }, 'invalid_credentials'],
    [{ message: 'User already registered' }, 'user_already_exists'],
    [{ message: 'Email rate limit exceeded' }, 'over_email_send_rate_limit'],
    [{ message: 'signup_not_allowed', status: 403 }, 'signup_not_allowed'],
    [
      { message: 'Hook requires authorization: signup_not_allowed' },
      'signup_not_allowed',
    ],
    [
      {
        code: 'unexpected_failure',
        message: 'Database error saving new user',
      },
      'signup_not_allowed',
    ],
  ])('%j → %s', (err, code) => {
    expect(authErrorCode(err)).toBe(code);
  });

  it.each([
    [null],
    [undefined],
    [{}],
    [{ code: 'unexpected_failure', message: 'detalle interno' }],
    [{ code: 'constructor' }],
  ])('sin código conocido → código genérico (%j)', err => {
    expect(authErrorCode(err)).toBe(GENERIC_AUTH_ERROR_CODE);
  });

  it('el código genérico se traduce al texto genérico', () => {
    expect(translateAuthError({ code: GENERIC_AUTH_ERROR_CODE })).toBe(
      GENERIC_AUTH_ERROR,
    );
  });

  it.each([
    [{ code: 'email_not_confirmed', message: 'Email not confirmed' }],
    [{ message: 'Invalid login credentials' }],
    [{ message: 'signup_not_allowed' }],
    [{ code: 'unexpected_failure', message: 'Database error saving new user' }],
    [{ code: 'unexpected_failure', message: 'detalle interno' }],
    [null],
  ])('traducir el código da el mismo texto que traducir el error (%j)', err => {
    expect(translateAuthError({ code: authErrorCode(err) })).toBe(
      translateAuthError(err),
    );
  });
});
