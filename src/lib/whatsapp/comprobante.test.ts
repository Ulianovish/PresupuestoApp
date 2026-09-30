import { describe, expect, it } from 'vitest';

import {
  conceptoDesdeTexto,
  describirTransferencia,
  formatFechaCorta,
  sanearFechaComprobante,
} from './comprobante';

const CUENTAS = ['Efectivo', 'Nequi', 'Davivienda Crédito'];

describe('conceptoDesdeTexto', () => {
  it('quita la mención de la cuenta: "Huevos con nequi" → "Huevos"', () => {
    expect(conceptoDesdeTexto('Huevos con nequi', CUENTAS)).toBe('Huevos');
  });

  it('deja intacto un texto sin cuenta: "Cena afuera"', () => {
    expect(conceptoDesdeTexto('Cena afuera', CUENTAS)).toBe('Cena afuera');
  });

  it('quita "pagué con la <banco>" aunque el banco no sea una cuenta del usuario', () => {
    expect(
      conceptoDesdeTexto('Mercado pagué con la Bancolombia', CUENTAS),
    ).toBe('Mercado');
  });

  it('quita la cuenta con varias palabras ("con la Davivienda Crédito")', () => {
    expect(
      conceptoDesdeTexto('almuerzo con la Davivienda Crédito', CUENTAS),
    ).toBe('Almuerzo');
  });

  it('no confunde "con <persona>" con una cuenta', () => {
    expect(conceptoDesdeTexto('Almuerzo con Juan', CUENTAS)).toBe(
      'Almuerzo con Juan',
    );
  });

  it('quita montos y muletillas: "Compré huevos 9.000 con nequi" → "Huevos"', () => {
    expect(conceptoDesdeTexto('Compré huevos 9.000 con nequi', CUENTAS)).toBe(
      'Huevos',
    );
  });

  it('solo cuenta (o vacío) → null, para caer a lo que leyó la visión', () => {
    expect(conceptoDesdeTexto('fue con la Nequi', CUENTAS)).toBeNull();
    expect(conceptoDesdeTexto('con davivienda', CUENTAS)).toBeNull();
    expect(conceptoDesdeTexto('', CUENTAS)).toBeNull();
    expect(conceptoDesdeTexto('   ', CUENTAS)).toBeNull();
  });

  it.each([
    'Subela a gastos', // caso real: quedó como descripción del gasto
    'súbela a gastos',
    'anota esto',
    'Anótalo porfa',
    'regístralo',
    'guárdalo',
    'agrega esto',
    'ahí va',
    'Registra este gasto',
    'guárdalo con nequi',
  ])('una instrucción no es un concepto: %j → null', texto => {
    expect(conceptoDesdeTexto(texto, CUENTAS)).toBeNull();
  });

  it('una instrucción junto a un concepto deja el concepto intacto', () => {
    expect(conceptoDesdeTexto('Huevos', CUENTAS)).toBe('Huevos');
    expect(conceptoDesdeTexto('Almuerzo con Juan', CUENTAS)).toBe(
      'Almuerzo con Juan',
    );
  });
});

describe('describirTransferencia', () => {
  it('el texto del usuario le gana a lo que leyó la visión', () => {
    expect(
      describirTransferencia(
        'Huevos con nequi',
        { concept: 'Pago', recipient: 'Persona Ejemplo Dos' },
        CUENTAS,
      ),
    ).toBe('Huevos');
  });

  it('sin texto → el concepto de la visión (limpio de cuenta)', () => {
    expect(
      describirTransferencia(
        '',
        { concept: 'Cena afuera con nequi', recipient: 'Persona Ejemplo Tres' },
        CUENTAS,
      ),
    ).toBe('Cena afuera');
  });

  it('sin texto ni concepto → el destinatario', () => {
    expect(
      describirTransferencia(
        '',
        { concept: null, recipient: 'Persona Ejemplo Dos' },
        CUENTAS,
      ),
    ).toBe('Persona Ejemplo Dos');
  });

  it('un pie de foto que es una instrucción cae al concepto de la visión', () => {
    expect(
      describirTransferencia(
        'Subela a gastos',
        { concept: 'Arriendo septiembre', recipient: 'Persona Ejemplo Uno' },
        CUENTAS,
      ),
    ).toBe('Arriendo septiembre');
    expect(
      describirTransferencia(
        'anota esto',
        { concept: null, recipient: 'Persona Ejemplo Uno' },
        CUENTAS,
      ),
    ).toBe('Persona Ejemplo Uno');
  });

  it('sin nada → "Transferencia"', () => {
    expect(
      describirTransferencia(
        'con nequi',
        { concept: null, recipient: '  ' },
        CUENTAS,
      ),
    ).toBe('Transferencia');
  });
});

describe('sanearFechaComprobante', () => {
  const HOY = '2026-09-28';

  it('fecha normal (reciente) → se respeta', () => {
    expect(sanearFechaComprobante('2026-09-20', HOY)).toEqual({
      fecha: '2026-09-20',
      descartada: null,
    });
  });

  it('justo 60 días atrás → se respeta', () => {
    expect(sanearFechaComprobante('2026-07-30', HOY)).toEqual({
      fecha: '2026-07-30',
      descartada: null,
    });
  });

  it('más de 60 días atrás → hoy, y se informa la descartada', () => {
    expect(sanearFechaComprobante('2025-04-09', HOY)).toEqual({
      fecha: HOY,
      descartada: '2025-04-09',
    });
    expect(sanearFechaComprobante('2026-07-29', HOY)).toEqual({
      fecha: HOY,
      descartada: '2026-07-29',
    });
  });

  it('en el futuro (p. ej. una fecha de vencimiento) → hoy', () => {
    expect(sanearFechaComprobante('2026-10-09', HOY)).toEqual({
      fecha: HOY,
      descartada: '2026-10-09',
    });
  });

  it('hoy → se respeta', () => {
    expect(sanearFechaComprobante(HOY, HOY)).toEqual({
      fecha: HOY,
      descartada: null,
    });
  });

  it.each(['2026-02-31', '2026-09-31', '2026-13-01', '2026-00-10', 'ayer'])(
    'fecha imposible o ilegible %j → hoy, y se informa',
    imposible => {
      expect(sanearFechaComprobante(imposible, HOY)).toEqual({
        fecha: HOY,
        descartada: imposible,
      });
    },
  );

  it('"31 de febrero" pocos días antes de hoy no pasa por reciente (Date.UTC lo corría a marzo)', () => {
    expect(sanearFechaComprobante('2026-02-31', '2026-03-05')).toEqual({
      fecha: '2026-03-05',
      descartada: '2026-02-31',
    });
    expect(sanearFechaComprobante('2026-02-28', '2026-03-05')).toEqual({
      fecha: '2026-02-28',
      descartada: null,
    });
  });

  it('sin fecha → hoy, sin aviso (no había nada que descartar)', () => {
    expect(sanearFechaComprobante(null, HOY)).toEqual({
      fecha: HOY,
      descartada: null,
    });
  });
});

describe('formatFechaCorta', () => {
  it('"2025-04-09" → "9 abr 2025"', () => {
    expect(formatFechaCorta('2025-04-09')).toBe('9 abr 2025');
    expect(formatFechaCorta('2026-12-31')).toBe('31 dic 2026');
  });

  it('una fecha ilegible se muestra tal cual (no "1 undefined 2026")', () => {
    expect(formatFechaCorta('2026-13-01')).toBe('2026-13-01');
    expect(formatFechaCorta('ayer')).toBe('ayer');
  });
});
