import { describe, expect, it, vi } from 'vitest';

import {
  CONTACT_EMAIL,
  assertContactEmailReady,
  isPlaceholderContactEmail,
} from './legal';

describe('isPlaceholderContactEmail', () => {
  it.each(['contacto@ejemplo.com', 'CONTACTO@Ejemplo.com', 'x@example.com'])(
    '%s es un marcador',
    correo => {
      expect(isPlaceholderContactEmail(correo)).toBe(true);
    },
  );

  it('un buzón real no es marcador', () => {
    expect(isPlaceholderContactEmail('soporte@mipresupuesto.co')).toBe(false);
  });
});

describe('assertContactEmailReady', () => {
  it('en producción con el marcador avisa sin romper ni exponer el correo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() =>
      assertContactEmailReady('contacto@ejemplo.com', 'production'),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      'CONTACT_EMAIL sigue siendo el de ejemplo: resuelve H9 antes de abrir el registro',
    );

    warn.mockRestore();
  });

  it('en producción con un buzón real no rompe', () => {
    expect(() =>
      assertContactEmailReady('soporte@mipresupuesto.co', 'production'),
    ).not.toThrow();
  });

  it.each([undefined, 'preview', 'development'])(
    'fuera de producción (%s) tolera el marcador',
    env => {
      expect(() =>
        assertContactEmailReady('contacto@ejemplo.com', env),
      ).not.toThrow();
    },
  );
});

// Tarea humana H9 (contratos §5.4): cuando CONTACT_EMAIL sea un buzón real,
// este test deja de saltarse solo y protege que no se vuelva al marcador.
describe.skipIf(isPlaceholderContactEmail(CONTACT_EMAIL))(
  'CONTACT_EMAIL (H9 resuelta)',
  () => {
    it('no es un correo de ejemplo', () => {
      expect(isPlaceholderContactEmail(CONTACT_EMAIL)).toBe(false);
    });
  },
);
