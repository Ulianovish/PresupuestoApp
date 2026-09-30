import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto: no hay @testing-library y vitest corre en node.
const leer = (ruta: string) =>
  readFileSync(resolve(process.cwd(), ruta), 'utf8');

const mobile = leer('src/components/molecules/MobileSidebar/MobileSidebar.tsx');
const desktop = leer('src/components/organisms/Sidebar/Sidebar.tsx');

describe('menú móvil (S10)', () => {
  it('tiene Ajustes', () => {
    expect(mobile).toContain('href="/settings"');
    expect(mobile).toContain('Ajustes y cuentas');
  });

  it('tiene Cerrar sesión con la misma server action que el escritorio', () => {
    expect(mobile).toContain(
      "import { logoutAction } from '@/lib/actions/auth';",
    );
    expect(mobile).toContain('<form action={logoutAction}>');
    expect(mobile).toContain('Cerrar sesión');
  });
});

describe('/test fuera de los menús (S10)', () => {
  it.each([
    ['MobileSidebar.tsx', mobile],
    ['Sidebar.tsx', desktop],
  ])('%s no enlaza /test', (_nombre, fuente) => {
    expect(fuente).not.toContain("'/test'");
    expect(fuente).not.toContain('FlaskConical');
  });
});
