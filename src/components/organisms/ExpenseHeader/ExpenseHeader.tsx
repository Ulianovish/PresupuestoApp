/**
 * ExpenseHeader - Organism Level
 *
 * Header principal de la página de gastos con título, selector de mes y botón de actualizar.
 * Incluye botón para mostrar migración de datos de julio.
 *
 * @param selectedMonth - Mes seleccionado actualmente
 * @param onRefresh - Función para actualizar los datos
 * @param onShowMigration - Función para mostrar panel de migración
 * @param isLoading - Estado de carga
 *
 * @example
 * <ExpenseHeader
 *   selectedMonth="2025-07"
 *   onRefresh={refreshExpenses}
 *   onShowMigration={handleShowMigrationPanel}
 *   isLoading={loading}
 * />
 */

import React from 'react';

import { RefreshCw, Database, Upload, Tags } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import { formatMonthName } from '@/lib/services/expenses';

interface ExpenseHeaderProps {
  selectedMonth: string;
  onRefresh: () => void;
  onImportExcel?: () => void;
  onAutoRecategorize?: () => void;
  onShowMigration?: () => void;
  isLoading: boolean;
  isImporting?: boolean;
  isRecategorizing?: boolean;
}

export default function ExpenseHeader({
  selectedMonth,
  onRefresh,
  onImportExcel,
  onAutoRecategorize,
  onShowMigration,
  isLoading,
  isImporting,
  isRecategorizing,
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
        {/* Botón de importar Excel */}
        {onImportExcel && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportExcel}
            disabled={isLoading || isImporting}
            className="flex items-center gap-2 border-green-500/50 text-green-300 hover:bg-green-500/10"
          >
            <Upload
              className={`w-4 h-4 ${isImporting ? 'animate-pulse' : ''}`}
            />
            {isImporting ? 'Importando...' : 'Importar Excel'}
          </Button>
        )}

        {/* Botón de auto-categorizar */}
        {onAutoRecategorize && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAutoRecategorize}
            disabled={isLoading || isRecategorizing}
            className="flex items-center gap-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
          >
            <Tags
              className={`w-4 h-4 ${isRecategorizing ? 'animate-pulse' : ''}`}
            />
            {isRecategorizing ? 'Categorizando...' : 'Auto-categorizar'}
          </Button>
        )}

        {/* Botón de migración julio */}
        {selectedMonth === '2025-07' && onShowMigration && (
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
