/**
 * Canario del CUFE: corre una factura conocida por CADA motor y avisa si alguno
 * dejó de funcionar.
 *
 * Por qué existe: la DIAN cambia el portal sin aviso y los fallos son
 * SILENCIOSOS — en jul-2026 agregó un campo NIT obligatorio y el scraper quedó
 * roto ~6 semanas sin que nadie se enterara (el síntoma parecía "captcha"). Un
 * canario diario convierte esas semanas en un día.
 *
 * Deliberadamente NO toca la base: no crea `electronic_invoices` ni gasta cupo
 * del usuario. Solo verifica que cada motor devuelva una factura con ítems.
 */
import { fetchFromVps, streamUpstreamOnce } from './process-invoice';

/** CUFE de referencia (POS de FRUTAS Y VERDURAS EL MONO, 15-04-2026). */
const CUFE_POR_DEFECTO =
  '851ebe2634d27d0b16e0d7625f3ce95231d09557c4d6d4a76e82a026ab8c24360c3d10c0da416340c77ff1c350eb3a45';

/** Techo por motor. El piso real del portal es ~50s; 150s deja margen sin colgar la función. */
const TIMEOUT_POR_MOTOR_MS = 150_000;

export type Motor = 'VPS' | 'Vercel';

export interface ResultadoMotor {
  motor: Motor;
  ok: boolean;
  segundos: number;
  items?: number;
  comercio?: string;
  error?: string;
}

export interface ResultadoCanario {
  cufe: string;
  motores: ResultadoMotor[];
  /** Mensaje a enviar, o null si está todo sano (el canario calla cuando todo anda). */
  alerta: string | null;
}

async function medir(
  motor: Motor,
  ejecutar: () => Promise<{
    success?: boolean;
    items?: unknown[];
    invoice_details?: { storeName?: string };
  }>,
): Promise<ResultadoMotor> {
  const t0 = Date.now();
  try {
    const r = await ejecutar();
    const segundos = Math.round((Date.now() - t0) / 1000);
    const items = Array.isArray(r.items) ? r.items.length : 0;
    // Un motor que responde "ok" pero sin ítems está roto a medias: la
    // extracción del PDF falló aunque la descarga funcionara. Cuenta como falla.
    if (!items) {
      return { motor, ok: false, segundos, items: 0, error: 'respondió sin ítems' };
    }
    return {
      motor,
      ok: true,
      segundos,
      items,
      comercio: r.invoice_details?.storeName,
    };
  } catch (err) {
    return {
      motor,
      ok: false,
      segundos: Math.round((Date.now() - t0) / 1000),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Arma el aviso. Devuelve null si todos los motores pasaron. */
export function construirAlerta(
  cufe: string,
  motores: ResultadoMotor[],
): string | null {
  const fallados = motores.filter(m => !m.ok);
  if (!fallados.length) return null;

  const todos = fallados.length === motores.length;
  const encabezado = todos
    ? '🚨 El CUFE dejó de funcionar en TODOS los motores.'
    : `⚠️ El CUFE falló en ${fallados.map(m => m.motor).join(' y ')} (el resto sigue bien).`;

  const detalle = motores
    .map(m =>
      m.ok
        ? `✅ ${m.motor}: ${m.items} ítems en ${m.segundos}s`
        : `❌ ${m.motor} (${m.segundos}s): ${m.error}`,
    )
    .join('\n');

  return `${encabezado}\n\n${detalle}\n\nFactura de prueba: ${cufe.slice(0, 16)}…\nLa DIAN suele romper esto cambiando el formulario sin avisar.`;
}

/**
 * Corre el canario. Los motores van EN SERIE a propósito: el VPS procesa de a
 * una factura (mutex), así que en paralelo se estorbarían y el 429 se leería
 * como caída.
 */
export async function correrCanario(
  cufe: string = process.env.DIAN_CANARY_CUFE || CUFE_POR_DEFECTO,
): Promise<ResultadoCanario> {
  const motores: ResultadoMotor[] = [];

  if (process.env.DIAN_VPS_URL) {
    motores.push(
      await medir('VPS', () =>
        fetchFromVps(cufe, undefined, TIMEOUT_POR_MOTOR_MS),
      ),
    );
  }

  const base = process.env.FACTURA_DIAN_URL || 'https://factura-dian.vercel.app';
  const method = process.env.FACTURA_DIAN_METHOD || 'python';
  const url = `${base}/api/cufe-to-data-stream?cufe=${encodeURIComponent(
    cufe,
  )}&method=${method}&download-pdf=false`;
  motores.push(await medir('Vercel', () => streamUpstreamOnce(url)));

  return { cufe, motores, alerta: construirAlerta(cufe, motores) };
}
