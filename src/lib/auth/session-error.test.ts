import { AuthSessionMissingError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { esFaltaDeSesion } from './session-error';

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
