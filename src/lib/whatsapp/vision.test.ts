import { beforeEach, describe, expect, it, vi } from 'vitest';

import { analyzeImage } from './vision';

function mockMiniMax(text: string, ok = true, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => ({ content: [{ text }] }),
    text: async () => text,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('analyzeImage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('MINIMAX_API_KEY', 'k');
  });

  it('parsea una transferencia', async () => {
    mockMiniMax(
      JSON.stringify({
        type: 'transfer',
        amount: 50000,
        date: '2026-06-12',
        account: 'Nequi',
        description: 'Juan Pérez',
        confidence: 0.9,
      }),
    );
    const r = await analyzeImage('b64', 'image/png');
    expect(r).toEqual({
      kind: 'transfer',
      amount: 50000,
      date: '2026-06-12',
      account: 'Nequi',
      description: 'Juan Pérez',
      confidence: 0.9,
    });
  });

  it('parsea un recibo con ítems (tolerando fences ```json)', async () => {
    const receiptJson = JSON.stringify({
      type: 'receipt',
      supplier: 'D1',
      date: '2026-06-12',
      items: [
        { description: 'Arroz', amount: 6000 },
        { description: 'Leche', amount: 5000 },
      ],
      total: 11000,
      confidence: 0.8,
    });
    mockMiniMax(['```json', receiptJson, '```'].join('\n'));
    const r = await analyzeImage('b64', 'image/jpeg');
    expect(r.kind).toBe('receipt');
    if (r.kind === 'receipt') {
      expect(r.supplier).toBe('D1');
      expect(r.items).toHaveLength(2);
      expect(r.items[0]).toEqual({ description: 'Arroz', amount: 6000 });
      expect(r.total).toBe(11000);
    }
  });

  it('type desconocido → unknown', async () => {
    mockMiniMax(JSON.stringify({ type: 'unknown' }));
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('JSON inválido → unknown', async () => {
    mockMiniMax('no es json');
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('sin API key → unknown sin llamar fetch', async () => {
    vi.stubEnv('MINIMAX_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('HTTP error → unknown', async () => {
    mockMiniMax('x', false, 500);
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });

  it('transfer sin amount válido → unknown', async () => {
    mockMiniMax(JSON.stringify({ type: 'transfer', amount: 0 }));
    expect(await analyzeImage('b64', 'image/png')).toEqual({ kind: 'unknown' });
  });
});
