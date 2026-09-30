import { describe, expect, it } from 'vitest';

import * as constantes from './expense-categories';

describe('constantes de gastos', () => {
  it('no trae una lista fija de cuentas', () => {
    expect(constantes).not.toHaveProperty('ACCOUNT_TYPES');
  });

  it('exporta la cuenta por defecto', () => {
    expect(constantes.DEFAULT_ACCOUNT_NAME).toBe('Efectivo');
  });
});
