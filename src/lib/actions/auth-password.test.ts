import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  // Igual que el redirect real: lanza para cortar la ejecución.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));
vi.mock('@/lib/site-url', () => ({
  getSiteUrl: vi.fn(() => 'https://app.ejemplo.com'),
}));

import { RESET_LINK_EXPIRED_PATH } from '@/lib/auth/password-reset-feedback';
import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { forgotPasswordAction, resetPasswordAction } from './auth';

const mockedCreateClient = vi.mocked(createClient);
const mockedRedirect = vi.mocked(redirect);
const mockedPostLogin = vi.mocked(getPostLoginPath);

const CORREO = 'usuario@ejemplo.com';
const REDIRECT_TO =
  'https://app.ejemplo.com/auth/confirm?type=recovery&next=/auth/reset-password';

interface ErrorFalso {
  message: string;
  code?: string;
  status?: number;
}

/** Cliente de cookie falso con solo los métodos de auth que usan las acciones. */
function clienteFalso({
  user = { id: '11111111-1111-4111-8111-111111111111' } as {
    id: string;
  } | null,
  resetError = null as ErrorFalso | null,
  resetThrows = null as Error | null,
  updateError = null as ErrorFalso | null,
  getUserError = null as ErrorFalso | null,
  getUserThrows = null as Error | null,
} = {}) {
  const client = {
    auth: {
      resetPasswordForEmail: resetThrows
        ? vi.fn().mockRejectedValue(resetThrows)
        : vi.fn().mockResolvedValue({ data: {}, error: resetError }),
      getUser: getUserThrows
        ? vi.fn().mockRejectedValue(getUserThrows)
        : vi.fn().mockResolvedValue({ data: { user }, error: getUserError }),
      updateUser: vi
        .fn()
        .mockResolvedValue({ data: { user }, error: updateError }),
    },
  };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return client;
}

function formulario(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/** Ejecuta la acción, exige que termine en redirect y devuelve la URL destino. */
async function destino(p: Promise<unknown>): Promise<URL> {
  await expect(p).rejects.toThrow('NEXT_REDIRECT:');
  const url = mockedRedirect.mock.calls.at(-1)?.[0] as string;
  return new URL(url, 'http://localhost');
}

describe('forgotPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('pide el correo de recuperación hacia /auth/confirm y responde el código genérico', async () => {
    const client = clienteFalso();

    const url = await destino(
      forgotPasswordAction(formulario({ email: CORREO })),
    );

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(CORREO, {
      redirectTo: REDIRECT_TO,
    });
    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('message')).toBe('enlace_enviado');
    expect(url.searchParams.get('error')).toBeNull();
  });

  it('quita espacios alrededor del correo', async () => {
    const client = clienteFalso();

    await destino(forgotPasswordAction(formulario({ email: `  ${CORREO}  ` })));

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(CORREO, {
      redirectTo: REDIRECT_TO,
    });
  });

  it('límite de envíos: responde exactamente lo mismo y registra solo el code', async () => {
    clienteFalso();
    const exito = await destino(
      forgotPasswordAction(formulario({ email: CORREO })),
    );

    clienteFalso({
      resetError: {
        message:
          'For security purposes, you can only request this after 60 seconds.',
        code: 'over_email_send_rate_limit',
        status: 429,
      },
    });
    const fallo = await destino(
      forgotPasswordAction(formulario({ email: CORREO })),
    );

    expect(fallo.href).toBe(exito.href);
    expect(fallo.searchParams.get('error')).toBeNull();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
      code: 'over_email_send_rate_limit',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      CORREO,
    );
  });

  it('si resetPasswordForEmail lanza, se lo traga y responde lo mismo', async () => {
    clienteFalso({ resetThrows: new Error(`fetch failed para ${CORREO}`) });

    const url = await destino(
      forgotPasswordAction(formulario({ email: CORREO })),
    );

    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('message')).toBe('enlace_enviado');
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
      code: 'sin_codigo',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      CORREO,
    );
  });

  it('correo con formato inválido → código de error y no llama a Supabase', async () => {
    const client = clienteFalso();

    const url = await destino(
      forgotPasswordAction(formulario({ email: 'no-es-correo' })),
    );

    expect(url.pathname).toBe('/auth/forgot-password');
    expect(url.searchParams.get('error')).toBe('correo_invalido');
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('sin campo email → mismo código de validación', async () => {
    const client = clienteFalso();

    const url = await destino(forgotPasswordAction(new FormData()));

    expect(url.searchParams.get('error')).toBe('correo_invalido');
    expect(client.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('resetPasswordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedPostLogin.mockResolvedValue('/dashboard');
  });

  const VALIDA = 'claveNueva123';
  const USER_ID = '11111111-1111-4111-8111-111111111111';

  function enviar(password: string, confirmPassword: string) {
    return destino(
      resetPasswordAction(formulario({ password, confirmPassword })),
    );
  }

  it('sin sesión → vuelve a pedir el enlace (otp_expired) y no cambia nada', async () => {
    const client = clienteFalso({ user: null });

    const url = await enviar(VALIDA, VALIDA);

    expect(RESET_LINK_EXPIRED_PATH).toBe(
      '/auth/forgot-password?error=otp_expired',
    );
    expect(`${url.pathname}${url.search}`).toBe(RESET_LINK_EXPIRED_PATH);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  it('getUser devuelve error → registra solo el code y va a RESET_LINK_EXPIRED_PATH', async () => {
    const client = clienteFalso({
      user: null,
      getUserError: {
        message: `sesión vencida de ${CORREO}`,
        code: 'session_expired',
        status: 403,
      },
    });

    const url = await enviar(VALIDA, VALIDA);

    expect(`${url.pathname}${url.search}`).toBe(RESET_LINK_EXPIRED_PATH);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
      code: 'session_expired',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      CORREO,
    );
  });

  it('getUser lanza → registra solo el nombre del error y va a RESET_LINK_EXPIRED_PATH', async () => {
    const fallo = new TypeError(`fetch failed para ${CORREO}`);
    const client = clienteFalso({ getUserThrows: fallo });

    const url = await enviar(VALIDA, VALIDA);

    expect(`${url.pathname}${url.search}`).toBe(RESET_LINK_EXPIRED_PATH);
    expect(client.auth.updateUser).not.toHaveBeenCalled();
    expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
      code: 'TypeError',
    });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      CORREO,
    );
  });

  it.each([
    ['corta', 'corta', 'password_corta'],
    ['a'.repeat(73), 'a'.repeat(73), 'password_larga'],
    [VALIDA, 'otraClave456', 'no_coinciden'],
    [VALIDA, '', 'confirmar_password'],
  ])(
    'validación (%s / %s) → código %s y no llama updateUser',
    async (password, confirmPassword, codigo) => {
      const client = clienteFalso();

      const url = await enviar(password, confirmPassword);

      expect(url.pathname).toBe('/auth/reset-password');
      expect(url.searchParams.get('error')).toBe(codigo);
      expect(client.auth.updateUser).not.toHaveBeenCalled();
    },
  );

  it('con sesión y contraseña válida → updateUser, revalida y va a getPostLoginPath', async () => {
    const client = clienteFalso();
    mockedPostLogin.mockResolvedValue('/bienvenida');

    const url = await enviar(VALIDA, VALIDA);

    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: VALIDA });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    expect(url.pathname).toBe('/bienvenida');
    expect(url.search).toBe('');
  });

  it('usuario que ya terminó el onboarding → /dashboard', async () => {
    clienteFalso();

    const url = await enviar(VALIDA, VALIDA);

    expect(url.pathname).toBe('/dashboard');
  });

  it.each([
    ['weak_password', 'Password is known to be weak', 'weak_password'],
    [
      'same_password',
      'New password should be different from the old password.',
      'same_password',
    ],
    ['unexpected_failure', 'detalle interno del servidor', 'error_desconocido'],
  ])(
    'error %s de updateUser («%s») → código %s, nunca el mensaje crudo',
    async (code, crudo, esperado) => {
      clienteFalso({ updateError: { message: crudo, code, status: 422 } });

      const url = await enviar(VALIDA, VALIDA);

      expect(url.pathname).toBe('/auth/reset-password');
      expect(url.searchParams.get('error')).toBe(esperado);
      expect(url.searchParams.get('error')).not.toBe(crudo);
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(vi.mocked(console.error).mock.calls[0]?.[1]).toEqual({
        code,
        status: 422,
      });
    },
  );
});
