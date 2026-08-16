/**
 * ExpenseRow - Molecule Level
 *
 * Fila individual de transacción de gasto en la tabla.
 * Incluye información de la transacción y botones de acción.
 * La categoría es editable inline con autocompletado.
 */

import React, { useState, useRef, useEffect } from 'react';

import Button from '@/components/atoms/Button/Button';
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

function InlineCombobox({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: string[];
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(query.toLowerCase()),
  );

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Auto-focus al abrir
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      setHighlighted(0);
    }
  }, [open]);

  // Resetear highlight cuando cambia el query
  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const select = (name: string) => {
    if (name !== value) onSelect(name);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlighted]) select(filtered[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  return (
    <div ref={ref} className="relative">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value}
          className="w-full min-w-[120px] px-2 py-0.5 text-xs bg-slate-700 border border-blue-500 rounded text-white outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-blue-300 hover:bg-white/10 transition-colors cursor-pointer"
          title="Click para editar categoría"
        >
          {value}
        </button>
      )}

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 min-w-[160px] max-h-48 overflow-y-auto bg-slate-800 border border-white/20 rounded-lg shadow-xl">
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              onMouseDown={e => {
                e.preventDefault(); // Evita que el input pierda foco antes del click
                select(opt);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                i === highlighted
                  ? 'bg-blue-600/40 text-white'
                  : opt === value
                    ? 'bg-white/10 text-blue-300'
                    : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
            {groupItemsByCategory(budgetItems).map(([cat, its]) => (
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
