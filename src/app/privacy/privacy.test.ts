import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { CONTACT_EMAIL } from '@/lib/constants/legal';

import { PRIVACY_SECTIONS } from './content';

const texto = JSON.stringify(PRIVACY_SECTIONS);

describe('contenido de /privacy', () => {
  it('cada sección tiene título y al menos un párrafo', () => {
    expect(PRIVACY_SECTIONS.length).toBeGreaterThanOrEqual(6);
    for (const seccion of PRIVACY_SECTIONS) {
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.paragraphs.length).toBeGreaterThan(0);
      for (const parrafo of seccion.paragraphs) {
        expect(parrafo.trim()).not.toBe('');
      }
    }
  });

  it('nombra a todos los proveedores que reciben datos', () => {
    for (const proveedor of [
      'Supabase',
      'Vercel',
      'Twilio',
      'Meta',
      'Vercel AI Gateway',
      'MiniMax',
      'Resend',
      'DIAN',
    ]) {
      expect(texto).toContain(proveedor);
    }
  });

  it('dice qué datos guarda la app', () => {
    for (const dato of [
      'correo',
      'gastos',
      'CUFE',
      'número',
      'cédula',
      'últimos 6 mensajes',
    ]) {
      expect(texto).toContain(dato);
    }
  });

  it('dice qué no guarda', () => {
    expect(texto).toContain('fotos');
    expect(texto.toLowerCase()).toContain('números de tarjeta');
  });

  it('explica cómo pedir el borrado con el correo de contacto', () => {
    expect(texto).toContain('borr');
    expect(texto).toContain(CONTACT_EMAIL);
  });

  it('no inventa responsables ni trae datos personales', () => {
    expect(texto).toContain('quien administra la app');
    const correos = texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    expect(correos.length).toBeGreaterThan(0);
    for (const correo of correos) expect(correo).toBe(CONTACT_EMAIL);
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toMatch(/\+\d/);
  });

  it('usa tuteo, no voseo', () => {
    expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribí\b/i);
  });
});

describe('CONTACT_EMAIL', () => {
  it('es un correo válido', () => {
    expect(z.string().email().safeParse(CONTACT_EMAIL).success).toBe(true);
  });
});

describe('página /privacy', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/app/privacy/page.tsx'),
    'utf8',
  );

  it('es un server component que exporta la página por defecto', () => {
    expect(fuente).not.toContain("'use client'");
    expect(fuente).toMatch(/export default function PrivacyPage\(/);
    expect(fuente).toContain('export const metadata');
  });

  it('pinta el contenido y el correo de contacto desde las constantes', () => {
    expect(fuente).toContain('PRIVACY_SECTIONS.map');
    expect(fuente).toContain('mailto:${CONTACT_EMAIL}');
    expect(fuente).toContain('LEGAL_UPDATED_AT');
    expect(fuente).toContain('href="/terms"');
  });
});
