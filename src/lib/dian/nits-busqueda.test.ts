import { describe, expect, it } from 'vitest';

import {
  MAX_NITS_BUSQUEDA,
  ordenarNitsBusqueda,
  separarDocumentosPorRemitente,
  validarDocumento,
} from './nits-busqueda';

describe('ordenarNitsBusqueda', () => {
  it('orden: NitFac y DocAdq del QR, documento del remitente, documentos de los otros números', () => {
    expect(
      ordenarNitsBusqueda({
        qrNits: ['900000001', '1000000001'],
        docRemitente: '1000000002',
        docsOtros: ['1000000003'],
      }),
    ).toEqual(['900000001', '1000000001', '1000000002', '1000000003']);
  });

  it('sin QR (CUFE pelado) → solo los documentos de los números, remitente primero', () => {
    expect(
      ordenarNitsBusqueda({
        qrNits: [],
        docRemitente: '1000000002',
        docsOtros: ['1000000003'],
      }),
    ).toEqual(['1000000002', '1000000003']);
  });

  it('deduplica conservando la primera aparición', () => {
    expect(
      ordenarNitsBusqueda({
        qrNits: ['900000001', '1000000002'],
        docRemitente: '1000000002',
        docsOtros: ['1000000003', '900000001', '1000000003'],
      }),
    ).toEqual(['900000001', '1000000002', '1000000003']);
  });

  it(`nunca manda más de ${MAX_NITS_BUSQUEDA} (el tope del regex de los scrapers)`, () => {
    const out = ordenarNitsBusqueda({
      qrNits: ['900000001', '900000002'],
      docRemitente: '1000000001',
      docsOtros: ['1000000002', '1000000003', '1000000004', '1000000005'],
    });
    expect(out).toEqual([
      '900000001',
      '900000002',
      '1000000001',
      '1000000002',
      '1000000003',
    ]);
    expect(MAX_NITS_BUSQUEDA).toBe(5);
  });

  it('sin nada que probar → [] (el motor no manda un `nits=` vacío)', () => {
    expect(
      ordenarNitsBusqueda({ qrNits: [], docRemitente: null, docsOtros: [] }),
    ).toEqual([]);
  });

  it('descarta valores mal formados y los genéricos (los scrapers ya los prueban solos)', () => {
    expect(
      ordenarNitsBusqueda({
        qrNits: ['', '12a45', '1234'],
        docRemitente: '222222222222',
        docsOtros: [' ', '2222222222', '1000000003', '1234567890123456'],
      }),
    ).toEqual(['1000000003']);
  });

  it('acepta docsOtros con null (números sin documento cargado)', () => {
    expect(
      ordenarNitsBusqueda({
        qrNits: [],
        docRemitente: null,
        docsOtros: [null, '1000000003', null],
      }),
    ).toEqual(['1000000003']);
  });
});

describe('separarDocumentosPorRemitente', () => {
  const links = [
    { phone_e164: '+573000000001', documento: '1000000001' },
    { phone_e164: '+573000000002', documento: '1000000002' },
    { phone_e164: '+573000000003', documento: null },
  ];

  it('separa el documento del número que escribió del de los otros', () => {
    expect(separarDocumentosPorRemitente(links, '+573000000002')).toEqual({
      docRemitente: '1000000002',
      docsOtros: ['1000000001'],
    });
  });

  it('remitente sin documento → docRemitente null, los otros igual se usan', () => {
    expect(separarDocumentosPorRemitente(links, '+573000000003')).toEqual({
      docRemitente: null,
      docsOtros: ['1000000001', '1000000002'],
    });
  });

  it('sin números → todo vacío', () => {
    expect(separarDocumentosPorRemitente([], '+573000000001')).toEqual({
      docRemitente: null,
      docsOtros: [],
    });
  });
});

describe('validarDocumento', () => {
  it('acepta solo dígitos, de 5 a 15', () => {
    expect(validarDocumento('1000000001')).toEqual({
      ok: true,
      documento: '1000000001',
    });
    expect(validarDocumento('12345')).toEqual({ ok: true, documento: '12345' });
    expect(validarDocumento('123456789012345')).toEqual({
      ok: true,
      documento: '123456789012345',
    });
  });

  it('tolera espacios y puntos de miles (se escribe "1.000.000.001")', () => {
    expect(validarDocumento(' 1.000.000.001 ')).toEqual({
      ok: true,
      documento: '1000000001',
    });
  });

  it('vacío → null (borra el documento)', () => {
    expect(validarDocumento('')).toEqual({ ok: true, documento: null });
    expect(validarDocumento('   ')).toEqual({ ok: true, documento: null });
    expect(validarDocumento(null)).toEqual({ ok: true, documento: null });
  });

  it('rechaza letras, guion y largos fuera de rango con un mensaje en español', () => {
    for (const malo of [
      '1234',
      '1234567890123456',
      '10000000a1',
      '900000001-7',
    ]) {
      const r = validarDocumento(malo);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/entre 5 y 15 dígitos/);
    }
  });
});
