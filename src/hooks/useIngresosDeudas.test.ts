import { beforeEach, describe, expect, it, vi } from 'vitest';

// `ingresos-deudas.ts` importa la instancia `supabase` creada a nivel de
// módulo en `@/lib/supabase/client`, así que los `vi.fn()` se fijan con
// `vi.hoisted` antes de que se evalúe el mock.
const { mockFrom, mockInsert, mockGetUser } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockGetUser: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => {
  const client = { from: mockFrom, auth: { getUser: mockGetUser } };
  return { supabase: client, createClient: () => client };
});

import * as servicio from '@/lib/services/ingresos-deudas';

import { cargarIngresosDeudas } from './useIngresosDeudas';

/**
 * Tabla vacía: `select().eq().order()` devuelve `[]`. Cualquier `insert`
 * queda registrado en `mockInsert` para poder afirmar que no hubo ninguno.
 */
function tablaVacia(tabla: string) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
  chain.insert = vi.fn((filas: unknown) => {
    mockInsert(tabla, filas);
    return chain;
  });
  return chain;
}

describe('cargarIngresosDeudas', () => {
  beforeEach(() => {
    mockFrom.mockReset();
    mockInsert.mockReset();
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
    });
    mockFrom.mockImplementation((tabla: string) => tablaVacia(tabla));
  });

  it('un usuario sin ingresos ni deudas no recibe inserts al cargar', async () => {
    const r = await cargarIngresosDeudas();

    expect(r.ingresos).toEqual([]);
    expect(r.deudas).toEqual([]);
    expect(r.resumen).toEqual({
      totalIngresos: 0,
      totalDeudas: 0,
      balanceNeto: 0,
      cantidadIngresos: 0,
      cantidadDeudas: 0,
      deudasPendientes: 0,
    });
    expect(mockFrom).toHaveBeenCalledWith('ingresos');
    expect(mockFrom).toHaveBeenCalledWith('deudas');
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('el servicio ya no exporta una siembra de datos de ejemplo', () => {
    expect(Object.keys(servicio)).not.toContain('inicializarDatosEjemplo');
  });
});
