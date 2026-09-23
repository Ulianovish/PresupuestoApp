import { describe, it, expect } from 'vitest';

import { conMovimiento, type CreditCardSummary } from './credit-cards-filter';

const tarjeta = (
  accountName: string,
  gastado: number,
  pagado: number,
): CreditCardSummary => ({
  accountId: accountName,
  accountName,
  gastado,
  pagado,
});

describe('conMovimiento', () => {
  it('deja las tarjetas con gasto, con pago o con ambos', () => {
    const r = conMovimiento([
      tarjeta('TC Davivienda', 583595, 0),
      tarjeta('TC Rappi', 0, 106615),
      tarjeta('TC Nu Bank Milo', 563091, 563091),
    ]);
    expect(r.map(t => t.accountName)).toEqual([
      'TC Davivienda',
      'TC Rappi',
      'TC Nu Bank Milo',
    ]);
  });

  it('descarta las tarjetas sin movimiento', () => {
    const r = conMovimiento([
      tarjeta('TC Nu Bank Migue', 0, 0),
      tarjeta('TC Falabella', 354390, 4397853),
    ]);
    expect(r.map(t => t.accountName)).toEqual(['TC Falabella']);
  });

  it('sin tarjetas devuelve vacío', () => {
    expect(conMovimiento([])).toEqual([]);
  });
});
