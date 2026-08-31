/**
 * BudgetAlertsPanel - Organism Level
 *
 * Muestra los rubros del mes que van en 80% o más de su presupuesto.
 * Se calcula en vivo: "vas al 82% de Dulces" sigue siendo cierto mañana, así
 * que no hay tabla de notificaciones ni "marcar como leído" que se desfase.
 *
 * Devuelve null cuando no hay nada que decir: un panel siempre presente deja de
 * leerse a las dos semanas.
 */

import React from 'react';

import { AlertTriangle } from 'lucide-react';

import Card from '@/components/atoms/Card/Card';
import { pintarAlerta, type Alerta } from '@/lib/budget/alerts';
import { formatCOP } from '@/lib/whatsapp/format';

interface BudgetAlertsPanelProps {
  alertas: Alerta[];
  hoy: Date;
}

export default function BudgetAlertsPanel({
  alertas,
  hoy,
}: BudgetAlertsPanelProps) {
  if (alertas.length === 0) return null;

  return (
    // variant="glass": el fondo de la página es oscuro (bg-slate-900), igual
    // que BudgetStatusPanels y UnclassifiedExpensesPanel, sus vecinos.
    <Card variant="glass" className="mb-6 p-4">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-white">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        Presupuestos en riesgo
      </h3>
      <ul className="space-y-4">
        {alertas.map(a => {
          // pintarAlerta (src/lib/budget/alerts.ts) decide redondeo, corte de
          // "excedido" y frase de días: es la MISMA función que usa el
          // mensaje de chat (formatearAlerta), para que el panel nunca pueda
          // decir algo distinto del mismo dato.
          const { pct, excedido, detalle } = pintarAlerta(a, hoy);
          return (
            <li key={a.budgetItemId}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium text-white">
                  {excedido ? '🔴' : '⚠️'} {a.itemName}
                </span>
                <span className="text-gray-400">
                  {formatCOP(a.spent)} / {formatCOP(a.budgeted)}
                </span>
              </div>
              <div className="my-1 h-2 w-full overflow-hidden rounded bg-white/10">
                <div
                  className={
                    excedido ? 'h-full bg-red-500' : 'h-full bg-amber-400'
                  }
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {pct}% · {detalle}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
