import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Vitest corre en entorno node sin transformar JSX: se revisa el código fuente.
const fuente = readFileSync(
  join(process.cwd(), 'src/app/auth/login/page.tsx'),
  'utf8',
);

describe('página de login', () => {
  it('resuelve error y message con la función pura (códigos, no texto)', () => {
    expect(fuente).toContain('resolveLoginFeedback(');
  });

  it('nunca pinta el texto crudo de la URL', () => {
    expect(fuente).not.toMatch(/setError\(\s*errorParam\s*\)/);
    expect(fuente).not.toMatch(/setMessage\(\s*messageParam\s*\)/);
    expect(fuente).not.toMatch(/:\s*errorParam\s*,?\s*\)/);
  });
});
