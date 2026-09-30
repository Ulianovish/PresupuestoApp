import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loginUrl } from './login-url';

describe('loginUrl', () => {
  it('lleva la ruta en redirectTo', () => {
    expect(loginUrl('/dashboard')).toBe('/auth/login?redirectTo=%2Fdashboard');
  });

  it('conserva la query de la ruta de origen', () => {
    const url = new URL(loginUrl('/gastos', '?mes=2026-09&x=1'), 'http://x');
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('redirectTo')).toBe('/gastos?mes=2026-09&x=1');
    expect([...url.searchParams.keys()]).toEqual(['redirectTo']);
  });

  it('acepta la query sin el signo de interrogación', () => {
    const url = new URL(loginUrl('/gastos', 'mes=2026-09'), 'http://x');
    expect(url.searchParams.get('redirectTo')).toBe('/gastos?mes=2026-09');
  });

  it.each(['', '?'])('ignora una query vacía (%o)', search => {
    const url = new URL(loginUrl('/deudas', search), 'http://x');
    expect(url.searchParams.get('redirectTo')).toBe('/deudas');
  });

  it('codifica caracteres que romperían la URL del login', () => {
    const url = new URL(loginUrl('/a b', '?q=1&r=#x'), 'http://x');
    expect(url.searchParams.get('redirectTo')).toBe('/a b?q=1&r=#x');
    expect(url.hash).toBe('');
  });
});

// Comprobación estática: cada guardia debe llamar a loginUrl con su propia
// ruta. La regex tolera espacios, saltos de línea y cualquier tipo de comillas.
describe('guardias de página', () => {
  it.each(['dashboard', 'deudas', 'ingresos', 'ingresos-deudas', 'settings'])(
    'src/app/%s/page.tsx usa loginUrl en vez de un literal',
    ruta => {
      const codigo = fs.readFileSync(
        path.resolve(__dirname, '../../app', ruta, 'page.tsx'),
        'utf8',
      );
      const llamada = new RegExp(
        `redirect\\(\\s*loginUrl\\(\\s*(['"\`])/${ruta}\\1\\s*\\)`,
      );
      expect(codigo).toMatch(llamada);
      expect(codigo).not.toContain('redirectTo=');
    },
  );
});
