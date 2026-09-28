import { describe, expect, it, vi } from 'vitest';

import type { BudgetItemRef } from '@/lib/services/expenses-rollup';

import {
  buscarEnHistorial,
  cargarHistorialManual,
  categorizarConHistorial,
  construirHistorial,
  ejemplosParaPrompt,
  indexarHistorial,
  itemDesdeHistorial,
  normalizarDescripcion,
  type FilaHistorial,
} from './historial-clasificacion';

function fila(
  description: string,
  categoria: string,
  item: string | null,
  fecha = '2026-08-15',
  itemCategoria: string | null = categoria,
): FilaHistorial {
  return {
    description,
    category_name: categoria,
    transaction_date: fecha,
    budget_items: item
      ? {
          name: item,
          categories: itemCategoria ? { name: itemCategoria } : null,
        }
      : null,
  };
}

describe('normalizarDescripcion', () => {
  it('minúsculas, sin tildes y con espacios colapsados (incluye saltos de línea)', () => {
    expect(normalizarDescripcion('  Arroz  Económico\nAlb ')).toBe(
      'arroz economico alb',
    );
  });

  it('quita el prefijo bancario "Banco Davibank S.A. <número> De"', () => {
    expect(
      normalizarDescripcion(
        'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
      ),
    ).toBe('luisa fernanda gomez franco');
  });

  it('quita "Nequi <número> De"', () => {
    expect(
      normalizarDescripcion('Nequi 3115230857 De Carlos Arturo Barrero Vega'),
    ).toBe('carlos arturo barrero vega');
  });

  it('quita llaves y transferencias', () => {
    expect(
      normalizarDescripcion('A La Llave Bancolombia Academia Chechi'),
    ).toBe('academia chechi');
    expect(normalizarDescripcion('Llave Bancolombia Academia Chechi')).toBe(
      'academia chechi',
    );
    expect(
      normalizarDescripcion('Llave Bold - Inversiones Crokampollo Sas'),
    ).toBe('inversiones crokampollo sas');
    expect(normalizarDescripcion('Transferencia a Carlos Gomez')).toBe(
      'carlos gomez',
    );
    expect(normalizarDescripcion('Enviado desde Arq')).toBe('arq');
    expect(normalizarDescripcion('Pago En Qr Breb: Elizabeth')).toBe(
      'elizabeth',
    );
  });

  it('un handle "@susana7309" queda como el nombre', () => {
    expect(normalizarDescripcion('Transferencia a @susana7309')).toBe('susana');
  });

  it('no confunde "@ 3.250" de una conversión de moneda con un handle', () => {
    expect(normalizarDescripcion('Pizzería (Panamá) — Usd 7,99 @ 3.250')).toBe(
      'pizzeria panama usd 7 99 3 250',
    );
  });

  it('quita "cuota N de M" al final', () => {
    expect(normalizarDescripcion('Eds Motomart Cuota 1 De 2')).toBe(
      'eds motomart',
    );
  });

  it('si solo queda el prefijo, no hay clave (no se matchea contra todo)', () => {
    expect(normalizarDescripcion('Pago En Qr Breb:')).toBe('');
  });
});

describe('construirHistorial / buscarEnHistorial', () => {
  it('match exacto por descripción normalizada, gana la asignación más reciente', () => {
    const idx = indexarHistorial(
      construirHistorial([
        fila('Verduras', 'MERCADO', 'Verduras y frutas', '2026-09-01'),
        fila('verduras', 'MERCADO', 'Otros', '2026-07-01'),
      ]),
    );
    expect(buscarEnHistorial('VERDURAS', idx)).toMatchObject({
      categoria: 'MERCADO',
      itemNombre: 'Verduras y frutas',
    });
    expect(buscarEnHistorial('Verduras frescas', idx)).toBeNull();
  });

  it('el mismo destinatario con otro número de cuenta sigue matcheando', () => {
    const idx = indexarHistorial(
      construirHistorial([
        fila(
          'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
          'VIVIENDA',
          'Arriendo',
        ),
      ]),
    );
    expect(
      buscarEnHistorial(
        'Banco Davibank S.A. 3009998877 De Luisa Fernanda Gómez Franco',
        idx,
      ),
    ).toMatchObject({ categoria: 'VIVIENDA', itemNombre: 'Arriendo' });
  });

  it('si el ítem quedó de OTRA categoría (se corrigió solo la categoría), se conserva la categoría pero no el ítem', () => {
    const idx = indexarHistorial(
      construirHistorial([
        fila('Chocolate', 'GASTOS HORMIGA', 'Dulces', '2026-08-15', 'MERCADO'),
      ]),
    );
    expect(buscarEnHistorial('chocolate', idx)).toMatchObject({
      categoria: 'GASTOS HORMIGA',
      itemNombre: null,
    });
  });
});

describe('itemDesdeHistorial', () => {
  const ITEMS_OCT: BudgetItemRef[] = [
    { id: 'oct-huevos', name: 'Huevos', category_name: 'MERCADO' },
    { id: 'oct-verduras', name: 'Verduras Y Frutas', category_name: 'Mercado' },
    { id: 'oct-arriendo', name: 'Arriendo', category_name: 'VIVIENDA' },
    { id: 'oct-arreglos-t', name: 'Arreglos', category_name: 'TRANSPORTE' },
    { id: 'oct-arreglos-v', name: 'Arreglos', category_name: 'VIVIENDA' },
  ];
  const idx = indexarHistorial(
    construirHistorial([
      fila('Carlos Gomez', 'MERCADO', 'Huevos', '2026-09-05'),
      fila('Verduras', 'MERCADO', 'Verduras y frutas', '2026-09-05'),
      fila(
        'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
        'VIVIENDA',
        'Arriendo',
        '2026-08-15',
      ),
      fila('Jairo Alberto', 'VIVIENDA', 'Arreglos', '2026-09-01'),
      fila('Cena', 'GASTOS PERSONALES', 'Restaurantes', '2026-09-01'),
    ]),
  );

  it('resuelve el ítem del MISMO NOMBRE en el mes destino (otro id)', () => {
    expect(
      itemDesdeHistorial('Carlos Gomez', 'MERCADO', idx, ITEMS_OCT),
    ).toEqual({
      itemId: 'oct-huevos',
      categoria: 'MERCADO',
      cambiaCategoria: false,
    });
  });

  it('el nombre del ítem y la categoría se comparan sin mayúsculas ni tildes', () => {
    expect(
      itemDesdeHistorial('Verduras', 'MERCADO', idx, ITEMS_OCT),
    ).toMatchObject({
      itemId: 'oct-verduras',
    });
  });

  it('entre ítems homónimos elige el de la categoría del historial', () => {
    expect(
      itemDesdeHistorial('Jairo Alberto', 'VIVIENDA', idx, ITEMS_OCT),
    ).toMatchObject({ itemId: 'oct-arreglos-v' });
  });

  it('si el gasto quedó en OTROS (comodín), toma la categoría del historial', () => {
    expect(
      itemDesdeHistorial(
        'Banco Davibank S.A. 3165766461 De Luisa Fernanda Gomez Franco',
        'OTROS',
        idx,
        ITEMS_OCT,
      ),
    ).toEqual({
      itemId: 'oct-arriendo',
      categoria: 'VIVIENDA',
      cambiaCategoria: true,
    });
  });

  it('respeta una categoría elegida distinta a la del historial', () => {
    expect(
      itemDesdeHistorial('Carlos Gomez', 'SALUD', idx, ITEMS_OCT),
    ).toBeNull();
  });

  it('null si el ítem no existe en el mes destino o no hay historial', () => {
    expect(
      itemDesdeHistorial('Cena', 'GASTOS PERSONALES', idx, ITEMS_OCT),
    ).toBeNull();
    expect(itemDesdeHistorial('Nada', 'MERCADO', idx, ITEMS_OCT)).toBeNull();
  });
});

describe('cargarHistorialManual', () => {
  function fakeClient(result: { data: unknown; error: unknown }) {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
    };
    return { client: { from: vi.fn(() => builder) }, builder };
  }

  it('una sola consulta: solo manuales del usuario, de los últimos meses', async () => {
    const { client, builder } = fakeClient({
      data: [fila('Carlos Gomez', 'MERCADO', 'Huevos', '2026-09-05')],
      error: null,
    });
    const entradas = await cargarHistorialManual(
      client as unknown as Parameters<typeof cargarHistorialManual>[0],
      'u1',
      { meses: 6, hoy: new Date('2026-09-28T12:00:00Z') },
    );
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('transactions');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('budget_item_source', 'manual');
    expect(builder.gte).toHaveBeenCalledWith('transaction_date', '2026-03-01');
    expect(entradas).toHaveLength(1);
  });

  it('best-effort: ante error devuelve [] (se sigue con la IA)', async () => {
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    expect(
      await cargarHistorialManual(
        client as unknown as Parameters<typeof cargarHistorialManual>[0],
        'u1',
      ),
    ).toEqual([]);
  });
});

describe('categorizarConHistorial', () => {
  it('usa la categoría del historial y solo le pregunta a la IA por el resto', async () => {
    const entradas = construirHistorial([
      fila('Gaseosa', 'GASTOS HORMIGA', 'Bebidas azucaradas'),
    ]);
    const categorizar = vi.fn(async (items: Array<{ description: string }>) =>
      items.map(() => 'MERCADO'),
    );

    const cats = await categorizarConHistorial(
      [{ description: 'gaseosa' }, { description: 'Arroz' }],
      ['MERCADO', 'Gastos Hormiga', 'OTROS'],
      entradas,
      {},
      categorizar,
    );

    // La categoría sale con la grafía de la lista del usuario.
    expect(cats).toEqual(['Gastos Hormiga', 'MERCADO']);
    expect(categorizar).toHaveBeenCalledTimes(1);
    expect(categorizar.mock.calls[0][0]).toEqual([{ description: 'Arroz' }]);
  });

  it('si todo sale del historial no llama a la IA', async () => {
    const entradas = construirHistorial([
      fila('Arriendo', 'VIVIENDA', 'Arriendo'),
    ]);
    const categorizar = vi.fn();
    const cats = await categorizarConHistorial(
      [{ description: 'arriendo' }],
      ['VIVIENDA'],
      entradas,
      {},
      categorizar,
    );
    expect(cats).toEqual(['VIVIENDA']);
    expect(categorizar).not.toHaveBeenCalled();
  });

  it('ignora una categoría del historial que el usuario ya no tiene', async () => {
    const entradas = construirHistorial([fila('Pan', 'PANADERIA', null)]);
    const categorizar = vi.fn(async (items: Array<{ description: string }>) =>
      items.map(() => 'MERCADO'),
    );
    const cats = await categorizarConHistorial(
      [{ description: 'Pan' }],
      ['MERCADO'],
      entradas,
      {},
      categorizar,
    );
    expect(cats).toEqual(['MERCADO']);
  });
});

describe('ejemplosParaPrompt', () => {
  it('toma hasta N ejemplos distintos, repartidos entre categorías', () => {
    const entradas = construirHistorial([
      fila('Pan', 'MERCADO', 'Lacena', '2026-09-10'),
      fila('pan', 'MERCADO', 'Lacena', '2026-09-09'),
      fila('Arroz', 'MERCADO', 'Lacena', '2026-09-08'),
      fila('Leche', 'MERCADO', 'Lacteos', '2026-09-07'),
      fila('Gaseosa', 'GASTOS HORMIGA', 'Bebidas', '2026-09-06'),
      fila('Blusa niña', 'ALICE', 'Vestuario Alice', '2026-09-05'),
    ]);
    const ej = ejemplosParaPrompt(
      entradas,
      ['MERCADO', 'Gastos Hormiga', 'ALICE'],
      4,
    );
    expect(ej).toHaveLength(4);
    // Ronda por categoría: no se llena todo con MERCADO.
    expect(ej.map(e => e.category)).toEqual(
      expect.arrayContaining(['MERCADO', 'Gastos Hormiga', 'ALICE']),
    );
    // Sin descripciones repetidas.
    expect(new Set(ej.map(e => e.description.toLowerCase())).size).toBe(4);
  });

  it('descarta ejemplos de categorías que el usuario ya no tiene', () => {
    const entradas = construirHistorial([fila('Pan', 'PANADERIA', null)]);
    expect(ejemplosParaPrompt(entradas, ['MERCADO'])).toEqual([]);
  });

  it('categorizarConHistorial manda proveedor y ejemplos al categorizador', async () => {
    const entradas = construirHistorial([
      fila('Gaseosa', 'GASTOS HORMIGA', null),
    ]);
    const categorizar = vi.fn(async (items: Array<{ description: string }>) =>
      items.map(() => 'MERCADO'),
    );
    await categorizarConHistorial(
      [{ description: 'Arroz' }],
      ['MERCADO', 'GASTOS HORMIGA'],
      entradas,
      { supplier: 'D1' },
      categorizar,
    );
    expect(categorizar).toHaveBeenCalledWith(
      [{ description: 'Arroz' }],
      ['MERCADO', 'GASTOS HORMIGA'],
      {
        supplier: 'D1',
        examples: [{ description: 'Gaseosa', category: 'GASTOS HORMIGA' }],
      },
    );
  });
});
