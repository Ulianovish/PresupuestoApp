/**
 * DashboardSummaryCards - Organism Level Component
 *
 * Componente que renderiza las tarjetas de resumen financiero del dashboard.
 * Muestra presupuesto total, gastos, disponible e ingresos totales.
 *
 * @param summary - Objeto con datos de resumen financiero
 * @param isLoading - Estado de carga
 * @param formatCurrency - Función para formatear moneda
 *
 * @example
 * <DashboardSummaryCards
 *   summary={{
 *     totalBudget: 1000000,
 *     totalSpent: 750000,
 *     totalRemaining: 250000,
 *     totalIncome: 1200000,
 *     spentPercentage: 75,
 *     overBudgetCount: 2
 *   }}
 *   isLoading={false}
 *   formatCurrency={(amount) => `$${amount.toLocaleString()}`}
 * />
 */

import React from 'react';

import { Wallet, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';

import Card, { CardContent } from '@/components/atoms/Card/Card';

interface DashboardSummary {
  totalBudget: number;
  totalSpent: number;
  totalRemaining: number;
  totalIncome: number;
  spentPercentage: number;
  overBudgetCount: number;
}

interface DashboardSummaryCardsProps {
  summary: DashboardSummary;
  isLoading: boolean;
  formatCurrency: (amount: number) => string;
}

export default function DashboardSummaryCards({
  summary,
  isLoading,
  formatCurrency,
}: DashboardSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Presupuesto Total */}
      <Card variant="glass" className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-600/10"></div>
        <CardContent className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Presupuesto Total</p>
              <p className="text-2xl font-bold text-white">
                {isLoading ? '...' : formatCurrency(summary.totalBudget)}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(summary.spentPercentage, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {summary.spentPercentage.toFixed(1)}% utilizado
          </p>
        </CardContent>
      </Card>

      {/* Total Gastado */}
      <Card variant="glass" className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-600/10"></div>
        <CardContent className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Total Gastado</p>
              <p className="text-2xl font-bold text-white">
                {isLoading ? '...' : formatCurrency(summary.totalSpent)}
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                summary.spentPercentage > 100
                  ? 'bg-red-500'
                  : summary.spentPercentage > 80
                    ? 'bg-amber-500'
                    : 'bg-green-500'
              }`}
              style={{
                width: `${Math.min(summary.spentPercentage, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {summary.spentPercentage.toFixed(1)}% del presupuesto
          </p>
        </CardContent>
      </Card>

      {/* Disponible */}
      <Card variant="glass" className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-600/10"></div>
        <CardContent className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-400" />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Disponible</p>
              <p
                className={`text-2xl font-bold ${summary.totalRemaining < 0 ? 'text-red-400' : 'text-white'}`}
              >
                {isLoading ? '...' : formatCurrency(summary.totalRemaining)}
              </p>
            </div>
          </div>
          {summary.overBudgetCount > 0 && (
            <div className="flex items-center text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {summary.overBudgetCount} categorías excedidas
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ingresos Totales */}
      <Card variant="glass" className="p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-600/10"></div>
        <CardContent className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Ingresos Totales</p>
              <p className="text-2xl font-bold text-white">
                {isLoading ? '...' : formatCurrency(summary.totalIncome)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Balance: {formatCurrency(summary.totalIncome - summary.totalSpent)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
