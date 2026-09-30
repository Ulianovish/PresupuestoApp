import { AuthSessionMissingError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { esFaltaDeSesion, resumenErrorAuth } from './session-error';

describe('esFaltaDeSesion', () => {
  it('reconoce el AuthSessionMissingError real de Supabase', () => {
    expect(esFaltaDeSesion(new AuthSessionMissingError())).toBe(true);
  });

  it('reconoce un objeto de error con ese nombre', () => {
    expect(esFaltaDeSesion({ name: 'AuthSessionMissingError' })).toBe(true);
  });

  it.each([
    null,
    undefined,
    'AuthSessionMissingError',
    { name: 'AuthApiError', code: 'refresh_token_not_found' },
    { name: 'AuthRetryableFetchError', status: 0 },
    new TypeError('fetch failed'),
  ])('no confunde %o con falta de sesión', error => {
    expect(esFaltaDeSesion(error)).toBe(false);
  });
});

describe('resumenErrorAuth', () => {
  it('usa el code y el status del error de Supabase', () => {
    expect(
      resumenErrorAuth({
        name: 'AuthApiError',
        code: 'refresh_token_not_found',
        status: 400,
        message: 'datos de usuario@ejemplo.com',
      }),
    ).toStrictEqual({ code: 'refresh_token_not_found', status: 400 });
  });

  it('sin code cae al nombre, aunque llegue como objeto plano', () => {
    expect(
      resumenErrorAuth({
        name: 'AuthRetryableFetchError',
        message: 'fetch failed para usuario@ejemplo.com',
        status: 0,
      }),
    ).toStrictEqual({ code: 'AuthRetryableFetchError', status: 0 });
  });

  it('un Error nativo da su nombre y no trae status', () => {
    expect(resumenErrorAuth(new TypeError('fetch failed'))).toStrictEqual({
      code: 'TypeError',
    });
  });

  it.each([null, undefined, 'texto', 42, {}, { code: '', name: '' }])(
    '%o queda como sin_codigo',
    error => {
      expect(resumenErrorAuth(error)).toStrictEqual({ code: 'sin_codigo' });
    },
  );

  it('nunca incluye el mensaje', () => {
    const resumen = resumenErrorAuth(
      new Error('usuario@ejemplo.com no pudo entrar'),
    );
    expect(JSON.stringify(resumen)).not.toContain('usuario@ejemplo.com');
  });
});
