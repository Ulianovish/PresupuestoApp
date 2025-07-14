/**
 * BudgetHeader - Organism Level
 *
 * Header principal de la página de presupuesto con título, selector de mes y botón de actualizar.
 * Maneja la selección de mes y la actualización de datos.
 *
 * @param selectedMonth - Mes seleccionado actualmente
 * @param onMonthChange - Función para cambiar el mes
 * @param onRefresh - Función para actualizar los datos
 * @param isLoading - Estado de carga
 * @param monthOptions - Opciones disponibles para el selector de mes
 *
 * @example
 * <BudgetHeader
 *   selectedMonth="2025-07"
 *   onMonthChange={handleMonthChange}
 *   onRefresh={refreshBudget}
 *   isLoading={false}
 *   monthOptions={monthOptions}
 * />
 */

import React from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import MonthSelector from '@/components/atoms/MonthSelector/MonthSelector';

interface MonthOption {
  value: string;
  label: string;
}

interface BudgetHeaderProps {
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  monthOptions: MonthOption[];
}

export default function BudgetHeader({
  selectedMonth,
  onMonthChange,
  onRefresh,
  isLoading,
  monthOptions,
}: BudgetHeaderProps) {
  // Obtener la etiqueta del mes seleccionado
  const selectedMonthLabel =
    monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* Título y descripción */}
      <div>
        <h1 className="text-3xl font-bold text-blue-400 mb-2">
          Presupuesto Mensual
        </h1>
        <p className="text-gray-300">
          Presupuestado vs Real - {selectedMonthLabel}
        </p>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-4">
        {/* Selector de mes */}
        <MonthSelector
          value={selectedMonth}
          onChange={onMonthChange}
          options={monthOptions}
          disabled={isLoading}
          className="min-w-[200px]"
        />

        {/* Botón de actualizar */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
    </div>
  );
}
