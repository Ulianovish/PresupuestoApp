/**
 * Indicadores básicos de endeudamiento.
 *
 * Calcula qué parte del ingreso neto de un mes se destina a pagar deudas:
 *
 *   % consumo = pagos mensuales a deuda de consumo / ingreso neto * 100
 *   % total   = pagos mensuales a todas las deudas  / ingreso neto * 100
 *
 * Módulo puro (sin Supabase ni React) para poder probarlo de forma aislada.
 */

import { totalIngresosDelMes, type IngresoConFecha } from './ingresos-mes';

/** Deuda reducida a lo que necesitan los indicadores. */
export interface DeudaParaIndicador {
  /** 'tarjeta_credito' = deuda de consumo; cualquier otro valor = deuda de activos. */
  tipo?: string | null;
  tipo_deuda?: string | null;
  /** Cuota mensual. Puede venir nula o en 0 si aún no se registra. */
  valor_cuota?: number | null;
  pagada?: boolean | null;
  es_activo?: boolean | null;
}

/** Ingreso reducido a lo que necesitan los indicadores. */
export type IngresoParaIndicador = IngresoConFecha;

export interface IndicadoresEndeudamiento {
  /** Suma de cuotas mensuales de deudas de consumo. */
  pagosConsumo: number;
  /** Suma de cuotas mensuales de todas las deudas. */
  pagosTotales: number;
  ingresoNeto: number;
  /** Porcentaje del ingreso destinado a deuda de consumo; null si no hay ingreso. */
  porcentajeConsumo: number | null;
  /** Porcentaje del ingreso destinado a todas las deudas; null si no hay ingreso. */
  porcentajeTotal: number | null;
}

/** Una deuda cuenta solo si está activa y todavía no se ha pagado. */
function cuenta(deuda: DeudaParaIndicador): boolean {
  return deuda.es_activo !== false && deuda.pagada !== true;
}

/** Es deuda de consumo si está clasificada como tarjeta de crédito. */
export function esDeudaDeConsumo(deuda: DeudaParaIndicador): boolean {
  return (
    deuda.tipo === 'tarjeta_credito' || deuda.tipo_deuda === 'tarjeta_credito'
  );
}

/**
 * Suma los ingresos de un mes concreto.
 *
 * @param mes Mes en formato YYYY-MM.
 */
export function ingresoNetoDelMes(
  ingresos: IngresoParaIndicador[],
  mes: string,
): number {
  return totalIngresosDelMes(ingresos, mes);
}

/**
 * Calcula los dos indicadores de endeudamiento.
 *
 * Si el ingreso neto es 0 (o negativo) los porcentajes quedan en null: no se
 * inventa un número ni se devuelve Infinity, la interfaz avisa que falta el
 * ingreso del mes.
 */
export function calcularIndicadores(
  deudas: DeudaParaIndicador[],
  ingresoNeto: number,
): IndicadoresEndeudamiento {
  const vigentes = deudas.filter(cuenta);

  const pagosTotales = vigentes.reduce(
    (sum, d) => sum + (d.valor_cuota ?? 0),
    0,
  );
  const pagosConsumo = vigentes
    .filter(esDeudaDeConsumo)
    .reduce((sum, d) => sum + (d.valor_cuota ?? 0), 0);

  const hayIngreso = ingresoNeto > 0;

  return {
    pagosConsumo,
    pagosTotales,
    ingresoNeto,
    porcentajeConsumo: hayIngreso ? (pagosConsumo / ingresoNeto) * 100 : null,
    porcentajeTotal: hayIngreso ? (pagosTotales / ingresoNeto) * 100 : null,
  };
}
