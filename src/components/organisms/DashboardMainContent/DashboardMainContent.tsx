/**
 * DashboardMainContent - Organism Level Component
 *
 * Componente que renderiza el contenido principal del dashboard.
 * Muestra las categorías del presupuesto en grid con barras de progreso.
 *
 * @param budgetItems - Lista de elementos de presupuesto
 * @param budgetData - Datos del presupuesto
 * @param isLoading - Estado de carga
 * @param onItemUpdate - Función para actualizar un elemento
 * @param onItemEdit - Función para editar un elemento
 *
 * @example
 * <DashboardMainContent
 *   budgetItems={[]}
 *   budgetData={null}
 *   isLoading={false}
 *   onItemUpdate={(id, value) => console.log(id, value)}
 *   onItemEdit={(id) => console.log(id)}
 * />
 */

import React from 'react';

import Link from 'next/link';

import { Target, Plus } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import { MonthlyBudgetData } from '@/lib/services/budget';

interface BudgetItem {
  id: string;
  description: string;
  amount: number;
  status: 'on-track' | 'over-budget' | 'under-budget';
  category: string;
  real?: number;
  remaining?: number;
}

interface DashboardMainContentProps {
  budgetItems: BudgetItem[];
  budgetData: MonthlyBudgetData | null;
  isLoading: boolean;
  onItemUpdate: (id: string, value: number) => void;
  onItemEdit: (id: string) => void;
}

export default function DashboardMainContent({
  budgetItems,
  budgetData,
  isLoading,
  onItemUpdate: _onItemUpdate,
  onItemEdit: _onItemEdit,
}: DashboardMainContentProps) {
  // Mostrar mensaje si no hay datos de presupuesto
  if (
    !isLoading &&
    (!budgetData ||
      !budgetData.categories ||
      budgetData.categories.length === 0)
  ) {
    return (
      <div className="text-center py-8">
        <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          No hay presupuesto para este mes
        </h3>
        <p className="text-gray-400 mb-4">
          Crea tu presupuesto mensual para comenzar a gestionar tus finanzas
        </p>
        <Link href="/presupuesto">
          <Button variant="gradient">
            <Plus className="w-4 h-4 mr-2" />
            Crear Presupuesto
          </Button>
        </Link>
      </div>
    );
  }

  // Función para calcular el porcentaje gastado
  const calculateProgress = (real: number, budgeted: number) => {
    if (budgeted === 0) return 0;
    return Math.min((real / budgeted) * 100, 100);
  };

  // Función para obtener el color de la barra según el estado
  const getProgressColor = (status: string) => {
    switch (status) {
      case 'over-budget':
        return 'bg-red-500';
      case 'on-track':
        return 'bg-amber-500';
      case 'under-budget':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Función para obtener el color del texto según el estado
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over-budget':
        return 'text-red-400';
      case 'on-track':
        return 'text-amber-400';
      case 'under-budget':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  // Mostrar grid de categorías con barras de progreso
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Resumen por Categorías
        </h3>
        <span className="text-sm text-gray-400">
          {budgetItems.length} categorías
        </span>
      </div>

      {/* Grid de 3 columnas con altura mínima y overflow visible */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
        {budgetItems.map(item => {
          const real = item.real || 0;
          const budgeted = item.amount;
          const progress = calculateProgress(real, budgeted);
          const progressColor = getProgressColor(item.status);
          const statusColor = getStatusColor(item.status);

          return (
            <div
              key={item.id}
              className="min-h-[160px] p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors border border-white/10 flex flex-col"
            >
              {/* Título de la categoría */}
              <h4
                className="text-white font-medium mb-3 text-sm truncate"
                title={item.description}
              >
                {item.description}
              </h4>

              {/* Montos presupuestado y real */}
              <div className="space-y-2 mb-3 flex-shrink-0">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Presupuestado:</span>
                  <span className="text-white">
                    ${budgeted.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Gastado:</span>
                  <span className="text-white">${real.toLocaleString()}</span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="mb-3 flex-shrink-0">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progreso</span>
                  <span>{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${progressColor}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Estado y monto restante */}
              <div className="flex justify-between items-end mt-auto">
                <div className="text-xs">
                  <span className={statusColor}>
                    {item.status === 'over-budget'
                      ? 'Excedido'
                      : item.status === 'on-track'
                        ? 'En progreso'
                        : 'Disponible'}
                  </span>
                </div>
                <div className={`text-xs font-bold ${statusColor}`}>
                  ${(item.remaining || 0).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {budgetItems.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400">
            No hay categorías de presupuesto configuradas
          </p>
        </div>
      )}
    </div>
  );
}
