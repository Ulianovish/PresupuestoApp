// Lista de NIT/documentos que se le pasan a los scrapers para buscar una
// factura por CUFE. La DIAN exige el documento del emisor o del receptor, y
// muchos QR traen solo el link (sin NitFac/DocAdq): ahí los genéricos de
// consumidor final solo aciertan si el comprador no se identificó. Casi
// siempre el comprador es una de las personas que comparten la cuenta, así
// que se prueba su documento (el cargado en Ajustes para cada número).
//
// Módulo puro (sin DB ni red): lo usan el webhook de WhatsApp, el route web y
// el formulario de Ajustes (la validación).

/** Tope del regex de los scrapers (`^\d{5,15}(,\d{5,15}){0,4}$`). */
export const MAX_NITS_BUSQUEDA = 5;

const FORMATO_NIT = /^\d{5,15}$/;

/**
 * NIT genéricos de consumidor final: los scrapers ya los prueban solos como
 * respaldo; mandarlos también gastaría un cupo repitiendo el mismo intento.
 */
const NITS_GENERICOS = new Set(['222222222222', '2222222222']);

export interface NitsBusquedaInput {
  /** NitFac y DocAdq del bloque del QR, en ese orden (ver `extractQrNits`). */
  qrNits: string[];
  /** Documento cargado para el número que mandó el CUFE (null si no hay). */
  docRemitente: string | null;
  /** Documentos de los demás números vinculados a la misma cuenta. */
  docsOtros: Array<string | null>;
}

/**
 * Orden de prueba: [NitFac, DocAdq, documento del remitente, documentos de los
 * otros números]. Deduplica conservando la primera aparición, descarta lo mal
 * formado y los genéricos, y corta en `MAX_NITS_BUSQUEDA`. Puede devolver []:
 * el motor entonces no manda `nits` y los scrapers usan solo los genéricos.
 */
export function ordenarNitsBusqueda({
  qrNits,
  docRemitente,
  docsOtros,
}: NitsBusquedaInput): string[] {
  const out: string[] = [];
  for (const nit of [...qrNits, docRemitente, ...docsOtros]) {
    if (out.length >= MAX_NITS_BUSQUEDA) break;
    if (!nit || !FORMATO_NIT.test(nit)) continue;
    if (NITS_GENERICOS.has(nit) || out.includes(nit)) continue;
    out.push(nit);
  }
  return out;
}

export interface LinkConDocumento {
  phone_e164: string;
  documento: string | null;
}

/**
 * Separa el documento del número que escribió de los de los demás números de
 * la cuenta (sin los vacíos).
 */
export function separarDocumentosPorRemitente(
  links: LinkConDocumento[],
  phoneRemitente: string,
): { docRemitente: string | null; docsOtros: string[] } {
  let docRemitente: string | null = null;
  const docsOtros: string[] = [];
  for (const link of links) {
    if (link.phone_e164 === phoneRemitente) {
      docRemitente = link.documento || null;
    } else if (link.documento) {
      docsOtros.push(link.documento);
    }
  }
  return { docRemitente, docsOtros };
}

export type ValidacionDocumento =
  | { ok: true; documento: string | null }
  | { ok: false; error: string };

export const ERROR_DOCUMENTO =
  'Escribí solo los números del documento, entre 5 y 15 dígitos (sin guion ni dígito de verificación).';

/**
 * Valida la cédula/NIT que se escribe en Ajustes. Tolera espacios y puntos de
 * miles ("1.000.000.001"); vacío significa borrar el documento (null). Mismo
 * formato que el CHECK de `whatsapp_links.documento`.
 */
export function validarDocumento(
  raw: string | null | undefined,
): ValidacionDocumento {
  const limpio = (raw ?? '').replace(/[\s.]/g, '');
  if (limpio === '') return { ok: true, documento: null };
  if (!FORMATO_NIT.test(limpio)) return { ok: false, error: ERROR_DOCUMENTO };
  return { ok: true, documento: limpio };
}
