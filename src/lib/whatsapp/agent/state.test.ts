import { describe, it, expect } from 'vitest';

import { applyTtl } from './state';

const AHORA = 1_700_000_000_000;
const HACE_5_MIN = new Date(AHORA - 5 * 60 * 1000).toISOString();
const HACE_40_MIN = new Date(AHORA - 40 * 60 * 1000).toISOString();

const ENTIDAD = {
  kind: 'expense' as const,
  transactionId: 'tx-1',
  amount: 45000,
  description: 'mercado',
  accountName: 'Efectivo',
  category: 'MERCADO',
  date: '2026-08-17',
};

describe('applyTtl', () => {
  it('conserva turns y pending si la conversación está fresca', () => {
    const s = applyTtl(
      {
        turns: [{ role: 'user', content: '45k mercado' }],
        pending: { kind: 'invoice_account', invoiceId: 'inv-1' },
        last_entity: ENTIDAD,
        updated_at: HACE_5_MIN,
      },
      AHORA,
    );
    expect(s.turns).toHaveLength(1);
    expect(s.pending).not.toBeNull();
  });

  it('descarta turns y pending pasados los 30 min: un "sí, esa" tres horas después es otra conversación', () => {
    const s = applyTtl(
      {
        turns: [{ role: 'user', content: 'hola' }],
        pending: { kind: 'invoice_account', invoiceId: 'inv-1' },
        last_entity: ENTIDAD,
        updated_at: HACE_40_MIN,
      },
      AHORA,
    );
    expect(s.turns).toEqual([]);
    expect(s.pending).toBeNull();
  });

  it('conserva last_entity aunque la conversación haya vencido: "corregí lo último" no caduca a los 30 min', () => {
    const s = applyTtl(
      { turns: [], pending: null, last_entity: ENTIDAD, updated_at: HACE_40_MIN },
      AHORA,
    );
    expect(s.lastEntity).toEqual(ENTIDAD);
  });

  it('el pending vence contra su propia creación, no contra updated_at: si no, no vencía nunca', () => {
    // `writeState` pisa `updated_at` en CADA turno. Midiendo el TTL contra esa
    // columna, una factura de hace horas seguía viva mientras el usuario
    // escribiera cualquier otra cosa, secuestrando el prompt.
    const s = applyTtl(
      {
        turns: [{ role: 'user', content: 'hola' }],
        pending: {
          kind: 'invoice_account',
          invoiceId: 'inv-1',
          createdAt: HACE_40_MIN,
        },
        last_entity: ENTIDAD,
        updated_at: HACE_5_MIN,
      },
      AHORA,
    );
    expect(s.pending).toBeNull();
    // La conversación en sí sigue fresca: solo vence el pendiente.
    expect(s.turns).toHaveLength(1);
  });

  it('un pending creado hace 5 min sobrevive aunque la conversación esté por vencer', () => {
    const s = applyTtl(
      {
        turns: [],
        pending: {
          kind: 'invoice_account',
          invoiceId: 'inv-1',
          createdAt: HACE_5_MIN,
        },
        last_entity: null,
        updated_at: HACE_5_MIN,
      },
      AHORA,
    );
    expect(s.pending).not.toBeNull();
  });

  it('un pending viejo sin createdAt (fila anterior al cambio) sigue venciendo por updated_at', () => {
    const s = applyTtl(
      {
        turns: [],
        pending: { kind: 'invoice_account', invoiceId: 'inv-1' },
        last_entity: null,
        updated_at: HACE_40_MIN,
      },
      AHORA,
    );
    expect(s.pending).toBeNull();
  });

  it('devuelve un estado vacío si no hay fila', () => {
    const s = applyTtl(null, AHORA);
    expect(s).toEqual({ turns: [], pending: null, lastEntity: null });
  });
});
