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
import DonutProgreso from '@/components/atoms/DonutProgreso/DonutProgreso';
import { MonthlyExpenseData } from '@/lib/services/expenses';
import { normalizarNombre } from '@/lib/services/expenses-rollup';

interface ExpenseSummaryProps {
  expenseData: MonthlyExpenseData;
  formatCurrency: (amount: number) => string;
  /**
   * Presupuesto del mes por categoría. Sin él las tarjetas se ven igual que
   * antes: el anillo necesita un 100% contra el cual medir.
   */
  presupuestoPorCategoria?: Record<string, number>;
}

export default function ExpenseSummary({
  expenseData,
  formatCurrency,
  presupuestoPorCategoria,
}: ExpenseSummaryProps) {
  // Los nombres se comparan sin tildes ni mayúsculas: "EDUCACIÓN" en el
  // presupuesto y "Educacion" en un gasto son la misma categoría.
  const presupuestoDe = (nombre: string): number =>
    presupuestoPorCategoria?.[normalizarNombre(nombre)] ?? 0;

  const totalPresupuestado = Object.values(
    presupuestoPorCategoria ?? {},
  ).reduce((a, b) => a + b, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Tarjetas por categoría */}
      {expenseData.summary.map(category => (
        <Card key={category.category_name} variant="glass" className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-blue-300 font-semibold truncate">
                {category.category_name}
              </h3>
              <p className="text-slate-400 text-sm">
                {category.transaction_count} transacciones
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-emerald-300 font-bold">
                {formatCurrency(category.total_amount)}
              </p>
              <DonutProgreso
                presupuestado={presupuestoDe(category.category_name)}
                gastado={category.total_amount}
              />
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
          <div className="flex items-center gap-3">
            <p className="text-purple-300 font-bold text-lg">
              {formatCurrency(expenseData.total_amount)}
            </p>
            <DonutProgreso
              presupuestado={totalPresupuestado}
              gastado={expenseData.total_amount}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}
