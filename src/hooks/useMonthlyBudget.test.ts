import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('useMonthlyBudget (deuda S10)', () => {
  const fuente = readFileSync(
    resolve(__dirname, 'useMonthlyBudget.ts'),
    'utf8',
  );

  it('el archivo existe', () => {
    expect(fuente).not.toBe('');
  });

  it('ya no expone initializeMonth (código muerto, nadie lo usaba)', () => {
    expect(fuente).not.toMatch(/\binitializeMonth\b/);
  });
});
