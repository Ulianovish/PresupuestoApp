import { describe, expect, it, vi } from 'vitest';

import {
  MSG_DESVINCULADO,
  MSG_ERROR_INESPERADO,
  confirmarDesvinculo,
} from './confirmar-desvinculo';

const LINK_ID = '00000000-0000-4000-8000-0000000000aa';

function deps(unlink: () => Promise<unknown>) {
  return {
    unlink: vi.fn(unlink),
    toast: { success: vi.fn(), error: vi.fn() },
  };
}

describe('confirmarDesvinculo', () => {
  it('ok → toast de éxito y cierra el modal', async () => {
    const d = deps(async () => ({ ok: true }));

    await expect(confirmarDesvinculo(LINK_ID, d as never)).resolves.toBe(true);
    expect(d.unlink).toHaveBeenCalledWith(LINK_ID);
    expect(d.toast.success).toHaveBeenCalledWith(MSG_DESVINCULADO);
    expect(d.toast.error).not.toHaveBeenCalled();
  });

  it('ok: false → toast con el error de la acción y el modal sigue abierto', async () => {
    const d = deps(async () => ({
      ok: false,
      error: 'No encontramos ese número.',
    }));

    await expect(confirmarDesvinculo(LINK_ID, d as never)).resolves.toBe(false);
    expect(d.toast.error).toHaveBeenCalledWith('No encontramos ese número.');
    expect(d.toast.success).not.toHaveBeenCalled();
  });

  it('si la acción lanza → toast genérico y el modal sigue abierto', async () => {
    const d = deps(async () => {
      throw new Error('red caída');
    });

    await expect(confirmarDesvinculo(LINK_ID, d as never)).resolves.toBe(false);
    expect(d.toast.error).toHaveBeenCalledWith(MSG_ERROR_INESPERADO);
  });
});
