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
import ExpenseMigrationPanel from '@/components/organisms/ExpenseMigrationPanel/ExpenseMigrationPanel';
import ExpenseModal from '@/components/organisms/ExpenseModal/ExpenseModal';
import ExpenseStatusPanels from '@/components/organisms/ExpenseStatusPanels/ExpenseStatusPanels';
import ExpenseSummary from '@/components/organisms/ExpenseSummary/ExpenseSummary';
import ExpenseTable from '@/components/organisms/ExpenseTable/ExpenseTable';
import ExpensePageTemplate from '@/components/templates/ExpensePageTemplate/ExpensePageTemplate';
import { useMonthlyExpenses } from '@/hooks/useMonthlyExpenses';
import {
  EXPENSE_CATEGORIES,
  ACCOUNT_TYPES,
  formatCurrency,
  formatMonthName,
  ExpenseTransaction,
} from '@/lib/services/expenses';
import {
  migrateJulyExpenses,
  checkMigrationStatus,
} from '@/scripts/migrate-july-expenses';

// Interfaces
interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
}

interface MigrationStatus {
  hasJulyData: boolean;
  expenseCount: number;
  totalAmount: number;
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

  // Estados locales
  const [showMigrationPanel, setShowMigrationPanel] = useState(false);
  const [migrationStatus, setMigrationStatus] =
    useState<MigrationStatus | null>(null);

  // Estado del formulario
  const [form, setForm] = useState<FormData>({
    description: '',
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    category_name: EXPENSE_CATEGORIES[0],
    account_name: ACCOUNT_TYPES[0],
    place: '',
  });

  // Funciones para migración
  const handleShowMigrationPanel = async () => {
    setShowMigrationPanel(true);
    try {
      const status = await checkMigrationStatus();
      setMigrationStatus(status);
    } catch (error) {
      console.error('Error verificando estado de migración:', error);
    }
  };

  const handleMigrateJuly = async () => {
    try {
      const result = await migrateJulyExpenses();
      if (result.success) {
        console.warn(
          `✅ Migración completada! ${result.migratedCount} gastos migrados.`
        );
        setShowMigrationPanel(false);
        refreshExpenses();
      } else {
        console.warn(`❌ Error en migración: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Error durante migración:', error);
      console.warn('❌ Error inesperado durante la migración');
    }
  };

  // Funciones del formulario
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
          onShowMigration={handleShowMigrationPanel}
          isLoading={loading}
        />
      }
      migrationPanel={
        <ExpenseMigrationPanel
          isVisible={showMigrationPanel}
          migrationStatus={migrationStatus}
          onMigrate={handleMigrateJuly}
          onClose={() => setShowMigrationPanel(false)}
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
            onAddFirst={openModal}
          />
        ) : undefined
      }
      modal={
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
      }
      floatingButton={<ExpenseFloatingButton onClick={openModal} />}
    />
  );
}
