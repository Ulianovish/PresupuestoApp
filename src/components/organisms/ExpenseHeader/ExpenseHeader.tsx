/**
 * ExpenseHeader - Organism Level
 *
 * Header principal de la página de gastos con título, selector de mes y botón de actualizar.
 * Incluye botón para mostrar migración de datos de julio.
 *
 * @param selectedMonth - Mes seleccionado actualmente
 * @param availableMonths - Meses disponibles para seleccionar
 * @param onMonthChange - Función para cambiar el mes
 * @param onRefresh - Función para actualizar los datos
 * @param onShowMigration - Función para mostrar panel de migración
 * @param isLoading - Estado de carga
 *
 * @example
 * <ExpenseHeader
 *   selectedMonth="2025-07"
 *   availableMonths={monthOptions}
 *   onMonthChange={setSelectedMonth}
 *   onRefresh={refreshExpenses}
 *   onShowMigration={handleShowMigrationPanel}
 *   isLoading={loading}
 * />
 */

import React from 'react';

import { RefreshCw, Database } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import MonthSelector from '@/components/atoms/MonthSelector/MonthSelector';
import { formatMonthName } from '@/lib/services/expenses';

interface MonthOption {
  value: string;
  label: string;
}

interface ExpenseHeaderProps {
  selectedMonth: string;
  availableMonths: MonthOption[];
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  onShowMigration: () => void;
  isLoading: boolean;
}

export default function ExpenseHeader({
  selectedMonth,
  availableMonths,
  onMonthChange,
  onRefresh,
  onShowMigration,
  isLoading,
}: ExpenseHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* Título y descripción */}
      <div>
        <h1 className="text-3xl font-bold text-blue-400 mb-2">
          Gastos Mensuales
        </h1>
        <p className="text-gray-300">
          Gestión de gastos - {formatMonthName(selectedMonth)}
        </p>
      </div>

      {/* Controles */}
      <div className="flex items-center gap-4">
        {/* Selector de mes */}
        <MonthSelector
          value={selectedMonth}
          onChange={onMonthChange}
          options={availableMonths}
          disabled={isLoading}
          className="min-w-[200px]"
        />

        {/* Botón de migración julio */}
        {selectedMonth === '2025-07' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShowMigration}
            disabled={isLoading}
            className="flex items-center gap-2 border-amber-500/50 text-amber-300 hover:bg-amber-500/10"
          >
            <Database className="w-4 h-4" />
            Migrar Julio
          </Button>
        )}

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
