/**
 * DashboardPageTemplate - Template Level Component
 *
 * Template que define la estructura y layout del dashboard principal.
 * Separa la presentación de la lógica de negocio siguiendo Atomic Design.
 *
 * Estructura del Template:
 * - Header con saludo y selector de mes
 * - Sección de tarjetas de resumen financiero
 * - Botones de acciones rápidas
 * - Área principal para mostrar tabla de presupuesto
 *
 * @param greeting - Saludo personalizado al usuario
 * @param monthSelector - Componente selector de mes
 * @param summaryCards - Tarjetas con resumen financiero
 * @param quickActions - Botones de acciones rápidas
 * @param mainContent - Contenido principal (tabla de presupuesto)
 * @param refreshButton - Botón para refrescar datos
 * @param isLoading - Estado de carga
 * @param error - Error si existe
 *
 * @example
 * <DashboardPageTemplate
 *   greeting="🌅 Buenos días"
 *   monthSelector={<MonthSelector />}
 *   summaryCards={[<SummaryCard1 />, <SummaryCard2 />]}
 *   quickActions={<QuickActionsButtons />}
 *   mainContent={<BudgetTable />}
 *   refreshButton={<RefreshButton />}
 *   isLoading={false}
 *   error={null}
 * />
 */

import React from 'react';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import Card, { CardContent } from '@/components/atoms/Card/Card';

interface DashboardPageTemplateProps {
  greeting: string;
  monthSelector: React.ReactNode;
  summaryCards: React.ReactNode;
  quickActions: React.ReactNode;
  mainContent: React.ReactNode;
  refreshButton: React.ReactNode;
  isLoading: boolean;
  error: string | null;
}

export default function DashboardPageTemplate({
  greeting: _greeting,
  monthSelector,
  summaryCards,
  quickActions,
  mainContent,
  refreshButton,
  isLoading,
  error,
}: DashboardPageTemplateProps) {
  // Mostrar estado de error si existe
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-6xl mx-auto">
          <Card variant="glass" className="p-6">
            <CardContent className="text-center">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Error al cargar datos
              </h2>
              <p className="text-gray-400 mb-4">{error}</p>
              {refreshButton}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">{monthSelector}</div>

        {/* Summary Cards Grid */}
        <div className="mb-8">{summaryCards}</div>

        {/* Quick Actions Section */}
        <div className="mb-8">{quickActions}</div>

        {/* Main Content Area */}
        <div className="w-full">
          <Card variant="glass" className="p-6">
            <CardContent className="px-0 overflow-visible">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
                  <span className="ml-2 text-gray-400">Cargando datos...</span>
                </div>
              ) : (
                <div className="overflow-visible">{mainContent}</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
