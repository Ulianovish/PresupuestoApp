/**
 * Lectura de extractos bancarios (Excel o PDF) para actualizar una deuda mes
 * a mes.
 *
 * Cada banco entrega otro formato, así que el mapeo de columnas lo propone un
 * modelo y SIEMPRE lo confirma la persona antes de guardar: una columna mal
 * interpretada dejaría saldos falsos en varios meses y cuesta notarlo después.
 *
 * Módulo puro (sin red ni React) para poder probar el contrato con el modelo.
 */

export interface FilaExtracto {
  /** Mes del corte, en formato YYYY-MM. */
  mes: string;
  /** Saldo pendiente al corte. */
  saldo: number | null;
  /** Cuota del mes. */
  cuota: number | null;
  cuotasPagas: number | null;
  cuotasFaltantes: number | null;
}

export interface ContextoDeuda {
  descripcion: string;
  acreedor: string;
}

/** Prompt que se le manda al modelo junto con el texto del extracto. */
export function buildExtractoPrompt(
  texto: string,
  deuda: ContextoDeuda,
): string {
  return [
    'Eres un asistente financiero. Te paso el texto de un extracto bancario',
    `de la deuda "${deuda.descripcion} · ${deuda.acreedor}".`,
    '',
    'Extrae UNA FILA POR CADA CORTE MENSUAL que encuentres, con:',
    '- mes: el mes del corte en formato YYYY-MM',
    '- saldo: saldo de capital pendiente al corte (número, sin separadores)',
    '- cuota: valor de la cuota de ese mes',
    '- cuotasPagas: número de cuota pagada (la cuota #)',
    '- cuotasFaltantes: cuotas que quedan pendientes',
    '',
    'Reglas:',
    '- Si un dato no aparece, usa null. No lo inventes ni lo estimes.',
    '- Los montos en pesos colombianos van sin puntos ni comas de miles.',
    '- Si el extracto trae un solo corte, devuelve una sola fila.',
    '- Ordena de más antiguo a más reciente.',
    '',
    'Responde SOLO con JSON:',
    '{"filas":[{"mes":"2026-01","saldo":0,"cuota":0,"cuotasPagas":0,"cuotasFaltantes":0}]}',
    '',
    'EXTRACTO:',
    texto,
  ].join('\n');
}

/** Extrae el primer objeto JSON del texto, tolerando cercos de código. */
function extraerJson(contenido: string): unknown | null {
  const limpio = contenido.trim().replace(/^```(?:json)?|```$/g, '');
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin === -1 || fin < inicio) return null;
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Lee un número en formato colombiano: el punto separa miles y la coma los
 * decimales ("2.744.318,52"). Un modelo puede devolverlo así aunque se le pida
 * sin separadores, y leerlo mal cambia el saldo por un factor de mil.
 */
export function numeroColombiano(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null;

  let t = String(v)
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (!t) return null;

  const tienePunto = t.includes('.');
  const tieneComa = t.includes(',');

  if (tienePunto && tieneComa) {
    // El separador decimal es el que aparece de último.
    const decimal = t.lastIndexOf(',') > t.lastIndexOf('.') ? ',' : '.';
    const miles = decimal === ',' ? '.' : ',';
    t = t.split(miles).join('').replace(decimal, '.');
  } else if (tieneComa) {
    // Una coma sola: decimal si deja 1 o 2 dígitos, si no son miles.
    t = /,\d{3}\b/.test(t) ? t.split(',').join('') : t.replace(',', '.');
  } else if (tienePunto) {
    // Un punto solo: miles si agrupa de a tres ("2.744.318").
    if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.split('.').join('');
  }

  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const numeroONull = numeroColombiano;

/**
 * Valida la respuesta del modelo. Descarta cualquier fila sin un mes válido:
 * sin mes no se sabe dónde guardarla, y guardarla en el mes equivocado es
 * peor que no guardarla.
 */
export function parseExtractoResponse(
  contenido: string | null,
): FilaExtracto[] {
  if (!contenido) return [];
  const parsed = extraerJson(contenido) as { filas?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.filas)) return [];

  const vistas = new Set<string>();
  const filas: FilaExtracto[] = [];

  for (const cruda of parsed.filas) {
    const f = cruda as Record<string, unknown>;
    const mes = typeof f.mes === 'string' ? f.mes.trim() : '';
    if (!MES.test(mes) || vistas.has(mes)) continue;

    const fila: FilaExtracto = {
      mes,
      saldo: numeroONull(f.saldo),
      cuota: numeroONull(f.cuota),
      cuotasPagas: numeroONull(f.cuotasPagas),
      cuotasFaltantes: numeroONull(f.cuotasFaltantes),
    };

    // Una fila sin ningún dato no aporta nada y solo ensucia la vista previa.
    const tieneAlgo =
      fila.saldo !== null ||
      fila.cuota !== null ||
      fila.cuotasPagas !== null ||
      fila.cuotasFaltantes !== null;
    if (!tieneAlgo) continue;

    vistas.add(mes);
    filas.push(fila);
  }

  return filas.sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Convierte una hoja de cálculo ya leída en texto plano para el modelo. */
export function filasATexto(filas: unknown[][], maxFilas = 60): string {
  return filas
    .slice(0, maxFilas)
    .map(fila =>
      fila
        .map(c => (c === null || c === undefined ? '' : String(c)))
        .join(' | '),
    )
    .join('\n');
}

export interface ValoresMes {
  saldoPendiente: number;
  valorCuota: number;
  cuotasPagas: number;
  cuotasFaltantes: number;
}

/**
 * Combina lo que el modelo leyó del extracto con lo que ya había guardado en
 * ese mes. Un dato que el extracto no trae (null) conserva el valor actual en
 * vez de caer a cero: el extracto aporta lo que sabe, no borra lo demás.
 */
export function fusionarFila(
  fila: FilaExtracto,
  actual: ValoresMes | null,
): ValoresMes {
  const base = actual ?? {
    saldoPendiente: 0,
    valorCuota: 0,
    cuotasPagas: 0,
    cuotasFaltantes: 0,
  };
  return {
    saldoPendiente: fila.saldo ?? base.saldoPendiente,
    valorCuota: fila.cuota ?? base.valorCuota,
    cuotasPagas: fila.cuotasPagas ?? base.cuotasPagas,
    cuotasFaltantes: fila.cuotasFaltantes ?? base.cuotasFaltantes,
  };
}

/** Tope de texto que se le manda al modelo, para no reventar el contexto. */
export const MAX_TEXTO_EXTRACTO = 20000;

export function recortarTexto(texto: string, max = MAX_TEXTO_EXTRACTO): string {
  return texto.length <= max ? texto : `${texto.slice(0, max)}\n[...]`;
}
