import { describe, expect, it, vi } from 'vitest';

import { handleLinkingMessage } from './handle-linking';

describe('handleLinkingMessage', () => {
  it('VINCULAR con código válido → confirma y canjea', async () => {
    const redeemLinkCode = vi.fn().mockResolvedValue({ ok: true, userId: 'u1' });
    const getLinkByPhone = vi.fn();
    const reply = await handleLinkingMessage('+573001234567', 'VINCULAR 482913', {
      redeemLinkCode,
      getLinkByPhone,
    });
    expect(redeemLinkCode).toHaveBeenCalledWith('482913', '+573001234567');
    expect(reply).toContain('vinculado');
    expect(getLinkByPhone).not.toHaveBeenCalled();
  });

  it('VINCULAR con código inválido → mensaje de error', async () => {
    const redeemLinkCode = vi.fn().mockResolvedValue({ ok: false, reason: 'invalid_or_expired' });
    const reply = await handleLinkingMessage('+573001234567', 'VINCULAR 000000', {
      redeemLinkCode,
      getLinkByPhone: vi.fn(),
    });
    expect(reply.toLowerCase()).toContain('código');
    expect(reply).toMatch(/válido|expir/i);
  });

  it('número ya vinculado y mensaje cualquiera → avisa que ya está vinculado', async () => {
    const reply = await handleLinkingMessage('+573001234567', 'hola', {
      redeemLinkCode: vi.fn(),
      getLinkByPhone: vi.fn().mockResolvedValue({ userId: 'u1' }),
    });
    expect(reply.toLowerCase()).toContain('vinculado');
  });

  it('número NO vinculado y mensaje cualquiera → instrucciones de vinculación', async () => {
    const reply = await handleLinkingMessage('+573001234567', 'hola', {
      redeemLinkCode: vi.fn(),
      getLinkByPhone: vi.fn().mockResolvedValue(null),
    });
    expect(reply).toContain('VINCULAR');
    expect(reply.toLowerCase()).toContain('ajustes');
  });
});
