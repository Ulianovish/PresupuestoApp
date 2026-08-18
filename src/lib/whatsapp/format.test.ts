import { describe, expect, it } from 'vitest';

import { formatCOP } from './format';

describe('formatCOP', () => {
  it('formatea con separador de miles y sin decimales', () => {
    expect(formatCOP(20000)).toMatch(/20\.000/);
  });
  it('formatea montos chicos', () => {
    expect(formatCOP(2)).toMatch(/\$\D*2\b/);
  });
});
