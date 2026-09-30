import { describe, expect, it, vi } from 'vitest';

import {
  handleLinkingMessage,
  type LinkingDeps,
  MSG_TOO_MANY_ATTEMPTS,
} from './handle-linking';

const TEL = '+573000000000';

function deps(over: Partial<LinkingDeps> = {}): LinkingDeps {
  return {
    redeemLinkCode: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
    getLinkByPhone: vi.fn().mockResolvedValue(null),
    reserveLinkAttempt: vi
      .fn()
      .mockResolvedValue({ allowed: true, attemptId: 7 }),
    releaseLinkAttempt: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('handleLinkingMessage', () => {
  it('VINCULAR con código válido → reserva el intento, canjea y lo libera (no cuenta como fallo)', async () => {
    const d = deps();
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(d.reserveLinkAttempt).toHaveBeenCalledWith(TEL);
    expect(d.redeemLinkCode).toHaveBeenCalledWith('482913', TEL);
    expect(reply).toContain('vinculado');
    expect(d.getLinkByPhone).not.toHaveBeenCalled();
    expect(d.releaseLinkAttempt).toHaveBeenCalledWith(7);
  });

  it('VINCULAR con código inválido → mensaje de error y el intento reservado queda como fallo', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'invalid_or_expired' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 000000', d);
    expect(reply.toLowerCase()).toContain('código');
    expect(reply).toMatch(/válido|expir/i);
    expect(d.reserveLinkAttempt).toHaveBeenCalledWith(TEL);
    expect(d.releaseLinkAttempt).not.toHaveBeenCalled();
  });

  it('un error de base (link_failed) responde igual pero NO cuenta como intento fallido', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'link_failed' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toMatch(/válido|expir/i);
    expect(d.releaseLinkAttempt).toHaveBeenCalledWith(7);
  });

  it('si la reserva no pudo guardarse (attemptId null) no intenta liberarla', async () => {
    const d = deps({
      reserveLinkAttempt: vi
        .fn()
        .mockResolvedValue({ allowed: true, attemptId: null }),
    });
    await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(d.redeemLinkCode).toHaveBeenCalled();
    expect(d.releaseLinkAttempt).not.toHaveBeenCalled();
  });

  it('si el canje lanza, libera el intento y propaga el error', async () => {
    const d = deps({
      redeemLinkCode: vi.fn().mockRejectedValue(new Error('boom')),
    });
    await expect(
      handleLinkingMessage(TEL, 'VINCULAR 482913', d),
    ).rejects.toThrow('boom');
    expect(d.releaseLinkAttempt).toHaveBeenCalledWith(7);
  });

  it('10 VINCULAR simultáneos del mismo número: como mucho 5 llegan a redeemLinkCode', async () => {
    // Tabla de intentos en memoria con la misma secuencia que la real: primero
    // se inserta la reserva y DESPUÉS se cuenta (con un tick en medio para
    // que las 10 llamadas se intercalen como en paralelo).
    const filas = new Set<number>();
    let siguiente = 1;
    const tick = () => new Promise(r => setTimeout(r, 0));
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'invalid_or_expired' }),
      reserveLinkAttempt: vi.fn(async () => {
        await tick();
        const id = siguiente++;
        filas.add(id);
        await tick();
        if (filas.size > 5) {
          filas.delete(id);
          return { allowed: false as const };
        }
        return { allowed: true as const, attemptId: id };
      }),
      releaseLinkAttempt: vi.fn(async (id: number) => {
        filas.delete(id);
      }),
    });

    const replies = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        handleLinkingMessage(TEL, `VINCULAR ${String(i).padStart(6, '0')}`, d),
      ),
    );

    expect(
      (d.redeemLinkCode as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(5);
    expect(replies.filter(r => r === MSG_TOO_MANY_ATTEMPTS).length).toBe(
      10 - (d.redeemLinkCode as ReturnType<typeof vi.fn>).mock.calls.length,
    );
  });

  it('con el límite alcanzado responde MSG_TOO_MANY_ATTEMPTS sin consultar el código', async () => {
    const d = deps({
      reserveLinkAttempt: vi.fn().mockResolvedValue({ allowed: false }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toBe(MSG_TOO_MANY_ATTEMPTS);
    expect(d.reserveLinkAttempt).toHaveBeenCalledWith(TEL);
    expect(d.redeemLinkCode).not.toHaveBeenCalled();
  });

  it('MSG_TOO_MANY_ATTEMPTS es el texto del contrato', () => {
    expect(MSG_TOO_MANY_ATTEMPTS).toBe(
      'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.',
    );
  });

  it('un mensaje que no es VINCULAR no consulta el límite', async () => {
    const d = deps({
      reserveLinkAttempt: vi.fn().mockResolvedValue({ allowed: false }),
    });
    const reply = await handleLinkingMessage(TEL, 'hola', d);
    expect(d.reserveLinkAttempt).not.toHaveBeenCalled();
    expect(reply).toContain('VINCULAR');
  });

  it('número ya vinculado y mensaje cualquiera → avisa que ya está vinculado', async () => {
    const d = deps({
      getLinkByPhone: vi.fn().mockResolvedValue({ userId: 'u1' }),
    });
    const reply = await handleLinkingMessage(TEL, 'hola', d);
    expect(reply.toLowerCase()).toContain('vinculado');
  });

  it('número NO vinculado y mensaje cualquiera → instrucciones de vinculación', async () => {
    const reply = await handleLinkingMessage(TEL, 'hola', deps());
    expect(reply).toContain('VINCULAR');
    expect(reply.toLowerCase()).toContain('ajustes');
  });
});
