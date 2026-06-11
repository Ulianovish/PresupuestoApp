import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/server';

import {
  generateSixDigitCode,
  getLinkByPhone,
  redeemLinkCode,
} from './whatsapp-links';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

describe('generateSixDigitCode', () => {
  it('devuelve exactamente 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSixDigitCode()).toMatch(/^\d{6}$/);
    }
  });
});

describe('redeemLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canjea con UPDATE atómico condicional: marca usado, upserta y devuelve userId', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    // Cadena del UPDATE atómico: update().eq().is().gt().select() → {data:[{user_id}]}
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_link_codes') return updateChain;
      if (table === 'whatsapp_links') return { upsert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from });

    const res = await redeemLinkCode('482913', '+573001234567');

    expect(res).toEqual({ ok: true, userId: 'user-1' });
    // El UPDATE filtra por código sin usar y vigente (un solo statement atómico).
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ used_at: expect.any(String) }),
    );
    expect(updateChain.is).toHaveBeenCalledWith('used_at', null);
    expect(upsert).toHaveBeenCalledWith(
      { phone_e164: '+573001234567', user_id: 'user-1' },
      { onConflict: 'phone_e164' },
    );
  });

  it('rechaza un código inexistente/expirado (UPDATE no afecta filas) sin upsertar', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_link_codes') return updateChain;
      if (table === 'whatsapp_links') return { upsert };
      throw new Error(`tabla inesperada ${table}`);
    });
    mockedAdmin.mockReturnValue({ from });

    const res = await redeemLinkCode('000000', '+573001234567');

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('getLinkByPhone', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve userId si el número está vinculado', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { user_id: 'user-9' } });
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    }));
    mockedAdmin.mockReturnValue({ from });

    expect(await getLinkByPhone('+573001234567')).toEqual({ userId: 'user-9' });
  });

  it('devuelve null si no está vinculado', async () => {
    const from = vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    }));
    mockedAdmin.mockReturnValue({ from });

    expect(await getLinkByPhone('+573009999999')).toBeNull();
  });
});
