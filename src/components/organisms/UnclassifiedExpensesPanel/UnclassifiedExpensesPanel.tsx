'use client';

import React, { useEffect, useState, useCallback } from 'react';

import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import InlineCombobox from '@/components/molecules/InlineCombobox/InlineCombobox';
import { useCategories } from '@/hooks/useCategories';
import {
  getUnclassifiedExpenses,
  getBudgetItemsForMonth,
  assignExpenseToBudgetItem,
  classifyUnassignedForMonth,
  updateExpenseTransaction,
  formatCurrency,
  type UnclassifiedExpense,
  type BudgetItemRef,
} from '@/lib/services/expenses';

import {
  asignacionesAGuardar,
  mensajeClasificacion,
  sugerenciaVisible,
  valorDelSelect,
  type SeleccionUsuario,
  type SugerenciasPorGasto,
} from './seleccion';

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
  // Lo que el usuario tocó en el desplegable, por gasto ('' = Sin asignar).
  const [selected, setSelected] = useState<SeleccionUsuario>({});
  // Sugerencias REALES (historial del usuario o IA). Sin sugerencia, el
  // desplegable arranca en "Sin asignar": nunca en el primer ítem alfabético.
  const [suggestions] = useState<SugerenciasPorGasto>({});

  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  /**
   * Ítems visibles para un gasto: solo los de su categoría. Si esa categoría no
   * tiene ítems, se muestran todos para no dejar al usuario sin opciones.
   */
  const visibleItems = (categoryName: string) => {
    const inCategory = items.filter(
      i => normalize(i.category_name) === normalize(categoryName || ''),
    );
    return inCategory.length > 0 ? inCategory : items;
  };

  /** Agrupa por categoría, para mostrar el encabezado al abrir el desplegable. */
  const groupByCategory = (list: BudgetItemRef[]) => {
    const groups = new Map<string, BudgetItemRef[]>();
    for (const it of list) {
      const arr = groups.get(it.category_name) ?? [];
      arr.push(it);
      groups.set(it.category_name, arr);
    }
    return Array.from(groups.entries());
  };

  // Categorías disponibles, para editar la categoría del gasto inline
  const { categories: budgetCategories } = useCategories();
  const categoryNames = budgetCategories.map(c => c.name.toUpperCase());

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

  const effectiveItemId = (exp: UnclassifiedExpense) =>
    valorDelSelect(exp, selected, suggestions, items);

  // Asigna en lote solo las filas con valor. Una sugerencia aceptada sin tocar
  // se guarda con su origen ('historial'/'ai'); 'manual' solo si el usuario
  // cambió el desplegable. Las que queden en "Sin asignar" siguen pendientes.
  const handleAssignSelected = async () => {
    const entries = asignacionesAGuardar(
      expenses,
      selected,
      suggestions,
      items,
    );
    if (entries.length === 0) return;

    setIsAssigning(true);
    try {
      for (const { expenseId, budgetItemId, source } of entries) {
        await assignExpenseToBudgetItem(expenseId, budgetItemId, source);
      }
      setSelected({});
      await load();
      onChanged?.();
    } finally {
      setIsAssigning(false);
    }
  };

  // Cambiar la categoría del gasto: al cambiarla, se descarta la selección
  // previa (el ítem elegido era de la categoría anterior).
  const handleCategoryChange = async (
    expenseId: string,
    categoryName: string,
  ) => {
    await updateExpenseTransaction(expenseId, { category_name: categoryName });
    setSelected(s => {
      const next = { ...s };
      delete next[expenseId];
      return next;
    });
    await load();
  };

  const handleClassifyAll = async () => {
    setIsBusy(true);
    try {
      const resumen = await classifyUnassignedForMonth(monthYear);
      const mensaje = mensajeClasificacion(resumen);
      if (resumen.assigned > 0) toast.success(mensaje);
      else toast.warning(mensaje);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo clasificar',
      );
    } finally {
      setIsBusy(false);
    }
  };

  if (expenses.length === 0) return null;

  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const selectedCount = asignacionesAGuardar(
    expenses,
    selected,
    suggestions,
    items,
  ).length;

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
        Elige el ítem de cada gasto (los marcados como “Sugerido” vienen de tu
        historial o de la IA) y presiona{' '}
        <span className="font-semibold">Asignar</span> para asignar todos de una
        vez; los que dejes en “Sin asignar” quedan pendientes. Estos gastos aún
        NO suman en el Presupuesto Real. Total sin contar:{' '}
        <span className="font-semibold">{formatCurrency(total)}</span>
      </p>

      <div className="space-y-2">
        {expenses.map(exp => (
          <div
            key={exp.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-white text-sm truncate">{exp.description}</p>
              <p className="text-xs text-gray-400">
                {formatCurrency(Number(exp.amount))}
              </p>
            </div>

            {/* Categoría (columna editable inline, igual que en Gastos) */}
            <div className="w-40 flex-shrink-0">
              {categoryNames.length > 0 ? (
                <InlineCombobox
                  value={exp.category_name}
                  options={categoryNames}
                  onSelect={name => handleCategoryChange(exp.id, name)}
                />
              ) : (
                <span className="text-xs font-medium text-blue-300 uppercase truncate">
                  {exp.category_name}
                </span>
              )}
            </div>

            {/* Ítem: solo el nombre; la categoría ya está al lado */}
            <div className="w-56 flex-shrink-0">
              <select
                value={effectiveItemId(exp)}
                onChange={e =>
                  setSelected(s => ({ ...s, [exp.id]: e.target.value }))
                }
                className="bg-slate-700/60 border border-slate-600 rounded-lg text-white text-sm px-2 py-1 w-full"
              >
                <option value="">Sin asignar</option>
                {groupByCategory(visibleItems(exp.category_name)).map(
                  ([cat, its]) => (
                    <optgroup key={cat} label={cat}>
                      {its.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
              {(() => {
                const sug = sugerenciaVisible(
                  exp,
                  selected,
                  suggestions,
                  items,
                );
                return sug ? (
                  <p className="mt-1 text-[11px] text-amber-300/90">
                    Sugerido (
                    {sug.source === 'historial' ? 'tu historial' : 'IA'}) —
                    revisa y presiona Asignar
                  </p>
                ) : null;
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
