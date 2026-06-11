// Validación de la firma X-Twilio-Signature.
// Algoritmo Twilio: concatenar la URL completa del webhook con cada par
// clave+valor de los parámetros POST ORDENADOS por clave, firmar con HMAC-SHA1
// usando el auth token de la cuenta y codificar en base64.
// Ref: https://www.twilio.com/docs/usage/security#validating-requests

import { createHmac, timingSafeEqual } from 'crypto';

export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const keys = Object.keys(params).sort();
  let data = url;
  for (const key of keys) {
    data += key + params[key];
  }
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function isValidTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>,
): boolean {
  const expected = computeTwilioSignature(authToken, url, params);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature || '', 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
