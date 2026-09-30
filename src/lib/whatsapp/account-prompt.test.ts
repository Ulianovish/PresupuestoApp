import { describe, expect, it, vi } from 'vitest';

import { armarIdOpcion, type CuentaActiva } from './account-picker';
import {
  intentarCuentaEscrita,
  manejarEleccionCuenta,
  preguntarCuenta,
  type EleccionDeps,
  type PromptCuenta,
} from './account-prompt';

const U = 'user-1';
const TEL = '+573001111111';
const OTRO_TEL = '+573002222222';
const P1 = '11111111-1111-4111-8111-111111111111';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const NOMBRES = [
  'Ahorros Nu',
  'Davivienda',
  'Efectivo',
  'Nequi Bruno',
  'Nequi Coco',
  'TC Davivienda',
  'TC Falabella',
  'TC Nu Bank Bruno',
];
const CUENTAS: CuentaActiva[] = NOMBRES.map((name, i) => ({
  id: uuid(i + 1),
  name,
  type: name.startsWith('TC') ? 'credit' : 'bank',
  createdAt: '2026-01-01T00:00:00Z',
}));
const idDe = (name: string) => CUENTAS.find(c => c.name === name)!.id;

/** Fake con memoria: un toque repetido ve lo que dejó el anterior. */
function makeDeps(
  opts: {
    prompts?: PromptCuenta[];
    contentSid?: string | undefined;
    cuentas?: CuentaActiva[];
    overrides?: Record<string, unknown>;
  } = {},
) {
  const prompts = new Map<string, PromptCuenta>(
    (opts.prompts ?? []).map(p => [p.id, { ...p }]),
  );
  let siguiente = 100;
  const deps = {
    listarCuentas: vi.fn(async () => opts.cuentas ?? CUENTAS),
    cargarUso: vi.fn(async () => []),
    crearPrompt: vi.fn(
      async (p: {
        userId: string;
        phone: string;
        targetKind: 'invoice' | 'transactions';
        targetIds: string[];
      }) => {
        const id = uuid(siguiente++).replace(/^0/, 'a');
        prompts.set(id, {
          id,
          userId: p.userId,
          phone: p.phone,
          targetKind: p.targetKind,
          targetIds: p.targetIds,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedAccountId: null,
        });
        return id;
      },
    ),
    sendMessage: vi.fn(async () => ({ ok: true })),
    sendContent: vi.fn(
      async (_to: string, _sid: string, _vars: Record<string, string>) => ({
        ok: true,
      }),
    ),
    contentSid: 'contentSid' in opts ? opts.contentSid : 'HXcuentas',
    cargarPrompt: vi.fn(async (id: string, phone: string) => {
      const p = prompts.get(id);
      return p && p.phone === phone ? { ...p } : null;
    }),
    ultimoPromptAbierto: vi.fn(async (phone: string) => {
      const abiertos = [...prompts.values()].filter(
        p => p.phone === phone && !p.resolvedAt,
      );
      return abiertos.length ? { ...abiertos[abiertos.length - 1] } : null;
    }),
    reclamarPrompt: vi.fn(async (id: string, accountId: string) => {
      const p = prompts.get(id);
      if (!p || p.resolvedAt) return false;
      p.resolvedAt = new Date().toISOString();
      p.resolvedAccountId = accountId;
      return true;
    }),
    liberarPrompt: vi.fn(async (id: string) => {
      const p = prompts.get(id);
      if (p) {
        p.resolvedAt = null;
        p.resolvedAccountId = null;
      }
    }),
    corregirResolucion: vi.fn(async (id: string, accountId: string) => {
      const p = prompts.get(id);
      if (p) p.resolvedAccountId = accountId;
    }),
    moverTransacciones: vi.fn(async () => ({ ok: true })),
    moverFactura: vi.fn(async () => ({ ok: true, movidos: 3 })),
    estadoFactura: vi.fn(async () => ({
      status: 'pending_review',
      cuenta: null as string | null,
    })),
    registrarFactura: vi.fn(async () => ({
      ok: true,
      itemsFound: 3,
      totalItems: 3,
      totalAmount: 45000,
      budgetItemIds: ['b1'],
      monthYear: '2026-09',
    })),
    onExpenseCreated: vi.fn(async () => ['⚠️ Mercado al 90%']),
    alResolver: vi.fn(async () => {}),
    ...opts.overrides,
  };
  const tipado: EleccionDeps = deps;
  void tipado; // el fake cumple el contrato real
  return { deps, prompts };
}

function prompt(extra: Partial<PromptCuenta> = {}): PromptCuenta {
  return {
    id: P1,
    userId: U,
    phone: TEL,
    targetKind: 'transactions',
    targetIds: ['tx-1'],
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedAccountId: null,
    ...extra,
  };
}

const ultimoTexto = (deps: { sendMessage: ReturnType<typeof vi.fn> }) =>
  String(deps.sendMessage.mock.calls.at(-1)?.[1] ?? '');

describe('preguntarCuenta', () => {
  it('con plantilla y 6+ cuentas manda la lista: un prompt apuntando al objetivo, cuerpo = previo + pregunta', async () => {
    const { deps } = makeDeps();
    const r = await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1', 'tx-2'],
      previo: '✅ Anotado $20.000 · taxi.',
      pregunta: 'Lo anoté en Efectivo. ¿Con qué cuenta fue?',
    });

    expect(r.via).toBe('lista');
    expect(deps.cargarUso).toHaveBeenCalledWith(U, TEL);
    expect(deps.crearPrompt).toHaveBeenCalledWith({
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1', 'tx-2'],
    });
    expect(deps.sendMessage).not.toHaveBeenCalled();
    const [to, sid, vars] = deps.sendContent.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, string>,
    ];
    expect(to).toBe(TEL);
    expect(sid).toBe('HXcuentas');
    expect(vars['1']).toBe(
      '✅ Anotado $20.000 · taxi.\n\nLo anoté en Efectivo. ¿Con qué cuenta fue?',
    );
    expect(Object.keys(vars)).toHaveLength(19);
    expect(vars['2']).toBe(armarIdOpcion(r.promptId!, CUENTAS[0].id));
  });

  it('las candidatas del texto van primero en la lista', async () => {
    const { deps } = makeDeps();
    await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1'],
      pregunta: '¿Con qué cuenta fue?',
      candidatas: ['Nequi Bruno', 'Nequi Coco'],
    });
    const vars = deps.sendContent.mock.calls[0][2] as unknown as Record<
      string,
      string
    >;
    expect([vars['3'], vars['6']]).toEqual(['Nequi Bruno', 'Nequi Coco']);
  });

  it('sin TWILIO_CONTENT_SID_CUENTAS pregunta por texto con las opciones', async () => {
    const { deps } = makeDeps({ contentSid: undefined });
    const r = await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'invoice',
      targetIds: ['inv-1'],
      pregunta: '🧾 Leí tu factura. ¿Con qué cuenta la pagaste?',
    });
    expect(r.via).toBe('texto');
    expect(deps.sendContent).not.toHaveBeenCalled();
    // El prompt se crea igual: el nombre escrito se aplica contra él.
    expect(deps.crearPrompt).toHaveBeenCalled();
    const texto = ultimoTexto(deps);
    expect(texto).toContain('¿Con qué cuenta la pagaste?');
    expect(texto).toContain('Nequi Bruno');
    expect(texto).toMatch(/respondé con el nombre/i);
  });

  it('con menos de 6 cuentas activas pregunta por texto', async () => {
    const { deps } = makeDeps({ cuentas: CUENTAS.slice(0, 5) });
    const r = await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1'],
      pregunta: '¿Con qué cuenta fue?',
    });
    expect(r.via).toBe('texto');
    expect(deps.sendContent).not.toHaveBeenCalled();
  });

  it('si Twilio rechaza la lista, cae a texto (el usuario no se queda sin pregunta)', async () => {
    const { deps } = makeDeps({
      overrides: { sendContent: vi.fn(async () => ({ ok: false })) },
    });
    const r = await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1'],
      previo: '✅ Anotado.',
      pregunta: '¿Con qué cuenta fue?',
    });
    expect(r.via).toBe('texto');
    expect(ultimoTexto(deps)).toContain('✅ Anotado.');
    expect(ultimoTexto(deps)).toContain('¿Con qué cuenta fue?');
  });

  it('si no se pudo crear el prompt (tabla sin migrar), pregunta por texto sin romper', async () => {
    const { deps } = makeDeps({
      overrides: {
        crearPrompt: vi.fn(async () => {
          throw new Error('relation does not exist');
        }),
      },
    });
    const r = await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1'],
      pregunta: '¿Con qué cuenta fue?',
    });
    expect(r).toEqual({ via: 'texto', promptId: null });
    expect(deps.sendContent).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('un previo demasiado largo para el cuerpo de la lista sale como mensaje aparte', async () => {
    const { deps } = makeDeps();
    await preguntarCuenta(deps, {
      userId: U,
      phone: TEL,
      targetKind: 'transactions',
      targetIds: ['tx-1'],
      previo: 'x'.repeat(1100),
      pregunta: '¿Con qué cuenta fue?',
    });
    expect(deps.sendMessage).toHaveBeenCalledWith(TEL, 'x'.repeat(1100));
    const vars = deps.sendContent.mock.calls[0][2] as unknown as Record<
      string,
      string
    >;
    expect(vars['1']).toBe('¿Con qué cuenta fue?');
  });
});

describe('manejarEleccionCuenta', () => {
  it('factura: el toque la registra con esa cuenta, confirma y pega las alertas', async () => {
    const { deps } = makeDeps({
      prompts: [prompt({ targetKind: 'invoice', targetIds: ['inv-1'] })],
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Nequi Coco'),
    });
    expect(deps.registrarFactura).toHaveBeenCalledWith('inv-1', 'Nequi Coco');
    expect(deps.onExpenseCreated).toHaveBeenCalledWith({
      categoria: 'FACTURA',
      budgetItemIds: ['b1'],
      monthYear: '2026-09',
    });
    const texto = ultimoTexto(deps);
    expect(texto).toContain('✅ Listo, quedó en Nequi Coco');
    expect(texto).toMatch(/45.?000/);
    expect(texto).toContain('3 ítems');
    expect(texto).toContain('Mercado al 90%');
    expect(deps.alResolver).toHaveBeenCalledWith({
      targetKind: 'invoice',
      targetIds: ['inv-1'],
      cuenta: 'Nequi Coco',
    });
  });

  it('factura: el doble toque no la registra dos veces', async () => {
    const { deps } = makeDeps({
      prompts: [prompt({ targetKind: 'invoice', targetIds: ['inv-1'] })],
    });
    const toque = {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Nequi Coco'),
    };
    await manejarEleccionCuenta(deps, toque);
    await manejarEleccionCuenta(deps, toque);
    expect(deps.registrarFactura).toHaveBeenCalledTimes(1);
    expect(ultimoTexto(deps)).toContain('Ya estaba en Nequi Coco');
  });

  it('factura: si el registro falla sin crear nada, libera la pregunta para reintentar', async () => {
    const { deps, prompts } = makeDeps({
      prompts: [prompt({ targetKind: 'invoice', targetIds: ['inv-1'] })],
      overrides: {
        registrarFactura: vi.fn(async () => ({
          ok: false,
          itemsFound: 0,
          totalItems: 3,
          error: 'boom',
        })),
      },
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Efectivo'),
    });
    expect(prompts.get(P1)!.resolvedAt).toBeNull();
    expect(ultimoTexto(deps)).toMatch(/no pude registrar/i);
  });

  it('factura: si el registro LANZA, no libera la pregunta (pudo quedar a medias) y manda a revisar la app', async () => {
    const { deps, prompts } = makeDeps({
      prompts: [prompt({ targetKind: 'invoice', targetIds: ['inv-1'] })],
      overrides: {
        registrarFactura: vi.fn(async () => {
          throw new Error('timeout de red');
        }),
      },
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Efectivo'),
    });
    // Liberarla invitaría a tocar de nuevo y duplicar lo que sí se escribió.
    expect(prompts.get(P1)!.resolvedAt).not.toBeNull();
    expect(ultimoTexto(deps)).toMatch(/revisala en la app/i);
  });

  it('gastos: si mover la cuenta LANZA, libera la pregunta para reintentar', async () => {
    const { deps, prompts } = makeDeps({
      prompts: [prompt()],
      overrides: {
        moverTransacciones: vi.fn(async () => {
          throw new Error('timeout de red');
        }),
      },
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Efectivo'),
    });
    expect(prompts.get(P1)!.resolvedAt).toBeNull();
    expect(ultimoTexto(deps)).toMatch(/no pude cambiar la cuenta/i);
  });

  it('factura ya registrada por otro camino con otra cuenta: el toque la corrige', async () => {
    const { deps } = makeDeps({
      prompts: [prompt({ targetKind: 'invoice', targetIds: ['inv-1'] })],
      overrides: {
        registrarFactura: vi.fn(async () => ({
          ok: false,
          itemsFound: 0,
          totalItems: 3,
          error: 'La factura ya está en estado "approved"',
        })),
        estadoFactura: vi.fn(async () => ({
          status: 'approved',
          cuenta: 'Efectivo',
        })),
      },
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('TC Falabella'),
    });
    expect(deps.moverFactura).toHaveBeenCalledWith(U, 'inv-1', {
      id: idDe('TC Falabella'),
      name: 'TC Falabella',
    });
    expect(ultimoTexto(deps)).toContain('✅ Listo, quedó en TC Falabella');
  });

  it('gastos: el toque les cambia la cuenta y confirma', async () => {
    const { deps, prompts } = makeDeps({
      prompts: [prompt({ targetIds: ['tx-1', 'tx-2'] })],
    });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Nequi Bruno'),
    });
    expect(deps.moverTransacciones).toHaveBeenCalledWith(
      U,
      ['tx-1', 'tx-2'],
      idDe('Nequi Bruno'),
    );
    expect(prompts.get(P1)!.resolvedAccountId).toBe(idDe('Nequi Bruno'));
    expect(ultimoTexto(deps)).toBe('✅ Listo, quedó en Nequi Bruno.');
  });

  it('gastos: un segundo toque con otra cuenta corrige; con la misma no hace nada', async () => {
    const { deps, prompts } = makeDeps({ prompts: [prompt()] });
    const base = { userId: U, phone: TEL, promptId: P1 };
    await manejarEleccionCuenta(deps, {
      ...base,
      accountId: idDe('Nequi Bruno'),
    });
    await manejarEleccionCuenta(deps, {
      ...base,
      accountId: idDe('Nequi Coco'),
    });
    expect(deps.moverTransacciones).toHaveBeenLastCalledWith(
      U,
      ['tx-1'],
      idDe('Nequi Coco'),
    );
    expect(prompts.get(P1)!.resolvedAccountId).toBe(idDe('Nequi Coco'));
    expect(ultimoTexto(deps)).toBe('✅ Listo, quedó en Nequi Coco.');

    await manejarEleccionCuenta(deps, {
      ...base,
      accountId: idDe('Nequi Coco'),
    });
    expect(deps.moverTransacciones).toHaveBeenCalledTimes(2);
    expect(ultimoTexto(deps)).toContain('Ya estaba en Nequi Coco');
  });

  it('una lista de OTRO número no se puede tocar desde este', async () => {
    const { deps } = makeDeps({ prompts: [prompt({ phone: OTRO_TEL })] });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Efectivo'),
    });
    expect(deps.cargarPrompt).toHaveBeenCalledWith(P1, TEL);
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
    expect(deps.registrarFactura).not.toHaveBeenCalled();
    expect(ultimoTexto(deps)).toMatch(/no encontr/i);
  });

  it('una pregunta de otro usuario tampoco', async () => {
    const { deps } = makeDeps({ prompts: [prompt({ userId: 'user-2' })] });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: idDe('Efectivo'),
    });
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
  });

  it('una cuenta que no es del usuario o ya no está activa no se aplica', async () => {
    const { deps, prompts } = makeDeps({ prompts: [prompt()] });
    await manejarEleccionCuenta(deps, {
      userId: U,
      phone: TEL,
      promptId: P1,
      accountId: uuid(999),
    });
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
    expect(prompts.get(P1)!.resolvedAt).toBeNull();
    expect(ultimoTexto(deps)).toMatch(/ya no est/i);
  });
});

describe('intentarCuentaEscrita', () => {
  it('un nombre corto con una pregunta abierta se aplica a la última', async () => {
    const { deps } = makeDeps({ prompts: [prompt()] });
    const manejado = await intentarCuentaEscrita(deps, {
      userId: U,
      phone: TEL,
      body: 'Nequi Coco',
    });
    expect(manejado).toBe(true);
    expect(deps.ultimoPromptAbierto).toHaveBeenCalledWith(TEL);
    expect(deps.moverTransacciones).toHaveBeenCalledWith(
      U,
      ['tx-1'],
      idDe('Nequi Coco'),
    );
    expect(ultimoTexto(deps)).toBe('✅ Listo, quedó en Nequi Coco.');
  });

  it('"40k huevos" va al agente: ni siquiera busca la pregunta abierta', async () => {
    const { deps } = makeDeps({ prompts: [prompt()] });
    const manejado = await intentarCuentaEscrita(deps, {
      userId: U,
      phone: TEL,
      body: '40k huevos',
    });
    expect(manejado).toBe(false);
    expect(deps.ultimoPromptAbierto).not.toHaveBeenCalled();
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
  });

  it('sin pregunta abierta, el nombre va al agente', async () => {
    const { deps } = makeDeps();
    expect(
      await intentarCuentaEscrita(deps, {
        userId: U,
        phone: TEL,
        body: 'Efectivo',
      }),
    ).toBe(false);
  });

  it('un texto corto que no es una cuenta va al agente', async () => {
    const { deps } = makeDeps({ prompts: [prompt()] });
    expect(
      await intentarCuentaEscrita(deps, {
        userId: U,
        phone: TEL,
        body: 'gracias',
      }),
    ).toBe(false);
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
  });

  it('un nombre ambiguo vuelve a preguntar con esas candidatas primero, sobre la MISMA pregunta', async () => {
    const { deps } = makeDeps({ prompts: [prompt()] });
    const manejado = await intentarCuentaEscrita(deps, {
      userId: U,
      phone: TEL,
      body: 'nequi',
    });
    expect(manejado).toBe(true);
    expect(deps.moverTransacciones).not.toHaveBeenCalled();
    expect(deps.crearPrompt).not.toHaveBeenCalled();
    const vars = deps.sendContent.mock.calls[0][2] as unknown as Record<
      string,
      string
    >;
    expect([vars['3'], vars['6']]).toEqual(['Nequi Bruno', 'Nequi Coco']);
    expect(vars['2']).toBe(armarIdOpcion(P1, idDe('Nequi Bruno')));
    expect(vars['1']).toContain('Nequi Bruno o Nequi Coco');
  });
});
