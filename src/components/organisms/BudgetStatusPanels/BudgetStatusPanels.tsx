/**
 * BudgetStatusPanels - Organism Level
 *
 * Paneles de estado de /presupuesto: error, carga y "sin categorías".
 * Qué panel se pinta lo decide getBudgetPanelState
 * (src/lib/onboarding/budget-empty-state.ts).
 *
 * Sin categorías activas no hay presupuesto posible, así que el panel vacío
 * ofrece las dos salidas: cargar las categorías sugeridas
 * (ensureStarterKitAction) o crear una a mano (el CategoryModal de la página,
 * que también crea el rubro por defecto del mes).
 *
 * @example
 * <BudgetStatusPanels
 *   isLoading={false}
 *   error={null}
 *   categoryCount={0}
 *   selectedMonthLabel="Septiembre 2026"
 *   onCreateCategory={() => setShowCategoryModal(true)}
 *   onLoadStarterKit={handleLoadStarterKit}
 *   isLoadingStarterKit={false}
 * />
 */

import React from 'react';

import { AlertCircle, FolderPlus, RefreshCw, Sparkles } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Card from '@/components/atoms/Card/Card';
import { getBudgetPanelState } from '@/lib/onboarding/budget-empty-state';

interface BudgetStatusPanelsProps {
  isLoading: boolean;
  error: string | null;
  /** Categorías activas del usuario (las que devuelve useMonthlyBudget). */
  categoryCount: number;
  selectedMonthLabel: string;
  /** Abre el CategoryModal de la página. */
  onCreateCategory: () => void;
  /** Llama ensureStarterKitAction y recarga el presupuesto. */
  onLoadStarterKit: () => void;
  isLoadingStarterKit: boolean;
}

export default function BudgetStatusPanels({
  isLoading,
  error,
  categoryCount,
  selectedMonthLabel,
  onCreateCategory,
  onLoadStarterKit,
  isLoadingStarterKit,
}: BudgetStatusPanelsProps) {
  const state = getBudgetPanelState({ isLoading, error, categoryCount });

  if (state === 'error') {
    return (
      <Card variant="glass" className="p-6 border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-red-400 mb-1">Error</h3>
            <p className="text-slate-600 dark:text-gray-300">{error}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (state === 'loading') {
    return (
      <Card variant="glass" className="p-8">
        <div className="flex items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
          <span className="text-slate-600 dark:text-gray-300 text-lg">
            Cargando presupuesto...
          </span>
        </div>
      </Card>
    );
  }

  if (state === 'sin-categorias') {
    return (
      <Card variant="glass" className="p-8 text-center">
        <div className="text-slate-500 dark:text-gray-400 mb-4">
          <FolderPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            Aún no tienes categorías
          </h3>
          <p className="text-sm">
            Para armar el presupuesto de {selectedMonthLabel} necesitas al menos
            una categoría. Carga las sugeridas (vivienda, mercado, transporte,
            salud, deudas y otros) o crea la tuya.
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="gradient"
            onClick={onLoadStarterKit}
            loading={isLoadingStarterKit}
            disabled={isLoadingStarterKit}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Cargar categorías sugeridas
          </Button>
          <Button
            variant="glass"
            onClick={onCreateCategory}
            disabled={isLoadingStarterKit}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            Crear categoría
          </Button>
        </div>
      </Card>
    );
  }

  return null;
}
