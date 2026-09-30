import { redirect } from 'next/navigation';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/actions/onboarding', () => ({
  ensureStarterKitAction: vi.fn(),
}));
vi.mock('@/lib/onboarding/wizard-data', () => ({ loadWizardData: vi.fn() }));
vi.mock('@/lib/whatsapp/format', () => ({ todayBogota: () => '2026-09-15' }));
vi.mock('@/components/organisms/OnboardingWizard/OnboardingWizard', () => ({
  default: () => null,
}));

import OnboardingWizard from '@/components/organisms/OnboardingWizard/OnboardingWizard';
import { ensureStarterKitAction } from '@/lib/actions/onboarding';
import { loadWizardData } from '@/lib/onboarding/wizard-data';
import { createClient } from '@/lib/supabase/server';

import BienvenidaPage from './page';

const mockedCreateClient = createClient as unknown as ReturnType<typeof vi.fn>;
const mockedEnsure = ensureStarterKitAction as unknown as ReturnType<
  typeof vi.fn
>;
const mockedLoad = loadWizardData as unknown as ReturnType<typeof vi.fn>;

const USER_ID = '00000000-0000-4000-8000-000000000001';

function clienteFalso({
  user = { id: USER_ID } as { id: string } | null,
  perfil = { onboarding_completed_at: null } as unknown,
  perfilError = null as { code: string } | null,
} = {}) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi
      .fn()
      .mockResolvedValue({ data: perfil, error: perfilError }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => chain),
  };
  mockedCreateClient.mockResolvedValue(client);
  return { client, chain };
}

/** Busca el elemento del wizard dentro del árbol que devuelve la página. */
function propsDelWizard(nodo: unknown): Record<string, unknown> | null {
  if (!nodo || typeof nodo !== 'object') return null;
  const el = nodo as { type?: unknown; props?: Record<string, unknown> };
  if (el.type === OnboardingWizard) return el.props ?? null;
  const hijos = el.props?.children;
  for (const hijo of Array.isArray(hijos) ? hijos : [hijos]) {
    const encontrado = propsDelWizard(hijo);
    if (encontrado) return encontrado;
  }
  return null;
}

describe('/bienvenida', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedEnsure.mockResolvedValue({ seeded: false });
    mockedLoad.mockResolvedValue({ items: [], categoryNames: ['OTROS'] });
  });

  it('sin sesión → login, sin sembrar el kit', async () => {
    clienteFalso({ user: null });

    await expect(BienvenidaPage()).rejects.toThrow('NEXT_REDIRECT:/auth/login');
    expect(mockedEnsure).not.toHaveBeenCalled();
  });

  it('con la bienvenida terminada → dashboard, sin sembrar el kit', async () => {
    const { chain } = clienteFalso({
      perfil: { onboarding_completed_at: '2026-09-01T00:00:00.000Z' },
    });

    await expect(BienvenidaPage()).rejects.toThrow('NEXT_REDIRECT:/dashboard');
    expect(chain.eq).toHaveBeenCalledWith('id', USER_ID);
    expect(mockedEnsure).not.toHaveBeenCalled();
  });

  it('siembra el kit ANTES de cargar los rubros del mes y muestra el wizard', async () => {
    const orden: string[] = [];
    mockedEnsure.mockImplementation(async () => {
      orden.push('kit');
      return { seeded: true };
    });
    mockedLoad.mockImplementation(async () => {
      orden.push('datos');
      return { items: [], categoryNames: ['OTROS'] };
    });
    const { client } = clienteFalso();

    const arbol = await BienvenidaPage();

    expect(orden).toEqual(['kit', 'datos']);
    expect(mockedLoad).toHaveBeenCalledWith(client, USER_ID, '2026-09');
    expect(redirect).not.toHaveBeenCalled();
    expect(propsDelWizard(arbol)).toMatchObject({
      items: [],
      categoryNames: ['OTROS'],
    });
  });

  it('si la columna aún no existe (error al leer el perfil) muestra el wizard igual', async () => {
    clienteFalso({ perfil: null, perfilError: { code: '42703' } });

    const arbol = await BienvenidaPage();

    expect(redirect).not.toHaveBeenCalled();
    expect(propsDelWizard(arbol)).not.toBeNull();
  });
});
