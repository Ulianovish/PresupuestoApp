import { describe, it, expect } from 'vitest';

import { buildSystemPrompt } from './prompt';

const BASE = {
  accounts: ['Efectivo', 'Davivienda Crédito', 'Nequi'],
  categories: ['MERCADO', 'TRANSPORTE', 'OTROS'],
  defaultAccount: 'Efectivo',
  today: '2026-08-17',
  pendingInvoice: null,
  lastEntity: null,
};

describe('buildSystemPrompt', () => {
  it('incluye las cuentas y categorías reales para que no las invente', () => {
    const p = buildSystemPrompt(BASE);
    expect(p).toContain('Davivienda Crédito');
    expect(p).toContain('MERCADO');
  });

  it('incluye la fecha de hoy para poder resolver "ayer"', () => {
    expect(buildSystemPrompt(BASE)).toContain('2026-08-17');
  });

  it('avisa que hay una factura esperando cuenta', () => {
    const p = buildSystemPrompt({
      ...BASE,
      pendingInvoice: {
        source: 'vision_receipt',
        cufe: null,
        supplier: 'ÉXITO',
        date: '2026-08-17',
        total: 89400,
        items: [{ description: 'arroz', amount: 5000 }],
      },
    });
    expect(p).toContain('ÉXITO');
    expect(p).toContain('registrar_factura');
  });

  it('con factura pendiente, deja explícito que otro gasto se registra igual', () => {
    // Sin esta instrucción la factura pendiente secuestraba la conversación:
    // un "20k taxi" se contestaba con "¿con qué cuenta pagaste la factura?" y
    // el gasto se perdía.
    const p = buildSystemPrompt({
      ...BASE,
      pendingInvoice: {
        source: 'vision_receipt',
        cufe: null,
        supplier: 'ÉXITO',
        date: '2026-08-17',
        total: 89400,
        items: [{ description: 'arroz', amount: 5000 }],
      },
    });
    expect(p).toContain('registrar_gasto');
    expect(p).toMatch(/otro gasto/i);
    // Ya no dice que CUALQUIER otra cosa vuelve a preguntar por la factura.
    expect(p).not.toMatch(/si dice cualquier otra cosa/i);
  });

  it('no menciona factura pendiente cuando no la hay', () => {
    expect(buildSystemPrompt(BASE)).not.toContain('registrar_factura');
  });

  it('describe el último gasto para poder corregirlo', () => {
    const p = buildSystemPrompt({
      ...BASE,
      lastEntity: {
        kind: 'expense',
        transactionId: 'tx-1',
        amount: 45000,
        description: 'mercado',
        accountName: 'Efectivo',
        category: 'MERCADO',
        date: '2026-08-17',
      },
    });
    expect(p).toContain('45000');
    expect(p).toContain('corregir_ultimo');
  });
});
