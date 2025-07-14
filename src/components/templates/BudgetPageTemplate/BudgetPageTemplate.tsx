/**
 * BudgetPageTemplate - Template Level
 *
 * Template para la página de presupuesto que define la estructura general y layout.
 * Sigue el patrón Atomic Design para composición de componentes.
 *
 * @param header - Componente del header con selector de mes
 * @param migrationPanel - Panel de migración de datos (opcional)
 * @param statusPanels - Paneles de estado (error, loading, vacío)
 * @param budgetTable - Tabla principal del presupuesto
 * @param modal - Modal para agregar/editar items
 *
 * @example
 * <BudgetPageTemplate
 *   header={<BudgetHeader />}
 *   migrationPanel={<BudgetMigrationPanel />}
 *   statusPanels={<BudgetStatusPanels />}
 *   budgetTable={<BudgetTable />}
 *   modal={<BudgetItemModal />}
 * />
 */

import React from 'react';

interface BudgetPageTemplateProps {
  header: React.ReactNode;
  migrationPanel?: React.ReactNode;
  statusPanels?: React.ReactNode;
  budgetTable?: React.ReactNode;
  modal: React.ReactNode;
}

export default function BudgetPageTemplate({
  header,
  migrationPanel,
  statusPanels,
  budgetTable,
  modal,
}: BudgetPageTemplateProps) {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header section */}
        <div className="mb-8">{header}</div>

        {/* Migration panel section */}
        {migrationPanel && <div className="mb-6">{migrationPanel}</div>}

        {/* Status panels section (error, loading, empty) */}
        {statusPanels && <div className="mb-6">{statusPanels}</div>}

        {/* Main budget table section */}
        {budgetTable && <div className="mb-6">{budgetTable}</div>}

        {/* Modal section */}
        {modal}
      </div>
    </div>
  );
}
