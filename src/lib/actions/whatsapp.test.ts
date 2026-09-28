import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/services/whatsapp-links', () => ({ createLinkCode: vi.fn() }));

import { createClient } from '@/lib/supabase/server';

import {
  guardarDocumentoDianAction,
  listarDocumentosDianAction,
} from './whatsapp';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;

const LINK_ID = '11111111-1111-4111-8111-111111111111';

interface Resultado {
  data: unknown;
  error: unknown;
}

/**
 * Cliente de cookie falso: una sola cadena con los métodos del SELECT
 * (select→eq→order) y del UPDATE (update→eq→eq→select), para mirar qué se
 * llamó.
 */
function clienteFalso({
  user = { id: 'user-1' } as { id: string } | null,
  updateResult = { data: [{ id: LINK_ID }], error: null } as Resultado,
  selectResult = { data: [], error: null } as Resultado,
} = {}) {
  const chain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    // El UPDATE termina en select('id'); el listado sigue con eq→order.
    select: vi.fn((cols: string) =>
      cols === 'id' ? Promise.resolve(updateResult) : chain,
    ),
    order: vi.fn().mockResolvedValue(selectResult),
  };
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => chain),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, chain };
}

describe('guardarDocumentoDianAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('guarda el documento validado solo en un link del usuario autenticado', async () => {
    const { client, chain } = clienteFalso();

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '1.000.000.001',
    });

    expect(r).toEqual({ ok: true, documento: '1000000001' });
    expect(client.from).toHaveBeenCalledWith('whatsapp_links');
    expect(chain.update).toHaveBeenCalledWith({ documento: '1000000001' });
    expect(chain.eq).toHaveBeenCalledWith('id', LINK_ID);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('vacío → borra el documento (null)', async () => {
    const { chain } = clienteFalso();

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '',
    });

    expect(r).toEqual({ ok: true, documento: null });
    expect(chain.update).toHaveBeenCalledWith({ documento: null });
  });

  it('documento inválido → error en español y no toca la DB', async () => {
    const { client } = clienteFalso();

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '12ab',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/entre 5 y 15 dígitos/);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('linkId que no es uuid → error sin tocar la DB', async () => {
    const { client } = clienteFalso();

    const r = await guardarDocumentoDianAction({
      linkId: 'otro',
      documento: '1000000001',
    });

    expect(r.ok).toBe(false);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('sin sesión → no autenticado', async () => {
    const { client } = clienteFalso({ user: null });

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '1000000001',
    });

    expect(r).toEqual({ ok: false, error: 'No autenticado' });
    expect(client.from).not.toHaveBeenCalled();
  });

  it('el link no es del usuario (0 filas actualizadas) → error, no éxito falso', async () => {
    clienteFalso({ updateResult: { data: [], error: null } });

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '1000000001',
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/número/i);
  });

  it('error de la DB → mensaje genérico y no loguea el documento', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      updateResult: {
        data: null,
        error: {
          code: '42501',
          message: 'permission denied',
          details: 'Failing row contains (1000000001)',
        },
      },
    });

    const r = await guardarDocumentoDianAction({
      linkId: LINK_ID,
      documento: '1000000001',
    });

    expect(r.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('1000000001');
    errorSpy.mockRestore();
  });
});

describe('listarDocumentosDianAction', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve los números del usuario enmascarados, con su documento', async () => {
    const { chain } = clienteFalso({
      selectResult: {
        data: [
          { id: LINK_ID, phone_e164: '+573001234567', documento: '1000000001' },
        ],
        error: null,
      },
    });

    const r = await listarDocumentosDianAction();

    expect(r).toEqual({
      ok: true,
      links: [
        { id: LINK_ID, telefono: '+57 300 ••• 4567', documento: '1000000001' },
      ],
    });
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    // El número completo no viaja al navegador.
    expect(JSON.stringify(r)).not.toContain('+573001234567');
  });

  it('sin sesión → no autenticado', async () => {
    clienteFalso({ user: null });

    expect(await listarDocumentosDianAction()).toEqual({
      ok: false,
      error: 'No autenticado',
    });
  });

  it('si la consulta falla → error en español', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteFalso({
      selectResult: { data: null, error: { code: '42703', message: 'x' } },
    });

    const r = await listarDocumentosDianAction();

    expect(r.ok).toBe(false);
    errorSpy.mockRestore();
  });
});
