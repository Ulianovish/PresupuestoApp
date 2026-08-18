import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/dian/process-invoice', () => ({
  prepareInvoiceProcessing: vi.fn(),
  runInvoiceProcessing: vi.fn(),
}));
vi.mock('@/lib/services/invoices', () => ({
  getPendingInvoiceSummary: vi.fn(),
  resolveUserCategoryNames: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
} from '@/lib/dian/process-invoice';
import {
  getPendingInvoiceSummary,
  resolveUserCategoryNames,
} from '@/lib/services/invoices';

import { processCufeForWhatsApp } from './process-cufe';

const mockedPrepare = vi.mocked(prepareInvoiceProcessing);
const mockedRun = vi.mocked(runInvoiceProcessing);
const mockedSummary = vi.mocked(getPendingInvoiceSummary);
const mockedCategoryNames = vi.mocked(resolveUserCategoryNames);

describe('processCufeForWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCategoryNames.mockResolvedValue(['OTROS']);
  });

  it('factura approved (duplicado real) → sigue diciendo que es duplicado, no procesa ni relee', async () => {
    mockedPrepare.mockResolvedValueOnce({
      kind: 'duplicate',
      invoice: { id: 'inv-approved', status: 'approved' } as never,
    });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({ ok: false, reason: 'duplicate' });
    expect(mockedRun).not.toHaveBeenCalled();
    expect(mockedSummary).not.toHaveBeenCalled();
  });

  it('factura con registro parcial → no re-scrapea ni vuelve a registrar (duplicaría los ítems ya creados)', async () => {
    mockedPrepare.mockResolvedValueOnce({
      kind: 'partial_registration',
      invoice: { id: 'inv-parcial', status: 'error' } as never,
      itemsFound: 2,
      totalItems: 5,
    });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({
      ok: false,
      reason: 'partial',
      itemsFound: 2,
      totalItems: 5,
    });
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it('factura en pending_review (nadie contestó la cuenta) → retoma sin volver a scrapear', async () => {
    mockedPrepare.mockResolvedValueOnce({
      kind: 'awaiting_account',
      invoice: {
        id: 'inv-pending',
        status: 'pending_review',
        items: [{ description: 'Arroz' }, { description: 'Leche' }],
      } as never,
    });
    mockedSummary.mockResolvedValueOnce({
      source: 'dian_cufe',
      cufe: 'CUFE123',
      supplier: 'D1',
      date: '2026-06-01',
      total: 12000,
      items: [],
    });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({
      ok: true,
      itemsFound: 2,
      invoiceId: 'inv-pending',
      supplier: 'D1',
      total: 12000,
    });
    // No es un duplicado real: no hay que decir "ya la había procesado" ni
    // volver a scrapear (ni gastar otro captcha).
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it('un fallo al releer proveedor/total NO rompe el flujo: el usuario igual recibe la pregunta de la cuenta', async () => {
    mockedPrepare.mockResolvedValueOnce({ kind: 'ready', invoiceId: 'inv-new' });
    mockedRun.mockResolvedValueOnce({ ok: true, itemsFound: 3 });
    mockedSummary.mockRejectedValueOnce(new Error('blip de red hacia Supabase'));

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({
      ok: true,
      itemsFound: 3,
      invoiceId: 'inv-new',
      supplier: null,
      total: null,
    });
  });

  it('camino feliz: procesa, releé proveedor/total y arma el ok con invoiceId', async () => {
    mockedPrepare.mockResolvedValueOnce({ kind: 'ready', invoiceId: 'inv-new' });
    mockedRun.mockResolvedValueOnce({ ok: true, itemsFound: 2 });
    mockedSummary.mockResolvedValueOnce({
      source: 'dian_cufe',
      cufe: 'CUFE123',
      supplier: 'D1',
      date: '2026-06-01',
      total: 12000,
      items: [],
    });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({
      ok: true,
      itemsFound: 2,
      invoiceId: 'inv-new',
      supplier: 'D1',
      total: 12000,
    });
  });

  it('error al preparar → propaga el mensaje sin procesar', async () => {
    mockedPrepare.mockResolvedValueOnce({ kind: 'error', message: 'No se pudo crear el borrador' });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({ ok: false, reason: 'error', message: 'No se pudo crear el borrador' });
    expect(mockedRun).not.toHaveBeenCalled();
  });

  it('error del scraper → propaga el mensaje, no relee proveedor/total', async () => {
    mockedPrepare.mockResolvedValueOnce({ kind: 'ready', invoiceId: 'inv-x' });
    mockedRun.mockResolvedValueOnce({ ok: false, message: 'DIAN caído' });

    const out = await processCufeForWhatsApp('u1', 'CUFE123');

    expect(out).toEqual({ ok: false, reason: 'error', message: 'DIAN caído' });
    expect(mockedSummary).not.toHaveBeenCalled();
  });
});
