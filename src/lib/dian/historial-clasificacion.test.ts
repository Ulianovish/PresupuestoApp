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
  primerosDeGrupo,
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
        'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
      ),
    ).toBe('persona ejemplo uno');
  });

  it('quita "Nequi <número> De"', () => {
    expect(
      normalizarDescripcion('Nequi 3000000001 De Persona Ejemplo Dos'),
    ).toBe('persona ejemplo dos');
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
    expect(normalizarDescripcion('Transferencia a Persona Ejemplo Dos')).toBe(
      'persona ejemplo dos',
    );
    expect(normalizarDescripcion('Transferencia a Academia Chechi')).toBe(
      'academia chechi',
    );
    expect(normalizarDescripcion('Pago En Qr Breb: Elizabeth')).toBe(
      'elizabeth',
    );
  });

  it('un handle "@ejemplo1234" queda como el nombre', () => {
    expect(normalizarDescripcion('Transferencia a @ejemplo1234')).toBe(
      'ejemplo',
    );
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

  it('claves de menos de 4 letras no se matchean ("Enviado desde Arq" → "arq")', () => {
    expect(normalizarDescripcion('Enviado desde Arq')).toBe('');
    expect(normalizarDescripcion('Pan')).toBe('');
  });

  it('descripciones genéricas (categorías, bancos, verbos de pago) no son clave', () => {
    for (const generica of [
      'Mercado',
      'Compras',
      'Pago',
      'Transferencia', // el concepto por defecto de un comprobante sin concepto
      'Sin descripción',
      'Gastos varios',
      'Otros',
      'Nequi',
      'Compra Bancolombia',
      'Pago tarjeta crédito',
      'Depósito A Daviplata Por Pse',
      'Efectivo',
      'Factura',
      'Recibo',
    ]) {
      expect(normalizarDescripcion(generica), generica).toBe('');
    }
  });

  it('una palabra genérica acompañada de algo específico sí es clave', () => {
    expect(normalizarDescripcion('Mercado D1')).toBe('mercado d1');
    expect(normalizarDescripcion('Pago Tarjeta Nu')).toBe('pago tarjeta nu');
    expect(normalizarDescripcion('Almuerzo')).toBe('almuerzo');
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
          'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
          'VIVIENDA',
          'Arriendo',
        ),
      ]),
    );
    expect(
      buscarEnHistorial(
        'Banco Davibank S.A. 3000000002 De Persona Ejemplo Úno',
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

/** Fila cuyo ítem tiene id (para marcarlo como "primero de su categoría"). */
function filaConId(
  itemId: string,
  description: string,
  categoria: string,
  item: string,
  fecha = '2026-08-15',
): FilaHistorial {
  const f = fila(description, categoria, item, fecha);
  f.budget_items = { ...f.budget_items!, id: itemId };
  return f;
}

describe('primerosDeGrupo', () => {
  it('marca el primer ítem (en el orden de la base) de cada categoría/mes con más de un ítem', () => {
    const primeros = primerosDeGrupo([
      // Ya vienen ordenados por nombre, como los devuelve la consulta.
      { id: 'aseo', template_id: 'sep', category_id: 'mercado' },
      { id: 'carnes', template_id: 'sep', category_id: 'mercado' },
      { id: 'arriendo', template_id: 'sep', category_id: 'vivienda' },
      { id: 'aseo-ago', template_id: 'ago', category_id: 'mercado' },
      { id: 'lacena-ago', template_id: 'ago', category_id: 'mercado' },
    ]);
    // "arriendo" es el único de su categoría: elegirlo no era un default dudoso.
    expect([...primeros].sort()).toEqual(['aseo', 'aseo-ago']);
  });
});

describe('construirHistorial: filas "Asignar" del panel viejo', () => {
  // El panel viejo guardaba como 'manual' el primer ítem alfabético de la
  // categoría cuando el usuario solo apretaba "Asignar".
  const PRIMEROS = new Set(['sep-aseo', 'sep-cine', 'ago-cine']);

  it('descarta una fila manual que apunta al primer ítem de la categoría, sin respaldo', () => {
    const entradas = construirHistorial(
      [filaConId('sep-cine', 'Migao', 'GASTOS PERSONALES', 'Cine')],
      { primerosDeGrupo: PRIMEROS },
    );
    expect(entradas).toEqual([]);
  });

  it('la confía si OTRA fila manual (no sospechosa) con la misma clave coincide', () => {
    const entradas = construirHistorial(
      [
        filaConId('sep-aseo', 'Quitamanchas Polvo', 'MERCADO', 'Aseo'),
        filaConId(
          'jul-aseo',
          'Quitamanchas Polvo',
          'MERCADO',
          'Aseo',
          '2026-07-01',
        ),
      ],
      { primerosDeGrupo: PRIMEROS },
    );
    expect(entradas).toHaveLength(2);
  });

  it('dos filas sospechosas que coinciden no se respaldan entre sí', () => {
    const entradas = construirHistorial(
      [
        filaConId('sep-aseo', 'Paquete Todo A', 'MERCADO', 'Aseo'),
        filaConId('sep-aseo', 'Paquete Todo A', 'MERCADO', 'Aseo'),
      ],
      { primerosDeGrupo: PRIMEROS },
    );
    expect(entradas).toEqual([]);
  });

  it('la confía si el nombre del ítem aparece en la descripción ("Entradas Cineprox" → Cine)', () => {
    const entradas = construirHistorial(
      [
        filaConId('ago-cine', 'Entradas Cineprox', 'ENTRETENIMIENTO', 'Cine'),
        filaConId('sep-cine', 'Cine', 'ENTRETENIMIENTO', 'Cine'),
      ],
      { primerosDeGrupo: PRIMEROS },
    );
    expect(entradas.map(e => e.clave)).toEqual(['entradas cineprox', 'cine']);
  });

  it('una fila cuyo ítem NO es el primero se confía como siempre', () => {
    const entradas = construirHistorial(
      [filaConId('sep-rest', 'Migao', 'GASTOS PERSONALES', 'Restaurantes')],
      { primerosDeGrupo: PRIMEROS },
    );
    expect(entradas).toHaveLength(1);
  });

  it('una sospechosa descartada no tapa a una confiable más vieja de la misma clave', () => {
    const idx = indexarHistorial(
      construirHistorial(
        [
          filaConId(
            'sep-cine',
            'Migao',
            'GASTOS PERSONALES',
            'Cine',
            '2026-09-01',
          ),
          filaConId(
            'jul-rest',
            'Migao',
            'GASTOS PERSONALES',
            'Restaurantes',
            '2026-07-01',
          ),
        ],
        { primerosDeGrupo: PRIMEROS },
      ),
    );
    expect(buscarEnHistorial('migao', idx)).toMatchObject({
      itemNombre: 'Restaurantes',
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
      fila('Persona Ejemplo Dos', 'MERCADO', 'Huevos', '2026-09-05'),
      fila('Verduras', 'MERCADO', 'Verduras y frutas', '2026-09-05'),
      fila(
        'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
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
      itemDesdeHistorial('Persona Ejemplo Dos', 'MERCADO', idx, ITEMS_OCT),
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

  it('si la categoría del gasto fue ADIVINADA (IA/palabras clave), toma la del historial', () => {
    expect(
      itemDesdeHistorial(
        'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
        'OTROS',
        idx,
        ITEMS_OCT,
        { categoriaAdivinada: true },
      ),
    ).toEqual({
      itemId: 'oct-arriendo',
      categoria: 'VIVIENDA',
      cambiaCategoria: true,
    });
  });

  it('si el gasto no tiene categoría, toma la del historial', () => {
    expect(
      itemDesdeHistorial(
        'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
        '',
        idx,
        ITEMS_OCT,
      ),
    ).toMatchObject({ itemId: 'oct-arriendo', cambiaCategoria: true });
  });

  it('OTROS elegido por el usuario se respeta: no se le cambia la categoría', () => {
    expect(
      itemDesdeHistorial(
        'Banco Davibank S.A. 3000000000 De Persona Ejemplo Uno',
        'OTROS',
        idx,
        ITEMS_OCT,
      ),
    ).toBeNull();
  });

  it('respeta una categoría elegida distinta a la del historial', () => {
    expect(
      itemDesdeHistorial('Persona Ejemplo Dos', 'SALUD', idx, ITEMS_OCT),
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
  /** Fake por tabla: `transactions` (las manuales) y `budget_items` (hermanos). */
  function fakeClient(
    result: { data: unknown; error: unknown },
    hermanos: { data: unknown; error: unknown } = { data: [], error: null },
  ) {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(result),
    };
    const items = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(hermanos),
    };
    const client = {
      from: vi.fn((tabla: string) =>
        tabla === 'budget_items' ? items : builder,
      ),
    };
    return { client, builder, items };
  }

  const conItem = (f: FilaHistorial, id: string, tpl: string, cat: string) => {
    f.budget_items = {
      ...f.budget_items!,
      id,
      template_id: tpl,
      category_id: cat,
    };
    return f;
  };

  it('solo manuales del usuario, de los últimos meses', async () => {
    const { client, builder } = fakeClient({
      data: [fila('Persona Ejemplo Dos', 'MERCADO', 'Huevos', '2026-09-05')],
      error: null,
    });
    const entradas = await cargarHistorialManual(
      client as unknown as Parameters<typeof cargarHistorialManual>[0],
      'u1',
      { meses: 6, hoy: new Date('2026-09-28T12:00:00Z') },
    );
    expect(client.from).toHaveBeenCalledWith('transactions');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('budget_item_source', 'manual');
    expect(builder.gte).toHaveBeenCalledWith('transaction_date', '2026-03-01');
    expect(entradas).toHaveLength(1);
  });

  it('descarta la fila cuyo ítem es el primero (por nombre) de su categoría ese mes', async () => {
    const { client, items } = fakeClient(
      {
        data: [
          conItem(
            fila('Migao', 'GASTOS PERSONALES', 'Cine'),
            'cine',
            'sep',
            'gp',
          ),
          conItem(
            fila('Almuerzo Afuera', 'GASTOS PERSONALES', 'Restaurantes'),
            'rest',
            'sep',
            'gp',
          ),
        ],
        error: null,
      },
      {
        // Orden de la base (por nombre): "Cine" antes que "Restaurantes".
        data: [
          { id: 'cine', template_id: 'sep', category_id: 'gp' },
          { id: 'rest', template_id: 'sep', category_id: 'gp' },
        ],
        error: null,
      },
    );
    const entradas = await cargarHistorialManual(
      client as unknown as Parameters<typeof cargarHistorialManual>[0],
      'u1',
    );
    expect(client.from).toHaveBeenCalledWith('budget_items');
    expect(items.in).toHaveBeenCalledWith('template_id', ['sep']);
    expect(items.in).toHaveBeenCalledWith('category_id', ['gp']);
    expect(items.eq).toHaveBeenCalledWith('is_active', true);
    expect(items.order).toHaveBeenCalledWith('name');
    expect(entradas.map(e => e.descripcion)).toEqual(['Almuerzo Afuera']);
  });

  it('si falla la consulta de ítems hermanos, sigue sin ese filtro', async () => {
    const { client } = fakeClient(
      {
        data: [
          conItem(
            fila('Migao', 'GASTOS PERSONALES', 'Cine'),
            'cine',
            'sep',
            'gp',
          ),
        ],
        error: null,
      },
      { data: null, error: { message: 'boom' } },
    );
    const entradas = await cargarHistorialManual(
      client as unknown as Parameters<typeof cargarHistorialManual>[0],
      'u1',
    );
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
    const entradas = construirHistorial([fila('Panela', 'PANADERIA', null)]);
    const categorizar = vi.fn(async (items: Array<{ description: string }>) =>
      items.map(() => 'MERCADO'),
    );
    const cats = await categorizarConHistorial(
      [{ description: 'Panela' }],
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
      fila('Panela', 'MERCADO', 'Lacena', '2026-09-10'),
      fila('panela', 'MERCADO', 'Lacena', '2026-09-09'),
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
    const entradas = construirHistorial([fila('Panela', 'PANADERIA', null)]);
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
