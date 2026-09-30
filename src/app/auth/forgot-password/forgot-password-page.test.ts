import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Vitest corre en entorno node sin transformar JSX: se revisa el código
// fuente. La traducción de ?error= y ?message= la prueban los tests de
// resolveForgotPasswordFeedback; aquí solo van invariantes de seguridad.
const fuente = readFileSync(
  join(process.cwd(), 'src/app/auth/forgot-password/page.tsx'),
  'utf8',
);

function argumentos(llamada: 'setError' | 'setMessage'): string[] {
  return [...fuente.matchAll(new RegExp(`${llamada}\\(([^)]*)\\)`, 'g'))].map(
    m => (m[1] ?? '').trim(),
  );
}

describe('página de recuperar contraseña', () => {
  it('envía el formulario a forgotPasswordAction', () => {
    expect(fuente).toContain('forgotPasswordAction(');
    expect(fuente).toContain('name="email"');
  });

  it('traduce la URL con la función pura de lista cerrada', () => {
    expect(fuente).toContain('resolveForgotPasswordFeedback(');
  });

  it('nunca pinta el texto crudo de la URL', () => {
    expect(fuente).not.toMatch(/set(Error|Message)\(\s*searchParams\.get/);
    // setMessage solo recibe lo que resolvió la lista cerrada, o null.
    for (const arg of argumentos('setMessage')) {
      expect(['feedback.message', 'null']).toContain(arg);
    }
    // setError: lo resuelto, null o un texto fijo del propio componente.
    for (const arg of argumentos('setError')) {
      expect(arg).toMatch(/^(feedback\.error|null|'[^']*')$/);
    }
  });
});
