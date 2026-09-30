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
    isLinkAttemptLimitReached: vi.fn().mockResolvedValue(false),
    recordFailedLinkAttempt: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('handleLinkingMessage', () => {
  it('VINCULAR con código válido → confirma y canjea, sin registrar fallo', async () => {
    const d = deps();
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(d.redeemLinkCode).toHaveBeenCalledWith('482913', TEL);
    expect(reply).toContain('vinculado');
    expect(d.getLinkByPhone).not.toHaveBeenCalled();
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('VINCULAR con código inválido → mensaje de error y registra el intento fallido', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'invalid_or_expired' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 000000', d);
    expect(reply.toLowerCase()).toContain('código');
    expect(reply).toMatch(/válido|expir/i);
    expect(d.recordFailedLinkAttempt).toHaveBeenCalledWith(TEL);
  });

  it('un error de base (link_failed) responde igual pero NO cuenta como intento fallido', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'link_failed' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toMatch(/válido|expir/i);
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('con el límite alcanzado responde MSG_TOO_MANY_ATTEMPTS sin consultar el código', async () => {
    const d = deps({
      isLinkAttemptLimitReached: vi.fn().mockResolvedValue(true),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toBe(MSG_TOO_MANY_ATTEMPTS);
    expect(d.isLinkAttemptLimitReached).toHaveBeenCalledWith(TEL);
    expect(d.redeemLinkCode).not.toHaveBeenCalled();
    // Los intentos bloqueados no se registran: quien espera 15 min vuelve a poder.
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('MSG_TOO_MANY_ATTEMPTS es el texto del contrato', () => {
    expect(MSG_TOO_MANY_ATTEMPTS).toBe(
      'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.',
    );
  });

  it('un mensaje que no es VINCULAR no consulta el límite', async () => {
    const d = deps({
      isLinkAttemptLimitReached: vi.fn().mockResolvedValue(true),
    });
    const reply = await handleLinkingMessage(TEL, 'hola', d);
    expect(d.isLinkAttemptLimitReached).not.toHaveBeenCalled();
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
