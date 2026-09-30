import { revalidatePath } from 'next/cache';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/onboarding/post-login', () => ({ getPostLoginPath: vi.fn() }));

import { getPostLoginPath } from '@/lib/onboarding/post-login';
import { createClient } from '@/lib/supabase/server';

import { loginAction, registerAction } from './auth';

const mockedCreateClient = vi.mocked(createClient);
const mockedPostLogin = vi.mocked(getPostLoginPath);
const mockedRevalidate = vi.mocked(revalidatePath);

const USER_ID = '0b9f3c1e-7a51-4c1e-9a55-2f8d3c4b5a61';
const EMAIL = 'usuario@ejemplo.com';
const PASSWORD = 'clave-de-prueba-123';

type Resultado = {
  data: { user: { id: string } | null; session: object | null };
  error: { code?: string; message?: string; status?: number } | null;
};

const OK: Resultado = {
  data: { user: { id: USER_ID }, session: {} },
  error: null,
};

function clienteFalso({
  signIn = OK,
  signUp = OK,
}: { signIn?: Resultado; signUp?: Resultado } = {}) {
  const auth = {
    signInWithPassword: vi.fn().mockResolvedValue(signIn),
    signUp: vi.fn().mockResolvedValue(signUp),
  };
  const client = { auth };
  mockedCreateClient.mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return { client, auth };
}

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/** Ejecuta la acción y devuelve la URL a la que redirigió. */
async function destino(accion: Promise<unknown>): Promise<string> {
  try {
    await accion;
  } catch (e) {
    const mensaje = (e as Error).message;
    if (mensaje.startsWith('NEXT_REDIRECT:')) {
      return mensaje.slice('NEXT_REDIRECT:'.length);
    }
    throw e;
  }
  throw new Error('la acción no redirigió');
}

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] ?? '');
}

describe('loginAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  it('sin redirectTo usa getPostLoginPath', async () => {
    const { client, auth } = clienteFalso();

    const url = await destino(
      loginAction(form({ email: EMAIL, password: PASSWORD })),
    );

    expect(url).toBe('/bienvenida');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
    });
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it('con redirectTo interno vuelve a esa ruta', async () => {
    clienteFalso();

    const url = await destino(
      loginAction(
        form({ email: EMAIL, password: PASSWORD, redirectTo: '/presupuesto' }),
      ),
    );

    expect(url).toBe('/presupuesto');
    expect(mockedPostLogin).not.toHaveBeenCalled();
  });

  it.each(['//otro.ejemplo.com', '/auth/login', 'https://otro.ejemplo.com'])(
    'con redirectTo inseguro (%s) cuenta como ausente y usa getPostLoginPath',
    async redirectTo => {
      const { client } = clienteFalso();

      const url = await destino(
        loginAction(form({ email: EMAIL, password: PASSWORD, redirectTo })),
      );

      expect(url).toBe('/bienvenida');
      expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    },
  );

  it('credenciales malas → código (no texto) y conserva redirectTo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: {
          code: 'invalid_credentials',
          message: 'Invalid login credentials',
        },
      },
    });

    const url = await destino(
      loginAction(
        form({ email: EMAIL, password: PASSWORD, redirectTo: '/gastos' }),
      ),
    );

    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('error')).toBe('invalid_credentials');
    expect(query(url).get('redirectTo')).toBe('/gastos');
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });

  it('correo sin confirmar → pide confirmarlo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
      },
    });

    const url = await destino(
      loginAction(form({ email: EMAIL, password: PASSWORD })),
    );

    expect(query(url).get('error')).toBe('email_not_confirmed');
    expect(query(url).get('redirectTo')).toBeNull();
  });

  it('un error desconocido nunca muestra el mensaje crudo', async () => {
    clienteFalso({
      signIn: {
        data: { user: null, session: null },
        error: {
          code: 'unexpected_failure',
          message: 'detalle interno del servidor',
        },
      },
    });

    const url = await destino(
      loginAction(form({ email: EMAIL, password: PASSWORD })),
    );

    expect(query(url).get('error')).toBe('error_desconocido');
    expect(url).not.toContain('detalle');
  });

  it('correo inválido → código de credenciales, sin llamar a Supabase', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      loginAction(form({ email: 'no-es-correo', password: PASSWORD })),
    );

    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('error')).toBe('invalid_credentials');
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('registerAction', () => {
  const campos = {
    email: EMAIL,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    fullName: 'Persona de Prueba',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.ejemplo.com');
    mockedPostLogin.mockResolvedValue('/bienvenida');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('manda emailRedirectTo a /auth/confirm y pide revisar el correo', async () => {
    const { auth } = clienteFalso({
      signUp: { data: { user: { id: USER_ID }, session: null }, error: null },
    });

    const url = await destino(registerAction(form(campos)));

    expect(auth.signUp).toHaveBeenCalledWith({
      email: EMAIL,
      password: PASSWORD,
      options: {
        emailRedirectTo:
          'https://app.ejemplo.com/auth/confirm?next=/bienvenida',
        data: { full_name: 'Persona de Prueba' },
      },
    });
    expect(url.startsWith('/auth/login?')).toBe(true);
    expect(query(url).get('message')).toBe('revisa_correo');
  });

  it('si Supabase devuelve sesión (confirmación apagada) va a getPostLoginPath', async () => {
    const { client } = clienteFalso();

    const url = await destino(registerAction(form(campos)));

    expect(url).toBe('/bienvenida');
    expect(mockedPostLogin).toHaveBeenCalledWith(client, USER_ID);
    expect(mockedRevalidate).toHaveBeenCalledWith('/', 'layout');
  });

  it.each([
    // Hook (§5.2): sin code, message 'signup_not_allowed', 403.
    [{ message: 'signup_not_allowed', status: 403 }],
    // Trigger (§5.2): code 'unexpected_failure', message 'Database error saving new user'.
    [
      {
        code: 'unexpected_failure',
        message: 'Database error saving new user',
        status: 500,
      },
    ],
  ])('correo fuera de la allowlist (%j) → sin invitación', async error => {
    clienteFalso({ signUp: { data: { user: null, session: null }, error } });

    const url = await destino(registerAction(form(campos)));

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe(
      'Este correo no tiene invitación. Pídele acceso a quien administra la app.',
    );
  });

  it('límite de correos → texto traducido', async () => {
    clienteFalso({
      signUp: {
        data: { user: null, session: null },
        error: {
          code: 'over_email_send_rate_limit',
          message: 'email rate limit exceeded',
        },
      },
    });

    const url = await destino(registerAction(form(campos)));

    expect(query(url).get('error')).toBe(
      'Enviamos demasiados correos. Intenta de nuevo en unos minutos.',
    );
  });

  it('contraseñas distintas → mensaje de validación, sin llamar a Supabase', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      registerAction(
        form({ ...campos, confirmPassword: 'otra-clave-de-prueba' }),
      ),
    );

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe('Las contraseñas no coinciden');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('correo inválido → primer mensaje de Zod, nunca "Datos inválidos"', async () => {
    const { auth } = clienteFalso();

    const url = await destino(
      registerAction(form({ ...campos, email: 'no-es-correo' })),
    );

    expect(url.startsWith('/auth/register?')).toBe(true);
    expect(query(url).get('error')).toBe('Debe ser un email válido');
    expect(query(url).get('error')).not.toBe('Datos inválidos');
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
