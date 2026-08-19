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
  // Orden por columna (como el "Ordenar A-Z / Z-A" de Excel)
  const [sort, setSort] = useState<{
    key: string;
    dir: 'asc' | 'desc';
  } | null>(null);

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

  /**
   * Valor comparable para ordenar: número en Valor, fecha en Fecha y texto en
   * el resto (el texto mostrado no sirve para Valor porque viene formateado).
   */
  const sortValue = React.useCallback(
    (t: ExpenseTransaction, key: string): number | string => {
      if (key === 'amount') return Number(t.amount) || 0;
      if (key === 'date') return t.transaction_date || '';
      return columnValue(t, key).toLowerCase();
    },
    [columnValue],
  );

  const sortedTransactions = useMemo(() => {
    if (!sort) return visibleTransactions;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...visibleTransactions].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * factor;
      }
      return (
        String(va).localeCompare(String(vb), 'es', {
          numeric: true,
          sensitivity: 'base',
        }) * factor
      );
    });
  }, [visibleTransactions, sort, sortValue]);

  const setSortFor = (key: string) => (dir: 'asc' | 'desc') =>
    setSort(current =>
      current?.key === key && current.dir === dir ? null : { key, dir },
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

  // Suma de lo que se ve en pantalla: con filtros aplicados es el total del
  // subconjunto (p. ej. solo "Regalos"); sin filtros, el total del mes.
  const visibleTotal = visibleTransactions.reduce(
    (sum, t) => sum + Number(t.amount || 0),
    0,
  );

  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          <span>Transacciones de {formatMonthName(selectedMonth)}</span>
          {(activeFilters > 0 || sort) && (
            <span className="flex items-center gap-2 text-sm font-normal text-gray-300">
              {activeFilters > 0 &&
                `${visibleTransactions.length} de ${expenseData.transactions.length}`}
              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSort(null);
                }}
                className="px-2 py-1 text-xs rounded border border-slate-600 text-gray-300 hover:text-white hover:bg-white/10"
              >
                Limpiar
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
                      sortDir={sort?.key === 'description' ? sort.dir : null}
                      onSort={setSortFor('description')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Fecha"
                      values={valuesFor('date')}
                      selected={filters.date ?? null}
                      onChange={setFilter('date')}
                      sortDir={sort?.key === 'date' ? sort.dir : null}
                      onSort={setSortFor('date')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Categoría"
                      values={valuesFor('category')}
                      selected={filters.category ?? null}
                      onChange={setFilter('category')}
                      sortDir={sort?.key === 'category' ? sort.dir : null}
                      onSort={setSortFor('category')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Ítem"
                      values={valuesFor('item')}
                      selected={filters.item ?? null}
                      onChange={setFilter('item')}
                      sortDir={sort?.key === 'item' ? sort.dir : null}
                      onSort={setSortFor('item')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Cuenta"
                      values={valuesFor('account')}
                      selected={filters.account ?? null}
                      onChange={setFilter('account')}
                      sortDir={sort?.key === 'account' ? sort.dir : null}
                      onSort={setSortFor('account')}
                      alignRight={false}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Lugar"
                      values={valuesFor('place')}
                      selected={filters.place ?? null}
                      onChange={setFilter('place')}
                      sortDir={sort?.key === 'place' ? sort.dir : null}
                      onSort={setSortFor('place')}
                      alignRight={true}
                    />
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    <ColumnFilter
                      label="Valor"
                      values={valuesFor('amount')}
                      selected={filters.amount ?? null}
                      onChange={setFilter('amount')}
                      sortDir={sort?.key === 'amount' ? sort.dir : null}
                      onSort={setSortFor('amount')}
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
                {sortedTransactions.map(transaction => (
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

              {/* Total de los valores visibles (respeta los filtros) */}
              <tfoot>
                <tr className="border-t-2 border-white/20 bg-white/5">
                  <td
                    colSpan={6}
                    className="px-4 py-3 text-right text-sm font-medium text-gray-300"
                  >
                    {activeFilters > 0 ? 'Total filtrado' : 'Total del mes'} (
                    {visibleTransactions.length}{' '}
                    {visibleTransactions.length === 1 ? 'gasto' : 'gastos'})
                  </td>
                  <td className="px-4 py-3 text-base font-bold text-emerald-300">
                    {formatCurrency(visibleTotal)}
                  </td>
                  <td />
                </tr>
              </tfoot>
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
