import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/invoices', () => ({
  saveProcessedInvoice: vi.fn(async () => undefined),
  markInvoiceError: vi.fn(async () => undefined),
  getInvoiceByCufe: vi.fn(),
  createProcessingInvoice: vi.fn(),
  resetInvoiceToProcessing: vi.fn(async () => undefined),
  // Predicado puro: se replica en vez de mockearse con vi.fn para que el test
  // ejercite la decisión real. Que el prefijo coincida con el que escribe
  // `createInvoiceDirect` lo verifica `invoices.test.ts`.
  esRegistroParcial: (m: string | null) =>
    (m ?? '').startsWith('Registro parcial:'),
}));
vi.mock('@/lib/dian/categorizer', () => ({
  categorizeInvoiceItems: vi.fn(
    async (items: Array<{ description: string }>) => items.map(() => 'MERCADO'),
  ),
}));

import { categorizeInvoiceItems } from '@/lib/dian/categorizer';
import {
  createProcessingInvoice,
  getInvoiceByCufe,
  markInvoiceError,
  resetInvoiceToProcessing,
  saveProcessedInvoice,
} from '@/lib/services/invoices';

import { prepareInvoiceProcessing, runInvoiceProcessing } from './process-invoice';

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(enc.encode(line));
      controller.close();
    },
  });
}

const sse = (obj: Record<string, unknown>) => `data: ${JSON.stringify(obj)}\n\n`;

const COMPLETE_RESULT = {
  success: true,
  invoice_details: {
    cufe: 'CUFE123',
    storeName: 'D1',
    date: '2026-06-01',
    currency: 'COP',
    nit: '900',
    subtotal: 10000,
    total_amount: 12000,
  },
  items: [
    { description: 'Arroz', quantity: 1, unit_price: 5000, total_price: 5000, total_with_tax: 6000 },
    { description: 'Leche', quantity: 1, unit_price: 5000, total_price: 5000, total_with_tax: 6000 },
  ],
};

describe('runInvoiceProcessing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('procesa, reporta progreso, categoriza con las categorías dadas y persiste', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: sseStream([
          sse({ step: 'fetching', progress: 30, message: 'Descargando...' }),
          sse({ step: 'complete', progress: 100, result: COMPLETE_RESULT }),
        ]),
      })),
    );
    const onProgress = vi.fn();

    const res = await runInvoiceProcessing('inv-1', 'CUFE123', {
      categoryNames: ['MERCADO', 'OTROS'],
      onProgress,
    });

    expect(res).toEqual({ ok: true, itemsFound: 2 });
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'categorizing' }),
    );
    expect(categorizeInvoiceItems).toHaveBeenCalledWith(
      [{ description: 'Arroz' }, { description: 'Leche' }],
      ['MERCADO', 'OTROS'],
    );
    expect(saveProcessedInvoice).toHaveBeenCalledWith(
      'inv-1',
      expect.objectContaining({ supplierName: 'D1', totalAmount: 12000 }),
      undefined,
    );
    const savedItems = (saveProcessedInvoice as unknown as ReturnType<typeof vi.fn>)
      .mock.calls[0][1].items;
    expect(savedItems[0].category).toBe('MERCADO');
  });

  it('expone el error real del upstream emitido como {error} sin step', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        body: sseStream([sse({ error: 'Error descargando PDF de la DIAN' })]),
      })),
    );

    const res = await runInvoiceProcessing('inv-2', 'CUFE123', {
      categoryNames: ['OTROS'],
    });

    expect(res.ok).toBe(false);
    expect(markInvoiceError).toHaveBeenCalledWith(
      'inv-2',
      expect.stringContaining('Error descargando PDF'),
      undefined,
    );
    expect(saveProcessedInvoice).not.toHaveBeenCalled();
  });

  it('reintenta ante cierre prematuro y tiene éxito en el 2º intento', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, body: sseStream([sse({ step: 'fetching', progress: 10 })]) })
      .mockResolvedValueOnce({ ok: true, body: sseStream([sse({ step: 'complete', result: COMPLETE_RESULT })]) });
    vi.stubGlobal('fetch', fetchMock);
    const onProgress = vi.fn();

    const res = await runInvoiceProcessing('inv-3', 'CUFE123', {
      categoryNames: ['MERCADO'],
      retryBaseMs: 0,
      onProgress,
    });

    expect(res).toEqual({ ok: true, itemsFound: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ step: 'retrying' }),
    );
  });

  it('NO reintenta un error no transitorio (4xx) y marca error', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, body: null }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await runInvoiceProcessing('inv-4', 'CUFE123', {
      categoryNames: ['OTROS'],
      retryBaseMs: 0,
    });

    expect(res.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(markInvoiceError).toHaveBeenCalledWith('inv-4', expect.stringContaining('404'), undefined);
  });

  it('el primario agota el presupuesto → NO arranca el respaldo y reporta el fallo', async () => {
    // Reproduce el bug real: el VPS consumía sus 240s, el respaldo arrancaba con
    // ~60s necesitando ~235s, y la función moría a los 300s sin escribir error ni
    // avisar. La factura quedaba en 'processing' para siempre.
    vi.stubEnv('DIAN_VPS_URL', 'http://vps.test');
    const base = Date.now();
    let elapsed = 0;
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => base + elapsed);

    const fetchMock = vi.fn(async () => {
      elapsed = 250_000; // el VPS se comió casi todo el presupuesto
      throw new Error('The operation was aborted due to timeout');
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await runInvoiceProcessing('inv-budget', 'CUFE123', {
      categoryNames: ['OTROS'],
      retryBaseMs: 0,
    });

    expect(res.ok).toBe(false);
    // Lo esencial: el respaldo nunca se intentó (una sola llamada, la del VPS).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(markInvoiceError).toHaveBeenCalledWith(
      'inv-budget',
      expect.stringContaining('insuficiente'),
      undefined,
    );
    nowSpy.mockRestore();
  });

  it('si el primario falla rápido, sí queda presupuesto y se usa el respaldo', async () => {
    vi.stubEnv('DIAN_VPS_URL', 'http://vps.test');
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1) throw new Error('VPS respondió 429'); // mutex: falla al instante
      return {
        ok: true,
        status: 200,
        body: null,
        json: async () => COMPLETE_RESULT,
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    await runInvoiceProcessing('inv-fast-fail', 'CUFE123', {
      categoryNames: ['OTROS'],
      retryBaseMs: 0,
    });

    // Con tiempo de sobra el respaldo sí debe intentarse.
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

const getInvoiceByCufeMock = getInvoiceByCufe as unknown as ReturnType<
  typeof vi.fn
>;
const createProcessingInvoiceMock = createProcessingInvoice as unknown as ReturnType<
  typeof vi.fn
>;
const resetInvoiceToProcessingMock = resetInvoiceToProcessing as unknown as ReturnType<
  typeof vi.fn
>;

function fakeInvoice(status: string, id = 'inv-existing') {
  return { id, status };
}

describe('prepareInvoiceProcessing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve awaiting_account para una factura en pending_review sin crear/reiniciar (no es duplicado real: nadie contestó la cuenta)', async () => {
    const invoice = fakeInvoice('pending_review');
    getInvoiceByCufeMock.mockResolvedValueOnce(invoice);

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(res).toEqual({ kind: 'awaiting_account', invoice });
    expect(createProcessingInvoiceMock).not.toHaveBeenCalled();
    expect(resetInvoiceToProcessingMock).not.toHaveBeenCalled();
  });

  it('devuelve duplicate para una factura approved', async () => {
    const invoice = fakeInvoice('approved');
    getInvoiceByCufeMock.mockResolvedValueOnce(invoice);

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(res).toEqual({ kind: 'duplicate', invoice });
  });

  it('una factura en error por REGISTRO PARCIAL no se reinicia: reprocesarla duplicaría los ítems ya creados', async () => {
    // Reenviar el CUFE es justo lo que hace un usuario que leyó "registré 2 de
    // 5 ítems". Antes caía al camino viejo: reset a processing → re-scrape →
    // `createInvoiceDirect` recorría los 5 ítems otra vez y los 2 primeros
    // quedaban duplicados como transacciones reales.
    const invoice = {
      ...fakeInvoice('error', 'inv-parcial'),
      error_message:
        'Registro parcial: 2 de 5 ítems ("leche" falló: boom).',
    };
    getInvoiceByCufeMock.mockResolvedValueOnce(invoice);

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(res).toEqual({ kind: 'partial_registration', invoice });
    expect(resetInvoiceToProcessingMock).not.toHaveBeenCalled();
    expect(createProcessingInvoiceMock).not.toHaveBeenCalled();
  });

  it('reinicia una factura en error y la deja ready', async () => {
    const invoice = fakeInvoice('error', 'inv-err');
    getInvoiceByCufeMock.mockResolvedValueOnce(invoice);

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(resetInvoiceToProcessingMock).toHaveBeenCalledWith('inv-err', undefined);
    expect(res).toEqual({ kind: 'ready', invoiceId: 'inv-err' });
  });

  it('crea una nueva factura cuando no existe y la deja ready', async () => {
    getInvoiceByCufeMock.mockResolvedValueOnce(null);
    createProcessingInvoiceMock.mockResolvedValueOnce('inv-new');

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(res).toEqual({ kind: 'ready', invoiceId: 'inv-new' });
  });

  it('devuelve error cuando no se pudo crear la factura', async () => {
    getInvoiceByCufeMock.mockResolvedValueOnce(null);
    createProcessingInvoiceMock.mockResolvedValueOnce(null);

    const res = await prepareInvoiceProcessing('user-1', 'CUFE123');

    expect(res.kind).toBe('error');
  });
});
