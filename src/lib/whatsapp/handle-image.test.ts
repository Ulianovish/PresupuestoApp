import { describe, expect, it, vi } from 'vitest';

import { handleImageMessage, resolveAccountFromMessage } from './handle-image';

function makeDeps(overrides = {}) {
  return {
    sendMessage: vi.fn(async () => ({ ok: true })),
    downloadMedia: vi.fn(async () => ({ base64: 'b64', mime: 'image/png' })),
    analyzeImage: vi.fn(),
    createDirectExpense: vi.fn(async () => ({ ok: true, category: 'OTROS' })),
    resolveDefaultAccount: vi.fn(async () => 'Efectivo'),
    today: () => '2026-06-12',
    accounts: ['Efectivo', 'Nequi', 'Davivienda Crédito'],
    createReceiptDraft: vi.fn(async () => ({
      ok: true,
      itemsFound: 1,
      invoiceId: 'inv-1',
    })),
    savePending: vi.fn(async () => {}),
    registerInvoice: vi.fn(async () => ({ ok: true, itemsFound: 2, totalItems: 2 })),
    ...overrides,
  };
}

const ctx = {
  userId: 'u1',
  phone: '+57300',
  mediaUrl: 'https://m/0',
  body: '',
  existingPendingId: null,
};

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

  it('recibo → se persiste SIEMPRE como borrador, antes de decidir si hay que preguntar', async () => {
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
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.createReceiptDraft).toHaveBeenCalledWith('u1', {
      supplier: 'D1',
      date: '2026-06-12',
      items: [{ description: 'Arroz', amount: 6000 }],
      total: 6000,
    });
  });

  it('recibo con cuenta en el texto → registra directo por invoiceId, sin preguntar', async () => {
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
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.registerInvoice).toHaveBeenCalledWith('inv-1', 'Nequi');
    expect(deps.savePending).not.toHaveBeenCalled();
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(mensaje).toMatch(/registr/i);
    expect(mensaje).toMatch(/6\.?000/); // el total, para que el usuario pueda detectar una lectura mala
  });

  it('recibo sin cuenta reconocible en el texto → guarda pendiente (por id) y pregunta con el total', async () => {
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
    await handleImageMessage({ ...ctx, body: '' }, deps);
    expect(deps.savePending).toHaveBeenCalledWith('inv-1');
    expect(deps.registerInvoice).not.toHaveBeenCalled();
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(mensaje).toMatch(/qué cuenta/i);
    expect(mensaje).toMatch(/6\.?000/);
  });

  it('recibo sin cuenta y ya había otra factura pendiente → avisa que la anterior quedó como borrador, y no la pisa en silencio', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D2',
        date: '2026-06-12',
        items: [{ description: 'Leche', amount: 4000 }],
        total: 4000,
        confidence: 0.8,
      })),
    });
    await handleImageMessage(
      { ...ctx, body: '', existingPendingId: 'inv-vieja' },
      deps,
    );
    const mensajes = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      c => c[1] as string,
    );
    expect(mensajes.some(m => /otra factura/i.test(m))).toBe(true);
    expect(mensajes.some(m => /qué cuenta/i.test(m))).toBe(true);
    expect(deps.savePending).toHaveBeenCalledWith('inv-1');
  });

  it('recibo con cuenta resuelta pero el registro falla del todo → avisa el error', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: null,
        date: '2026-06-12',
        items: [{ description: 'x', amount: 1000 }],
        total: 1000,
        confidence: 0.5,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: false,
        itemsFound: 0,
        totalItems: 1,
        error: 'boom',
      })),
    });
    await handleImageMessage({ ...ctx, body: 'con Nequi' }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude guardar la factura/i),
    );
  });

  it('recibo con cuenta resuelta pero el registro falla a mitad de camino → avisa cuántos SÍ quedaron, no reenviar', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [
          { description: 'arroz', amount: 5000 },
          { description: 'leche', amount: 3000 },
        ],
        total: 8000,
        confidence: 0.8,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: false,
        itemsFound: 1,
        totalItems: 2,
        error: 'boom',
      })),
    });
    await handleImageMessage({ ...ctx, body: 'con Nequi' }, deps);
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(mensaje).toContain('1');
    expect(mensaje).toContain('2');
    expect(mensaje).not.toMatch(/no pude guardar la factura/i);
    expect(mensaje).toMatch(/no reenv/i);
  });

  it('recibo cuya persistencia falla → avisa el error y no intenta preguntar ni registrar', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'x', amount: 1000 }],
        total: 1000,
        confidence: 0.5,
      })),
      createReceiptDraft: vi.fn(async () => ({
        ok: false,
        itemsFound: 0,
        error: 'db caída',
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.savePending).not.toHaveBeenCalled();
    expect(deps.registerInvoice).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude guardar la factura/i),
    );
  });

  it('unknown → pide reenviar/escribir (no crea nada)', async () => {
    const deps = makeDeps({ analyzeImage: vi.fn(async () => ({ kind: 'unknown' })) });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.createReceiptDraft).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith('+57300', expect.stringMatching(/no pude|reenv|escrib/i));
  });

  it('service_error → culpa al servicio, NO a la foto', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({ kind: 'service_error' })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.createReceiptDraft).not.toHaveBeenCalled();
    const [, msg] = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, string];
    expect(msg).toMatch(/no es tu foto|fallando/i);
    // el mensaje de "reenvíala más clara" culparía a la imagen: no debe salir
    expect(msg).not.toMatch(/más clara/i);
  });

  it('descarga falla → avisa y no analiza', async () => {
    const deps = makeDeps({ downloadMedia: vi.fn(async () => null) });
    await handleImageMessage(ctx, deps);
    expect(deps.analyzeImage).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalled();
  });
});

describe('resolveAccountFromMessage', () => {
  const CUENTAS = ['Efectivo', 'Davivienda Crédito', 'Nequi'];

  it('usa el texto que vino con la imagen', () => {
    expect(resolveAccountFromMessage('con la Davivienda', null, CUENTAS)).toBe(
      'Davivienda Crédito',
    );
  });

  it('cae a la cuenta que detectó la visión si el texto no dice nada', () => {
    expect(resolveAccountFromMessage('', 'Nequi', CUENTAS)).toBe('Nequi');
  });

  it('el texto le gana a la visión: el usuario sabe más que la foto', () => {
    expect(resolveAccountFromMessage('fue con Nequi', 'Efectivo', CUENTAS)).toBe('Nequi');
  });

  it('devuelve null si no hay nada que resolver, para que el bot pregunte', () => {
    expect(resolveAccountFromMessage('', null, CUENTAS)).toBeNull();
  });

  it('ignora una cuenta que el usuario no tiene', () => {
    expect(resolveAccountFromMessage('con Bancolombia', null, CUENTAS)).toBeNull();
  });

  it('una cuenta ambigua por texto se trata como no resuelta, nunca se elige al azar', () => {
    // Escenario real: "Davivienda" y "DAVIVIENDA" coexisten como cuentas
    // distintas del usuario (colisión de datos real, ver memoria del proyecto).
    const CUENTAS_AMBIGUAS = ['Davivienda', 'DAVIVIENDA', 'Nequi'];
    expect(
      resolveAccountFromMessage('pagué con davivienda', null, CUENTAS_AMBIGUAS),
    ).toBeNull();
  });

  it('la visión también trata la ambigüedad como no resuelta', () => {
    const CUENTAS_AMBIGUAS = ['Davivienda', 'DAVIVIENDA', 'Nequi'];
    expect(resolveAccountFromMessage('', 'davivienda', CUENTAS_AMBIGUAS)).toBeNull();
  });

  it('varias cuentas que comparten la misma palabra distintiva también son ambiguas', () => {
    // Con ~23 cuentas reales, varias comparten palabra (8 variantes de "Nu").
    const CUENTAS_COMPARTIDAS = ['Banco Falabella', 'Falabella Crédito', 'Nequi'];
    expect(
      resolveAccountFromMessage('pagué con Falabella', null, CUENTAS_COMPARTIDAS),
    ).toBeNull();
  });
});
