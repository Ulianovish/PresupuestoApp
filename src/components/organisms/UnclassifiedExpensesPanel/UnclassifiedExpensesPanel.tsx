'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { AlertTriangle } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import {
  getUnclassifiedExpenses,
  getBudgetItemsForMonth,
  assignExpenseToBudgetItem,
  classifyUnassignedForMonth,
  formatCurrency,
  type UnclassifiedExpense,
  type BudgetItemRef,
} from '@/lib/services/expenses';

interface Props {
  monthYear: string;
  /** Se llama tras asignar/clasificar para refrescar los totales del presupuesto. */
  onChanged?: () => void;
}

export default function UnclassifiedExpensesPanel({
  monthYear,
  onChanged,
}: Props) {
  const [expenses, setExpenses] = useState<UnclassifiedExpense[]>([]);
  const [items, setItems] = useState<BudgetItemRef[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  // Selección por gasto (el ítem elegido en el desplegable, aún sin asignar).
  // Si no hay entrada para un gasto, se usa el ítem sugerido por su categoría.
  const [selected, setSelected] = useState<Record<string, string>>({});

  /** Ítem sugerido por defecto: el primero de la misma categoría del gasto
   * (comparando sin distinguir mayúsculas ni acentos). */
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  const suggestedItemId = (categoryName: string) =>
    items.find(i => normalize(i.category_name) === normalize(categoryName))
      ?.id ?? '';
  /** Valor efectivo del desplegable: lo elegido, o la sugerencia por categoría. */
  const effectiveItemId = (exp: UnclassifiedExpense) =>
    selected[exp.id] ?? suggestedItemId(exp.category_name);

  const load = useCallback(async () => {
    const [exp, its] = await Promise.all([
      getUnclassifiedExpenses(monthYear),
      getBudgetItemsForMonth(monthYear),
    ]);
    setExpenses(exp);
    setItems(its);
  }, [monthYear]);

  useEffect(() => {
    load();
  }, [load]);

  // Asigna en lote todos los gastos con un ítem elegido en el desplegable.
  // Los que queden en "Sin asignar" permanecen pendientes.
  const handleAssignSelected = async () => {
    const entries = expenses
      .map(exp => [exp.id, effectiveItemId(exp)] as const)
      .filter(([, itemId]) => !!itemId);
    if (entries.length === 0) return;

    setIsAssigning(true);
    try {
      for (const [expenseId, itemId] of entries) {
        await assignExpenseToBudgetItem(expenseId, itemId, 'manual');
      }
      setSelected({});
      await load();
      onChanged?.();
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClassifyAll = async () => {
    setIsBusy(true);
    try {
      await classifyUnassignedForMonth(monthYear);
      await load();
      onChanged?.();
    } finally {
      setIsBusy(false);
    }
  };

  if (expenses.length === 0) return null;

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const selectedCount = expenses.filter(e => effectiveItemId(e)).length;

  return (
    <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-red-300">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold">
            Gastos sin clasificar ({expenses.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClassifyAll}
            disabled={isBusy || isAssigning}
          >
            {isBusy ? 'Clasificando...' : 'Clasificar con IA'}
          </Button>
          <Button
            size="sm"
            variant="gradient"
            onClick={handleAssignSelected}
            disabled={isAssigning || isBusy || selectedCount === 0}
          >
            {isAssigning ? 'Asignando...' : `Asignar (${selectedCount})`}
          </Button>
        </div>
      </div>

      <p className="text-xs text-red-300/80 mb-3">
        Cada gasto viene con un ítem sugerido de su categoría. Ajusta el que
        quieras y presiona <span className="font-semibold">Asignar</span> para
        asignar todos de una vez; los que dejes en “Sin asignar” quedan
        pendientes. Estos gastos aún NO suman en el Presupuesto Real. Total sin
        contar: <span className="font-semibold">{formatCurrency(total)}</span>
      </p>

      <div className="space-y-2">
        {expenses.map(exp => (
          <div
            key={exp.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-white text-sm truncate">{exp.description}</p>
              <p className="text-xs text-gray-400">
                {exp.category_name} · {formatCurrency(Number(exp.amount))}
              </p>
            </div>
            <select
              value={effectiveItemId(exp)}
              onChange={e =>
                setSelected(s => ({ ...s, [exp.id]: e.target.value }))
              }
              className="bg-slate-700/60 border border-slate-600 rounded-lg text-white text-sm px-2 py-1 max-w-[240px] flex-shrink-0"
            >
              <option value="">Sin asignar</option>
              {items.map(it => (
                <option key={it.id} value={it.id}>
                  {it.category_name} · {it.name}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
