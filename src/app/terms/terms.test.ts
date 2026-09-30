import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { CONTACT_EMAIL } from '@/lib/constants/legal';

import { TERMS_SECTIONS } from './content';

const texto = JSON.stringify(TERMS_SECTIONS);

describe('contenido de /terms', () => {
  it('cada sección tiene título y al menos un párrafo', () => {
    expect(TERMS_SECTIONS.length).toBeGreaterThanOrEqual(6);
    for (const seccion of TERMS_SECTIONS) {
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.paragraphs.length).toBeGreaterThan(0);
      for (const parrafo of seccion.paragraphs) {
        expect(parrafo.trim()).not.toBe('');
      }
    }
  });

  it('cubre lo que una persona invitada necesita saber', () => {
    for (const tema of [
      'invitación',
      'al menos 8 caracteres',
      'número vinculado',
      'inteligencia artificial',
      'pesos colombianos (COP)',
      'asesoría financiera',
      'política de privacidad',
    ]) {
      expect(texto).toContain(tema);
    }
  });

  it('dice cómo cerrar la cuenta con el correo de contacto', () => {
    expect(texto).toContain('cierre tu cuenta');
    expect(texto).toContain(CONTACT_EMAIL);
  });

  it('no inventa responsables ni trae datos personales', () => {
    expect(texto).toContain('quien administra la app');
    const correos = texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    for (const correo of correos) expect(correo).toBe(CONTACT_EMAIL);
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toMatch(/\+\d/);
  });

  it('usa tuteo, no voseo', () => {
    expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribí\b/i);
  });
});

describe('página /terms', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/app/terms/page.tsx'),
    'utf8',
  );

  it('es un server component que exporta la página por defecto', () => {
    expect(fuente).not.toContain("'use client'");
    expect(fuente).toMatch(/export default function TermsPage\(/);
    expect(fuente).toContain('export const metadata');
  });

  it('pinta el contenido y el correo de contacto desde las constantes', () => {
    expect(fuente).toContain('TERMS_SECTIONS.map');
    expect(fuente).toContain('mailto:${CONTACT_EMAIL}');
    expect(fuente).toContain('LEGAL_UPDATED_AT');
    expect(fuente).toContain('href="/privacy"');
  });
});
