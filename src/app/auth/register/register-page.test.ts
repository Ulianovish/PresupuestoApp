import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

// Vitest corre en entorno node sin transformar JSX (tsconfig "jsx": "preserve"),
// así que se revisa el código fuente de la página como texto. Es una red
// provisional: las reglas viven en password-rules.ts y register-feedback.ts,
// que tienen sus propios tests; aquí solo se verifica que la página las use.
const fuente = readFileSync(
  join(process.cwd(), 'src/app/auth/register/page.tsx'),
  'utf8',
);

describe('formulario de registro', () => {
  it('muestra el texto de ayuda compartido con passwordSchema', () => {
    expect(fuente).toContain('{PASSWORD_HINT}');
    expect(fuente).not.toContain('Mínimo 6');
  });

  it('el navegador aplica los mismos límites que Zod', () => {
    expect(fuente).toContain('minLength={PASSWORD_MIN_LENGTH}');
    expect(fuente).toContain('maxLength={PASSWORD_MAX_LENGTH}');
  });

  it('pide al navegador sugerir una contraseña nueva', () => {
    expect(fuente).toContain('autoComplete="new-password"');
  });
});

describe('mensajes de la URL en el registro', () => {
  it('resuelve ?error= con la función pura de lista cerrada', () => {
    expect(fuente).toMatch(
      /setError\(\s*resolveRegisterError\(\s*searchParams\.get\('error'\)\s*\)\s*\)/,
    );
  });

  it('nunca pinta el texto crudo de la URL', () => {
    expect(fuente).not.toMatch(/setError\(\s*errorParam\s*\)/);
    expect(fuente).not.toMatch(/setMessage\(/);
    expect(fuente).not.toContain("searchParams.get('message')");
  });
});
