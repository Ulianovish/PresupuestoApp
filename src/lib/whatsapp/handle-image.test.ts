import { describe, expect, it, vi } from 'vitest';

import { handleImageMessage } from './handle-image';

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true })),
    downloadMedia: vi.fn(async () => ({ base64: 'b64', mime: 'image/png' })),
    analyzeImage: vi.fn(),
    createDirectExpense: vi.fn(async () => ({ ok: true, category: 'OTROS' })),
    createVisionReceiptDraft: vi.fn(async () => ({ ok: true, itemsFound: 2 })),
    resolveDefaultAccount: vi.fn(async () => 'Efectivo'),
    today: () => '2026-06-12',
    ...overrides,
  };
}

const ctx = { userId: 'u1', phone: '+57300', mediaUrl: 'https://m/0', mediaType: 'image/png' };

describe('handleImageMessage', () => {
  it('transferencia → gasto directo con la cuenta deducida', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        description: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 50000,
      description: 'Juan',
      accountName: 'Nequi',
      date: '2026-06-11',
    });
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/50.?000/));
  });

  it('transferencia sin cuenta → usa la cuenta por defecto', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 30000,
        date: null,
        account: null,
        description: null,
        confidence: 0.7,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+57300');
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 30000,
      description: 'Transferencia',
      accountName: 'Efectivo',
      date: '2026-06-12',
    });
  });

  it('recibo → borrador y avisa', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'Arroz', amount: 6000 }],
        total: 6000,
        confidence: 0.8,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createVisionReceiptDraft).toHaveBeenCalledWith('u1', {
      supplier: 'D1',
      date: '2026-06-12',
      items: [{ description: 'Arroz', amount: 6000 }],
      total: 6000,
    });
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/revisar|aprobar|lista/i));
  });

  it('unknown → pide reenviar/escribir (no crea nada)', async () => {
    const deps = makeDeps({ analyzeImage: vi.fn(async () => ({ kind: 'unknown' })) });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.createVisionReceiptDraft).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/no pude|reenv|escrib/i));
  });

  it('descarga falla → avisa y no analiza', async () => {
    const deps = makeDeps({ downloadMedia: vi.fn(async () => null) });
    await handleImageMessage(ctx, deps);
    expect(deps.analyzeImage).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });
});
