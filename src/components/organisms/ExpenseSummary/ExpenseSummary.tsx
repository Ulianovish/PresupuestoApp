/**
 * ExpenseSummary - Organism Level
 *
 * Resumen de gastos por categoría mostrado en tarjetas.
 * Incluye el total general en una tarjeta destacada.
 *
 * @param expenseData - Datos de gastos con resumen y transacciones
 * @param formatCurrency - Función para formatear moneda
 *
 * @example
 * <ExpenseSummary
 *   expenseData={expenseData}
 *   formatCurrency={formatCurrency}
 * />
 */

import React from 'react';

import Card from '@/components/atoms/Card/Card';
import { MonthlyExpenseData } from '@/lib/services/expenses';

interface ExpenseSummaryProps {
  expenseData: MonthlyExpenseData;
  formatCurrency: (amount: number) => string;
}

export default function ExpenseSummary({
  expenseData,
  formatCurrency,
}: ExpenseSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Tarjetas por categoría */}
      {expenseData.summary.map(category => (
        <Card key={category.category_name} variant="glass" className="p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-blue-300 font-semibold">
                {category.category_name}
              </h3>
              <p className="text-slate-400 text-sm">
                {category.transaction_count} transacciones
              </p>
            </div>
            <div className="text-right">
              <p className="text-emerald-300 font-bold">
                {formatCurrency(category.total_amount)}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {/* Tarjeta de total general */}
      <Card variant="gradient-border" className="p-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-purple-300 font-semibold">TOTAL</h3>
            <p className="text-slate-400 text-sm">
              {expenseData.transactions.length} transacciones
            </p>
          </div>
          <div className="text-right">
            <p className="text-purple-300 font-bold text-lg">
              {formatCurrency(expenseData.total_amount)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
