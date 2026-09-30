import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Vitest corre en entorno node sin transformar JSX: se revisa el código fuente.
function leer(archivo: string): string {
  return readFileSync(
    join(process.cwd(), 'src/app/auth/reset-password', archivo),
    'utf8',
  );
}

const pagina = leer('page.tsx');
const formulario = leer('ResetPasswordForm.tsx');

describe('página de contraseña nueva (servidor)', () => {
  it('exige sesión: sin usuario manda a pedir otro enlace con el código otp_expired', () => {
    expect(pagina).toContain('auth.getUser()');
    expect(pagina).toContain("'/auth/forgot-password?error=otp_expired'");
    expect(pagina).toContain("export const dynamic = 'force-dynamic'");
  });
});

describe('formulario de contraseña nueva', () => {
  it('envía password y confirmPassword a resetPasswordAction', () => {
    expect(formulario).toContain('resetPasswordAction(formData)');
    expect(formulario).toContain('name="password"');
    expect(formulario).toContain('name="confirmPassword"');
  });

  it('usa la regla compartida de contraseña (texto de ayuda y límites)', () => {
    expect(formulario).toContain('{PASSWORD_HINT}');
    expect(formulario.match(/minLength=\{PASSWORD_MIN_LENGTH\}/g)).toHaveLength(
      1,
    );
    expect(formulario.match(/maxLength=\{PASSWORD_MAX_LENGTH\}/g)).toHaveLength(
      2,
    );
    expect(formulario).toContain('autoComplete="new-password"');
  });

  it('resuelve ?error= con la función pura de lista cerrada', () => {
    expect(formulario).toMatch(
      /setError\(\s*resolveResetPasswordError\(\s*searchParams\.get\('error'\)\s*\)\s*\)/,
    );
    expect(formulario).not.toMatch(/setError\(\s*searchParams\.get/);
    expect(formulario).not.toContain("searchParams.get('message')");
  });
});
