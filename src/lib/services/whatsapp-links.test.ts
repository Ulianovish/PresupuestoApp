import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/server';

import {
  createLinkCode,
  generateSixDigitCode,
  getLinkByPhone,
  isOverLinkAttemptLimit,
  LINK_ATTEMPTS_WINDOW_MINUTES,
  LINK_MAX_FAILED_ATTEMPTS,
  linkAttemptsWindowStart,
  listarDocumentosDeUsuario,
  MAX_CODE_ATTEMPTS,
  redeemLinkCode,
  releaseLinkAttempt,
  reserveLinkAttempt,
} from './whatsapp-links';

const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;

const NOW = new Date('2026-09-30T12:00:00.000Z');
const NOW_ISO = '2026-09-30T12:00:00.000Z';
const now = () => NOW;
const TEL = '+573000000000';

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
function tablaLinks(
  previo: { data: unknown; error: unknown },
  upsertResult: { error: unknown } = { error: null },
) {
  return {
    upsert: vi.fn().mockResolvedValue(upsertResult),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(previo),
  };
}

/** Tabla whatsapp_link_codes para el canje: update().eq().is().gt().select(). */
function tablaCanje(resultado: { data: unknown; error: unknown }) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resultado),
  };
}

function codigoValido(userId = 'user-1') {
  return tablaCanje({ data: [{ user_id: userId }], error: null });
}

/** Tabla whatsapp_conversations: delete().eq().neq(). */
function tablaConversaciones(resultado: { error: unknown } = { error: null }) {
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockResolvedValue(resultado),
  };
}

/** Cliente con solo las tablas dadas; pedir cualquier otra hace fallar el test. */
function clienteCanje(tablas: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    if (table in tablas) return tablas[table];
    throw new Error(`tabla inesperada ${table}`);
  });
  mockedAdmin.mockReturnValue({ from });
  return from;
}

describe('redeemLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canjea con UPDATE atómico condicional según el reloj inyectado y devuelve userId', async () => {
    const codigos = codigoValido();
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigos,
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: true, userId: 'user-1' });
    // Un solo statement: marca usado SOLO si está sin usar y vigente.
    expect(codigos.update).toHaveBeenCalledWith({ used_at: NOW_ISO });
    expect(codigos.eq).toHaveBeenCalledWith('code', '482913');
    expect(codigos.is).toHaveBeenCalledWith('used_at', null);
    expect(codigos.gt).toHaveBeenCalledWith('expires_at', NOW_ISO);
    // Número nuevo: el documento arranca vacío.
    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1', documento: null },
      { onConflict: 'phone_e164' },
    );
  });

  it('re-vincular el número a OTRO usuario borra el documento del dueño anterior', async () => {
    const links = tablaLinks({ data: { user_id: 'otro' }, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1', documento: null },
      { onConflict: 'phone_e164' },
    );
  });

  it('re-vincular al MISMO usuario conserva el documento', async () => {
    const links = tablaLinks({ data: { user_id: 'user-1' }, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1' },
      { onConflict: 'phone_e164' },
    );
  });

  it('si no se puede leer el vínculo previo, borra el documento (ante la duda, no se hereda)', async () => {
    const links = tablaLinks({ data: null, error: { message: 'boom' } });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ documento: null }),
      { onConflict: 'phone_e164' },
    );
  });

  it('borra la conversación del número que era de OTRO usuario, antes de vincular', async () => {
    const conversaciones = tablaConversaciones();
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: conversaciones,
    });

    await redeemLinkCode('482913', TEL, now);

    expect(conversaciones.delete).toHaveBeenCalled();
    expect(conversaciones.eq).toHaveBeenCalledWith('phone_e164', TEL);
    // Solo la de otro dueño: si el dueño es el mismo, la conversación sigue.
    expect(conversaciones.neq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(conversaciones.delete.mock.invocationCallOrder[0]).toBeLessThan(
      links.upsert.mock.invocationCallOrder[0],
    );
  });

  it('si no se puede borrar la conversación ajena, no vincula (link_failed) y no loguea el número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones({
        error: { code: 'XX000', message: 'boom' },
      }),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
    expect(links.upsert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('redeemLinkCode'),
      'XX000',
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(TEL);
    errorSpy.mockRestore();
  });

  it('rechaza un código inexistente/vencido (UPDATE sin filas) sin tocar vínculos ni conversaciones', async () => {
    const links = tablaLinks({ data: null, error: null });
    const from = clienteCanje({
      whatsapp_link_codes: tablaCanje({ data: [], error: null }),
      whatsapp_links: links,
    });

    const res = await redeemLinkCode('000000', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(links.upsert).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('whatsapp_conversations');
  });

  it('código ya canjeado hace poco para el MISMO vínculo del número (reintento de Twilio) → already_redeemed_same_link', async () => {
    const canje = consulta({ data: [], error: null });
    const vinculo = consulta({ data: { user_id: 'user-1' }, error: null });
    const reciente = consulta({ data: [{ code: '482913' }], error: null });
    const from = clienteIntentos(canje, vinculo, reciente);

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'already_redeemed_same_link' });
    expect(from).toHaveBeenNthCalledWith(2, 'whatsapp_links');
    expect(vinculo.eq).toHaveBeenCalledWith('phone_e164', TEL);
    expect(from).toHaveBeenNthCalledWith(3, 'whatsapp_link_codes');
    // Solo ese código, del dueño del vínculo y canjeado en los últimos 2 min.
    expect(reciente.eq).toHaveBeenCalledWith('code', '482913');
    expect(reciente.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(reciente.gte).toHaveBeenCalledWith(
      'used_at',
      '2026-09-30T11:58:00.000Z',
    );
  });

  it('número vinculado + código que no se canjeó para su vínculo (ajeno o inexistente) → invalid_or_expired', async () => {
    const from = clienteIntentos(
      consulta({ data: [], error: null }),
      consulta({ data: { user_id: 'user-1' }, error: null }),
      consulta({ data: [], error: null }),
    );

    const res = await redeemLinkCode('999999', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it('número sin vínculo + código inválido → invalid_or_expired sin buscar canjes recientes', async () => {
    const from = clienteIntentos(
      consulta({ data: [], error: null }),
      consulta({ data: null, error: null }),
    );

    const res = await redeemLinkCode('999999', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('si falla la búsqueda del vínculo o del canje reciente, el intento sigue siendo invalid_or_expired', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteIntentos(
      consulta({ data: [], error: null }),
      consulta({ data: null, error: { code: 'XX000', message: 'boom' } }),
    );
    expect(await redeemLinkCode('482913', TEL, now)).toEqual({
      ok: false,
      reason: 'invalid_or_expired',
    });

    clienteIntentos(
      consulta({ data: [], error: null }),
      consulta({ data: { user_id: 'user-1' }, error: null }),
      consulta({ data: null, error: { code: 'XX000', message: 'boom' } }),
    );
    expect(await redeemLinkCode('482913', TEL, now)).toEqual({
      ok: false,
      reason: 'invalid_or_expired',
    });
    errorSpy.mockRestore();
  });

  it('un error de base en el UPDATE es link_failed (no es culpa del número)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteCanje({
      whatsapp_link_codes: tablaCanje({
        data: null,
        error: { code: '57014', message: 'canceling statement due to timeout' },
      }),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('482913');
    errorSpy.mockRestore();
  });

  it('si no se puede borrar la conversación ajena, libera el código para reintentarlo', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const codigos = codigoValido();
    clienteCanje({
      whatsapp_link_codes: codigos,
      whatsapp_links: tablaLinks({ data: null, error: null }),
      whatsapp_conversations: tablaConversaciones({
        error: { code: 'XX000', message: 'boom' },
      }),
    });

    await redeemLinkCode('482913', TEL, now);

    // Segundo UPDATE: vuelve used_at a NULL solo si lo marcó este canje.
    expect(codigos.update).toHaveBeenLastCalledWith({ used_at: null });
    expect(codigos.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(codigos.eq).toHaveBeenCalledWith('used_at', NOW_ISO);
    errorSpy.mockRestore();
  });

  it('si el upsert falla, libera el código para reintentarlo', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const codigos = codigoValido();
    clienteCanje({
      whatsapp_link_codes: codigos,
      whatsapp_links: tablaLinks(
        { data: null, error: null },
        { error: { code: 'XX000', message: 'boom' } },
      ),
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(codigos.update).toHaveBeenLastCalledWith({ used_at: null });
    errorSpy.mockRestore();
  });

  it('un canje exitoso no libera el código', async () => {
    const codigos = codigoValido();
    clienteCanje({
      whatsapp_link_codes: codigos,
      whatsapp_links: tablaLinks({ data: null, error: null }),
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(codigos.update).toHaveBeenCalledTimes(1);
  });

  it('si el upsert del vínculo falla devuelve link_failed', async () => {
    const links = tablaLinks(
      { data: null, error: null },
      { error: { code: 'XX000', message: 'boom' } },
    );
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
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

describe('límite de intentos de vinculación (lógica pura)', () => {
  it('la ventana empieza 15 minutos antes de ahora', () => {
    expect(LINK_ATTEMPTS_WINDOW_MINUTES).toBe(15);
    expect(linkAttemptsWindowStart(NOW)).toBe('2026-09-30T11:45:00.000Z');
  });

  it('con 4 fallos todavía se puede intentar; con 5 ya no', () => {
    expect(LINK_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(isOverLinkAttemptLimit(0)).toBe(false);
    expect(isOverLinkAttemptLimit(4)).toBe(false);
    expect(isOverLinkAttemptLimit(5)).toBe(true);
    expect(isOverLinkAttemptLimit(9)).toBe(true);
  });
});

/**
 * Una consulta encadenable (cada método devuelve la misma cadena) que al
 * esperarse resuelve a `result`. Cada `from()` recibe una cadena nueva.
 */
function consulta(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of [
    'delete',
    'eq',
    'lt',
    'gte',
    'select',
    'insert',
    'single',
    'update',
    'is',
    'gt',
    'neq',
    'maybeSingle',
    'limit',
  ]) {
    c[m] = vi.fn(() => c);
  }
  c.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return c as Record<string, ReturnType<typeof vi.fn>>;
}

/** Cliente cuyas llamadas a from() devuelven las consultas dadas, en orden. */
function clienteIntentos(...consultas: Array<ReturnType<typeof consulta>>) {
  const from = vi.fn();
  for (const q of consultas) from.mockReturnValueOnce(q);
  mockedAdmin.mockReturnValue({ from });
  return from;
}

describe('reserveLinkAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('purga todo lo anterior a la ventana, registra el intento ANTES de contar y cuenta la ventana con él incluido', async () => {
    const purga = consulta({ error: null });
    const insert = consulta({ data: { id: 42 }, error: null });
    const conteo = consulta({ count: 5, error: null });
    const from = clienteIntentos(purga, insert, conteo);

    const res = await reserveLinkAttempt(TEL, now);

    expect(res).toEqual({ allowed: true, attemptId: 42 });
    expect(from).toHaveBeenCalledWith('whatsapp_link_attempts');
    // Purga: TODAS las filas anteriores a la ventana, de cualquier número
    // (así también desaparecen las de números que no vuelven a escribir).
    expect(purga.delete).toHaveBeenCalled();
    expect(purga.eq).not.toHaveBeenCalled();
    expect(purga.lt).toHaveBeenCalledWith(
      'created_at',
      '2026-09-30T11:45:00.000Z',
    );
    expect(insert.insert).toHaveBeenCalledWith({
      phone_e164: TEL,
      created_at: NOW_ISO,
    });
    expect(insert.select).toHaveBeenCalledWith('id');
    expect(conteo.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(conteo.eq).toHaveBeenCalledWith('phone_e164', TEL);
    expect(conteo.gte).toHaveBeenCalledWith(
      'created_at',
      '2026-09-30T11:45:00.000Z',
    );
    expect(insert.insert.mock.invocationCallOrder[0]).toBeLessThan(
      conteo.select.mock.invocationCallOrder[0],
    );
  });

  it('con 6 en la ventana (5 fallos + este) rechaza y borra su propia reserva', async () => {
    expect(LINK_MAX_FAILED_ATTEMPTS).toBe(5);
    const borrado = consulta({ error: null });
    clienteIntentos(
      consulta({ error: null }),
      consulta({ data: { id: 42 }, error: null }),
      consulta({ count: 6, error: null }),
      borrado,
    );

    expect(await reserveLinkAttempt(TEL, now)).toEqual({ allowed: false });
    expect(borrado.delete).toHaveBeenCalled();
    expect(borrado.eq).toHaveBeenCalledWith('id', 42);
  });

  it('si la purga falla sigue igual (best-effort)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteIntentos(
      consulta({ error: { code: 'XX000', message: 'boom' } }),
      consulta({ data: { id: 1 }, error: null }),
      consulta({ count: 1, error: null }),
    );

    expect(await reserveLinkAttempt(TEL, now)).toEqual({
      allowed: true,
      attemptId: 1,
    });
    errorSpy.mockRestore();
  });

  it('si el insert falla (p. ej. la migración sin aplicar) deja pasar sin reserva y no loguea el número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteIntentos(
      consulta({ error: null }),
      consulta({
        data: null,
        error: {
          code: '42P01',
          message: 'relation "whatsapp_link_attempts" does not exist',
        },
      }),
    );

    expect(await reserveLinkAttempt(TEL, now)).toEqual({
      allowed: true,
      attemptId: null,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('reserveLinkAttempt'),
      '42P01',
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(TEL);
    errorSpy.mockRestore();
  });

  it('si el conteo falla deja pasar y conserva la reserva', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteIntentos(
      consulta({ error: null }),
      consulta({ data: { id: 9 }, error: null }),
      consulta({ count: null, error: { code: '57014', message: 'timeout' } }),
    );

    expect(await reserveLinkAttempt(TEL, now)).toEqual({
      allowed: true,
      attemptId: 9,
    });
    errorSpy.mockRestore();
  });

  it('si el cliente lanza, deja pasar sin reserva', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockImplementationOnce(() => {
      throw new Error('sin variables de entorno');
    });

    expect(await reserveLinkAttempt(TEL, now)).toEqual({
      allowed: true,
      attemptId: null,
    });
    errorSpy.mockRestore();
  });
});

describe('releaseLinkAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('borra el intento por id', async () => {
    const borrado = consulta({ error: null });
    const from = clienteIntentos(borrado);

    await releaseLinkAttempt(42);

    expect(from).toHaveBeenCalledWith('whatsapp_link_attempts');
    expect(borrado.delete).toHaveBeenCalled();
    expect(borrado.eq).toHaveBeenCalledWith('id', 42);
  });

  it('si el borrado falla no lanza y loguea solo el código de error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteIntentos(consulta({ error: { code: 'XX000', message: 'boom' } }));

    await expect(releaseLinkAttempt(42)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('releaseLinkAttempt'),
      'XX000',
    );
    errorSpy.mockRestore();
  });

  it('si el cliente lanza, no lanza', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockImplementationOnce(() => {
      throw new Error('sin variables de entorno');
    });

    await expect(releaseLinkAttempt(42)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
