import { describe, expect, it, vi } from 'vitest';

import { handleAgentMessage } from './handle-agent';

const CUFE = 'a'.repeat(96);

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true as const })),
    processCufe: vi.fn(async () => ({
      ok: true as const,
      itemsFound: 3,
      invoiceId: 'inv-1',
    })),
    accounts: ['Efectivo', 'Nequi'],
    savePending: vi.fn(async () => {}),
    registerInvoice: vi.fn(async () => ({ ok: true, itemsFound: 3, totalItems: 3 })),
    ...overrides,
  };
}

describe('handleAgentMessage', () => {
  it('tras procesar el CUFE, pregunta con qué cuenta se pagó en vez de mandar a la app', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+573001234567', body: CUFE, existingPendingId: null },
      deps,
    );
    expect(deps.processCufe).toHaveBeenCalledWith('u1', CUFE);
    expect(deps.savePending).toHaveBeenCalledWith('inv-1');
    expect(deps.registerInvoice).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+573001234567',
      expect.stringMatching(/cuenta/i),
    );
    expect(deps.sendMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/aprobar/i),
    );
  });

  it('si el texto del CUFE ya trae la cuenta, registra sin preguntar', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: `${CUFE} con la Nequi`, existingPendingId: null },
      deps,
    );
    expect(deps.registerInvoice).toHaveBeenCalledWith('inv-1', 'Nequi');
    expect(deps.savePending).not.toHaveBeenCalled();
    expect(deps.sendMessage).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringMatching(/¿con qué cuenta/i),
    );
  });

  it('si ya había otra factura esperando cuenta, avisa antes de preguntar por esta', async () => {
    const enviados: string[] = [];
    const deps = makeDeps({
      sendMessage: vi.fn(async (_to: string, body: string) => {
        enviados.push(body);
        return { ok: true as const };
      }),
    });
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: CUFE, existingPendingId: 'inv-old' },
      deps,
    );
    expect(enviados.some(t => /otra factura/i.test(t))).toBe(true);
    expect(deps.savePending).toHaveBeenCalledWith('inv-1');
  });

  it('cufe dentro del bloque del QR → extrae el CUFE y lo procesa', async () => {
    const realCufe =
      'd434a4e186eeaa19d67e27b796af6847db0cd0aa708698fbc42fb6c68e1062867a5d9090d1bc2a907f2a0c12439c3e8a';
    const qrBlock = `NumFac: E2MD091860\nValTolFac: 725200.28\nCUFE: ${realCufe}`;
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: qrBlock, existingPendingId: null },
      deps,
    );
    expect(deps.processCufe).toHaveBeenCalledWith('u1', realCufe);
  });

  it('cufe sin CUFE válido en el cuerpo → pide reenviar (no procesa)', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: 'texto sin cufe', existingPendingId: null },
      deps,
    );
    expect(deps.processCufe).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });

  it('cufe duplicado (factura approved) → avisa que ya estaba procesada', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'duplicate' })),
    });
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: CUFE, existingPendingId: null },
      deps,
    );
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/ya/i),
    );
  });

  it('cufe de una factura registrada a medias → dice cuántos quedaron, que ya son gastos y que cargue el resto a mano, sin mandar a "Facturas sin completar" ni invitar a reintentar', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({
        ok: false,
        reason: 'partial',
        itemsFound: 2,
        totalItems: 5,
      })),
    });
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: CUFE, existingPendingId: null },
      deps,
    );
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(mensaje).toMatch(/a medias|duplicar/i);
    expect(mensaje).toContain('2');
    expect(mensaje).toContain('5');
    expect(mensaje).toMatch(/ya son gastos|no se perdieron/i);
    expect(mensaje).toMatch(/mano en gastos/i);
    expect(mensaje).not.toMatch(/facturas sin completar/i);
    expect(mensaje).not.toMatch(/reintentar|de nuevo/i);
  });

  it('el total que confirma es el REGISTRADO, no el de la cabecera de la factura', async () => {
    // Con descuentos o redondeos difieren: el bot decía "$312.400" y en la app
    // aparecían "$298.000".
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({
        ok: true as const,
        itemsFound: 2,
        invoiceId: 'inv-1',
        supplier: 'D1',
        total: 312400,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: true,
        itemsFound: 2,
        totalItems: 2,
        totalAmount: 298000,
      })),
    });
    await handleAgentMessage(
      'cufe',
      {
        userId: 'u1',
        phone: '+57300',
        body: `${CUFE} con la Nequi`,
        existingPendingId: null,
      },
      deps,
    );
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(mensaje).toMatch(/298\.000/);
    expect(mensaje).not.toMatch(/312\.400/);
  });

  it('cufe cuyo registro falla a mitad de camino → avisa cuántos SÍ quedaron, que ya son gastos y que cargue el resto a mano, sin mandar a "Facturas sin completar"', async () => {
    const deps = makeDeps({
      registerInvoice: vi.fn(async () => ({
        ok: false,
        itemsFound: 3,
        totalItems: 8,
        error: 'boom',
      })),
    });
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: `${CUFE} con la Nequi`, existingPendingId: null },
      deps,
    );
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(mensaje).toContain('3');
    expect(mensaje).toContain('8');
    expect(mensaje).toMatch(/ya están en tus gastos|no se perdieron/i);
    expect(mensaje).toMatch(/mano en gastos/i);
    expect(mensaje).toMatch(/no vuelvas a mandar el cufe/i);
    expect(mensaje).not.toMatch(/facturas sin completar/i);
  });

  it('cufe error → avisa el error', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'error', message: 'DIAN caído' })),
    });
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: CUFE, existingPendingId: null },
      deps,
    );
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude|error|falló/i),
    );
  });
});
