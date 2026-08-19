/**
 * Normalización de texto para descripciones y lugares.
 *
 * Los gastos llegan de fuentes distintas (facturas DIAN en MAYÚSCULAS, Excel,
 * WhatsApp, escritura manual), así que se guardan con un formato uniforme:
 * cada palabra con la primera letra en mayúscula y el resto en minúscula.
 *
 * Replica la semántica de `initcap` de Postgres —cualquier carácter que no sea
 * letra o número actúa como separador— para que el mismo texto quede igual sin
 * importar si lo normaliza la base de datos o la aplicación.
 */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(
      /(^|[^\p{L}\p{N}])(\p{L})/gu,
      (_match, sep: string, letter: string) => sep + letter.toUpperCase(),
    );
}
