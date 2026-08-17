import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import {
  applyCorrection,
  correctLastExpense,
} from '@/lib/services/whatsapp-queries';
import { createAdminClient } from '@/lib/supabase/server';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

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

  it('rechaza un monto por encima del tope de 100 millones', () => {
    // Mismo tope que `validateGasto` al dar de alta: un typo tipo "300000k"
    // (300 millones) no puede colarse por la corrección cuando el alta lo
    // rechaza.
    const r = applyCorrection(ULTIMO, 'monto', '300000k');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/tope/i);
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

describe('correctLastExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  /** Cadena mínima de `update().eq().eq().select()` que resuelve `result`. */
  function fakeTransactionsUpdate(result: { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.select = vi.fn().mockResolvedValue(result);
    return chain;
  }

  it('devuelve ok:false y un mensaje útil si el gasto ya no existe (el update no afecta filas)', async () => {
    // Supabase no manda `error` cuando el `.eq()` no matchea ninguna fila
    // (p. ej. el usuario borró el gasto en la app antes de corregirlo por
    // chat) — por eso el chequeo es sobre `data`, no sobre `error`.
    const chain = fakeTransactionsUpdate({ data: [], error: null });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '30 mil');

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/ya no existe|borrado/i);
  });

  it('actualiza cuando el update sí afecta una fila', async () => {
    const chain = fakeTransactionsUpdate({
      data: [{ id: 'tx-1' }],
      error: null,
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => chain) });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '30 mil');

    expect(res.ok).toBe(true);
  });

  it('rechaza un monto por encima del tope sin llamar a la base', async () => {
    const from = vi.fn();
    mockedAdmin.mockReturnValue({ from });

    const res = await correctLastExpense('user-1', ULTIMO, 'monto', '300000k');

    expect(res.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
