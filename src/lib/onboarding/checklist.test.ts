import { describe, expect, it } from 'vitest';

import {
  computeChecklist,
  type ChecklistInput,
  type ChecklistItemId,
} from './checklist';

/** Usuario recién sembrado: solo la cuenta Efectivo del kit. */
const RECIEN_LLEGADO: ChecklistInput = {
  accountCount: 1,
  deudaCount: 0,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
};

describe('computeChecklist', () => {
  it('devuelve los 5 ítems en orden, con su texto y su enlace', () => {
    expect(computeChecklist(RECIEN_LLEGADO)).toEqual([
      {
        id: 'cuentas',
        label: 'Agrega tus cuentas',
        href: '/settings',
        done: false,
      },
      {
        id: 'deudas',
        label: 'Registra tarjetas y deudas',
        href: '/deudas',
        done: false,
      },
      {
        id: 'whatsapp',
        label: 'Vincula WhatsApp',
        href: '/settings',
        done: false,
      },
      {
        id: 'documento',
        label: 'Carga tu cédula para facturas DIAN',
        href: '/settings',
        done: false,
      },
      {
        id: 'presupuesto',
        label: 'Ponle montos a tu presupuesto',
        href: '/presupuesto',
        done: false,
      },
    ]);
  });

  it('la cuenta Efectivo del kit sola no completa "cuentas": hacen falta más de una', () => {
    const cuentas = (n: number) =>
      computeChecklist({ ...RECIEN_LLEGADO, accountCount: n }).find(
        i => i.id === 'cuentas',
      )?.done;

    expect(cuentas(0)).toBe(false);
    expect(cuentas(1)).toBe(false);
    expect(cuentas(2)).toBe(true);
  });

  it('cada ítem depende solo de su dato', () => {
    const casos: Array<[Partial<ChecklistInput>, ChecklistItemId]> = [
      [{ accountCount: 3 }, 'cuentas'],
      [{ deudaCount: 1 }, 'deudas'],
      [{ linkedPhoneCount: 2 }, 'whatsapp'],
      [{ hasDocumento: true }, 'documento'],
      [{ hasBudgetAmounts: true }, 'presupuesto'],
    ];

    for (const [cambio, id] of casos) {
      const hechos = computeChecklist({ ...RECIEN_LLEGADO, ...cambio })
        .filter(i => i.done)
        .map(i => i.id);
      expect(hechos).toEqual([id]);
    }
  });

  it('con todo configurado, los 5 quedan hechos', () => {
    const items = computeChecklist({
      accountCount: 2,
      deudaCount: 1,
      linkedPhoneCount: 1,
      hasDocumento: true,
      hasBudgetAmounts: true,
    });

    expect(items).toHaveLength(5);
    expect(items.every(i => i.done)).toBe(true);
  });
});
