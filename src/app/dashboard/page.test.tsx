import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/actions/auth', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/lib/actions/onboarding', () => ({
  ensureStarterKitAction: vi.fn(),
}));
vi.mock('@/lib/onboarding/checklist', () => ({
  loadDashboardChecklist: vi.fn(),
}));
vi.mock('@/components/pages/DashboardContent', () => ({
  default: () => null,
}));

import DashboardContent from '@/components/pages/DashboardContent';
import { getCurrentUser } from '@/lib/actions/auth';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loadDashboardChecklist } from '@/lib/onboarding/checklist';
import { createClient } from '@/lib/supabase/server';

import DashboardPage from './page';

const mocked = (f: unknown) => f as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ITEMS = [
  {
    id: 'cuentas',
    label: 'Agrega tus cuentas',
    href: '/settings',
    done: false,
  },
];

function clienteFalso(perfil: {
  data: unknown;
  error: { code: string } | null;
}) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(perfil),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  const client = { from: vi.fn(() => chain) };
  mocked(createClient).mockResolvedValue(client);
  return { client, chain };
}

describe('/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked(getCurrentUser).mockResolvedValue({ id: USER_ID });
    mocked(ensureStarterKitAction).mockResolvedValue({ seeded: false });
    mocked(loadDashboardChecklist).mockResolvedValue(ITEMS);
  });
  // Restaura los spies (console.error) aunque una aserción falle.
  afterEach(() => vi.restoreAllMocks());

  it('sin sesión → login, sin sembrar el kit', async () => {
    mocked(getCurrentUser).mockResolvedValue(null);
    clienteFalso({ data: null, error: null });

    await expect(DashboardPage()).rejects.toThrow('NEXT_REDIRECT:/auth/login');
    expect(ensureStarterKitAction).not.toHaveBeenCalled();
  });

  it('bienvenida sin terminar (onboarding_completed_at null): repara el kit ANTES de la checklist', async () => {
    const orden: string[] = [];
    mocked(ensureStarterKitAction).mockImplementation(async () => {
      orden.push('kit');
      return { seeded: true };
    });
    mocked(loadDashboardChecklist).mockImplementation(async () => {
      orden.push('checklist');
      return ITEMS;
    });
    const perfil = {
      onboarding_completed_at: null,
      onboarding_dismissed_at: null,
    };
    const { client, chain } = clienteFalso({ data: perfil, error: null });

    const arbol = (await DashboardPage()) as {
      type: unknown;
      props: Record<string, unknown>;
    };

    // Una sola lectura de profiles con las dos columnas; la checklist recibe
    // el perfil ya leído.
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledWith('profiles');
    expect(chain.select).toHaveBeenCalledWith(
      'onboarding_completed_at, onboarding_dismissed_at',
    );
    expect(chain.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(orden).toEqual(['kit', 'checklist']);
    expect(loadDashboardChecklist).toHaveBeenCalledWith(
      client,
      USER_ID,
      perfil,
    );
    expect(arbol.type).toBe(DashboardContent);
    expect(arbol.props).toMatchObject({
      user: { id: USER_ID },
      checklist: ITEMS,
    });
  });

  it('bienvenida terminada: NO llama el kit (no reactiva categorías borradas)', async () => {
    const perfil = {
      onboarding_completed_at: '2026-09-01T00:00:00.000Z',
      onboarding_dismissed_at: null,
    };
    const { client } = clienteFalso({ data: perfil, error: null });

    const arbol = (await DashboardPage()) as { props: Record<string, unknown> };

    expect(ensureStarterKitAction).not.toHaveBeenCalled();
    expect(loadDashboardChecklist).toHaveBeenCalledWith(
      client,
      USER_ID,
      perfil,
    );
    expect(arbol.props.checklist).toEqual(ITEMS);
  });

  it('si la lectura del perfil falla (columna sin migrar): NO llama el kit y carga igual', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clienteFalso({ data: null, error: { code: '42703' } });
    mocked(loadDashboardChecklist).mockResolvedValue(null);

    const arbol = (await DashboardPage()) as { props: Record<string, unknown> };

    expect(ensureStarterKitAction).not.toHaveBeenCalled();
    // Sin perfil válido la checklist recibe null (no muestra nada).
    expect(loadDashboardChecklist).toHaveBeenCalledWith(client, USER_ID, null);
    expect(console.error).toHaveBeenCalledWith(expect.any(String), '42703');
    expect(arbol.props.checklist).toBeNull();
  });

  it('sin fila de perfil: NO llama el kit', async () => {
    const { client } = clienteFalso({ data: null, error: null });

    await DashboardPage();

    expect(ensureStarterKitAction).not.toHaveBeenCalled();
    expect(loadDashboardChecklist).toHaveBeenCalledWith(client, USER_ID, null);
  });
});
