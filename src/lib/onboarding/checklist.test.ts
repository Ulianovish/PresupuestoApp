import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeChecklist,
  loadChecklistInput,
  loadDashboardChecklist,
  type ChecklistInput,
  type ChecklistItemId,
} from './checklist';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Usuario recién sembrado: solo la cuenta Efectivo del kit. */
const RECIEN_LLEGADO: ChecklistInput = {
  accountCount: 1,
  deudaCount: 0,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
};

describe('computeChecklist', () => {
  it('devuelve los 5 ítems en orden, con su texto y su enlace', () => {
    expect(computeChecklist(RECIEN_LLEGADO)).toEqual([
      {
        id: 'cuentas',
        label: 'Agrega tus cuentas',
        href: '/settings',
        done: false,
      },
      {
        id: 'deudas',
        label: 'Registra tarjetas y deudas',
        href: '/deudas',
        done: false,
      },
      {
        id: 'whatsapp',
        label: 'Vincula WhatsApp',
        href: '/settings',
        done: false,
      },
      {
        id: 'documento',
        label: 'Carga tu cédula para facturas DIAN',
        href: '/settings',
        done: false,
      },
      {
        id: 'presupuesto',
        label: 'Ponle montos a tu presupuesto',
        href: '/presupuesto',
        done: false,
      },
    ]);
  });

  it('la cuenta Efectivo del kit sola no completa "cuentas": hacen falta más de una', () => {
    const cuentas = (n: number) =>
      computeChecklist({ ...RECIEN_LLEGADO, accountCount: n }).find(
        i => i.id === 'cuentas',
      )?.done;

    expect(cuentas(0)).toBe(false);
    expect(cuentas(1)).toBe(false);
    expect(cuentas(2)).toBe(true);
  });

  it('cada ítem depende solo de su dato', () => {
    const casos: Array<[Partial<ChecklistInput>, ChecklistItemId]> = [
      [{ accountCount: 3 }, 'cuentas'],
      [{ deudaCount: 1 }, 'deudas'],
      [{ linkedPhoneCount: 2 }, 'whatsapp'],
      [{ hasDocumento: true }, 'documento'],
      [{ hasBudgetAmounts: true }, 'presupuesto'],
    ];

    for (const [cambio, id] of casos) {
      const hechos = computeChecklist({ ...RECIEN_LLEGADO, ...cambio })
        .filter(i => i.done)
        .map(i => i.id);
      expect(hechos).toEqual([id]);
    }
  });

  it('con todo configurado, los 5 quedan hechos', () => {
    const items = computeChecklist({
      accountCount: 2,
      deudaCount: 1,
      linkedPhoneCount: 1,
      hasDocumento: true,
      hasBudgetAmounts: true,
    });

    expect(items).toHaveLength(5);
    expect(items.every(i => i.done)).toBe(true);
  });
});

const USER_ID = '00000000-0000-4000-8000-000000000001';

type Llamada = { metodo: string; args: unknown[] };
type Consulta = { tabla: string; llamadas: Llamada[] };
type Respuesta = {
  data?: unknown;
  count?: number | null;
  error: { code: string } | null;
};

/**
 * Cliente falso: cada from() arma una consulta que registra sus llamadas
 * (select, eq, not, gt, maybeSingle) y al hacer await responde con lo que
 * decida `responder` mirando la tabla y los filtros.
 */
function clienteFalso(responder: (c: Consulta) => Respuesta) {
  const consultas: Consulta[] = [];
  const from = vi.fn((tabla: string) => {
    const consulta: Consulta = { tabla, llamadas: [] };
    consultas.push(consulta);
    const builder: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'not', 'gt', 'maybeSingle']) {
      builder[metodo] = (...args: unknown[]) => {
        consulta.llamadas.push({ metodo, args });
        return builder;
      };
    }
    builder.then = (
      ok: (r: Respuesta) => unknown,
      fallo?: (e: unknown) => unknown,
    ) =>
      Promise.resolve()
        .then(() => responder(consulta))
        .then(ok, fallo);
    return builder;
  });
  return { client: { from } as unknown as SupabaseClient, from, consultas };
}

function llamo(c: Consulta, metodo: string, ...args: unknown[]): boolean {
  return c.llamadas.some(
    l => l.metodo === metodo && JSON.stringify(l.args) === JSON.stringify(args),
  );
}

function filtraNoNulo(c: Consulta, columna: string): boolean {
  return llamo(c, 'not', columna, 'is', null);
}

type Conteos = {
  accounts: number | null;
  deudas: number | null;
  links: number | null;
  linksConDocumento: number | null;
  presupuesto: number | null;
};

const CEROS: Conteos = {
  accounts: 0,
  deudas: 0,
  links: 0,
  linksConDocumento: 0,
  presupuesto: 0,
};

const MES = '2026-09';
const SELECT_RUBROS_DEL_MES = 'id, budget_templates!inner(month_year)';

function responderConteos(
  conteos: Conteos,
  fallas: Partial<Record<string, string>> = {},
) {
  return (c: Consulta): Respuesta => {
    const clave =
      c.tabla === 'whatsapp_links' && filtraNoNulo(c, 'documento')
        ? 'whatsapp_links.documento'
        : c.tabla;
    if (fallas[clave]) return { count: null, error: { code: fallas[clave] } };
    switch (clave) {
      case 'accounts':
        return { count: conteos.accounts, error: null };
      case 'deudas':
        return { count: conteos.deudas, error: null };
      case 'whatsapp_links':
        return { count: conteos.links, error: null };
      case 'whatsapp_links.documento':
        return { count: conteos.linksConDocumento, error: null };
      case 'budget_items':
        return { count: conteos.presupuesto, error: null };
      default:
        throw new Error(`tabla inesperada: ${c.tabla}`);
    }
  };
}

describe('loadChecklistInput', () => {
  it('cuenta con head:true, filtra todo por user_id y arma el input', async () => {
    const { client, consultas } = clienteFalso(
      responderConteos({
        accounts: 2,
        deudas: 3,
        links: 1,
        linksConDocumento: 1,
        presupuesto: 4,
      }),
    );

    await expect(loadChecklistInput(client, USER_ID, MES)).resolves.toEqual({
      accountCount: 2,
      deudaCount: 3,
      linkedPhoneCount: 1,
      hasDocumento: true,
      hasBudgetAmounts: true,
    });

    expect(consultas.map(c => c.tabla).sort()).toEqual([
      'accounts',
      'budget_items',
      'deudas',
      'whatsapp_links',
      'whatsapp_links',
    ]);
    for (const c of consultas) {
      const columnas =
        c.tabla === 'budget_items' ? SELECT_RUBROS_DEL_MES : 'id';
      expect(llamo(c, 'select', columnas, { count: 'exact', head: true })).toBe(
        true,
      );
      expect(llamo(c, 'eq', 'user_id', USER_ID)).toBe(true);
    }

    const cuentas = consultas.find(c => c.tabla === 'accounts')!;
    expect(llamo(cuentas, 'eq', 'is_active', true)).toBe(true);

    // Solo deudas activas (§5.2): la columna es es_activo.
    const deudas = consultas.find(c => c.tabla === 'deudas')!;
    expect(llamo(deudas, 'eq', 'es_activo', true)).toBe(true);

    const links = consultas.filter(c => c.tabla === 'whatsapp_links');
    expect(links.filter(c => filtraNoNulo(c, 'documento'))).toHaveLength(1);

    // Rubros del mes con monto (§5.2).
    const rubros = consultas.find(c => c.tabla === 'budget_items')!;
    expect(llamo(rubros, 'eq', 'budget_templates.month_year', MES)).toBe(true);
    expect(llamo(rubros, 'gt', 'budgeted_amount', 0)).toBe(true);
  });

  it('sin mes, usa el mes actual de Bogotá', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 3:00 UTC del 1 de octubre = 22:00 del 30 de septiembre en Bogotá.
    vi.setSystemTime(new Date('2026-10-01T03:00:00.000Z'));
    try {
      const { client, consultas } = clienteFalso(responderConteos(CEROS));

      await loadChecklistInput(client, USER_ID);

      const rubros = consultas.find(c => c.tabla === 'budget_items')!;
      expect(
        llamo(rubros, 'eq', 'budget_templates.month_year', '2026-09'),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('count nulo cuenta como 0', async () => {
    const { client } = clienteFalso(
      responderConteos({
        accounts: null,
        deudas: null,
        links: null,
        linksConDocumento: null,
        presupuesto: null,
      }),
    );

    await expect(loadChecklistInput(client, USER_ID, MES)).resolves.toEqual({
      accountCount: 0,
      deudaCount: 0,
      linkedPhoneCount: 0,
      hasDocumento: false,
      hasBudgetAmounts: false,
    });
  });

  it('con documento en 0 y sin rubros con monto, los booleanos quedan en false', async () => {
    const { client } = clienteFalso(
      responderConteos({ ...CEROS, accounts: 1, links: 2 }),
    );

    const input = await loadChecklistInput(client, USER_ID, MES);
    expect(input.linkedPhoneCount).toBe(2);
    expect(input.hasDocumento).toBe(false);
    expect(input.hasBudgetAmounts).toBe(false);
  });

  it('si una consulta falla, lanza nombrando la consulta y el código, sin el user_id', async () => {
    const { client } = clienteFalso(
      responderConteos(CEROS, { deudas: '42P01' }),
    );

    const error = await loadChecklistInput(client, USER_ID, MES).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/deudas.*42P01/);
    expect((error as Error).message).not.toContain(USER_ID);
  });
});

describe('loadDashboardChecklist', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  function responderDashboard(
    perfil: Respuesta,
    conteos: Conteos = CEROS,
    fallas: Partial<Record<string, string>> = {},
  ) {
    const conteo = responderConteos(conteos, fallas);
    return (c: Consulta): Respuesta =>
      c.tabla === 'profiles' ? perfil : conteo(c);
  }

  it('si ya la ocultó, devuelve null sin hacer los conteos', async () => {
    const { client, from, consultas } = clienteFalso(
      responderDashboard({
        data: { onboarding_dismissed_at: '2026-09-01T00:00:00.000Z' },
        error: null,
      }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    const perfil = consultas[0];
    expect(perfil.tabla).toBe('profiles');
    expect(llamo(perfil, 'select', 'onboarding_dismissed_at')).toBe(true);
    expect(llamo(perfil, 'eq', 'id', USER_ID)).toBe(true);
    expect(llamo(perfil, 'maybeSingle')).toBe(true);
  });

  it('si no la ocultó y hay pendientes, devuelve los 5 ítems', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        { ...CEROS, accounts: 1, deudas: 2 },
      ),
    );

    const items = await loadDashboardChecklist(client, USER_ID);
    expect(items).toHaveLength(5);
    expect(items!.filter(i => i.done).map(i => i.id)).toEqual(['deudas']);
  });

  it('si todo está hecho, devuelve null', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        {
          accounts: 2,
          deudas: 1,
          links: 1,
          linksConDocumento: 1,
          presupuesto: 1,
        },
      ),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
  });

  it('si la lectura del perfil falla (p. ej. columna sin migrar), devuelve null y registra solo el código', async () => {
    const { client, from } = clienteFalso(
      responderDashboard({ data: null, error: { code: '42703' } }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    expect(from).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), '42703');
  });

  it('sin fila de perfil, devuelve null', async () => {
    const { client } = clienteFalso(
      responderDashboard({ data: null, error: null }),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
  });

  it('si un conteo falla, devuelve null sin lanzar y sin loguear el user_id', async () => {
    const { client } = clienteFalso(
      responderDashboard(
        { data: { onboarding_dismissed_at: null }, error: null },
        CEROS,
        { budget_items: '42501' },
      ),
    );

    await expect(loadDashboardChecklist(client, USER_ID)).resolves.toBeNull();
    const logueado = JSON.stringify(
      (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls,
    );
    expect(logueado).toContain('42501');
    expect(logueado).not.toContain(USER_ID);
  });
});
