import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/budget/alerts', () => ({
  dispararAlertas: vi.fn(),
}));
vi.mock('@/lib/budget/alerts-supabase', () => ({
  alertDepsSupabase: vi.fn(),
}));

import { dispararAlertas } from '@/lib/budget/alerts';
import { alertDepsSupabase } from '@/lib/budget/alerts-supabase';

import { dispararAlertasWhatsapp, pegarAlertas } from './alerts';

const mockedDispararAlertas = vi.mocked(dispararAlertas);
const mockedAlertDepsSupabase = vi.mocked(alertDepsSupabase);

describe('dispararAlertasWhatsapp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAlertDepsSupabase.mockReturnValue(
      {} as unknown as ReturnType<typeof alertDepsSupabase>,
    );
  });

  it('sin rubros, ni siquiera toca Supabase', async () => {
    const msgs = await dispararAlertasWhatsapp('u1', [], '2026-08');
    expect(msgs).toEqual([]);
    expect(mockedDispararAlertas).not.toHaveBeenCalled();
  });

  it('le pasa a dispararAlertas EXACTAMENTE el mes que le mandó el llamador, no el de hoy', async () => {
    // El hallazgo crítico que motivó este archivo: el mes tiene que viajar
    // desde el llamador (que conoce la fecha real del gasto o de la
    // factura), nunca resolverse acá adentro con la fecha de hoy — si no,
    // una factura de otro mes compara contra rubros que no son los suyos y
    // la alerta no dispara nunca, en silencio.
    mockedDispararAlertas.mockResolvedValue(['⚠️ alerta']);
    const msgs = await dispararAlertasWhatsapp('u1', ['item-1'], '2026-07');
    expect(msgs).toEqual(['⚠️ alerta']);
    expect(mockedDispararAlertas).toHaveBeenCalledWith(expect.anything(), {
      userId: 'u1',
      monthYear: '2026-07',
      budgetItemIds: ['item-1'],
      hoy: expect.any(Date),
    });
  });
});

describe('pegarAlertas', () => {
  it('sin alertas, devuelve el texto base sin tocar', () => {
    expect(pegarAlertas('✅ Listo.', [])).toBe('✅ Listo.');
  });

  it('con una alerta, la pega al final separada por línea en blanco', () => {
    expect(pegarAlertas('✅ Listo.', ['⚠️ Vas en 82%.'])).toBe(
      '✅ Listo.\n\n⚠️ Vas en 82%.',
    );
  });

  it('con varias alertas, las junta todas separadas entre sí', () => {
    expect(pegarAlertas('✅ Listo.', ['⚠️ Uno.', '🔴 Dos.'])).toBe(
      '✅ Listo.\n\n⚠️ Uno.\n\n🔴 Dos.',
    );
  });
});
