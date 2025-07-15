/**
 * ExpenseMigrationPanel - Organism Level
 *
 * Panel de migración de datos de gastos para julio 2025.
 * Muestra información sobre la migración y permite ejecutarla.
 *
 * @param isVisible - Si el panel debe ser visible
 * @param migrationStatus - Estado de la migración con datos existentes
 * @param onMigrate - Función para ejecutar la migración
 * @param onClose - Función para cerrar el panel
 *
 * @example
 * <ExpenseMigrationPanel
 *   isVisible={showMigrationPanel}
 *   migrationStatus={migrationStatus}
 *   onMigrate={handleMigrateJuly}
 *   onClose={() => setShowMigrationPanel(false)}
 * />
 */

import React from 'react';

import { Database, X } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import { formatCurrency } from '@/lib/services/expenses';

interface MigrationStatus {
  hasJulyData: boolean;
  expenseCount: number;
  totalAmount: number;
}

interface ExpenseMigrationPanelProps {
  isVisible: boolean;
  migrationStatus: MigrationStatus | null;
  onMigrate: () => void;
  onClose: () => void;
}

export default function ExpenseMigrationPanel({
  isVisible,
  migrationStatus,
  onMigrate,
  onClose,
}: ExpenseMigrationPanelProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <Card variant="glass" className="border-amber-500/30 overflow-hidden">
      <CardHeader className="bg-amber-500/10 border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-amber-400">
            <Database className="w-5 h-5" />
            Migración de Datos - Julio 2025
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-amber-400 hover:bg-amber-500/20"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="space-y-4">
          <p className="text-slate-300">
            Migra los datos de ejemplo de gastos de julio 2025 desde el sistema
            local hacia Supabase. Esto permitirá tener datos reales para probar
            todas las funcionalidades.
          </p>

          {migrationStatus && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-amber-400 font-semibold mb-2">
                Datos disponibles para migrar:
              </h4>
              <div className="text-slate-300 space-y-1">
                <p>📊 {migrationStatus.expenseCount} transacciones</p>
                <p>💰 Total: {formatCurrency(migrationStatus.totalAmount)}</p>
              </div>
              <div className="mt-3 text-sm text-slate-400">
                <p className="mb-1">Incluye gastos como:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Arriendo - {formatCurrency(1410000)}</li>
                  <li>• Administración - {formatCurrency(324000)}</li>
                  <li>• Gasolina - {formatCurrency(50000)}</li>
                  <li>• Lacena - {formatCurrency(38277)}</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="gradient" onClick={onMigrate}>
              Migrar Datos de Julio
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-slate-300"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
