import { describe, expect, it } from 'vitest';

import {
  computeTwilioSignature,
  isValidTwilioSignature,
} from './twilio-signature';

// Vector real (verificado con openssl). NO cambiar sin recomputar.
const URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const PARAMS = {
  CallSid: 'CA1234567890ABCDE',
  Caller: '+14158675310',
  Digits: '1234',
  From: '+14158675310',
  To: '+18005551212',
};
const TOKEN = '12345';
const EXPECTED = 'GvWf1cFY/Q7PnoempGyD5oXAezc=';

describe('computeTwilioSignature', () => {
  it('produce la firma esperada para el vector conocido', () => {
    expect(computeTwilioSignature(TOKEN, URL, PARAMS)).toBe(EXPECTED);
  });

  it('es independiente del orden de inserción de los params', () => {
    const shuffled = {
      To: '+18005551212',
      Digits: '1234',
      CallSid: 'CA1234567890ABCDE',
      From: '+14158675310',
      Caller: '+14158675310',
    };
    expect(computeTwilioSignature(TOKEN, URL, shuffled)).toBe(EXPECTED);
  });
});

describe('isValidTwilioSignature', () => {
  it('acepta la firma correcta', () => {
    expect(isValidTwilioSignature(TOKEN, EXPECTED, URL, PARAMS)).toBe(true);
  });

  it('rechaza una firma manipulada', () => {
    expect(isValidTwilioSignature(TOKEN, 'AAAA/Q7PnoempGyD5oXAezc=', URL, PARAMS)).toBe(false);
  });

  it('rechaza una firma vacía sin lanzar', () => {
    expect(isValidTwilioSignature(TOKEN, '', URL, PARAMS)).toBe(false);
  });

  it('rechaza si cambia un parámetro (cuerpo manipulado)', () => {
    expect(
      isValidTwilioSignature(TOKEN, EXPECTED, URL, { ...PARAMS, Digits: '9999' }),
    ).toBe(false);
  });
});
