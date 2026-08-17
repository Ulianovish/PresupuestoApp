import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/services/invoices', () => ({
  resolveUserCategoryNames: vi.fn(),
  createInvoiceDirect: vi.fn(),
  getPendingInvoiceSummary: vi.fn(),
}));
vi.mock('@/lib/services/whatsapp-expenses', () => ({
  createDirectExpense: vi.fn(),
  resolveDefaultAccount: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));
vi.mock('@/lib/whatsapp/transport', () => ({
  sendWhatsAppMessage: vi.fn(),
}));
vi.mock('./run', () => ({
  callGatewayReal: vi.fn(),
  runAgent: vi.fn(),
}));
vi.mock('./state', () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
}));

import {
  createInvoiceDirect,
  getPendingInvoiceSummary,
  resolveUserCategoryNames,
} from '@/lib/services/invoices';
import {
  createDirectExpense,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import { createAdminClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

import { runAgent } from './run';
import { readState, writeState } from './state';
import { handleAgentTurn } from './turn';

const mockedResolveCategoryNames = vi.mocked(resolveUserCategoryNames);
const mockedCreateInvoiceDirect = vi.mocked(createInvoiceDirect);
const mockedGetPendingInvoiceSummary = vi.mocked(getPendingInvoiceSummary);
const mockedCreateDirectExpense = vi.mocked(createDirectExpense);
const mockedResolveDefaultAccount = vi.mocked(resolveDefaultAccount);
const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedSendWhatsAppMessage = vi.mocked(sendWhatsAppMessage);
const mockedRunAgent = vi.mocked(runAgent);
const mockedReadState = vi.mocked(readState);
const mockedWriteState = vi.mocked(writeState);

const ESTADO_VACIO = { turns: [], pending: null, lastEntity: null };

/** Cadena mínima de Supabase para `select().eq().eq()` que resuelve `{data}`. */
function fakeAdmin(accountNames: string[]) {
  const chain: Record<string, unknown> & { data: Array<{ name: string }> } = {
    data: accountNames.map(name => ({ name })),
  };
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  return { from: vi.fn(() => chain) };
}

describe('handleAgentTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadState.mockResolvedValue(ESTADO_VACIO);
    mockedResolveCategoryNames.mockResolvedValue(['MERCADO', 'TRANSPORTE']);
    mockedResolveDefaultAccount.mockResolvedValue('Nequi');
    mockedCreateAdminClient.mockReturnValue(
      fakeAdmin(['Efectivo', 'Nequi']) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
    mockedSendWhatsAppMessage.mockResolvedValue({ ok: true });
    mockedWriteState.mockResolvedValue(undefined);
    mockedCreateDirectExpense.mockResolvedValue({
      ok: true,
      category: 'General',
    });
  });

  it('camino feliz: manda el texto del agente y guarda el estado', async () => {
    mockedRunAgent.mockResolvedValue({ text: 'Listo, anotado.', calls: [] });

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: '¿cuánto llevo en mercado?' });

    expect(mockedSendWhatsAppMessage).toHaveBeenCalledWith(
      '+57300',
      'Listo, anotado.',
    );
    expect(mockedWriteState).toHaveBeenCalledWith('+57300', 'u1', {
      turns: [
        { role: 'user', content: '¿cuánto llevo en mercado?' },
        { role: 'assistant', content: 'Listo, anotado.' },
      ],
    });
  });

  it('Gateway caído + parser que acierta: registra el gasto con monto formateado y descripción, y guarda estado', async () => {
    mockedRunAgent.mockResolvedValue({ kind: 'service_error' });
    mockedCreateDirectExpense.mockResolvedValue({
      ok: true,
      category: 'TRANSPORTE',
    });

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: '20k taxi' });

    expect(mockedCreateDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 20000,
      description: 'taxi',
      accountName: 'Nequi',
      date: expect.any(String),
    });
    const mensaje = mockedSendWhatsAppMessage.mock.calls[0][1];
    // Monto formateado (no "20000" pelado) y descripción visible: es lo que
    // permite pescar un acierto malo del parser en modo degradado.
    expect(mensaje).toMatch(/20\.000/);
    expect(mensaje).toMatch(/taxi/);
    expect(mockedWriteState).toHaveBeenCalledWith('+57300', 'u1', {
      turns: [
        { role: 'user', content: '20k taxi' },
        { role: 'assistant', content: mensaje },
      ],
    });
  });

  it('Gateway caído + parser que no acierta: mensaje honesto, no culpa al usuario', async () => {
    mockedRunAgent.mockResolvedValue({ kind: 'service_error' });

    await handleAgentTurn({
      userId: 'u1',
      phone: '+57300',
      body: 'hola, qué tal',
    });

    expect(mockedCreateDirectExpense).not.toHaveBeenCalled();
    const mensaje = mockedSendWhatsAppMessage.mock.calls[0][1];
    expect(mensaje).toMatch(/fallando|asistente/i);
    expect(mockedWriteState).toHaveBeenCalled();
  });

  it('falla de base al armar el contexto: cae al parser en vez del error genérico', async () => {
    mockedResolveDefaultAccount.mockRejectedValue(new Error('DB caída'));

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: '20k taxi' });

    expect(mockedRunAgent).not.toHaveBeenCalled();
    // Sin cuenta por defecto resuelta, usa la cuenta de emergencia (Efectivo).
    expect(mockedCreateDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 20000,
      description: 'taxi',
      accountName: 'Efectivo',
      date: expect.any(String),
    });
    expect(mockedSendWhatsAppMessage).toHaveBeenCalled();
    expect(mockedWriteState).toHaveBeenCalled();
  });
});

// `runAgent` sigue mockeado (no hay Gateway real), pero acá la implementación
// del mock LLAMA al `deps.executeTool` que le pasa `turn.ts` — que es el real
// `executeTool` de `./tools` (sin mockear) corriendo con el `registerInvoice`
// real de `handleAgentTurn`. Así se ejercita la ruta completa
// registrar_factura → executeTool → registerInvoice → createInvoiceDirect,
// que antes no tenía ninguna cobertura (el mock de `@/lib/services/invoices`
// no exponía `createInvoiceDirect` ni `getPendingInvoiceSummary`, así que
// ningún test la recorría).
describe('handleAgentTurn — registrar_factura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResolveCategoryNames.mockResolvedValue(['MERCADO', 'TRANSPORTE']);
    mockedResolveDefaultAccount.mockResolvedValue('Nequi');
    mockedCreateAdminClient.mockReturnValue(
      fakeAdmin(['Efectivo', 'Nequi']) as unknown as ReturnType<
        typeof createAdminClient
      >,
    );
    mockedSendWhatsAppMessage.mockResolvedValue({ ok: true });
    mockedWriteState.mockResolvedValue(undefined);
    mockedReadState.mockResolvedValue({
      turns: [],
      pending: { kind: 'invoice_account', invoiceId: 'inv-1' },
      lastEntity: null,
    });
    mockedGetPendingInvoiceSummary.mockResolvedValue({
      source: 'vision_receipt',
      cufe: null,
      supplier: 'ÉXITO',
      date: '2026-08-17',
      total: 8000,
      items: [{ description: 'arroz', amount: 8000 }],
    });
  });

  it('registro exitoso: createInvoiceDirect se llama con el invoiceId del pending, y el pending se limpia', async () => {
    mockedCreateInvoiceDirect.mockResolvedValue({
      ok: true,
      itemsFound: 1,
      totalItems: 1,
    });
    mockedRunAgent.mockImplementation(async (_mensaje, _ctx, deps) => {
      const out = await deps.executeTool('registrar_factura', { cuenta: 'Nequi' });
      return { text: out.summary, calls: [] };
    });

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: 'con Nequi' });

    expect(mockedCreateInvoiceDirect).toHaveBeenCalledWith('u1', 'inv-1', 'Nequi');
    expect(mockedCreateInvoiceDirect).toHaveBeenCalledTimes(1);
    expect(mockedWriteState).toHaveBeenCalledWith('+57300', 'u1', { pending: null });
  });

  it('fallo parcial: el mensaje final dice cuántos ítems se registraron, no que no se guardó nada', async () => {
    // El hallazgo crítico: un usuario que cree que no se guardó nada reenvía
    // la foto y duplica los ítems que sí se registraron.
    mockedCreateInvoiceDirect.mockResolvedValue({
      ok: false,
      itemsFound: 2,
      totalItems: 5,
      error: 'boom',
    });
    mockedRunAgent.mockImplementation(async (_mensaje, _ctx, deps) => {
      const out = await deps.executeTool('registrar_factura', { cuenta: 'Nequi' });
      return { text: out.summary, calls: [] };
    });

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: 'con Nequi' });

    const mensaje = mockedSendWhatsAppMessage.mock.calls[0][1];
    expect(mensaje).toContain('2');
    expect(mensaje).toContain('5');
    expect(mensaje).not.toMatch(/no se pudo guardar/i);
  });

  it('un segundo registrar_factura en la misma vuelta no registra la factura dos veces', async () => {
    mockedCreateInvoiceDirect.mockResolvedValue({
      ok: true,
      itemsFound: 1,
      totalItems: 1,
    });
    mockedRunAgent.mockImplementation(async (_mensaje, _ctx, deps) => {
      await deps.executeTool('registrar_factura', { cuenta: 'Nequi' });
      // Segunda llamada, mismo turno: el pending ya se anuló en memoria tras
      // la primera, así que esta no debería volver a llamar createInvoiceDirect.
      const segundo = await deps.executeTool('registrar_factura', { cuenta: 'Nequi' });
      return { text: segundo.summary, calls: [] };
    });

    await handleAgentTurn({ userId: 'u1', phone: '+57300', body: 'con Nequi' });

    expect(mockedCreateInvoiceDirect).toHaveBeenCalledTimes(1);
  });
});
