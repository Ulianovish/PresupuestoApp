import { describe, it, expect } from 'vitest';

import { filtrarNombres, normalizar } from './sugerencias-nombre';

const NOMBRES = [
  'Embutidos',
  'Emergencias',
  'Lacteos',
  'Pan de la semana',
  'Verduras y frutas',
];

describe('normalizar', () => {
  it('quita tildes, baja a minúscula y recorta', () => {
    expect(normalizar('  Lácteos ')).toBe('lacteos');
  });
});

describe('filtrarNombres', () => {
  it('sin texto muestra lo que ya existe', () => {
    expect(filtrarNombres(NOMBRES, '')).toEqual(NOMBRES);
  });

  it('recorta al máximo pedido', () => {
    expect(filtrarNombres(NOMBRES, '', 2)).toEqual([
      'Embutidos',
      'Emergencias',
    ]);
  });

  it('filtra por lo escrito', () => {
    expect(filtrarNombres(NOMBRES, 'Emb')).toEqual(['Embutidos']);
  });

  it('los que empiezan por el texto van antes que los que lo contienen', () => {
    expect(filtrarNombres(['Pan tajado', 'Compañía', 'Panela'], 'pan')).toEqual(
      ['Pan tajado', 'Panela', 'Compañía'],
    );
  });

  it('ignora tildes y mayúsculas', () => {
    expect(filtrarNombres(NOMBRES, 'LACTE')).toEqual(['Lacteos']);
    expect(filtrarNombres(['Lácteos'], 'LACT')).toEqual(['Lácteos']);
  });

  it('no sugiere el nombre que ya está escrito completo', () => {
    expect(filtrarNombres(NOMBRES, 'Embutidos')).toEqual([]);
  });

  it('no repite nombres que solo difieren en tildes o mayúsculas', () => {
    expect(filtrarNombres(['Lácteos', 'lacteos', 'LACTEOS'], 'lac')).toEqual([
      'Lácteos',
    ]);
  });

  it('descarta nombres vacíos', () => {
    expect(filtrarNombres(['', '   ', 'Aseo'], '')).toEqual(['Aseo']);
  });
});
