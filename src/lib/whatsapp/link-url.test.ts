import { describe, expect, it } from 'vitest';

import { buildWhatsAppLinkUrl } from './link-url';

const ESPERADO = 'https://wa.me/573000000000?text=VINCULAR%20123456';

describe('buildWhatsAppLinkUrl', () => {
  it('número E.164 → enlace wa.me con el mensaje VINCULAR codificado', () => {
    expect(buildWhatsAppLinkUrl('+573000000000', '123456')).toBe(ESPERADO);
  });

  it('quita el prefijo whatsapp: (formato de Twilio)', () => {
    expect(buildWhatsAppLinkUrl('whatsapp:+573000000000', '123456')).toBe(
      ESPERADO,
    );
  });

  it('quita espacios internos y de los extremos', () => {
    expect(buildWhatsAppLinkUrl(' +57 300 000 0000 ', '123456')).toBe(ESPERADO);
  });

  it('sin número (undefined, vacío o solo espacios) → null', () => {
    expect(buildWhatsAppLinkUrl(undefined, '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('   ', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('whatsapp:', '123456')).toBeNull();
  });

  it('un valor que no es un número de teléfono → null, no un enlace roto', () => {
    expect(buildWhatsAppLinkUrl('pendiente', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('+57-300-000-0000', '123456')).toBeNull();
    expect(buildWhatsAppLinkUrl('+1234', '123456')).toBeNull();
  });
});
