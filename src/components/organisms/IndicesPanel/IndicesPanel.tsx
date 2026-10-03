'use client';

/**
 * IndicesPanel - Organism Level
 *
 * Los 12 índices del test de realidad financiera, cada uno con su valor, su
 * nivel y una lectura en lenguaje de todos los días.
 *
 * Los que no se pueden calcular no muestran un número: dicen qué dato falta.
 * Un índice financiero inventado es peor que un índice ausente.
 */

import React from 'react';

import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import type { Indice, Nivel } from '@/lib/indices-financieros';

const COLOR: Record<Nivel, string> = {
  excelente: 'text-emerald-400',
  bien: 'text-emerald-300',
  neutro: 'text-blue-300',
  alerta: 'text-amber-400',
  critico: 'text-red-400',
  'sin-dato': 'text-slate-500',
};

const BORDE: Record<Nivel, string> = {
  excelente: 'border-emerald-500/40',
  bien: 'border-emerald-500/25',
  neutro: 'border-blue-500/25',
  alerta: 'border-amber-500/40',
  critico: 'border-red-500/50',
  'sin-dato': 'border-white/10',
};

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatear(indice: Indice): string {
  if (indice.valor === null) return '—';
  switch (indice.formato) {
    case 'moneda':
      return COP.format(indice.valor);
    case 'porcentaje':
      return `${indice.valor.toFixed(1)} %`;
    case 'meses':
      return `${indice.valor.toFixed(1)} meses`;
    case 'veces':
      return `${indice.valor.toFixed(1)}×`;
    default:
      return indice.valor.toFixed(indice.valor % 1 === 0 ? 0 : 2);
  }
}

export default function IndicesPanel({
  indices,
  nombreMes,
}: {
  indices: Indice[];
  nombreMes: string;
}) {
  const sinDato = indices.filter(i => i.nivel === 'sin-dato').length;

  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle className="text-white">Mi realidad financiera</CardTitle>
        <p className="text-sm text-gray-400">
          Los 12 índices, sobre {nombreMes}
          {sinDato > 0 &&
            ` · ${sinDato} ${sinDato === 1 ? 'necesita un dato' : 'necesitan datos'} que falta registrar`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {indices.map((indice, i) => (
            <div
              key={indice.id}
              className={`rounded-lg border ${BORDE[indice.nivel]} bg-white/5 p-4`}
            >
              <p className="text-xs text-slate-500">{i + 1}</p>
              <p className="text-sm text-gray-300">{indice.nombre}</p>
              <p className={`mt-1 text-2xl font-bold ${COLOR[indice.nivel]}`}>
                {formatear(indice)}
              </p>
              <p className="mt-2 text-xs text-gray-400">{indice.descripcion}</p>
              <p className={`mt-1 text-xs ${COLOR[indice.nivel]}`}>
                {indice.lectura}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
