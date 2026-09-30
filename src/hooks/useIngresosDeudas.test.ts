import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

// Sin DOM en vitest (entorno `node`) no se puede montar el hook: se revisa
// su código fuente para que el efecto de montaje solo lea (antes la siembra
// vivía ahí, en `inicializarDatos`).
describe('useIngresosDeudas: efecto de montaje', () => {
  const hook = readFileSync(
    resolve(process.cwd(), 'src/hooks/useIngresosDeudas.ts'),
    'utf8',
  );

  it('el único efecto al montar llama solo a cargarDatos', () => {
    const efectos = [
      ...hook.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[/g),
    ];
    expect(efectos).toHaveLength(1);
    expect(efectos[0][1].trim()).toBe('cargarDatos();');
  });

  it('cargarDatos solo lee a través de cargarIngresosDeudas', () => {
    const cuerpo = hook.slice(
      hook.indexOf('const cargarDatos = useCallback'),
      hook.indexOf('// Cargar datos al montar'),
    );
    expect(cuerpo).toContain('await cargarIngresosDeudas()');
    expect(cuerpo).not.toMatch(/crearIngreso|crearDeuda|inicializar/);
  });
});
