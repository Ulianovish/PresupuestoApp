import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/server';

import {
  createLinkCode,
  generateSixDigitCode,
  getLinkByPhone,
  listarDocumentosDeUsuario,
  MAX_CODE_ATTEMPTS,
  redeemLinkCode,
} from './whatsapp-links';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-09-30T12:00:00.000Z');
const NOW_ISO = '2026-09-30T12:00:00.000Z';
const now = () => NOW;

describe('generateSixDigitCode', () => {
  it('devuelve exactamente 6 dígitos', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSixDigitCode()).toMatch(/^\d{6}$/);
    }
  });
});

/** Tabla whatsapp_link_codes para createLinkCode: limpieza (delete) + inserts. */
function tablaCodigosNuevos(
  inserts: Array<{ error: unknown }>,
  limpieza: { error: unknown } = { error: null },
) {
  const insert = vi.fn();
  for (const r of inserts) insert.mockResolvedValueOnce(r);
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue(limpieza),
    insert,
  };
}

const CHOQUE = {
  error: {
    code: '23505',
    message: 'duplicate key value violates unique constraint',
  },
};

describe('createLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('antes de insertar borra los códigos vencidos y sin usar del propio usuario', async () => {
    const tabla = tablaCodigosNuevos([{ error: null }]);
    const from = vi.fn(() => tabla);
    mockedAdmin.mockReturnValue({ from });

    await createLinkCode('user-1', { now, generateCode: () => '111111' });

    expect(from).toHaveBeenCalledWith('whatsapp_link_codes');
    expect(tabla.delete).toHaveBeenCalled();
    expect(tabla.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(tabla.is).toHaveBeenCalledWith('used_at', null);
    expect(tabla.lte).toHaveBeenCalledWith('expires_at', NOW_ISO);
    expect(tabla.delete.mock.invocationCallOrder[0]).toBeLessThan(
      tabla.insert.mock.invocationCallOrder[0],
    );
  });

  it('inserta el código con vencimiento a 10 minutos del reloj inyectado', async () => {
    const tabla = tablaCodigosNuevos([{ error: null }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    const code = await createLinkCode('user-1', {
      now,
      generateCode: () => '111111',
    });

    expect(code).toBe('111111');
    expect(tabla.insert).toHaveBeenCalledWith({
      code: '111111',
      user_id: 'user-1',
      expires_at: '2026-09-30T12:10:00.000Z',
    });
  });

  it('si el código choca con otro pendiente (23505) reintenta con uno nuevo', async () => {
    const tabla = tablaCodigosNuevos([CHOQUE, { error: null }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });
    const generateCode = vi
      .fn()
      .mockReturnValueOnce('111111')
      .mockReturnValueOnce('222222');

    const code = await createLinkCode('user-1', { now, generateCode });

    expect(code).toBe('222222');
    expect(tabla.insert).toHaveBeenCalledTimes(2);
    expect(tabla.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: '222222' }),
    );
  });

  it('tras 5 choques seguidos lanza error', async () => {
    expect(MAX_CODE_ATTEMPTS).toBe(5);
    const tabla = tablaCodigosNuevos([CHOQUE, CHOQUE, CHOQUE, CHOQUE, CHOQUE]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    await expect(
      createLinkCode('user-1', { now, generateCode: () => '111111' }),
    ).rejects.toThrow('No se pudo crear el código');
    expect(tabla.insert).toHaveBeenCalledTimes(5);
  });

  it('un error que no es de código repetido lanza sin reintentar', async () => {
    const tabla = tablaCodigosNuevos([
      { error: { code: '42501', message: 'permission denied' } },
    ]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    await expect(
      createLinkCode('user-1', { now, generateCode: () => '111111' }),
    ).rejects.toThrow('No se pudo crear el código');
    expect(tabla.insert).toHaveBeenCalledTimes(1);
  });

  it('si la limpieza falla igual crea el código y loguea solo el código de error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tabla = tablaCodigosNuevos([{ error: null }], {
      error: { code: 'XX000', message: 'boom' },
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    const code = await createLinkCode('user-1', {
      now,
      generateCode: () => '111111',
    });

    expect(code).toBe('111111');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('createLinkCode'),
      'XX000',
    );
    errorSpy.mockRestore();
  });
});

/** Tabla whatsapp_links: lectura del vínculo previo + upsert. */
function tablaLinks(previo: { data: unknown; error: unknown }) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    upsert,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(previo),
  };
}

function codigoValido(userId = 'user-1') {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    select: vi
      .fn()
      .mockResolvedValue({ data: [{ user_id: userId }], error: null }),
  };
}

describe('redeemLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('re-vincular el número a OTRO usuario borra el documento del dueño anterior', async () => {
    const links = tablaLinks({ data: { user_id: 'otro' }, error: null });
    const from = vi.fn((table: string) =>
      table === 'whatsapp_link_codes' ? codigoValido() : links,
    );
    mockedAdmin.mockReturnValue({ from });

    await redeemLinkCode('482913', '+573001234567');

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: '+573001234567', user_id: 'user-1', documento: null },
      { onConflict: 'phone_e164' },
    );
  });

  it('re-vincular al MISMO usuario conserva el documento', async () => {
    const links = tablaLinks({ data: { user_id: 'user-1' }, error: null });
    const from = vi.fn((table: string) =>
      table === 'whatsapp_link_codes' ? codigoValido() : links,
    );
    mockedAdmin.mockReturnValue({ from });

    await redeemLinkCode('482913', '+573001234567');

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: '+573001234567', user_id: 'user-1' },
      { onConflict: 'phone_e164' },
    );
  });

  it('si no se puede leer el vínculo previo, borra el documento (ante la duda, no se hereda)', async () => {
    const links = tablaLinks({ data: null, error: { message: 'boom' } });
    const from = vi.fn((table: string) =>
      table === 'whatsapp_link_codes' ? codigoValido() : links,
    );
    mockedAdmin.mockReturnValue({ from });

    await redeemLinkCode('482913', '+573001234567');

    expect(links.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ documento: null }),
      { onConflict: 'phone_e164' },
    );
  });

  it('canjea con UPDATE atómico condicional: marca usado, upserta y devuelve userId', async () => {
    const links = tablaLinks({ data: null, error: null });
    const upsert = links.upsert;
    // Cadena del UPDATE atómico: update().eq().is().gt().select() → {data:[{user_id}]}
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      select: vi
        .fn()
        .mockResolvedValue({ data: [{ user_id: 'user-1' }], error: null }),
    };
    const from = vi.fn((table: string) => {
      if (table === 'whatsapp_link_codes') return updateChain;
      if (table === 'whatsapp_links') return links;
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
    // Número nuevo: el documento arranca vacío.
    expect(upsert).toHaveBeenCalledWith(
      { phone_e164: '+573001234567', user_id: 'user-1', documento: null },
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
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { user_id: 'user-9' } });
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

describe('listarDocumentosDeUsuario', () => {
  beforeEach(() => vi.clearAllMocks());

  function clienteCon(resultado: { data: unknown; error: unknown }) {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue(resultado),
    };
    return { client: { from: vi.fn(() => chain) }, chain };
  }

  it('devuelve número y documento de cada link del usuario (filtra por user_id)', async () => {
    const { client, chain } = clienteCon({
      data: [
        { phone_e164: '+573000000001', documento: '1000000001' },
        { phone_e164: '+573000000002', documento: null },
      ],
      error: null,
    });

    const out = await listarDocumentosDeUsuario('user-1', client as never);

    expect(out).toEqual([
      { phone_e164: '+573000000001', documento: '1000000001' },
      { phone_e164: '+573000000002', documento: null },
    ]);
    expect(client.from).toHaveBeenCalledWith('whatsapp_links');
    expect(chain.select).toHaveBeenCalledWith('phone_e164, documento');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mockedAdmin).not.toHaveBeenCalled();
  });

  it('sin cliente usa el service-role (el webhook corre sin sesión)', async () => {
    const { client } = clienteCon({ data: [], error: null });
    mockedAdmin.mockReturnValue(client);

    expect(await listarDocumentosDeUsuario('user-1')).toEqual([]);
    expect(mockedAdmin).toHaveBeenCalled();
  });

  it('best-effort: si la consulta falla (p. ej. la columna aún no existe) devuelve [] sin lanzar', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clienteCon({
      data: null,
      error: { message: 'column whatsapp_links.documento does not exist' },
    });

    expect(await listarDocumentosDeUsuario('user-1', client as never)).toEqual(
      [],
    );
    errorSpy.mockRestore();
  });
});
