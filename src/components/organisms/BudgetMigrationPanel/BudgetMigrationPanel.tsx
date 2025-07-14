/**
 * BudgetMigrationPanel - Organism Level
 *
 * Panel de migración de datos para julio 2025.
 * Maneja el estado de migración y permite migrar datos de ejemplo.
 *
 * @param isVisible - Si el panel debe ser visible
 * @param isChecking - Si está verificando el estado de migración
 * @param isMigrating - Si está migrando datos
 * @param onMigrate - Función para ejecutar la migración
 *
 * @example
 * <BudgetMigrationPanel
 *   isVisible={true}
 *   isChecking={false}
 *   isMigrating={false}
 *   onMigrate={handleMigration}
 * />
 */

import React from 'react';

import { Database, RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';

interface BudgetMigrationPanelProps {
  isVisible: boolean;
  isChecking: boolean;
  isMigrating: boolean;
  onMigrate: () => void;
}

export default function BudgetMigrationPanel({
  isVisible,
  isChecking,
  isMigrating,
  onMigrate,
}: BudgetMigrationPanelProps) {
  // Si está verificando, mostrar panel de carga
  if (isChecking) {
    return (
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
          <span className="text-gray-300">Verificando datos...</span>
        </div>
      </Card>
    );
  }

  // Si no es visible, no mostrar nada
  if (!isVisible) {
    return null;
  }

  return (
    <Card variant="glass" className="p-6 border-amber-500/20">
      <div className="flex items-start gap-4">
        <Database className="w-6 h-6 text-amber-400 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-amber-400 mb-2">
            Migrar Datos Iniciales
          </h3>
          <p className="text-gray-300 mb-4">
            Para empezar con datos reales de julio 2025, puedes migrar los datos
            de ejemplo a Supabase. Esto creará todas las categorías y elementos
            del presupuesto en la base de datos.
          </p>

          <Button
            variant="gradient"
            onClick={onMigrate}
            disabled={isMigrating}
            className="flex items-center gap-2"
          >
            {isMigrating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Migrando datos...
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Migrar Datos de Julio
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
