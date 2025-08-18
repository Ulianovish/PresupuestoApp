/**
 * GastosPage - Page Level (Refactored)
 *
 * Página de gastos mensuales refactorizada usando Atomic Design.
 * Utiliza Template y Organisms para una estructura más limpia y mantenible.
 *
 * Esta versión refactorizada reemplaza la página original de 797 líneas
 * con una estructura más modular y fácil de mantener.
 */
'use client';

import React, { useState } from 'react';

import ExpenseFloatingButton from '@/components/molecules/ExpenseFloatingButton/ExpenseFloatingButton';
import ExpenseHeader from '@/components/organisms/ExpenseHeader/ExpenseHeader';
import ExpenseModal from '@/components/organisms/ExpenseModal/ExpenseModal';
import ExpenseStatusPanels from '@/components/organisms/ExpenseStatusPanels/ExpenseStatusPanels';
import ExpenseSummary from '@/components/organisms/ExpenseSummary/ExpenseSummary';
import ExpenseTable from '@/components/organisms/ExpenseTable/ExpenseTable';
import ExpenseTypeSelectionModal from '@/components/organisms/ExpenseTypeSelectionModal/ExpenseTypeSelectionModal';
import InvoiceWorkflow from '@/components/organisms/InvoiceWorkflow/InvoiceWorkflow';
import ExpensePageTemplate from '@/components/templates/ExpensePageTemplate/ExpensePageTemplate';
import { useMonthlyExpenses } from '@/hooks/useMonthlyExpenses';
import {
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
  formatCurrency,
  formatMonthName,
  ExpenseTransaction,
} from '@/lib/services/expenses';
import type { SuggestedExpense } from '@/types/electronic-invoices';

// Interfaces
interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
}

export default function GastosPage() {
  // Hook para manejar gastos mensuales
  const {
    expenseData,
    loading,
    error,
    selectedMonth,
    availableMonths,
    isModalOpen,
    isEditing,
    editingTransaction,
    setSelectedMonth,
    refreshExpenses,
    openModal,
    closeModal,
    addExpense,
    editExpense,
    updateExpense,
    deleteExpense,
  } = useMonthlyExpenses();

  // Estado para el modal de selección de tipo de gasto
  const [isTypeSelectionOpen, setIsTypeSelectionOpen] = useState(false);

  // Estado para el workflow de facturas electrónicas
  const [isInvoiceWorkflowOpen, setIsInvoiceWorkflowOpen] = useState(false);

  // Estado del formulario
  const [form, setForm] = useState<FormData>({
    description: '',
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    category_name: EXPENSE_CATEGORIES[0],
    account_name: ACCOUNT_TYPES[0],
    place: '',
  });

  // Funciones para el modal de selección de tipo
  const openTypeSelection = () => setIsTypeSelectionOpen(true);
  const closeTypeSelection = () => setIsTypeSelectionOpen(false);

  const handleSelectManual = () => {
    // Cerrar modal de selección y abrir modal de formulario
    closeTypeSelection();
    openModal();
  };

  const handleSelectInvoice = () => {
    // Por ahora, mostrar mensaje de próximamente
    closeTypeSelection();
    console.warn('🚧 Funcionalidad de factura próximamente disponible');
    // TODO: Implementar funcionalidad de factura
  };

  const handleSelectQR = () => {
    // Abrir el workflow de facturas electrónicas
    closeTypeSelection();
    setIsInvoiceWorkflowOpen(true);
  };

  // Funciones del workflow de facturas electrónicas
  const handleInvoiceWorkflowClose = () => {
    console.error('🚨 handleInvoiceWorkflowClose llamado - cerrando workflow');
    console.trace('🔍 Stack trace del cierre:');
    setIsInvoiceWorkflowOpen(false);
  };

  const handleExpensesFromInvoice = async (expenses: SuggestedExpense[]) => {
    try {
      // Convertir gastos sugeridos al formato del sistema
      for (const expense of expenses) {
        const expenseForm: FormData = {
          description: expense.description,
          amount: expense.amount,
          transaction_date: expense.transaction_date,
          category_name: expense.suggested_category,
          account_name: 'Efectivo', // Cuenta por defecto para facturas
          place: expense.place || '',
        };

        await addExpense(expenseForm);
      }

      // Mostrar mensaje de éxito
      console.error(
        `✅ ${expenses.length} gastos agregados desde factura electrónica`,
      );

      // Refrescar la lista de gastos
      await refreshExpenses();
    } catch (error) {
      console.error('Error agregando gastos desde factura:', error);
      console.warn('❌ Error al agregar gastos desde la factura');
    }
  };

  const handleInvoiceError = (error: string) => {
    console.error('Error en workflow de facturas:', error);
    console.warn(`❌ Error procesando factura: ${error}`);
  };

  // Funciones del formulario
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  // Preparar formulario para edición
  const handleEditTransaction = (transaction: ExpenseTransaction) => {
    setForm({
      description: transaction.description,
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      category_name: transaction.category_name,
      account_name: transaction.account_name,
      place: transaction.place || '',
    });
    editExpense(transaction);
  };

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación básica
    if (!form.description.trim()) {
      console.warn('❌ La descripción es obligatoria');
      return;
    }

    if (form.amount <= 0) {
      console.warn('❌ El monto debe ser mayor a 0');
      return;
    }

    try {
      if (isEditing && editingTransaction) {
        await updateExpense(editingTransaction.id, form);
      } else {
        await addExpense(form);
      }

      // Resetear formulario
      setForm({
        description: '',
        amount: 0,
        transaction_date: new Date().toISOString().slice(0, 10),
        category_name: EXPENSE_CATEGORIES[0],
        account_name: ACCOUNT_TYPES[0],
        place: '',
      });

      closeModal();
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      console.warn('❌ Error al guardar el gasto');
    }
  };

  const handleCloseModal = () => {
    setForm({
      description: '',
      amount: 0,
      transaction_date: new Date().toISOString().slice(0, 10),
      category_name: EXPENSE_CATEGORIES[0],
      account_name: ACCOUNT_TYPES[0],
      place: '',
    });
    closeModal();
  };

  const handleDeleteExpense = async (transactionId: string) => {
    // TODO: Reemplazar con modal de confirmación personalizado
    const confirmed = true; // confirm('¿Estás seguro de que quieres eliminar este gasto?');
    console.warn('Eliminando gasto:', transactionId);

    if (confirmed) {
      try {
        await deleteExpense(transactionId);
        console.warn('✅ Gasto eliminado correctamente');
      } catch (error) {
        console.error('Error eliminando gasto:', error);
        console.warn('❌ Error al eliminar el gasto');
      }
    }
  };

  return (
    <ExpensePageTemplate
      header={
        <ExpenseHeader
          selectedMonth={selectedMonth}
          availableMonths={availableMonths.map(month => ({
            value: month,
            label: formatMonthName(month),
          }))}
          onMonthChange={setSelectedMonth}
          onRefresh={refreshExpenses}
          isLoading={loading}
        />
      }
      statusPanels={<ExpenseStatusPanels isLoading={loading} error={error} />}
      expenseSummary={
        expenseData && !loading ? (
          <ExpenseSummary
            expenseData={expenseData}
            formatCurrency={formatCurrency}
          />
        ) : undefined
      }
      expenseTable={
        expenseData && !loading ? (
          <ExpenseTable
            expenseData={expenseData}
            selectedMonth={selectedMonth}
            formatCurrency={formatCurrency}
            formatMonthName={formatMonthName}
            onEdit={handleEditTransaction}
            onDelete={handleDeleteExpense}
            onAddFirst={openTypeSelection}
          />
        ) : undefined
      }
      modal={
        <>
          {/* Modal de selección de tipo de gasto */}
          <ExpenseTypeSelectionModal
            isOpen={isTypeSelectionOpen}
            onClose={closeTypeSelection}
            onSelectManual={handleSelectManual}
            onSelectInvoice={handleSelectInvoice}
            onSelectQR={handleSelectQR}
          />
          {/* Modal de formulario de gasto */}
          <ExpenseModal
            isOpen={isModalOpen}
            isEditing={isEditing}
            formData={form}
            expenseCategories={[...EXPENSE_CATEGORIES]}
            accountTypes={[...ACCOUNT_TYPES]}
            onFormChange={handleFormChange}
            onSubmit={handleSubmitExpense}
            onClose={handleCloseModal}
          />
          {/* Workflow de facturas electrónicas */}
          <InvoiceWorkflow
            isOpen={isInvoiceWorkflowOpen}
            onClose={handleInvoiceWorkflowClose}
            onExpensesAdded={handleExpensesFromInvoice}
            onError={handleInvoiceError}
            title="Agregar Factura Electrónica"
            allowDirectSave={false}
          />
        </>
      }
      floatingButton={<ExpenseFloatingButton onClick={openTypeSelection} />}
    />
  );
}
