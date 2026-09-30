/**
 * OnboardingChecklist - Organism Level
 *
 * Pasos de configuración pendientes en el dashboard. El estado de cada ítem
 * viene calculado del servidor (loadDashboardChecklist); aquí solo se pinta y
 * se oculta. "Ocultar" esconde la tarjeta al instante y guarda
 * onboarding_dismissed_at con dismissChecklistAction (contratos §5.2); si
 * devuelve { ok: false } o la llamada lanza, la tarjeta vuelve con un toast
 * (hideChecklist).
 */
'use client';

import React, { useState } from 'react';

import Link from 'next/link';

import { CheckCircle2, ChevronRight, Circle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import { dismissChecklistAction } from '@/lib/actions/onboarding';
import { hideChecklist, type ChecklistItem } from '@/lib/onboarding/checklist';

interface OnboardingChecklistProps {
  items: ChecklistItem[];
}

export default function OnboardingChecklist({
  items,
}: OnboardingChecklistProps) {
  const [oculta, setOculta] = useState(false);

  if (oculta || items.length === 0) return null;

  const hechos = items.filter(i => i.done).length;
  const porcentaje = Math.round((hechos / items.length) * 100);

  const ocultar = () => {
    void hideChecklist({
      dismiss: dismissChecklistAction,
      setOculta,
      notify: message => toast.error(message),
    });
  };

  return (
    <Card variant="glass" className="p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <ListChecks className="h-5 w-5 text-emerald-400" />
            Termina de configurar tu presupuesto
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {hechos} de {items.length} listos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={ocultar}
          className="text-gray-300 hover:text-white"
        >
          Ocultar
        </Button>
      </div>

      <div
        className="mb-4 h-2 w-full overflow-hidden rounded bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={hechos}
        aria-label="Pasos completados"
      >
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <ul className="space-y-1">
        {items.map(item =>
          item.done ? (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-gray-400"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
              <span className="line-through">{item.label}</span>
            </li>
          ) : (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <Circle className="h-5 w-5 shrink-0 text-gray-500" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-gray-500" />
              </Link>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}
