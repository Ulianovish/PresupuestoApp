import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (vitest corre en `node`, sin DOM): se verifica el código
// fuente del modal. vitest corre desde la raíz del repo.
const modal = readFileSync(
  resolve(
    process.cwd(),
    'src/components/organisms/ExpenseModal/ExpenseModal.tsx',
  ),
  'utf8',
);

describe('ExpenseModal sin categorías (contratos §2.6 y §5.2)', () => {
  it('el botón de guardar se deshabilita con submitDisabled', () => {
    expect(modal).toMatch(/disabled=\{submitDisabled\}/);
  });

  it('el botón muestra submitDisabledLabel mientras está deshabilitado', () => {
    expect(modal).toMatch(
      /submitDisabled && submitDisabledLabel\s*\?\s*submitDisabledLabel/,
    );
  });

  it('el aviso enlaza a /settings solo cuando el guardado está deshabilitado', () => {
    expect(modal).toMatch(
      /\{submitDisabled && \([\s\S]*?<Link href="\/settings"[\s\S]*?\)\}/,
    );
  });
});
