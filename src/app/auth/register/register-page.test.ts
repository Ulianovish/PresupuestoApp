import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

// Vitest corre en entorno node sin transformar JSX (tsconfig "jsx": "preserve"),
// así que se revisa el código fuente de la página como texto.
const fuente = readFileSync(
  join(process.cwd(), 'src/app/auth/register/page.tsx'),
  'utf8',
);

describe('formulario de registro', () => {
  it('dice exactamente la regla de passwordSchema', () => {
    expect(fuente).toContain('Mínimo 8 caracteres.');
  });

  it('ya no pide reglas de composición que Zod no valida', () => {
    expect(fuente).not.toMatch(/mayúscula|minúscula|número/i);
    expect(fuente).not.toContain('Mínimo 6');
  });

  it('el navegador aplica los mismos límites que Zod', () => {
    expect(fuente).toContain('minLength={8}');
    expect(fuente).toContain('maxLength={72}');
  });

  it('pide al navegador sugerir una contraseña nueva', () => {
    expect(fuente).toContain('autoComplete="new-password"');
  });
});
