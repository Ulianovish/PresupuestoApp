/**
 * Constantes de las páginas /terms y /privacy.
 */

// CAMBIA ESTE CORREO antes de abrir el registro (tarea humana H9, contratos
// §5.4): es el que ve la gente en /terms y /privacy para pedir una copia,
// corrección o borrado de sus datos, o cerrar su cuenta. Tiene que ser un
// buzón que alguien lea.
export const CONTACT_EMAIL = 'contacto@ejemplo.com';

// Cambia esta fecha cada vez que cambies el texto de /terms o /privacy.
export const LEGAL_UPDATED_AT = '30 de septiembre de 2026';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};
