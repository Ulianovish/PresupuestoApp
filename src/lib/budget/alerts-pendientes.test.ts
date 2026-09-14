import { describe, it, expect } from 'vitest';

import { alertasPendientes, type AlertDeps, type RubroEstado } from './alerts';

const rubro = (over: Partial<RubroEstado> = {}): RubroEstado => ({
  budgetItemId: 'item-1',
  itemName: 'Dulces',
  budgeted: 150000,
  spent: 0,
  ...over,
});

function depsFake(
  estado: RubroEstado[],
  yaEnviados: Record<string, number> = {},
): AlertDeps {
  return {
    cargarEstado: async () => estado,
    // Réplica en memoria del ON CONFLICT ... WHERE last_threshold < excluded.
    marcarEnviado: async (_u, _m, id, threshold) => {
      if ((yaEnviados[id] ?? 0) >= threshold) return false;
      yaEnviados[id] = threshold;
      return true;
    },
  };
}

describe('alertasPendientes', () => {
  const args = {
    userId: 'u1',
    monthYear: '2026-09',
    hoy: new Date(2026, 8, 14),
  };

  it('mira TODOS los rubros vigilados, no solo los de un gasto, de peor a mejor', async () => {
    const estado = [
      rubro({ budgetItemId: 'a', itemName: 'Aseo', spent: 50000 }), // 33%: nada
      rubro({ budgetItemId: 'b', itemName: 'Cine', spent: 123000 }), // 82%
      rubro({ budgetItemId: 'c', itemName: 'Copagos', spent: 1080000 }), // 720%
    ];
    const msgs = await alertasPendientes(depsFake(estado), args);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('Copagos');
    expect(msgs[1]).toContain('Cine');
  });

  it('no repite un umbral que ya se avisó (p. ej. al registrar el gasto)', async () => {
    const estado = [
      rubro({ budgetItemId: 'b', itemName: 'Cine', spent: 123000 }), // 80
      rubro({ budgetItemId: 'c', itemName: 'Copagos', spent: 195000 }), // 100
    ];
    const msgs = await alertasPendientes(depsFake(estado, { b: 80 }), args);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Copagos');
  });
});
