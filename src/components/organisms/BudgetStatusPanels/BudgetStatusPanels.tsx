/**
 * BudgetStatusPanels - Organism Level
 *
 * Organism que maneja todos los paneles de estado para la página de presupuesto:
 * - Panel de error
 * - Panel de carga
 * - Panel de estado vacío
 *
 * @param isLoading - Estado de carga
 * @param error - Mensaje de error (si existe)
 * @param hasData - Si hay datos para mostrar
 * @param selectedMonth - Mes seleccionado
 * @param selectedMonthLabel - Etiqueta del mes seleccionado
 * @param onCreateBudget - Función para crear presupuesto nuevo
 *
 * @example
 * <BudgetStatusPanels
 *   isLoading={false}
 *   error="Error al cargar datos"
 *   hasData={false}
 *   selectedMonth="2025-07"
 *   selectedMonthLabel="Julio 2025"
 *   onCreateBudget={handleCreateBudget}
 * />
 */

import React from 'react';

import { AlertCircle, Database, RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';

interface BudgetStatusPanelsProps {
  isLoading: boolean;
  error: string | null;
  hasData: boolean;
  selectedMonth: string;
  selectedMonthLabel: string;
  onCreateBudget: (month: string) => void;
}

export default function BudgetStatusPanels({
  isLoading,
  error,
  hasData,
  selectedMonth,
  selectedMonthLabel,
  onCreateBudget,
}: BudgetStatusPanelsProps) {
  return (
    <>
      {/* Panel de error */}
      {error && (
        <Card variant="glass" className="p-6 border-red-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-red-400 mb-1">Error</h3>
              <p className="text-gray-300">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Panel de carga */}
      {isLoading && (
        <Card variant="glass" className="p-8">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <span className="text-gray-300 text-lg">
              Cargando presupuesto...
            </span>
          </div>
        </Card>
      )}

      {/* Panel de estado vacío */}
      {!isLoading && !hasData && !error && (
        <Card variant="glass" className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">
              No hay datos para este mes
            </h3>
            <p className="text-sm">
              {selectedMonth === '2025-07'
                ? 'Usa el botón "Migrar Datos de Julio" para empezar con datos de ejemplo.'
                : `No hay presupuesto creado para ${selectedMonthLabel}. Puedes crear uno nuevo.`}
            </p>
          </div>

          {/* Botón para crear presupuesto nuevo (solo si no es julio) */}
          {selectedMonth !== '2025-07' && (
            <Button
              variant="gradient"
              onClick={() => onCreateBudget(selectedMonth)}
              className="mt-4"
            >
              Crear Presupuesto para {selectedMonthLabel}
            </Button>
          )}
        </Card>
      )}
    </>
  );
}
