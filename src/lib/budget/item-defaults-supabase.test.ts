import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '@/types/database';

import { resolveBudgetItemDefaults } from './item-defaults-supabase';

import type { SupabaseClient } from '@supabase/supabase-js';

interface Resultado {
  data: { id: string; name: string }[] | null;
  error: unknown;
}

const CLASIFICACIONES = [
  { id: 'cls-basico', name: 'Basico' },
  { id: 'cls-estilo', name: 'Estilo de Vida' },
];
const CONTROLES = [
  { id: 'ctl-eliminar', name: 'Eliminar' },
  { id: 'ctl-necesario', name: 'Necesario' },
  { id: 'ctl-reducir', name: 'Reducir' },
];
const ESTADOS = [
  { id: 'st-activo', name: 'Activo' },
  { id: 'st-inactivo', name: 'Inactivo' },
];

/**
 * Cliente falso: cada tabla responde con su resultado al final de
 * select→eq→order, y se guarda qué se pidió para verificar los filtros.
 */
function clienteFalso(resultados: Partial<Record<string, Resultado>> = {}) {
  const tablas: Record<string, Resultado> = {
    classifications: { data: CLASIFICACIONES, error: null },
    controls: { data: CONTROLES, error: null },
    budget_statuses: { data: ESTADOS, error: null },
    ...resultados,
  };
  const pedidos: Array<{
    tabla: string;
    select?: string;
    eq?: [string, unknown];
    order?: string;
  }> = [];

  const client = {
    from: vi.fn((tabla: string) => {
      const pedido: (typeof pedidos)[number] = { tabla };
      pedidos.push(pedido);
      const chain = {
        select: vi.fn((cols: string) => {
          pedido.select = cols;
          return chain;
        }),
        eq: vi.fn((col: string, valor: unknown) => {
          pedido.eq = [col, valor];
          return chain;
        }),
        order: vi.fn((col: string) => {
          pedido.order = col;
          return Promise.resolve(tablas[tabla]);
        }),
      };
      return chain;
    }),
  };

  return {
    client: client as unknown as SupabaseClient<Database>,
    pedidos,
  };
}

const GENERAL = { classification: 'Estilo de Vida', control: 'Reducir' };
const DEUDA = { classification: 'Basico', control: 'Necesario' };

describe('resolveBudgetItemDefaults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('elige clasificación, control y estado por nombre (no el primero)', async () => {
    const { client } = clienteFalso();

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-estilo',
        controlId: 'ctl-reducir',
        statusId: 'st-activo',
      },
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('usa los nombres de deuda cuando se le piden', async () => {
    const { client } = clienteFalso();

    const r = await resolveBudgetItemDefaults(client, DEUDA);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-basico',
        controlId: 'ctl-necesario',
        statusId: 'st-activo',
      },
    });
  });

  it('consulta solo catálogos activos, ordenados por nombre', async () => {
    const { client, pedidos } = clienteFalso();

    await resolveBudgetItemDefaults(client, GENERAL);

    expect(pedidos.map(p => p.tabla).sort()).toEqual([
      'budget_statuses',
      'classifications',
      'controls',
    ]);
    for (const p of pedidos) {
      expect(p.select).toBe('id, name');
      expect(p.eq).toEqual(['is_active', true]);
      expect(p.order).toBe('name');
    }
  });

  it('si el nombre no existe cae al primero activo y avisa con console.warn', async () => {
    const { client } = clienteFalso({
      classifications: {
        data: [
          { id: 'cls-basico', name: 'Basico' },
          { id: 'cls-caprichos', name: 'Caprichos' },
        ],
        error: null,
      },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-basico',
        controlId: 'ctl-reducir',
        statusId: 'st-activo',
      },
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[budget-defaults] No existe la clasificación "Estilo de Vida"; se usa "Basico".',
    );
  });

  it('si no existe el estado "Activo" cae al primer estado activo y avisa', async () => {
    const { client } = clienteFalso({
      budget_statuses: {
        data: [
          { id: 'st-inactivo', name: 'Inactivo' },
          { id: 'st-pausado', name: 'Pausado' },
        ],
        error: null,
      },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({
      ok: true,
      ids: {
        classificationId: 'cls-estilo',
        controlId: 'ctl-reducir',
        statusId: 'st-inactivo',
      },
    });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      '[budget-defaults] No existe el estado "Activo"; se usa "Inactivo".',
    );
  });

  it('si falla una consulta → ok:false y console.error', async () => {
    const { client } = clienteFalso({
      controls: { data: null, error: { message: 'fallo' } },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });

  it('si un catálogo activo está vacío → ok:false', async () => {
    const { client } = clienteFalso({
      budget_statuses: { data: [], error: null },
    });

    const r = await resolveBudgetItemDefaults(client, GENERAL);

    expect(r).toEqual({ ok: false });
    expect(console.error).toHaveBeenCalled();
  });
});
