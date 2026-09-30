import { createElement, type ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// El Dialog de Radix monta el contenido en un portal, que no se renderiza en
// servidor: se sustituye por contenedores simples para ver el contenido.
vi.mock('@/components/ui/dialog', () => {
  const contenedor = ({ children }: { children?: ReactNode }) =>
    createElement('div', null, children);
  return {
    Dialog: contenedor,
    DialogContent: contenedor,
    DialogDescription: contenedor,
    DialogHeader: contenedor,
    DialogTitle: contenedor,
  };
});

import ExpenseModal from './ExpenseModal';

function renderizar(props: {
  submitDisabled?: boolean;
  submitDisabledLabel?: string;
  isEditing?: boolean;
}): string {
  return renderToStaticMarkup(
    createElement(ExpenseModal, {
      isOpen: true,
      isEditing: props.isEditing ?? false,
      formData: {
        description: '',
        amount: 0,
        transaction_date: '2026-09-01',
        category_name: '',
        account_name: 'Efectivo',
        place: '',
      },
      expenseCategories: [],
      accountTypes: ['Efectivo'],
      onFormChange: () => {},
      onSubmit: () => {},
      onClose: () => {},
      submitDisabled: props.submitDisabled,
      submitDisabledLabel: props.submitDisabledLabel,
    }),
  );
}

/** El <button type="submit"> del formulario, con sus atributos y texto. */
function botonGuardar(html: string): { disabled: boolean; texto: string } {
  const m = html.match(/<button([^>]*type="submit"[^>]*)>([\s\S]*?)<\/button>/);
  if (!m) throw new Error('No se encontró el botón de guardar');
  return {
    disabled: /\sdisabled(=""|\s|$)/.test(m[1]),
    texto: m[2].replace(/<[^>]*>/g, '').trim(),
  };
}

describe('ExpenseModal sin categorías (contratos §2.6 y §5.2)', () => {
  it('bloqueado por falta de categorías: botón deshabilitado con el texto y aviso a /settings', () => {
    const html = renderizar({
      submitDisabled: true,
      submitDisabledLabel: 'Primero crea una categoría',
    });

    expect(botonGuardar(html)).toEqual({
      disabled: true,
      texto: 'Primero crea una categoría',
    });
    expect(html).toContain('href="/settings"');
    expect(html).toContain('Aún no tienes categorías');
  });

  it('deshabilitado sin texto (categorías cargando): sin aviso ni enlace a /settings', () => {
    const html = renderizar({ submitDisabled: true });

    expect(botonGuardar(html)).toEqual({
      disabled: true,
      texto: 'Agregar Gasto',
    });
    expect(html).not.toContain('href="/settings"');
    expect(html).not.toContain('Aún no tienes categorías');
  });

  it('habilitado: botón normal y sin aviso', () => {
    const html = renderizar({});

    expect(botonGuardar(html)).toEqual({
      disabled: false,
      texto: 'Agregar Gasto',
    });
    expect(html).not.toContain('href="/settings"');
  });

  it('un texto sin deshabilitar no muestra el aviso', () => {
    const html = renderizar({
      submitDisabled: false,
      submitDisabledLabel: 'Primero crea una categoría',
      isEditing: true,
    });

    expect(botonGuardar(html)).toEqual({
      disabled: false,
      texto: 'Actualizar Gasto',
    });
    expect(html).not.toContain('href="/settings"');
  });
});
