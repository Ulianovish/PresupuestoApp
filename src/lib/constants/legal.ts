/**
 * Constantes de las páginas /terms y /privacy.
 */

// CAMBIA ESTE CORREO antes de abrir el registro (tarea humana H9, contratos
// §5.4): es el que ve la gente en /terms y /privacy para pedir una copia,
// corrección o borrado de sus datos, o cerrar su cuenta. Tiene que ser un
// buzón que alguien lea.
export const CONTACT_EMAIL = 'contacto@ejemplo.com';

/** Dominios reservados para ejemplos: nadie lee esos buzones. */
const DOMINIOS_DE_EJEMPLO = ['@ejemplo.com', '@example.com'];

export function isPlaceholderContactEmail(correo: string): boolean {
  const normalizado = correo.trim().toLowerCase();
  return DOMINIOS_DE_EJEMPLO.some(dominio => normalizado.endsWith(dominio));
}

/**
 * Rompe si en producción el correo sigue siendo un marcador: /terms y
 * /privacy prometerían copia, corrección y borrado de datos a través de un
 * buzón que no existe. Se evalúa al cargar este módulo, así que el build de
 * producción de Vercel (VERCEL_ENV === 'production') falla hasta que se
 * resuelva H9. Preview y local lo toleran.
 */
export function assertContactEmailReady(
  correo: string,
  vercelEnv: string | undefined,
): void {
  if (vercelEnv === 'production' && isPlaceholderContactEmail(correo)) {
    throw new Error(
      `CONTACT_EMAIL sigue siendo el marcador "${correo}". Cámbialo en src/lib/constants/legal.ts por un buzón real (tarea humana H9, contratos §5.4) antes de publicar en producción.`,
    );
  }
}

assertContactEmailReady(CONTACT_EMAIL, process.env.VERCEL_ENV);

// Cambia esta fecha cada vez que cambies el texto de /terms o /privacy.
export const LEGAL_UPDATED_AT = '30 de septiembre de 2026';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};
