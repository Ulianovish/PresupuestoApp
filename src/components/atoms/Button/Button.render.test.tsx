import { isValidElement, type ReactNode } from 'react';

import Link from 'next/link';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Button from './Button';

/** Clase suelta (no variantes como `disabled:pointer-events-none`). */
function tieneClase(etiqueta: string, clase: string): boolean {
  const m = etiqueta.match(/class="([^"]*)"/);
  return Boolean(m && m[1].split(/\s+/).includes(clase));
}

/** Etiqueta de apertura del primer <a> del marcado. */
function etiquetaA(html: string): string {
  const m = html.match(/<a\b[^>]*>/);
  if (!m) throw new Error(`no hay <a> en: ${html}`);
  return m[0];
}

// Deuda S13: con `href`, disabled/loading no deben dejar navegar.
describe('Button con href', () => {
  it('habilitado: enlace navegable, sin aria-disabled', () => {
    const a = etiquetaA(
      renderToStaticMarkup(<Button href="/gastos">Ir</Button>),
    );
    expect(a).toContain('href="/gastos"');
    expect(a).not.toContain('aria-disabled');
    expect(a).not.toContain('tabindex="-1"');
    expect(tieneClase(a, 'pointer-events-none')).toBe(false);
  });

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ])(
    '%s: aria-disabled, fuera del tab y sin eventos de puntero',
    (_, extra) => {
      const html = renderToStaticMarkup(
        <Button href="/gastos" {...extra}>
          Ir
        </Button>,
      );
      const a = etiquetaA(html);
      expect(a).toContain('aria-disabled="true"');
      expect(a).toContain('tabindex="-1"');
      expect(tieneClase(a, 'pointer-events-none')).toBe(true);
      expect(html).not.toContain('<button');
    },
  );
});

/** Props del <Link> dentro del árbol que devuelve Button (sin renderizar). */
function propsDelLink(nodo: ReactNode): Record<string, unknown> | null {
  if (!isValidElement(nodo)) return null;
  const props = nodo.props as Record<string, unknown> & {
    children?: ReactNode;
  };
  if (nodo.type === Link) return props;
  const hijos = Array.isArray(props.children)
    ? props.children
    : [props.children];
  for (const hijo of hijos) {
    const encontrado = propsDelLink(hijo as ReactNode);
    if (encontrado) return encontrado;
  }
  return null;
}

describe('Button con href: onClick', () => {
  it('habilitado: el Link recibe el onClick', () => {
    const onClick = vi.fn();
    const link = propsDelLink(
      Button({ href: '/gastos', onClick, children: 'Ir' }),
    );
    expect(link).not.toBeNull();
    const evento = { preventDefault: vi.fn() };
    (link!.onClick as (e: unknown) => void)(evento);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(evento.preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ])('%s: el clic no navega ni llama onClick', (_, extra) => {
    const onClick = vi.fn();
    const link = propsDelLink(
      Button({ href: '/gastos', onClick, children: 'Ir', ...extra }),
    );
    const evento = { preventDefault: vi.fn() };
    (link!.onClick as (e: unknown) => void)(evento);
    expect(evento.preventDefault).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });
});
