import { describe, expect, it, vi } from 'vitest';

import { handleAgentMessage } from './handle-agent';

const CUFE = 'a'.repeat(96);

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true as const })),
    processCufe: vi.fn(async () => ({ ok: true as const, itemsFound: 3 })),
    createDirectExpense: vi.fn(async () => ({ ok: true as const, category: 'MERCADO' })),
    resolveDefaultAccount: vi.fn(async () => 'Nequi'),
    today: () => '2026-06-11',
    ...overrides,
  };
}

describe('handleAgentMessage', () => {
  it('cufe ok → procesa y avisa "lista para revisar"', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'cufe',
      { userId: 'u1', phone: '+573001234567', body: CUFE },
      deps,
    );
    expect(deps.processCufe).toHaveBeenCalledWith('u1', CUFE);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+573001234567',
      expect.stringMatching(/revisar|lista|aprobar/i),
    );
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

  it('quick_expense → crea gasto y confirma con monto y categoría', async () => {
    const deps = makeDeps();
    await handleAgentMessage(
      'quick_expense',
      { userId: 'u1', phone: '+573001234567', body: '20k mercado' },
      deps,
    );
    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+573001234567');
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+573001234567', {
      amount: 20000,
      description: 'mercado',
      accountName: 'Nequi',
      date: '2026-06-11',
    });
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+573001234567',
      expect.stringMatching(/20.?000/),
    );
  });

  it('quick_expense con texto no parseable → pide reformular (no crea gasto)', async () => {
    const deps = makeDeps();
    await handleAgentMessage('quick_expense', { userId: 'u1', phone: '+57300', body: 'hola' }, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });
});
