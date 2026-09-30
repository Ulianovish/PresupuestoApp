import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Vitest corre en entorno node sin transformar JSX: se revisa el código
// fuente. La traducción de ?error= la prueban los tests de
// resolveResetPasswordError; aquí solo van invariantes de seguridad y de la
// regla compartida de contraseña.
function leer(archivo: string): string {
  return readFileSync(
    join(process.cwd(), 'src/app/auth/reset-password', archivo),
    'utf8',
  );
}

const pagina = leer('page.tsx');
const formulario = leer('ResetPasswordForm.tsx');

describe('página de contraseña nueva (servidor)', () => {
  it('exige sesión: sin usuario manda a RESET_LINK_EXPIRED_PATH (pedir otro enlace)', () => {
    expect(pagina).toContain('auth.getUser()');
    expect(pagina).toContain('redirect(RESET_LINK_EXPIRED_PATH)');
    expect(pagina).toMatch(
      /import \{ RESET_LINK_EXPIRED_PATH \} from '@\/lib\/auth\/password-reset-feedback'/,
    );
    expect(pagina).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('formulario de contraseña nueva', () => {
  it('envía password y confirmPassword a resetPasswordAction', () => {
    expect(formulario).toContain('resetPasswordAction(');
    expect(formulario).toContain('name="password"');
    expect(formulario).toContain('name="confirmPassword"');
  });

  it('usa la regla compartida de contraseña (texto de ayuda y límites)', () => {
    expect(formulario).toContain('PASSWORD_HINT');
    expect(formulario).toContain('PASSWORD_MIN_LENGTH');
    expect(formulario).toContain('PASSWORD_MAX_LENGTH');
    expect(formulario).not.toMatch(/(minLength|maxLength)=\{\s*\d/);
    expect(formulario).toContain('autoComplete="new-password"');
  });

  it('nunca pinta el texto crudo de la URL', () => {
    expect(formulario).toContain('resolveResetPasswordError(');
    expect(formulario).not.toMatch(/setError\(\s*searchParams\.get/);
    expect(formulario).not.toContain("searchParams.get('message')");
  });
});
