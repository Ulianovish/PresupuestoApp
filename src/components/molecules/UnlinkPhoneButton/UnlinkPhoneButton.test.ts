import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Test de texto (contratos §5.0): vitest corre en `node`, sin DOM. Se lee el
// fuente; un archivo que aún no existe se lee como '' para que el test falle
// por aserción y no por excepción.
const leer = (ruta: string) => {
  const abs = resolve(process.cwd(), ruta);
  return existsSync(abs) ? readFileSync(abs, 'utf8') : '';
};

const boton = leer(
  'src/components/molecules/UnlinkPhoneButton/UnlinkPhoneButton.tsx',
);
const ajustes = leer('src/app/settings/page.tsx');
const modal = leer('src/components/atoms/ConfirmModal/ConfirmModal.tsx');

describe('archivos leídos', () => {
  // `leer` devuelve '' si el archivo falta: sin esto, los `not.toContain`
  // pasarían en falso.
  it('existen', () => {
    expect(boton).not.toBe('');
    expect(ajustes).not.toBe('');
    expect(modal).not.toBe('');
  });
});

describe('UnlinkPhoneButton (S13, contratos §5.2)', () => {
  it('desvincula por el id del link con la server action', () => {
    expect(boton).toContain('confirmarDesvinculo(linkId');
    expect(boton).toContain('unlink: unlinkWhatsAppLinkAction');
    expect(boton).toContain('linkId: string;');
    expect(boton).toContain('maskedPhone: string;');
  });
});

describe('Ajustes: el número completo no llega al navegador', () => {
  it('la lista usa el id como key y se lo pasa al botón', () => {
    expect(ajustes).toContain('key={l.id as string}');
    expect(ajustes).toContain('linkId={l.id as string}');
    expect(ajustes).not.toContain('key={l.phone_e164');
  });

  it('al botón solo llegan el id y el número enmascarado', () => {
    expect(ajustes).toContain('enmascararTelefono(l.phone_e164');
    const props = ajustes.match(/<UnlinkPhoneButton([\s\S]*?)\/>/)?.[1] ?? '';
    expect(props).toContain('maskedPhone={masked}');
    expect(props).not.toContain('phone_e164');
    expect(boton).not.toContain('phone_e164');
    expect(boton).not.toContain('console.');
  });

  it('no hay server action en línea ni la acción vieja por teléfono', () => {
    expect(ajustes).not.toContain("'use server'");
    expect(ajustes).not.toContain('unlinkWhatsAppPhoneAction');
    expect(ajustes).not.toContain('maskPhone');
  });
});

describe('Ajustes: lista de números vinculados', () => {
  it('la fecha de vinculación se muestra en horario de Bogotá', () => {
    expect(ajustes).toContain('formatearFechaBogota(l.linked_at');
    expect(ajustes).not.toContain('toLocaleDateString(');
  });

  it('si la consulta falla muestra un error y no el estado vacío', () => {
    expect(ajustes).toMatch(/const \{ data: links, error: linksError \}/);
    expect(ajustes).toContain('linksError.code');
    expect(ajustes).toContain('No pudimos cargar tus números vinculados');
    expect(ajustes).toMatch(
      /linksError \?[\s\S]*?Aún no hay números vinculados/,
    );
  });
});

describe('UnlinkPhoneButton: confirmación', () => {
  // La lógica (toasts y cierre) se prueba en confirmar-desvinculo.test.ts.
  it('la confirmación muestra el número enmascarado', () => {
    expect(boton).toContain('message={`El número ${maskedPhone}');
  });

  it('usa confirmarDesvinculo y solo cierra el modal si salió bien', () => {
    expect(boton).toContain('confirmarDesvinculo(linkId');
    expect(boton).toMatch(/if \(cerrar\) setOpen\(false\)/);
  });

  it('mientras carga el botón dice "Desvinculando...", no "Eliminando..."', () => {
    expect(boton).toContain('loadingText="Desvinculando..."');
    expect(modal).toContain("loadingText = 'Eliminando...'");
    expect(modal).toContain('{isLoading ? loadingText : confirmText}');
  });
});
