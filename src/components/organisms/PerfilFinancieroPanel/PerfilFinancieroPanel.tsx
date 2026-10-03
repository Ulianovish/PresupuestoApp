'use client';

/**
 * PerfilFinancieroPanel - Organism Level
 *
 * Los datos que ningún movimiento puede deducir y que hacen falta para cuatro
 * de los 12 índices: edad, horas trabajadas, score crediticio, promedio de
 * ingresos de 10 años, termostato financiero y horas de vida al día.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import {
  getPerfilFinanciero,
  savePerfilFinanciero,
  type PerfilFinanciero,
} from '@/lib/services/activos';

const VACIO: PerfilFinanciero = {
  fecha_nacimiento: null,
  horas_trabajadas_mes: null,
  score_crediticio: null,
  ingreso_anual_promedio_10a: null,
  termostato_financiero: null,
  horas_vida_dia: null,
};

export default function PerfilFinancieroPanel({
  onSaved,
}: {
  onSaved?: () => void;
}) {
  const [perfil, setPerfil] = useState<PerfilFinanciero>(VACIO);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setPerfil(await getPerfilFinanciero());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const guardar = async () => {
    setIsSaving(true);
    try {
      const r = await savePerfilFinanciero(perfil);
      if (r.success) {
        toast.success('Datos guardados');
        onSaved?.();
      } else {
        toast.error(r.error || 'No se pudieron guardar');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const num = (v: string): number | null => (v === '' ? null : Number(v));

  const campo =
    'rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500';

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">
        Datos para los índices
      </h3>
      <p className="mb-4 text-sm text-slate-400">
        Lo que no se puede deducir de tus movimientos. Sin esto, cuatro de los
        12 índices no se pueden calcular.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Fecha de nacimiento
            <input
              type="date"
              value={perfil.fecha_nacimiento ?? ''}
              onChange={e =>
                setPerfil(p => ({
                  ...p,
                  fecha_nacimiento: e.target.value || null,
                }))
              }
              className={campo}
            />
            <span className="text-xs text-slate-500">
              Para el Índice de Riqueza. La edad se recalcula sola.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Horas que trabajas al mes
            <input
              type="number"
              min={0}
              value={perfil.horas_trabajadas_mes ?? ''}
              onChange={e =>
                setPerfil(p => ({
                  ...p,
                  horas_trabajadas_mes: num(e.target.value),
                }))
              }
              placeholder="Ej: 160"
              className={campo}
            />
            <span className="text-xs text-slate-500">
              Para el Precio Hora de Vida.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Score crediticio
            <input
              type="number"
              min={150}
              max={950}
              value={perfil.score_crediticio ?? ''}
              onChange={e =>
                setPerfil(p => ({
                  ...p,
                  score_crediticio: num(e.target.value),
                }))
              }
              placeholder="Entre 150 y 950"
              className={campo}
            />
            <span className="text-xs text-slate-500">
              Lo consultas en una central de riesgo.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Horas al día en lo que amas
            <input
              type="number"
              min={0}
              max={24}
              step="0.5"
              value={perfil.horas_vida_dia ?? ''}
              onChange={e =>
                setPerfil(p => ({ ...p, horas_vida_dia: num(e.target.value) }))
              }
              placeholder="Ej: 3"
              className={campo}
            />
            <span className="text-xs text-slate-500">
              Para Trabajo vs Vida.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Promedio de ingresos anuales (10 años)
            <CurrencyInput
              value={perfil.ingreso_anual_promedio_10a ?? 0}
              onChange={valor =>
                setPerfil(p => ({ ...p, ingreso_anual_promedio_10a: valor }))
              }
              className="bg-slate-700/50 border-slate-600 text-white"
              placeholder="$0"
            />
            <span className="text-xs text-slate-500">
              Para el Índice de Riqueza. Tus ingresos registrados no llegan a 10
              años, por eso va a mano.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-slate-300">
            Termostato financiero
            <CurrencyInput
              value={perfil.termostato_financiero ?? 0}
              onChange={valor =>
                setPerfil(p => ({ ...p, termostato_financiero: valor }))
              }
              className="bg-slate-700/50 border-slate-600 text-white"
              placeholder="$0"
            />
            <span className="text-xs text-slate-500">
              La cantidad que te resulta normal pronunciar.
            </span>
          </label>

          <div className="sm:col-span-2">
            <Button variant="gradient" onClick={guardar} disabled={isSaving}>
              Guardar datos
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
