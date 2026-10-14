import { describe, it, expect } from 'vitest';

import { avanceDeCategoria } from './avance';

describe('avanceDeCategoria', () => {
  it('la mitad del presupuesto llena medio anillo', () => {
    const a = avanceDeCategoria(1_000_000, 500_000);
    expect(a.porcentaje).toBe(50);
    expect(a.relleno).toBe(50);
    expect(a.etiqueta).toBe('50%');
    expect(a.estado).toBe('holgado');
  });

  it('cerca del límite avisa', () => {
    expect(avanceDeCategoria(1_000_000, 850_000).estado).toBe('cerca');
  });

  it('un exceso llena el anillo pero el número dice la verdad', () => {
    const a = avanceDeCategoria(100_000, 215_000);
    expect(a.relleno).toBe(100);
    expect(a.etiqueta).toBe('215%');
    expect(a.estado).toBe('excedido');
  });

  it('sin presupuesto no inventa un porcentaje', () => {
    const a = avanceDeCategoria(0, 44_000);
    expect(a.porcentaje).toBeNull();
    expect(a.relleno).toBe(0);
    expect(a.etiqueta).toBe('—');
  });

  it('sin gasto el anillo queda vacío', () => {
    const a = avanceDeCategoria(500_000, 0);
    expect(a.relleno).toBe(0);
    expect(a.etiqueta).toBe('0%');
    expect(a.estado).toBe('sin-gasto');
  });

  it('redondea el número del centro', () => {
    expect(avanceDeCategoria(3, 1).etiqueta).toBe('33%');
  });
});
