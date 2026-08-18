/**
 * ExpenseTable - Organism Level
 *
 * Tabla principal de transacciones de gastos.
 * Incluye estado vacío y tabla completa con todas las transacciones.
 *
 * @param expenseData - Datos de gastos con transacciones
 * @param selectedMonth - Mes seleccionado para mostrar en el título
 * @param formatCurrency - Función para formatear moneda
 * @param formatMonthName - Función para formatear nombre del mes
 * @param onEdit - Función para editar transacción
 * @param onDelete - Función para eliminar transacción
 * @param onAddFirst - Función para agregar primer gasto
 *
 * @example
 * <ExpenseTable
 *   expenseData={expenseData}
 *   selectedMonth="2025-07"
 *   formatCurrency={formatCurrency}
 *   formatMonthName={formatMonthName}
 *   onEdit={handleEditTransaction}
 *   onDelete={handleDeleteExpense}
 *   onAddFirst={openModal}
 * />
 */

import React, { useMemo, useState } from 'react';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import ColumnFilter from '@/components/molecules/ColumnFilter/ColumnFilter';
import ExpenseRow from '@/components/molecules/ExpenseRow/ExpenseRow';
import {
  ExpenseTransaction,
  MonthlyExpenseData,
  type BudgetItemRef,
} from '@/lib/services/expenses';

interface ExpenseTableProps {
  expenseData: MonthlyExpenseData;
  selectedMonth: string;
  formatCurrency: (amount: number) => string;
  formatMonthName: (month: string) => string;
  onEdit: (transaction: ExpenseTransaction) => void;
  onDelete: (transactionId: string) => void;
  onAddFirst: () => void;
  categories?: string[];
  onCategoryChange?: (
    transactionId: string,
    categoryName: string,
  ) => Promise<void>;
  accounts?: string[];
  onAccountChange?: (
    transactionId: string,
    accountName: string,
  ) => Promise<void>;
  budgetItems?: BudgetItemRef[];
  onAssignItem?: (
    transactionId: string,
    itemId: string,
  ) => void | Promise<void>;
  onCreateItem?: (transaction: ExpenseTransaction) => void;
}

export default function ExpenseTable({
  expenseData,
  selectedMonth,
  formatCurrency,
  formatMonthName,
  onEdit,
  onDelete,
  onAddFirst,
  categories,
  onCategoryChange,
  accounts,
  onAccountChange,
  budgetItems,
  onAssignItem,
  onCreateItem,
}: ExpenseTableProps) {
  // Filtros por columna al estilo Excel: null = sin filtro
  const [filters, setFilters] = useState<Record<string, string[] | null>>({});

  const itemNameById = useMemo(() => {
    const map = new Map<string, string>();
    (budgetItems || []).forEach(it => map.set(it.id, it.name));
    return map;
  }, [budgetItems]);

  /** Valor mostrado de cada columna, que es sobre lo que se filtra. */
  const columnValue = React.useCallback(
    (t: ExpenseTransaction, key: string): string => {
      switch (key) {
        case 'description':
          return t.description || '';
        case 'date':
          return t.transaction_date || '';
        case 'category':
          return t.category_name || '';
        case 'item':
          return t.budget_item_id
            ? (itemNameById.get(t.budget_item_id) ?? 'Sin asignar')
            : 'Sin asignar';
        case 'account':
          return t.account_name || '';
        case 'place':
          return t.place || '-';
        case 'amount':
          return formatCurrency(t.amount);
        default:
          return '';
      }
    },
    [itemNameById, formatCurrency],
  );

  const visibleTransactions = useMemo(
    () =>
      expenseData.transactions.filter(t =>
        Object.entries(filters).every(([key, allowed]) =>
          allowed === null || allowed === undefined
            ? true
            : allowed.includes(columnValue(t, key)),
        ),
      ),
    [expenseData.transactions, filters, columnValue],
  );

  /** Valores disponibles en una columna, respetando los filtros de las demás. */
  const valuesFor = (key: string) =>
    expenseData.transactions
      .filter(t =>
        Object.entries(filters).every(([k, allowed]) =>
          k === key || allowed === null || allowed === undefined
            ? true
            : allowed.includes(columnValue(t, k)),
        ),
      )
      .map(t => columnValue(t, key));

  const setFilter = (key: string) => (next: string[] | null) =>
    setFilters(f => ({ ...f, [key]: next }));

  const activeFilters = Object.values(filters).filter(v => v != null).length;

  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Transacciones de {formatMonthName(selectedMonth)}</span>
          {activeFilters > 0 && (
            <span className="flex items-center gap-2 text-sm font-normal text-gray-300">
              {visibleTransactions.length} de {expenseData.transactions.length}
              <button
                type="button"
                onClick={() => setFilters({})}
                className="px-2 py-1 text-xs rounded border border-slate-600 text-gray-300 hover:text-white hover:bg-white/10"
              >
                Limpiar filtros
              </button>
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {expenseData.transactions.length === 0 ? (
          /* Estado vacío */
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">
              No hay gastos registrados para este mes
            </p>
            <Button variant="gradient" onClick={onAddFirst}>
              Agregar Primer Gasto
            </Button>
          </div>
        ) : (
          /* Tabla de transacciones */
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              {/* Cabecera de la tabla */}
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Descripción"
                      values={valuesFor('description')}
                      selected={filters.description ?? null}
                      onChange={setFilter('description')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Fecha"
                      values={valuesFor('date')}
                      selected={filters.date ?? null}
                      onChange={setFilter('date')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Categoría"
                      values={valuesFor('category')}
                      selected={filters.category ?? null}
                      onChange={setFilter('category')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Ítem presupuesto"
                      values={valuesFor('item')}
                      selected={filters.item ?? null}
                      onChange={setFilter('item')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Cuenta"
                      values={valuesFor('account')}
                      selected={filters.account ?? null}
                      onChange={setFilter('account')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Lugar"
                      values={valuesFor('place')}
                      selected={filters.place ?? null}
                      onChange={setFilter('place')}
                      alignRight={true}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Valor"
                      values={valuesFor('amount')}
                      selected={filters.amount ?? null}
                      onChange={setFilter('amount')}
                      alignRight={true}
                    />
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>

              {/* Cuerpo de la tabla */}
              <tbody className="divide-y divide-white/10">
                {visibleTransactions.map(transaction => (
                  <ExpenseRow
                    key={transaction.id}
                    transaction={transaction}
                    formatCurrency={formatCurrency}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    categories={categories}
                    onCategoryChange={onCategoryChange}
                    accounts={accounts}
                    onAccountChange={onAccountChange}
                    budgetItems={budgetItems}
                    onAssignItem={onAssignItem}
                    onCreateItem={onCreateItem}
                  />
                ))}
              </tbody>
            </table>
            {visibleTransactions.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">
                Ningún gasto coincide con los filtros aplicados.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
