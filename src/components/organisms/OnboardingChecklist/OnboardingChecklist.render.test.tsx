import React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sin DOM (vitest en node, contratos §5.0): el render es estático. Para probar
// "Ocultar" se captura el onClick del botón y se registra lo que el componente
// le pide a su estado (`oculta`), sin leer el código fuente.
const h = vi.hoisted(() => ({
  onClick: undefined as undefined | (() => void),
  ocultaInicial: false,
  estados: [] as boolean[],
}));

vi.mock('@/lib/actions/onboarding', () => ({
  dismissChecklistAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/atoms/Button/Button', () => ({
  default: (props: { onClick?: () => void; children?: React.ReactNode }) => {
    h.onClick = props.onClick;
    return <button type="button">{props.children}</button>;
  },
}));
vi.mock('react', async importOriginal => {
  const real = await importOriginal<typeof import('react')>();
  const useState = ((inicial: unknown) => {
    // Solo el estado booleano `oculta` del componente.
    if (typeof inicial !== 'boolean') return real.useState(inicial);
    const [valor] = real.useState(h.ocultaInicial);
    return [valor, (v: boolean) => h.estados.push(v)];
  }) as typeof real.useState;
  return { ...real, default: { ...real, useState }, useState };
});

import { dismissChecklistAction } from '@/lib/actions/onboarding';
import {
  computeChecklist,
  DISMISS_ERROR_MESSAGE,
} from '@/lib/onboarding/checklist';

import OnboardingChecklist from './OnboardingChecklist';

const ITEMS = computeChecklist({
  accountCount: 1,
  deudaCount: 2,
  linkedPhoneCount: 0,
  hasDocumento: false,
  hasBudgetAmounts: false,
});

const dismiss = dismissChecklistAction as unknown as ReturnType<typeof vi.fn>;

/** Espera a que terminen las promesas pendientes (la acción y su manejo). */
const vaciarPromesas = () => new Promise(r => setTimeout(r, 0));

describe('OnboardingChecklist (marcado)', () => {
  beforeEach(() => {
    h.ocultaInicial = false;
  });

  it('muestra el título, el avance y el botón "Ocultar"', () => {
    const html = renderToStaticMarkup(<OnboardingChecklist items={ITEMS} />);
    expect(html).toContain('Termina de configurar tu presupuesto');
    expect(html).toContain('1 de 5 listos');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toMatch(/<button[^>]*>[\s\S]*?Ocultar/);
  });

  it('los pendientes enlazan a su página y los hechos van tachados sin enlace', () => {
    const html = renderToStaticMarkup(<OnboardingChecklist items={ITEMS} />);
    expect(html).toContain('href="/presupuesto"');
    expect(html).toContain('href="/settings"');
    expect(html).not.toContain('href="/deudas"');
    expect(html).toMatch(/line-through[^>]*>Registra tarjetas y deudas/);
  });

  it('sin ítems no pinta nada', () => {
    expect(renderToStaticMarkup(<OnboardingChecklist items={[]} />)).toBe('');
  });

  it('oculta no pinta nada', () => {
    h.ocultaInicial = true;
    expect(renderToStaticMarkup(<OnboardingChecklist items={ITEMS} />)).toBe(
      '',
    );
  });
});

describe('OnboardingChecklist ("Ocultar")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.ocultaInicial = false;
    h.estados = [];
    h.onClick = undefined;
    renderToStaticMarkup(<OnboardingChecklist items={ITEMS} />);
  });

  it('esconde la tarjeta al instante y la deja oculta si se guardó', async () => {
    dismiss.mockResolvedValue({ ok: true });

    h.onClick!();
    expect(h.estados).toEqual([true]);
    await vaciarPromesas();

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(h.estados).toEqual([true]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('si la acción devuelve ok:false, la tarjeta vuelve con un toast', async () => {
    dismiss.mockResolvedValue({ ok: false });

    h.onClick!();
    await vaciarPromesas();

    expect(h.estados).toEqual([true, false]);
    expect(toast.error).toHaveBeenCalledWith(DISMISS_ERROR_MESSAGE);
  });

  it('si la acción lanza, la tarjeta vuelve con un toast', async () => {
    dismiss.mockRejectedValue(new Error('red'));

    h.onClick!();
    await vaciarPromesas();

    expect(h.estados).toEqual([true, false]);
    expect(toast.error).toHaveBeenCalledWith(DISMISS_ERROR_MESSAGE);
  });
});
