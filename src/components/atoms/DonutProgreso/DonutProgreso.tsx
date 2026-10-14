/**
 * DonutProgreso - Atom
 *
 * Anillo pequeño: el círculo completo es el 100% de lo presupuestado y la
 * parte coloreada es lo que se lleva gastado.
 *
 * El color es el mismo semáforo del resto de la app (verde holgado, ámbar
 * cerca del límite, rojo excedido), para no tener que aprender otro código.
 */

import React from 'react';

import type { EstadoGasto } from '@/lib/colores-dato';
import { avanceDeCategoria } from '@/lib/presupuesto/avance';

/** El trazo del anillo, por estado. Mismo semáforo que el texto. */
const TRAZO: Record<EstadoGasto, string> = {
  'sin-gasto': 'stroke-slate-400 dark:stroke-slate-600',
  holgado: 'stroke-emerald-600 dark:stroke-emerald-400',
  cerca: 'stroke-amber-600 dark:stroke-amber-400',
  excedido: 'stroke-red-600 dark:stroke-red-500',
};

const TEXTO: Record<EstadoGasto, string> = {
  'sin-gasto': 'fill-slate-500 dark:fill-gray-400',
  holgado: 'fill-emerald-700 dark:fill-emerald-300',
  cerca: 'fill-amber-700 dark:fill-amber-300',
  excedido: 'fill-red-700 dark:fill-red-400',
};

interface Props {
  presupuestado: number;
  gastado: number;
  /** Lado del anillo en píxeles. */
  size?: number;
  className?: string;
}

export default function DonutProgreso({
  presupuestado,
  gastado,
  size = 52,
  className = '',
}: Props) {
  const { porcentaje, relleno, estado, etiqueta } = avanceDeCategoria(
    presupuestado,
    gastado,
  );

  // "215%" no cabe al mismo tamaño que "68%": roza el anillo.
  const tamanoTexto = etiqueta.length >= 4 ? 9 : 11;

  const titulo =
    porcentaje === null
      ? 'Esta categoría no tiene presupuesto este mes'
      : `${etiqueta} de lo presupuestado`;

  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={titulo}
      className={`shrink-0 ${className}`}
    >
      <title>{titulo}</title>

      {/* El 100%: lo presupuestado. */}
      <circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        strokeWidth="5"
        className="stroke-slate-300 dark:stroke-slate-700"
      />

      {/* Lo gastado. pathLength=100 hace que el guion sea el porcentaje tal cual. */}
      {relleno > 0 && (
        <circle
          cx="20"
          cy="20"
          r="16"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${relleno} ${100 - relleno}`}
          transform="rotate(-90 20 20)"
          className={`transition-all duration-500 ${TRAZO[estado]}`}
        />
      )}

      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        className={`font-semibold ${TEXTO[estado]}`}
        style={{ fontSize: tamanoTexto }}
      >
        {etiqueta}
      </text>
    </svg>
  );
}
