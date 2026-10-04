/**
 * Dinero expresado en tiempo de vida.
 *
 *   horas de vida = precio ÷ precio real de tu hora
 *
 * El precio de la hora sale del índice 7 (Precio Hora de Vida): el ingreso que
 * trabajas en el mes dividido por las horas que trabajas. Sin ese dato no se
 * puede convertir nada, y se dice así en vez de inventar una cifra.
 *
 * Módulo puro (sin Supabase ni React).
 */

/** Jornada de referencia para expresar las horas en días. */
export const HORAS_POR_DIA = 8;
/** Días laborales de referencia al mes. */
export const DIAS_POR_MES = 20;

export function precioHora(
  ingresoTrabajadoMes: number,
  horasTrabajadasMes: number | null | undefined,
): number | null {
  if (!horasTrabajadasMes || horasTrabajadasMes <= 0) return null;
  if (ingresoTrabajadoMes <= 0) return null;
  return ingresoTrabajadoMes / horasTrabajadasMes;
}

/** Cuántas horas de vida cuesta un monto. */
export function horasDeVida(
  monto: number,
  valorHora: number | null,
): number | null {
  if (!valorHora || valorHora <= 0) return null;
  return monto / valorHora;
}

/**
 * Expresa las horas en la unidad que mejor se entiende: minutos para lo
 * pequeño, horas, días de jornada, y meses cuando la cifra se vuelve enorme.
 * Un saldo de 2.260 horas no dice nada; "14 meses de trabajo" sí.
 */
export function formatearTiempo(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 0) return '—';

  if (horas < 1) {
    const minutos = Math.round(horas * 60);
    return `${minutos} min de trabajo`;
  }
  if (horas < HORAS_POR_DIA) {
    return `${horas.toFixed(1)} h de trabajo`;
  }

  const dias = horas / HORAS_POR_DIA;
  if (dias < DIAS_POR_MES) {
    return `${dias.toFixed(1)} días de trabajo`;
  }

  const meses = dias / DIAS_POR_MES;
  return `${meses.toFixed(1)} meses de trabajo`;
}

/** Atajo: monto a texto de tiempo. */
export function montoEnTiempo(monto: number, valorHora: number | null): string {
  return formatearTiempo(horasDeVida(monto, valorHora));
}
