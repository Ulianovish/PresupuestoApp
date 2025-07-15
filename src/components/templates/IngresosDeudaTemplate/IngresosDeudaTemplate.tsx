/**
 * IngresosDeudaTemplate - Template Level Component
 *
 * Template que define la estructura y layout de la página de ingresos y deudas.
 * Separa la presentación de la lógica de negocio siguiendo Atomic Design.
 *
 * Estructura del Template:
 * - Header con título y botón de recarga
 * - Sección de resumen financiero
 * - Botones de acciones para agregar ingresos y deudas
 * - Grid con listas de ingresos y deudas
 *
 * @param header - Componente de encabezado
 * @param summaryCards - Tarjetas de resumen financiero
 * @param actionButtons - Botones para agregar ingresos y deudas
 * @param ingresosSection - Sección de lista de ingresos
 * @param deudasSection - Sección de lista de deudas
 * @param isLoading - Estado de carga
 * @param error - Error si existe
 * @param refreshButton - Botón para refrescar datos
 *
 * @example
 * <IngresosDeudaTemplate
 *   header={<Header />}
 *   summaryCards={[<SummaryCard1 />, <SummaryCard2 />]}
 *   actionButtons={<ActionButtons />}
 *   ingresosSection={<IngresosSection />}
 *   deudasSection={<DeudasSection />}
 *   isLoading={false}
 *   error={null}
 *   refreshButton={<RefreshButton />}
 * />
 */

import React from 'react';

import { AlertTriangle, RefreshCw } from 'lucide-react';

import Card, { CardContent } from '@/components/atoms/Card/Card';

interface IngresosDeudaTemplateProps {
  header: React.ReactNode;
  summaryCards: React.ReactNode[];
  actionButtons: React.ReactNode;
  ingresosSection: React.ReactNode;
  deudasSection: React.ReactNode;
  isLoading: boolean;
  error: string | null;
  refreshButton: React.ReactNode;
}

export default function IngresosDeudaTemplate({
  header,
  summaryCards,
  actionButtons,
  ingresosSection,
  deudasSection,
  isLoading,
  error,
  refreshButton,
}: IngresosDeudaTemplateProps) {
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

  // Mostrar estado de carga
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-6xl mx-auto">
          <Card variant="glass" className="p-6">
            <CardContent className="text-center">
              <RefreshCw className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Cargando datos...
              </h2>
              <p className="text-gray-400">
                Obteniendo información de ingresos y deudas
              </p>
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
        <div className="mb-8">{header}</div>

        {/* Summary Cards Section */}
        {summaryCards.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {summaryCards.map((card, index) => (
              <div key={index}>{card}</div>
            ))}
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="mb-8">{actionButtons}</div>

        {/* Main Content Grid - Ingresos y Deudas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ingresos Section */}
          <div className="w-full">{ingresosSection}</div>

          {/* Deudas Section */}
          <div className="w-full">{deudasSection}</div>
        </div>
      </div>
    </div>
  );
}
