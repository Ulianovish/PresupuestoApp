import { describe, it, expect } from 'vitest';

import { applyCorrection } from '@/lib/services/whatsapp-queries';

const ULTIMO = {
  kind: 'expense' as const,
  transactionId: 'tx-1',
  amount: 45000,
  description: 'mercado',
  accountName: 'Efectivo',
  category: 'MERCADO',
  date: '2026-08-17',
};

describe('applyCorrection', () => {
  it('corrige el monto interpretando "30 mil"', () => {
    const r = applyCorrection(ULTIMO, 'monto', '30 mil');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.patch.amount).toBe(30000);
  });

  it('corrige el monto interpretando "30k"', () => {
    const r = applyCorrection(ULTIMO, 'monto', '30k');
    if (r.ok) expect(r.patch.amount).toBe(30000);
  });

  it('rechaza un monto que no se puede interpretar', () => {
    expect(applyCorrection(ULTIMO, 'monto', 'como cinco').ok).toBe(false);
  });

  it('corrige la descripción', () => {
    const r = applyCorrection(ULTIMO, 'descripcion', 'mercado del mes');
    if (r.ok) expect(r.patch.description).toBe('mercado del mes');
  });

  it('corrige la cuenta', () => {
    const r = applyCorrection(ULTIMO, 'cuenta', 'Nequi');
    if (r.ok) expect(r.patch.accountName).toBe('Nequi');
  });

  it('corrige la fecha solo en formato válido', () => {
    expect(applyCorrection(ULTIMO, 'fecha', '2026-08-16').ok).toBe(true);
    expect(applyCorrection(ULTIMO, 'fecha', '16/08/2026').ok).toBe(false);
  });

  it('rechaza un campo desconocido', () => {
    expect(applyCorrection(ULTIMO, 'color', 'rojo').ok).toBe(false);
  });
});
