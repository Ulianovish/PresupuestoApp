import { describe, expect, it, vi } from 'vitest';

import { handleImageMessage, resolveAccountFromMessage } from './handle-image';

function makeDeps(overrides = {}) {
  const sendMessage = vi.fn(async (_to: string, _body: string) => ({
    ok: true,
  }));
  return {
    sendMessage,
    // Por defecto simula la pregunta por texto (sin plantilla): lo que
    // pregunta sale por `sendMessage` como antes de la lista.
    askAccount: vi.fn(
      async (i: { previo?: string | null; pregunta: string }) => {
        await sendMessage(
          '+57300',
          i.previo ? `${i.previo}\n\n${i.pregunta}` : i.pregunta,
        );
      },
    ),
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
    registerInvoice: vi.fn(async () => ({
      ok: true,
      itemsFound: 2,
      totalItems: 2,
    })),
    onExpenseCreated: vi.fn(async () => []),
    saveState: vi.fn(async () => {}),
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
        recipient: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 50000,
      description: 'Juan',
      accountName: 'Nequi',
      date: '2026-06-11',
      place: 'Juan',
    });
    // La cuenta salió clara: no hay lista.
    expect(deps.askAccount).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/50.?000/),
    );
  });

  it('transferencia sin cuenta → usa la cuenta por defecto', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 30000,
        date: null,
        account: null,
        concept: null,
        recipient: null,
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

  it('transferencia: la cuenta que leyó la visión se canonicaliza contra las reales, no se usa cruda', async () => {
    // `upsert_monthly_expense` CREA la cuenta si el nombre no matchea exacto:
    // un "Nequi" leído contra un "NEQUI" real inventaba una cuenta nueva en
    // silencio, que después entraba al prompt de todos los mensajes. (Parte de
    // las ~23 cuentas casi duplicadas que tiene hoy el usuario.)
    const deps = makeDeps({
      accounts: ['Efectivo', 'NEQUI'],
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        recipient: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ accountName: 'NEQUI' }),
    );
  });

  it('transferencia: una cuenta que el usuario no tiene cae a la por defecto, no se inventa', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Bancolombia Ahorros',
        recipient: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+57300');
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ accountName: 'Efectivo' }),
    );
  });

  it('transferencia: el texto del usuario le gana a la cuenta que leyó la visión', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Efectivo',
        recipient: 'Juan',
        confidence: 0.9,
      })),
    });
    await handleImageMessage({ ...ctx, body: 'fue con la Nequi' }, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ accountName: 'Nequi' }),
    );
  });

  it('la foto de una transferencia también dispara la alerta del rubro', async () => {
    let recibido: string[] | null = null;
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        recipient: 'Juan',
        confidence: 0.9,
      })),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 't1',
        budgetItemId: 'item-dulces',
      })),
      onExpenseCreated: async (e: { budgetItemIds: string[] }) => {
        recibido = e.budgetItemIds;
        return [];
      },
    });
    await handleImageMessage(ctx, deps);
    expect(recibido).toEqual(['item-dulces']);
  });

  it('la alerta de la transferencia se pega al mismo mensaje, no manda uno aparte', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        recipient: 'Juan',
        confidence: 0.9,
      })),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 't1',
        budgetItemId: 'item-dulces',
      })),
      onExpenseCreated: vi.fn(async () => ['⚠️ Vas en 82% de Dulces.']),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.sendMessage).toHaveBeenCalledTimes(1);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringContaining('⚠️ Vas en 82% de Dulces.'),
    );
  });

  it('si el enganche de la transferencia lanza, el gasto igual queda confirmado', async () => {
    // Mismo criterio que executeTool: el gasto YA está guardado, una alerta
    // que falla no puede convertir esto en un "no pude registrar".
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'transfer',
        amount: 50000,
        date: '2026-06-11',
        account: 'Nequi',
        recipient: 'Juan',
        confidence: 0.9,
      })),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 't1',
        budgetItemId: 'item-dulces',
      })),
      onExpenseCreated: vi.fn(async () => {
        throw new Error('Supabase caído');
      }),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/✅ Registré/),
    );
  });

  it('el total que confirma de una factura es el REGISTRADO, no el que leyó la visión', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'Arroz', amount: 6000 }],
        total: 312400,
        confidence: 0.8,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: true,
        itemsFound: 1,
        totalItems: 1,
        totalAmount: 298000,
      })),
    });
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(mensaje).toMatch(/298\.000/);
    expect(mensaje).not.toMatch(/312\.400/);
  });

  it('el recibo registrado también dispara la alerta de los rubros que tocó, pegada al mismo mensaje', async () => {
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'Arroz', amount: 6000 }],
        total: 6000,
        confidence: 0.8,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: true,
        itemsFound: 1,
        totalItems: 1,
        totalAmount: 6000,
        budgetItemIds: ['item-mercado'],
        monthYear: '2026-06',
      })),
      onExpenseCreated: vi.fn(async () => ['⚠️ Vas en 90% de Mercado.']),
    });
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.onExpenseCreated).toHaveBeenCalledWith({
      categoria: 'FACTURA',
      budgetItemIds: ['item-mercado'],
      // Mes DE LA FACTURA (lo que devuelve `registerInvoice`), no el de hoy.
      monthYear: '2026-06',
    });
    expect(deps.sendMessage).toHaveBeenCalledTimes(1);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringContaining('⚠️ Vas en 90% de Mercado.'),
    );
  });

  it('si el enganche del recibo lanza, la factura igual queda confirmada', async () => {
    // Mismo criterio que la rama de transferencia: los gastos de la factura
    // YA están escritos, una alerta que falla no puede convertir esto en un
    // "no pude registrar".
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({
        kind: 'receipt',
        supplier: 'D1',
        date: '2026-06-12',
        items: [{ description: 'Arroz', amount: 6000 }],
        total: 6000,
        confidence: 0.8,
      })),
      registerInvoice: vi.fn(async () => ({
        ok: true,
        itemsFound: 1,
        totalItems: 1,
        totalAmount: 6000,
        budgetItemIds: ['item-mercado'],
        monthYear: '2026-06',
      })),
      onExpenseCreated: vi.fn(async () => {
        throw new Error('Supabase caído');
      }),
    });
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/✅ Registré tu factura/),
    );
  });

  it('recibo cuyo registro falla a mitad de camino: los ítems que SÍ quedaron con rubro también avisan al enganche', async () => {
    // El hallazgo crítico: esos ítems ya son transacciones reales con rubro
    // asignado. Que el registro haya quedado a medias no los excluye de las
    // alertas de presupuesto.
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
        budgetItemIds: ['item-mercado'],
        monthYear: '2026-06',
        error: 'boom',
      })),
      onExpenseCreated: vi.fn(async () => ['⚠️ Vas en 90% de Mercado.']),
    });
    await handleImageMessage({ ...ctx, body: 'con Nequi' }, deps);
    expect(deps.onExpenseCreated).toHaveBeenCalledWith({
      categoria: 'FACTURA',
      budgetItemIds: ['item-mercado'],
      monthYear: '2026-06',
    });
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1] as string;
    expect(mensaje).toContain('⚠️ Vas en 90% de Mercado.');
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
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
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
    // La factura queda retenida y la pregunta es la lista, apuntando a ella.
    expect(deps.askAccount).toHaveBeenCalledWith(
      expect.objectContaining({ targetKind: 'invoice', targetIds: ['inv-1'] }),
    );
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
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
    const mensajes = (
      deps.sendMessage as ReturnType<typeof vi.fn>
    ).mock.calls.map(c => c[1] as string);
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

  it('recibo con cuenta resuelta pero el registro falla a mitad de camino → avisa cuántos SÍ quedaron, que ya son gastos y que cargue el resto a mano, no reenviar', async () => {
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
    const mensaje = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(mensaje).toContain('1');
    expect(mensaje).toContain('2');
    expect(mensaje).not.toMatch(/no pude guardar la factura/i);
    expect(mensaje).toMatch(/ya están en tus gastos|no se perdieron/i);
    expect(mensaje).toMatch(/mano en gastos/i);
    expect(mensaje).toMatch(/no reenv/i);
    expect(mensaje).not.toMatch(/facturas sin completar/i);
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
    const deps = makeDeps({
      analyzeImage: vi.fn(async () => ({ kind: 'unknown' })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).not.toHaveBeenCalled();
    expect(deps.createReceiptDraft).not.toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith(
      '+57300',
      expect.stringMatching(/no pude|reenv|escrib/i),
    );
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

describe('handleImageMessage: texto del usuario, fecha y memoria', () => {
  function transferencia(extra: Record<string, unknown> = {}) {
    return vi.fn(async () => ({
      kind: 'transfer',
      amount: 9000,
      date: '2026-06-11',
      account: null,
      concept: 'Pago',
      recipient: 'Carlos Gomez',
      confidence: 0.9,
      ...extra,
    }));
  }

  function mensajes(deps: { sendMessage: unknown }): string[] {
    return (deps.sendMessage as ReturnType<typeof vi.fn>).mock.calls.map(
      c => c[1] as string,
    );
  }

  it('le pasa a la visión lo que escribió el usuario junto a la foto', async () => {
    const deps = makeDeps({ analyzeImage: transferencia() });
    await handleImageMessage({ ...ctx, body: 'Huevos con nequi' }, deps);
    expect(deps.analyzeImage).toHaveBeenCalledWith(
      'b64',
      'image/png',
      'Huevos con nequi',
    );
  });

  it('"Huevos con nequi" → la descripción es "Huevos" (no el destinatario), y la cuenta sigue saliendo del texto', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 't1',
      })),
    });
    await handleImageMessage({ ...ctx, body: 'Huevos con nequi' }, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith('u1', '+57300', {
      amount: 9000,
      description: 'Huevos',
      accountName: 'Nequi',
      date: '2026-06-11',
      place: 'Carlos Gomez',
    });
    expect(mensajes(deps)[0]).toMatch(
      /^✅ Registré \$\s?9\.000 · Huevos en MERCADO \(Nequi\)\./,
    );
  });

  it('caption ambigua ("con nequi" y hay dos Nequi): registra YA con la por defecto, lo dice y manda la lista con las dos primero', async () => {
    const deps = makeDeps({
      accounts: ['Efectivo', 'Nequi Migue', 'Nequi Milo', 'TC Davivienda'],
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 'tx-foto',
      })),
    });
    await handleImageMessage({ ...ctx, body: 'Huevos con nequi' }, deps);

    expect(deps.resolveDefaultAccount).toHaveBeenCalledWith('+57300');
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({
        accountName: 'Efectivo',
        place: 'Carlos Gomez',
      }),
    );
    expect(deps.askAccount).toHaveBeenCalledTimes(1);
    const pedido = deps.askAccount.mock.calls[0][0] as unknown as {
      targetKind: string;
      targetIds: string[];
      previo: string;
      pregunta: string;
      candidatas: string[];
    };
    expect(pedido.targetKind).toBe('transactions');
    expect(pedido.targetIds).toEqual(['tx-foto']);
    expect(pedido.candidatas).toEqual(['Nequi Migue', 'Nequi Milo']);
    expect(pedido.previo).toMatch(
      /^✅ Registré \$\s?9\.000 · Huevos en MERCADO\./,
    );
    expect(pedido.pregunta).toBe('Lo anoté en Efectivo. ¿Con qué cuenta fue?');
    // La confirmación sale UNA vez (dentro de la pregunta), no aparte.
    expect(mensajes(deps)).toHaveLength(1);
  });

  it('sin cuenta en el texto ni en la visión: también pregunta (sin candidatas)', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 'tx-foto',
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.askAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        targetKind: 'transactions',
        targetIds: ['tx-foto'],
        candidatas: [],
      }),
    );
  });

  it('sin texto → la descripción es el concepto que leyó la visión', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia({ concept: 'Cena afuera' }),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ description: 'Cena afuera' }),
    );
  });

  it('sin texto ni concepto → el destinatario', async () => {
    const deps = makeDeps({ analyzeImage: transferencia({ concept: null }) });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ description: 'Carlos Gomez' }),
    );
  });

  it('transferencia con fecha vieja (>60 días) → registra con hoy y lo avisa', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia({ date: '2025-04-09' }),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ date: '2026-06-12' }),
    );
    expect(mensajes(deps)[0]).toContain(
      '(La fecha del comprobante parecía 9 abr 2025; la puse hoy. Editala si no.)',
    );
  });

  it('transferencia con fecha futura → registra con hoy y lo avisa', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia({ date: '2026-07-09' }),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.createDirectExpense).toHaveBeenCalledWith(
      'u1',
      '+57300',
      expect.objectContaining({ date: '2026-06-12' }),
    );
    expect(mensajes(deps)[0]).toMatch(/parecía 9 jul 2026; la puse hoy/);
  });

  it('transferencia con fecha normal → sin aviso de fecha', async () => {
    const deps = makeDeps({ analyzeImage: transferencia() });
    await handleImageMessage(ctx, deps);
    expect(mensajes(deps)[0]).not.toMatch(/parecía/);
  });

  it('transferencia registrada → queda como lastEntity y el intercambio entra a los turnos', async () => {
    const previos = [
      { role: 'user' as const, content: '20k taxi' },
      { role: 'assistant' as const, content: '✅ Anotado' },
    ];
    const deps = makeDeps({
      analyzeImage: transferencia({ amount: 563091 }),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'MERCADO',
        transactionId: 't-foto',
      })),
    });
    await handleImageMessage(
      { ...ctx, body: 'Huevos con nequi', previousTurns: previos },
      deps,
    );
    const confirmacion = mensajes(deps)[0];
    expect(deps.saveState).toHaveBeenCalledWith({
      lastEntity: {
        kind: 'expense',
        transactionId: 't-foto',
        amount: 563091,
        description: 'Huevos',
        accountName: 'Nequi',
        category: 'MERCADO',
        date: '2026-06-11',
      },
      turns: [
        ...previos,
        { role: 'user', content: '[foto] Huevos con nequi' },
        { role: 'assistant', content: confirmacion },
      ],
    });
  });

  it('el estado se guarda ANTES de confirmar: una corrección rápida ya encuentra este gasto', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'OTROS',
        transactionId: 't1',
      })),
    });
    await handleImageMessage(ctx, deps);
    const guardado = (deps.saveState as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    const enviado = (deps.sendMessage as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0];
    expect(guardado).toBeLessThan(enviado);
  });

  it('foto sin texto → el turno del usuario dice "[foto] sin texto"', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'OTROS',
        transactionId: 't1',
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        turns: [
          { role: 'user', content: '[foto] sin texto' },
          expect.objectContaining({ role: 'assistant' }),
        ],
      }),
    );
  });

  it('si guardar el estado falla, el gasto igual se confirma', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: true,
        category: 'OTROS',
        transactionId: 't1',
      })),
      saveState: vi.fn(async () => {
        throw new Error('db caída');
      }),
    });
    await handleImageMessage(ctx, deps);
    expect(mensajes(deps)[0]).toMatch(/✅ Registré/);
  });

  it('transferencia que no se pudo registrar → no toca la memoria', async () => {
    const deps = makeDeps({
      analyzeImage: transferencia(),
      createDirectExpense: vi.fn(async () => ({
        ok: false,
        category: 'OTROS',
        error: 'boom',
      })),
    });
    await handleImageMessage(ctx, deps);
    expect(deps.saveState).not.toHaveBeenCalled();
  });

  const recibo = (extra: Record<string, unknown> = {}) =>
    vi.fn(async () => ({
      kind: 'receipt',
      supplier: 'D1',
      date: '2026-06-12',
      items: [{ description: 'Arroz', amount: 6000 }],
      total: 6000,
      confidence: 0.8,
      ...extra,
    }));

  it('recibo pendiente de cuenta → limpia lastEntity (una corrección no puede ir a un gasto viejo)', async () => {
    const deps = makeDeps({ analyzeImage: recibo() });
    await handleImageMessage(ctx, deps);
    expect(deps.savePending).toHaveBeenCalledWith('inv-1');
    expect(deps.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ lastEntity: null }),
    );
  });

  it('recibo registrado directo → también limpia lastEntity', async () => {
    const deps = makeDeps({ analyzeImage: recibo() });
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.registerInvoice).toHaveBeenCalled();
    expect(deps.saveState).toHaveBeenCalledWith(
      expect.objectContaining({ lastEntity: null }),
    );
  });

  it('recibo con fecha vieja → el borrador va con hoy y el mensaje lo avisa', async () => {
    const deps = makeDeps({ analyzeImage: recibo({ date: '2025-04-09' }) });
    await handleImageMessage(ctx, deps);
    expect(deps.createReceiptDraft).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ date: '2026-06-12' }),
    );
    expect(mensajes(deps).join('\n')).toContain(
      'parecía 9 abr 2025; la puse hoy',
    );
  });

  it('recibo con fecha futura y cuenta resuelta → registra con hoy y lo avisa', async () => {
    const deps = makeDeps({ analyzeImage: recibo({ date: '2026-10-09' }) });
    await handleImageMessage({ ...ctx, body: 'pagué con Nequi' }, deps);
    expect(deps.createReceiptDraft).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ date: '2026-06-12' }),
    );
    expect(mensajes(deps)[0]).toMatch(/✅ Registré tu factura/);
    expect(mensajes(deps)[0]).toContain('parecía 9 oct 2026');
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
    expect(
      resolveAccountFromMessage('fue con Nequi', 'Efectivo', CUENTAS),
    ).toBe('Nequi');
  });

  it('devuelve null si no hay nada que resolver, para que el bot pregunte', () => {
    expect(resolveAccountFromMessage('', null, CUENTAS)).toBeNull();
  });

  it('ignora una cuenta que el usuario no tiene', () => {
    expect(
      resolveAccountFromMessage('con Bancolombia', null, CUENTAS),
    ).toBeNull();
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
    expect(
      resolveAccountFromMessage('', 'davivienda', CUENTAS_AMBIGUAS),
    ).toBeNull();
  });

  it('varias cuentas que comparten la misma palabra distintiva también son ambiguas', () => {
    // Con ~23 cuentas reales, varias comparten palabra (8 variantes de "Nu").
    const CUENTAS_COMPARTIDAS = [
      'Banco Falabella',
      'Falabella Crédito',
      'Nequi',
    ];
    expect(
      resolveAccountFromMessage(
        'pagué con Falabella',
        null,
        CUENTAS_COMPARTIDAS,
      ),
    ).toBeNull();
  });
});
