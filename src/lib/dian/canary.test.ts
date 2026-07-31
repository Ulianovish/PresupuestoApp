import { describe, it, expect } from 'vitest';

import { construirAlerta, type ResultadoMotor } from './canary';

const CUFE = 'a'.repeat(96);

describe('construirAlerta', () => {
  it('calla cuando todos los motores pasan', () => {
    const motores: ResultadoMotor[] = [
      { motor: 'VPS', ok: true, segundos: 74, items: 15 },
      { motor: 'Vercel', ok: true, segundos: 53, items: 15 },
    ];
    expect(construirAlerta(CUFE, motores)).toBeNull();
  });

  it('avisa y aclara que el otro motor sigue bien cuando falla uno solo', () => {
    const motores: ResultadoMotor[] = [
      { motor: 'VPS', ok: false, segundos: 12, error: 'VPS respondió 502' },
      { motor: 'Vercel', ok: true, segundos: 53, items: 15 },
    ];
    const alerta = construirAlerta(CUFE, motores);
    expect(alerta).toContain('VPS');
    expect(alerta).toContain('el resto sigue bien');
    expect(alerta).toContain('502');
    expect(alerta).toContain('✅ Vercel');
  });

  it('escala el aviso cuando caen todos', () => {
    const motores: ResultadoMotor[] = [
      { motor: 'VPS', ok: false, segundos: 48, error: 'NIT rechazado' },
      { motor: 'Vercel', ok: false, segundos: 60, error: 'NIT rechazado' },
    ];
    const alerta = construirAlerta(CUFE, motores);
    expect(alerta).toContain('TODOS');
  });

  it('trata "responde pero sin ítems" como falla: la extracción está rota', () => {
    const motores: ResultadoMotor[] = [
      { motor: 'VPS', ok: false, segundos: 70, items: 0, error: 'respondió sin ítems' },
    ];
    expect(construirAlerta(CUFE, motores)).toContain('sin ítems');
  });
});
