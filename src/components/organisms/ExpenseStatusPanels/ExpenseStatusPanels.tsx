/**
 * ExpenseStatusPanels - Organism Level
 *
 * Organism que maneja todos los paneles de estado para la página de gastos:
 * - Panel de carga
 * - Panel de error
 *
 * @param isLoading - Estado de carga
 * @param error - Mensaje de error (si existe)
 *
 * @example
 * <ExpenseStatusPanels
 *   isLoading={loading}
 *   error={error}
 * />
 */

import React from 'react';

import { AlertCircle } from 'lucide-react';

import Card from '@/components/atoms/Card/Card';

interface ExpenseStatusPanelsProps {
  isLoading: boolean;
  error: string | null;
}

export default function ExpenseStatusPanels({
  isLoading,
  error,
}: ExpenseStatusPanelsProps) {
  return (
    <>
      {/* Panel de carga */}
      {isLoading && (
        <Card variant="glass" className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-300">Cargando gastos...</p>
        </Card>
      )}

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
    </>
  );
}
