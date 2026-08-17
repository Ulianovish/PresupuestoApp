import { describe, it, expect } from 'vitest';

import {
  TOOL_DEFINITIONS,
  executeTool,
  resolverCuenta,
  validateGasto,
} from './tools';

import type { ToolDeps } from './tools';

const CUENTAS = ['Efectivo', 'Davivienda Crédito', 'Nequi'];
const CATEGORIAS = ['MERCADO', 'TRANSPORTE', 'OTROS'];

describe('validateGasto', () => {
  it('acepta un gasto normal', () => {
    const r = validateGasto(
      { monto: 45000, descripcion: 'mercado', cuenta: 'Nequi' },
      CUENTAS,
    );
    expect(r.ok).toBe(true);
  });

  it('rechaza una cuenta que el usuario no tiene: el modelo no puede inventarlas', () => {
    const r = validateGasto(
      { monto: 45000, descripcion: 'x', cuenta: 'Bancolombia' },
      CUENTAS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Bancolombia');
  });

  it('acepta la cuenta sin importar mayúsculas ni tildes', () => {
    const r = validateGasto(
      { monto: 1000, descripcion: 'x', cuenta: 'davivienda credito' },
      CUENTAS,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cuenta).toBe('Davivienda Crédito');
  });

  it('rechaza montos sobre 100 millones: casi siempre es un typo tipo "999999k"', () => {
    const r = validateGasto({ monto: 200_000_000, descripcion: 'x' }, CUENTAS);
    expect(r.ok).toBe(false);
  });

  it('rechaza monto cero o negativo', () => {
    expect(validateGasto({ monto: 0, descripcion: 'x' }, CUENTAS).ok).toBe(
      false,
    );
    expect(validateGasto({ monto: -5, descripcion: 'x' }, CUENTAS).ok).toBe(
      false,
    );
  });

  it('rechaza descripción vacía', () => {
    expect(validateGasto({ monto: 1000, descripcion: '   ' }, CUENTAS).ok).toBe(
      false,
    );
  });

  it('rechaza una fecha con formato inválido', () => {
    const r = validateGasto(
      { monto: 1000, descripcion: 'x', fecha: '17/08/2026' },
      CUENTAS,
    );
    expect(r.ok).toBe(false);
  });
});

describe('resolverCuenta', () => {
  const CUENTAS_AMBIGUAS = ['Davivienda', 'DAVIVIENDA'];

  it('la coincidencia exacta gana aunque otra cuenta normalice igual', () => {
    const r = resolverCuenta('Davivienda', CUENTAS_AMBIGUAS);
    expect(r).toEqual({ kind: 'ok', cuenta: 'Davivienda' });
  });

  it('sin coincidencia exacta, usa la coincidencia normalizada única', () => {
    const r = resolverCuenta('davivienda credito', CUENTAS);
    expect(r).toEqual({ kind: 'ok', cuenta: 'Davivienda Crédito' });
  });

  it('si normaliza a más de una cuenta, no elige ninguna: es ambigua', () => {
    const r = resolverCuenta('davivienda', CUENTAS_AMBIGUAS);
    expect(r.kind).toBe('ambigua');
    if (r.kind === 'ambigua') {
      expect(r.candidatas).toEqual(['Davivienda', 'DAVIVIENDA']);
    }
  });
});

describe('validateGasto — ambigüedad de cuentas', () => {
  const CUENTAS_AMBIGUAS = ['Davivienda', 'DAVIVIENDA'];

  it('no elige ninguna cuenta ambigua, y el mensaje nombra las candidatas', () => {
    const r = validateGasto(
      { monto: 1000, descripcion: 'x', cuenta: 'davivienda' },
      CUENTAS_AMBIGUAS,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('Davivienda');
      expect(r.error).toContain('DAVIVIENDA');
    }
  });
});

describe('TOOL_DEFINITIONS', () => {
  it('expone las cuatro herramientas', () => {
    expect(TOOL_DEFINITIONS.map(t => t.name).sort()).toEqual([
      'consultar_gastos',
      'corregir_ultimo',
      'registrar_factura',
      'registrar_gasto',
    ]);
  });

  it('cada herramienta declara un input_schema de objeto', () => {
    for (const t of TOOL_DEFINITIONS) {
      expect(t.input_schema.type).toBe('object');
    }
  });

  it('corregir_ultimo declara los seis campos del spec, incluido item', () => {
    const corregir = TOOL_DEFINITIONS.find(t => t.name === 'corregir_ultimo');
    const campo = corregir?.input_schema.properties.campo as { enum: string[] };
    expect(campo.enum).toEqual([
      'monto',
      'descripcion',
      'cuenta',
      'categoria',
      'item',
      'fecha',
    ]);
  });

  it('consultar_gastos avisa que sin fechas la ventana es el mes en curso', () => {
    const consultar = TOOL_DEFINITIONS.find(t => t.name === 'consultar_gastos');
    expect(consultar?.description).toMatch(/mes en curso/i);
  });
});

function depsFalsas(over: Partial<ToolDeps> = {}): ToolDeps {
  return {
    accounts: CUENTAS,
    categories: CATEGORIAS,
    defaultAccount: 'Efectivo',
    today: () => '2026-08-17',
    createExpense: async () => ({
      ok: true,
      category: 'MERCADO',
      transactionId: 'tx-1',
    }),
    registerInvoice: async () => ({ ok: true, itemsFound: 3, totalItems: 3 }),
    correctLast: async () => ({ ok: true }),
    queryExpenses: async () => ({
      total: 412000,
      categoria: 'MERCADO',
      desde: '2026-08-01',
      hasta: '2026-08-17',
      mesEnCurso: true,
    }),
    onExpenseCreated: async () => {},
    ...over,
  };
}

describe('executeTool', () => {
  it('registra un gasto y avisa qué quedó guardado', async () => {
    const r = await executeTool(
      'registrar_gasto',
      { monto: 45000, descripcion: 'mercado' },
      depsFalsas(),
    );
    expect(r.ok).toBe(true);
    expect(r.summary).toContain('45000');
  });

  it('usa la cuenta por defecto si el modelo no mandó ninguna', async () => {
    let usada = '';
    const deps = depsFalsas({
      createExpense: async input => {
        usada = input.accountName;
        return { ok: true, category: 'MERCADO', transactionId: 'tx-1' };
      },
    });
    await executeTool(
      'registrar_gasto',
      { monto: 1000, descripcion: 'x' },
      deps,
    );
    expect(usada).toBe('Efectivo');
  });

  it('no escribe nada si la cuenta no existe y le explica al modelo', async () => {
    let escribio = false;
    const deps = depsFalsas({
      createExpense: async () => {
        escribio = true;
        return { ok: true, category: 'X', transactionId: 't' };
      },
    });
    const r = await executeTool(
      'registrar_gasto',
      { monto: 1000, descripcion: 'x', cuenta: 'Bancolombia' },
      deps,
    );
    expect(escribio).toBe(false);
    expect(r.ok).toBe(false);
    expect(r.summary).toContain('Bancolombia');
  });

  it('avisa al llamador del gasto creado, para poder disparar alertas después', async () => {
    let avisado = '';
    const deps = depsFalsas({
      onExpenseCreated: async cat => {
        avisado = cat;
      },
    });
    await executeTool(
      'registrar_gasto',
      { monto: 1000, descripcion: 'x' },
      deps,
    );
    expect(avisado).toBe('MERCADO');
  });

  it('devuelve un error legible si la herramienta no existe', async () => {
    const r = await executeTool('volar', {}, depsFalsas());
    expect(r.ok).toBe(false);
  });

  it('si onExpenseCreated lanza, igual devuelve ok:true: el gasto ya quedó guardado', async () => {
    const deps = depsFalsas({
      onExpenseCreated: async () => {
        throw new Error('boom');
      },
    });
    const r = await executeTool(
      'registrar_gasto',
      { monto: 1000, descripcion: 'x' },
      deps,
    );
    expect(r.ok).toBe(true);
  });

  describe('registrar_factura', () => {
    it('guarda la factura con una cuenta válida', async () => {
      const r = await executeTool(
        'registrar_factura',
        { cuenta: 'Nequi' },
        depsFalsas(),
      );
      expect(r.ok).toBe(true);
      expect(r.summary).toContain('Nequi');
    });

    it('no llama a registerInvoice si la cuenta no existe', async () => {
      let escribio = false;
      const deps = depsFalsas({
        registerInvoice: async () => {
          escribio = true;
          return { ok: true, itemsFound: 1, totalItems: 1 };
        },
      });
      const r = await executeTool(
        'registrar_factura',
        { cuenta: 'Bancolombia' },
        deps,
      );
      expect(escribio).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('Bancolombia');
    });

    it('no elige ninguna cuenta ambigua, no escribe, y el mensaje nombra las candidatas', async () => {
      let escribio = false;
      const deps = depsFalsas({
        accounts: ['Davivienda', 'DAVIVIENDA'],
        registerInvoice: async () => {
          escribio = true;
          return { ok: true, itemsFound: 1, totalItems: 1 };
        },
      });
      const r = await executeTool(
        'registrar_factura',
        { cuenta: 'davivienda' },
        deps,
      );
      expect(escribio).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('Davivienda');
      expect(r.summary).toContain('DAVIVIENDA');
    });

    it('fallo parcial: el resumen dice cuántos se guardaron, que ya son gastos reales y que cargue el resto a mano; no que no pasó nada ni que reenvíe', async () => {
      // Los ítems ya guardados son transacciones reales. Si el resumen dijera
      // "no se pudo guardar la factura" el modelo podría sugerirle al usuario
      // reenviar la foto, duplicando esos ítems.
      const deps = depsFalsas({
        registerInvoice: async () => ({
          ok: false,
          itemsFound: 2,
          totalItems: 5,
        }),
      });
      const r = await executeTool('registrar_factura', { cuenta: 'Nequi' }, deps);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('2');
      expect(r.summary).toContain('5');
      expect(r.summary).not.toMatch(/no se pudo guardar/i);
      expect(r.summary).toMatch(/no.*reenv/i);
      expect(r.userSummary).toContain('2');
      expect(r.userSummary).toContain('5');
      expect(r.userSummary).toMatch(/ya están en tus gastos|no se perdieron/i);
      expect(r.userSummary).toMatch(/mano en gastos/i);
      expect(r.userSummary).not.toMatch(/facturas sin completar/i);
    });
  });

  describe('corregir_ultimo', () => {
    it('corrige un campo que no es cuenta', async () => {
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'descripcion', valor: 'taxi' },
        depsFalsas(),
      );
      expect(r.ok).toBe(true);
      expect(r.summary).toContain('taxi');
    });

    it('corrige la cuenta con una cuenta válida', async () => {
      let corregidoA = '';
      const deps = depsFalsas({
        correctLast: async (_campo, valor) => {
          corregidoA = valor;
          return { ok: true };
        },
      });
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'cuenta', valor: 'nequi' },
        deps,
      );
      expect(r.ok).toBe(true);
      expect(corregidoA).toBe('Nequi');
    });

    it('no escribe una categoría que el usuario no tiene: quedaría fuera de todo reporte', async () => {
      // El silencio es lo grave: `category_name` acepta cualquier string, así
      // que una categoría inventada por el modelo se guardaba sin error y el
      // gasto desaparecía de los reportes.
      let escribio = false;
      const deps = depsFalsas({
        correctLast: async () => {
          escribio = true;
          return { ok: true };
        },
      });
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'categoria', valor: 'SUPERMERCADOS' },
        deps,
      );
      expect(escribio).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('MERCADO');
    });

    it('canonicaliza la categoría contra las reales (mayúsculas y tildes)', async () => {
      let corregidoA = '';
      const deps = depsFalsas({
        correctLast: async (_campo, valor) => {
          corregidoA = valor;
          return { ok: true };
        },
      });
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'categoria', valor: 'mercado' },
        deps,
      );
      expect(r.ok).toBe(true);
      expect(corregidoA).toBe('MERCADO');
    });

    it('acepta el campo item (el ítem del presupuesto, que el spec pide y faltaba)', async () => {
      let recibido: [string, string] = ['', ''];
      const deps = depsFalsas({
        correctLast: async (campo, valor) => {
          recibido = [campo, valor];
          return { ok: true };
        },
      });
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'item', valor: 'Mercado quincenal' },
        deps,
      );
      expect(r.ok).toBe(true);
      expect(recibido).toEqual(['item', 'Mercado quincenal']);
    });

    it('no escribe si la cuenta nueva es ambigua', async () => {
      let escribio = false;
      const deps = depsFalsas({
        accounts: ['Davivienda', 'DAVIVIENDA'],
        correctLast: async () => {
          escribio = true;
          return { ok: true };
        },
      });
      const r = await executeTool(
        'corregir_ultimo',
        { campo: 'cuenta', valor: 'davivienda' },
        deps,
      );
      expect(escribio).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('Davivienda');
      expect(r.summary).toContain('DAVIVIENDA');
    });
  });

  describe('consultar_gastos', () => {
    it('devuelve el total', async () => {
      const deps = depsFalsas({
        queryExpenses: async () => ({
          total: 999,
          desde: '2026-08-01',
          hasta: '2026-08-17',
          mesEnCurso: true,
        }),
      });
      const r = await executeTool('consultar_gastos', {}, deps);
      expect(r.ok).toBe(true);
      expect(r.summary).toContain('999');
    });

    it('el summary menciona la categoría cuando se pidió una', async () => {
      const deps = depsFalsas({
        queryExpenses: async () => ({
          total: 412000,
          categoria: 'MERCADO',
          desde: '2026-08-01',
          hasta: '2026-08-17',
          mesEnCurso: true,
        }),
      });
      const r = await executeTool(
        'consultar_gastos',
        { categoria: 'MERCADO' },
        deps,
      );
      expect(r.ok).toBe(true);
      expect(r.summary).toContain('MERCADO');
      expect(r.summary).toContain('412000');
    });

    it('el summary dice el período: un total sin ventana se lee como "este mes"', async () => {
      const deps = depsFalsas();
      const r = await executeTool(
        'consultar_gastos',
        { categoria: 'MERCADO' },
        deps,
      );
      expect(r.summary).toMatch(/este mes/i);
      // Y el texto para el usuario trae el monto formateado.
      expect(r.userSummary).toMatch(/412\.000/);
    });

    it('con fechas explícitas nombra el rango, no "este mes"', async () => {
      const deps = depsFalsas({
        queryExpenses: async () => ({
          total: 1000,
          desde: '2026-07-01',
          hasta: '2026-07-31',
          mesEnCurso: false,
        }),
      });
      const r = await executeTool(
        'consultar_gastos',
        { desde: '2026-07-01', hasta: '2026-07-31' },
        deps,
      );
      expect(r.summary).toContain('2026-07-01');
      expect(r.summary).not.toMatch(/este mes/i);
    });

    it('una categoría inventada no consulta nada: devolvería $0 y el usuario lo leería como "no gasté"', async () => {
      let consultado = false;
      const deps = depsFalsas({
        queryExpenses: async () => {
          consultado = true;
          return {
            total: 0,
            desde: '2026-08-01',
            hasta: '2026-08-17',
            mesEnCurso: true,
          };
        },
      });
      const r = await executeTool(
        'consultar_gastos',
        { categoria: 'SUPERMERCADOS' },
        deps,
      );
      expect(consultado).toBe(false);
      expect(r.ok).toBe(false);
      expect(r.summary).toContain('MERCADO');
    });
  });
});
