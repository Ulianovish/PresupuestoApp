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

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import ExpenseRow from '@/components/molecules/ExpenseRow/ExpenseRow';
import {
  ExpenseTransaction,
  MonthlyExpenseData,
} from '@/lib/services/expenses';

interface ExpenseTableProps {
  expenseData: MonthlyExpenseData;
  selectedMonth: string;
  formatCurrency: (amount: number) => string;
  formatMonthName: (month: string) => string;
  onEdit: (transaction: ExpenseTransaction) => void;
  onDelete: (transactionId: string) => void;
  onAddFirst: () => void;
}

export default function ExpenseTable({
  expenseData,
  selectedMonth,
  formatCurrency,
  formatMonthName,
  onEdit,
  onDelete,
  onAddFirst,
}: ExpenseTableProps) {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle>Transacciones de {formatMonthName(selectedMonth)}</CardTitle>
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
                    Descripción
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    Categoría
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    Cuenta
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    Lugar
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase">
                    Valor
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-300 uppercase">
                    Acciones
                  </th>
                </tr>
              </thead>

              {/* Cuerpo de la tabla */}
              <tbody className="divide-y divide-white/10">
                {expenseData.transactions.map(transaction => (
                  <ExpenseRow
                    key={transaction.id}
                    transaction={transaction}
                    formatCurrency={formatCurrency}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
