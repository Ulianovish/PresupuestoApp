/**
 * ExpenseRow - Molecule Level
 *
 * Fila individual de transacción de gasto en la tabla.
 * Incluye información de la transacción y botones de acción.
 *
 * @param transaction - Datos de la transacción
 * @param formatCurrency - Función para formatear moneda
 * @param onEdit - Función para editar la transacción
 * @param onDelete - Función para eliminar la transacción
 *
 * @example
 * <ExpenseRow
 *   transaction={transaction}
 *   formatCurrency={formatCurrency}
 *   onEdit={handleEditTransaction}
 *   onDelete={handleDeleteExpense}
 * />
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import { ExpenseTransaction } from '@/lib/services/expenses';

interface ExpenseRowProps {
  transaction: ExpenseTransaction;
  formatCurrency: (amount: number) => string;
  onEdit: (transaction: ExpenseTransaction) => void;
  onDelete: (transactionId: string) => void;
}

export default function ExpenseRow({
  transaction,
  formatCurrency,
  onEdit,
  onDelete,
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

      {/* Categoría */}
      <td className="px-4 py-2 text-blue-300">{transaction.category_name}</td>

      {/* Cuenta */}
      <td className="px-4 py-2 text-white">{transaction.account_name}</td>

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
