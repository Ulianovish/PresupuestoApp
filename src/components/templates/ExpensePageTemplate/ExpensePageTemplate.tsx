/**
 * ExpensePageTemplate - Template Level
 *
 * Template para la página de gastos que define la estructura general y layout.
 * Sigue el patrón Atomic Design para composición de componentes.
 *
 * @param header - Componente del header con selector de mes
 * @param migrationPanel - Panel de migración de datos (opcional)
 * @param statusPanels - Paneles de estado (error, loading)
 * @param expenseSummary - Resumen de gastos por categoría
 * @param expenseTable - Tabla de transacciones
 * @param modal - Modal para agregar/editar gastos
 * @param floatingButton - Botón flotante para agregar
 *
 * @example
 * <ExpensePageTemplate
 *   header={<ExpenseHeader />}
 *   migrationPanel={<ExpenseMigrationPanel />}
 *   statusPanels={<ExpenseStatusPanels />}
 *   expenseSummary={<ExpenseSummary />}
 *   expenseTable={<ExpenseTable />}
 *   modal={<ExpenseModal />}
 *   floatingButton={<ExpenseFloatingButton />}
 * />
 */

import React from 'react';

interface ExpensePageTemplateProps {
  header: React.ReactNode;
  migrationPanel?: React.ReactNode;
  statusPanels?: React.ReactNode;
  expenseSummary?: React.ReactNode;
  expenseTable?: React.ReactNode;
  modal: React.ReactNode;
  floatingButton: React.ReactNode;
}

export default function ExpensePageTemplate({
  header,
  migrationPanel,
  statusPanels,
  expenseSummary,
  expenseTable,
  modal,
  floatingButton,
}: ExpensePageTemplateProps) {
  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header section */}
        <div className="mb-8">{header}</div>

        {/* Migration panel section */}
        {migrationPanel && <div className="mb-6">{migrationPanel}</div>}

        {/* Status panels section (error, loading) */}
        {statusPanels && <div className="mb-6">{statusPanels}</div>}

        {/* Expense summary section */}
        {expenseSummary && <div className="mb-6">{expenseSummary}</div>}

        {/* Expense table section */}
        {expenseTable && <div className="mb-6">{expenseTable}</div>}

        {/* Modal section */}
        {modal}

        {/* Floating button */}
        {floatingButton}
      </div>
    </div>
  );
}
