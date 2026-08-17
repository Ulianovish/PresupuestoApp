import { describe, it, expect } from 'vitest';

import { TOOL_DEFINITIONS, resolverCuenta, validateGasto } from './tools';

const CUENTAS = ['Efectivo', 'Davivienda Crédito', 'Nequi'];

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
});
