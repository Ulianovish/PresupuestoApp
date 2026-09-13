/**
 * IndicadoresEndeudamiento - Organism Level
 *
 * Muestra los indicadores básicos de endeudamiento sobre el ingreso neto del
 * mes seleccionado, uno por cada grupo de deudas más el total:
 *
 *   - % del ingreso destinado a deudas de consumo (tarjetas de crédito)
 *   - % del ingreso destinado a deudas de activos
 *   - % del ingreso destinado a todas las deudas
 *
 * Debajo de cada porcentaje se deja a la vista la división que lo produce,
 * para que el número sea auditable de un vistazo.
 */

import React from 'react';

import { AlertTriangle, Percent } from 'lucide-react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import {
  alertasEndeudamiento,
  type IndicadoresEndeudamiento as Indicadores,
} from '@/lib/indicadores-endeudamiento';

interface IndicadoresEndeudamientoProps {
  indicadores: Indicadores;
  /** Mes al que corresponde el ingreso, ya formateado (p. ej. "Agosto 2026"). */
  nombreMes: string;
  formatCurrency: (amount: number) => string;
}

/** Un indicador: porcentaje grande y la fracción que lo compone debajo. */
function Indicador({
  titulo,
  porcentaje,
  numerador,
  formatCurrency,
  ingresoNeto,
}: {
  titulo: string;
  porcentaje: number | null;
  numerador: number;
  formatCurrency: (amount: number) => string;
  ingresoNeto: number;
}) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="text-sm text-gray-300">{titulo}</p>
      <p className="mt-1 text-3xl font-bold text-white">
        {porcentaje === null ? '—' : `${porcentaje.toFixed(1)} %`}
      </p>
      <p className="mt-2 text-xs text-gray-400">
        {formatCurrency(numerador)} /{' '}
        {ingresoNeto > 0 ? formatCurrency(ingresoNeto) : 'sin ingreso'}
      </p>
    </div>
  );
}

export default function IndicadoresEndeudamiento({
  indicadores,
  nombreMes,
  formatCurrency,
}: IndicadoresEndeudamientoProps) {
  const { pagosConsumo, pagosActivos, pagosTotales, ingresoNeto } = indicadores;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Percent className="w-5 h-5 mr-2 text-emerald-400" />
          Indicadores de Endeudamiento
        </CardTitle>
        <p className="text-sm text-gray-400">
          Sobre el ingreso neto de {nombreMes}
        </p>
      </CardHeader>
      <CardContent>
        {alertasEndeudamiento(indicadores).map(alerta => (
          <div
            key={alerta.id}
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
            <p>{alerta.mensaje}</p>
          </div>
        ))}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Indicador
            titulo="Del ingreso a deudas de consumo"
            porcentaje={indicadores.porcentajeConsumo}
            numerador={pagosConsumo}
            ingresoNeto={ingresoNeto}
            formatCurrency={formatCurrency}
          />
          <Indicador
            titulo="Del ingreso a deudas de activos"
            porcentaje={indicadores.porcentajeActivos}
            numerador={pagosActivos}
            ingresoNeto={ingresoNeto}
            formatCurrency={formatCurrency}
          />
          <Indicador
            titulo="Del ingreso a todas las deudas"
            porcentaje={indicadores.porcentajeTotal}
            numerador={pagosTotales}
            ingresoNeto={ingresoNeto}
            formatCurrency={formatCurrency}
          />
        </div>

        {ingresoNeto <= 0 && (
          <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            No hay ingresos registrados en {nombreMes}, así que no se puede
            calcular el porcentaje. Registra el ingreso del mes en la sección
            Ingresos o cambia el mes en el menú lateral.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
