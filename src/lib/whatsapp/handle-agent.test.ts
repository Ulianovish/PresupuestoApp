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
      { userId: 'u1', phone: '+573001234567', body: CUFE },
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
      { userId: 'u1', phone: '+57300', body: `${CUFE} con la Nequi` },
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
      { userId: 'u1', phone: '+57300', body: qrBlock },
      deps,
    );
    expect(deps.processCufe).toHaveBeenCalledWith('u1', realCufe);
  });

  it('cufe sin CUFE válido en el cuerpo → pide reenviar (no procesa)', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+57300', body: 'texto sin cufe' },
      deps,
    );
    expect(deps.processCufe).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });

  it('cufe duplicado → avisa que ya estaba procesada', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'duplicate' })),
    });
    await handleAgentMessage('cufe', { userId: 'u1', phone: '+57300', body: CUFE }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/ya/i),
    );
  });

  it('cufe error → avisa el error', async () => {
    const deps = makeDeps({
      processCufe: vi.fn(async () => ({ ok: false, reason: 'error', message: 'DIAN caído' })),
    });
    await handleAgentMessage('cufe', { userId: 'u1', phone: '+57300', body: CUFE }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude|error|falló/i),
    );
  });
});
