/**
 * ExpenseRow - Molecule Level
 *
 * Fila individual de transacción de gasto en la tabla.
 * Incluye información de la transacción y botones de acción.
 * La categoría es editable inline con autocompletado.
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import InlineCombobox from '@/components/molecules/InlineCombobox/InlineCombobox';
import {
  ExpenseTransaction,
  type BudgetItemRef,
} from '@/lib/services/expenses';

interface ExpenseRowProps {
  transaction: ExpenseTransaction;
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: ExpenseTransaction) => void;
  onDelete: (transactionId: string) => void;
  categories?: string[];
  onCategoryChange?: (
    transactionId: string,
    categoryName: string,
  ) => Promise<void>;
  /** Cuentas disponibles, para editar la cuenta inline. */
  accounts?: string[];
  onAccountChange?: (
    transactionId: string,
    accountName: string,
  ) => Promise<void>;
  /** Ítems del presupuesto del mes, para asignar el gasto a un ítem. */
  budgetItems?: BudgetItemRef[];
  /** Asigna el gasto a un ítem ('' = sin asignar). */
  onAssignItem?: (
    transactionId: string,
    itemId: string,
  ) => void | Promise<void>;
  /** Abre el modal para crear un ítem nuevo y asignárselo a este gasto. */
  onCreateItem?: (transaction: ExpenseTransaction) => void;
}

/** Normaliza texto para comparar sin acentos ni mayúsculas. */
function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Ítems visibles en el desplegable: solo los de la categoría del gasto.
 * Si esa categoría no tiene ítems, se muestran todos (para no dejar al usuario
 * sin opciones). El ítem ya asignado siempre se incluye, aunque sea de otra
 * categoría, para que el selector pueda mostrarlo.
 */
function visibleItemsForExpense(
  items: BudgetItemRef[],
  categoryName: string,
  assignedItemId?: string | null,
): BudgetItemRef[] {
  const inCategory = items.filter(
    i => normalizeText(i.category_name) === normalizeText(categoryName || ''),
  );
  const base = inCategory.length > 0 ? inCategory : items;

  if (assignedItemId && !base.some(i => i.id === assignedItemId)) {
    const assigned = items.find(i => i.id === assignedItemId);
    if (assigned) return [assigned, ...base];
  }
  return base;
}

/** Agrupa los ítems por categoría, conservando el orden de llegada. */
function groupItemsByCategory(
  items: BudgetItemRef[],
): Array<[string, BudgetItemRef[]]> {
  const groups = new Map<string, BudgetItemRef[]>();
  for (const it of items) {
    const arr = groups.get(it.category_name) ?? [];
    arr.push(it);
    groups.set(it.category_name, arr);
  }
  return Array.from(groups.entries());
}

export default function ExpenseRow({
  transaction,
  formatCurrency,
  onEdit,
  onDelete,
  categories,
  onCategoryChange,
  accounts,
  onAccountChange,
  budgetItems,
  onAssignItem,
  onCreateItem,
}: ExpenseRowProps) {
  const handleEdit = () => {
    onEdit(transaction);
  };

  const handleDelete = () => {
    onDelete(transaction.id);
  };

  return (
    <tr className="hover:bg-white/5 transition-colors duration-150">
      {/* Descripción */}
      <td className="px-4 py-2 text-white">{transaction.description}</td>

      {/* Fecha */}
      <td className="px-4 py-2 text-white">{transaction.transaction_date}</td>

      {/* Categoría — editable inline si hay categorías y callback */}
      <td className="px-4 py-2">
        {categories && categories.length > 0 && onCategoryChange ? (
          <InlineCombobox
            value={transaction.category_name}
            options={categories}
            onSelect={name => onCategoryChange(transaction.id, name)}
          />
        ) : (
          <span className="text-blue-300">{transaction.category_name}</span>
        )}
      </td>

      {/* Ítem de presupuesto — asignable/reasignable */}
      <td className="px-4 py-2">
        {budgetItems && budgetItems.length > 0 && onAssignItem ? (
          <select
            value={transaction.budget_item_id ?? ''}
            onChange={e => {
              if (e.target.value === '__create__') {
                onCreateItem?.(transaction);
                return;
              }
              onAssignItem(transaction.id, e.target.value);
            }}
            className={`bg-slate-700/60 border rounded-lg text-xs px-2 py-1 max-w-[190px] ${
              transaction.budget_item_id
                ? 'border-slate-600 text-white'
                : 'border-red-500/50 text-red-300'
            }`}
          >
            <option value="">Sin asignar</option>
            {onCreateItem && (
              <option value="__create__">➕ Crear nuevo ítem…</option>
            )}
            {groupItemsByCategory(
              visibleItemsForExpense(
                budgetItems,
                transaction.category_name,
                transaction.budget_item_id,
              ),
            ).map(([cat, its]) => (
              <optgroup key={cat} label={cat}>
                {its.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </td>

      {/* Cuenta — editable inline si hay cuentas y callback */}
      <td className="px-4 py-2">
        {accounts && accounts.length > 0 && onAccountChange ? (
          <InlineCombobox
            value={transaction.account_name}
            options={accounts}
            onSelect={name => onAccountChange(transaction.id, name)}
          />
        ) : (
          <span className="text-white">{transaction.account_name}</span>
        )}
      </td>

      {/* Lugar */}
      <td className="px-4 py-2 text-white">{transaction.place || '-'}</td>

      {/* Valor */}
      <td className="px-4 py-2 text-emerald-300 font-semibold">
        {formatCurrency(transaction.amount)}
      </td>

      {/* Acciones */}
      <td className="px-4 py-2">
        <div className="flex gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            ✏️
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="border-red-600 text-red-300 hover:bg-red-700"
          >
            🗑️
          </Button>
        </div>
      </td>
    </tr>
  );
}
