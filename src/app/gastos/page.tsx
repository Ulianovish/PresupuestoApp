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

import React, { useRef, useState } from 'react';

import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import ExpenseFloatingButton from '@/components/molecules/ExpenseFloatingButton/ExpenseFloatingButton';
import ExpenseHeader from '@/components/organisms/ExpenseHeader/ExpenseHeader';
import ExpenseModal from '@/components/organisms/ExpenseModal/ExpenseModal';
import ExpenseStatusPanels from '@/components/organisms/ExpenseStatusPanels/ExpenseStatusPanels';
import ExpenseSummary from '@/components/organisms/ExpenseSummary/ExpenseSummary';
import ExpenseTable from '@/components/organisms/ExpenseTable/ExpenseTable';
import ExpensePageTemplate from '@/components/templates/ExpensePageTemplate/ExpensePageTemplate';
import { useCategories } from '@/hooks/useCategories';
import { useMonthlyExpenses } from '@/hooks/useMonthlyExpenses';
import {
  ACCOUNT_TYPES,
  createExpenseTransaction,
  formatCurrency,
  formatMonthName,
  ExpenseTransaction,
} from '@/lib/services/expenses';

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

  // Cargar categorías dinámicas desde la BD
  const { categories: budgetCategories } = useCategories();
  const categoryNames = budgetCategories.map(c => c.name.toUpperCase());

  // Estado y ref para importar Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Estado del modal de confirmación de eliminación
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: '', name: '' });

  // Estado del formulario
  const [form, setForm] = useState<FormData>({
    description: '',
    amount: 0,
    transaction_date: new Date().toISOString().slice(0, 10),
    category_name: '',
    account_name: ACCOUNT_TYPES[0],
    place: '',
  });

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
        category_name: categoryNames[0] || '',
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
      category_name: categoryNames[0] || '',
      account_name: ACCOUNT_TYPES[0],
      place: '',
    });
    closeModal();
  };

  const handleDeleteExpense = async (transactionId: string) => {
    // Buscar descripción del gasto para el modal
    const transaction = expenseData?.transactions.find(
      t => t.id === transactionId,
    );
    setConfirmDelete({
      isOpen: true,
      id: transactionId,
      name: transaction?.description || 'este gasto',
    });
  };

  const executeDeleteExpense = async () => {
    const { id } = confirmDelete;
    setConfirmDelete(prev => ({ ...prev, isOpen: false }));
    try {
      await deleteExpense(id);
    } catch (error) {
      console.error('Error eliminando gasto:', error);
    }
  };

  // Importar gastos desde Excel
  const handleImportExcel = () => {
    fileInputRef.current?.click();
  };

  const processExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (rows.length === 0) {
        toast.error('El archivo Excel está vacío');
        setIsImporting(false);
        return;
      }

      toast.info(`Procesando ${rows.length} filas del Excel...`);

      // Auto-detectar columnas por nombre (case-insensitive)
      const findCol = (row: Record<string, unknown>, ...names: string[]) => {
        for (const key of Object.keys(row)) {
          const lower = key.toLowerCase().trim();
          if (names.some(n => lower.includes(n))) return key;
        }
        return null;
      };

      const sample = rows[0];
      const descCol = findCol(
        sample,
        'descripcion',
        'description',
        'concepto',
        'detalle',
        'nombre',
      );
      const amountCol = findCol(
        sample,
        'monto',
        'valor',
        'amount',
        'total',
        'precio',
      );
      const dateCol = findCol(sample, 'fecha', 'date', 'dia');
      const catCol = findCol(sample, 'categoria', 'category', 'tipo');
      const accountCol = findCol(sample, 'cuenta', 'account', 'medio', 'banco');
      const placeCol = findCol(
        sample,
        'lugar',
        'place',
        'sitio',
        'comercio',
        'establecimiento',
      );

      if (!descCol || !amountCol) {
        const columnsFound = Object.keys(sample).join(', ');
        toast.error(
          `No se encontraron columnas de Descripción o Monto. Columnas detectadas: ${columnsFound}`,
        );
        setIsImporting(false);
        return;
      }

      // Mostrar qué columnas se detectaron
      const detected = [
        descCol && `Descripción: "${descCol}"`,
        amountCol && `Monto: "${amountCol}"`,
        dateCol && `Fecha: "${dateCol}"`,
        catCol && `Categoría: "${catCol}"`,
        accountCol && `Cuenta: "${accountCol}"`,
        placeCol && `Lugar: "${placeCol}"`,
      ].filter(Boolean);
      console.log('Columnas detectadas:', detected.join(', '));

      let imported = 0;
      let skipped = 0;
      let errors = 0;
      const monthsAffected = new Set<string>();
      const errorMessages: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const rawAmount = row[amountCol];
          const amount =
            typeof rawAmount === 'number'
              ? Math.abs(rawAmount)
              : Math.abs(
                  parseFloat(String(rawAmount).replace(/[^0-9.-]/g, '')) || 0,
                );

          if (amount <= 0) {
            skipped++;
            continue;
          }

          const description = String(row[descCol] || '').trim();
          if (!description) {
            skipped++;
            continue;
          }

          // Parsear fecha
          let transactionDate = new Date().toISOString().slice(0, 10);
          if (dateCol && row[dateCol]) {
            const rawDate = row[dateCol];
            if (typeof rawDate === 'number') {
              // Excel serial date
              const excelDate = XLSX.SSF.parse_date_code(rawDate);
              transactionDate = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
            } else {
              const dateStr = String(rawDate).trim();
              // Intentar varios formatos de fecha
              let parsed = new Date(dateStr);
              // Formato DD/MM/YYYY o DD-MM-YYYY
              if (isNaN(parsed.getTime())) {
                const parts = dateStr.split(/[/\-\.]/);
                if (parts.length === 3) {
                  const [d, m, y] = parts;
                  // Si el primer número es > 12, asumir DD/MM/YYYY
                  if (parseInt(d) > 12) {
                    parsed = new Date(
                      `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`,
                    );
                  } else {
                    parsed = new Date(
                      `${y}-${d.padStart(2, '0')}-${m.padStart(2, '0')}`,
                    );
                  }
                }
              }
              if (!isNaN(parsed.getTime())) {
                transactionDate = parsed.toISOString().slice(0, 10);
              }
            }
          }

          // Registrar el mes afectado (YYYY-MM)
          monthsAffected.add(transactionDate.slice(0, 7));

          const categoryName =
            catCol && row[catCol]
              ? String(row[catCol]).toUpperCase().trim()
              : categoryNames[0] || 'OTROS';

          const accountName =
            accountCol && row[accountCol]
              ? String(row[accountCol]).trim()
              : ACCOUNT_TYPES[0];

          const place =
            placeCol && row[placeCol] ? String(row[placeCol]).trim() : '';

          await createExpenseTransaction({
            description,
            amount,
            transaction_date: transactionDate,
            category_name: categoryName,
            account_name: accountName,
            place,
          });
          imported++;
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : 'Error desconocido';
          if (errorMessages.length < 3) {
            errorMessages.push(`Fila ${i + 2}: ${msg}`);
          }
        }
      }

      // Mostrar resultado con toast
      if (imported > 0) {
        const monthsList = Array.from(monthsAffected).sort().join(', ');
        toast.success(
          `${imported} gastos importados en ${monthsAffected.size} mes(es): ${monthsList}`,
          { duration: 6000 },
        );
      }

      if (skipped > 0) {
        toast.warning(
          `${skipped} filas omitidas (sin descripción o monto vacío/cero)`,
        );
      }

      if (errors > 0) {
        toast.error(
          `${errors} filas con error${errorMessages.length > 0 ? `: ${errorMessages.join('; ')}` : ''}`,
          { duration: 8000 },
        );
      }

      if (imported === 0 && errors === 0 && skipped === 0) {
        toast.warning('No se encontraron datos válidos en el archivo');
      }

      await refreshExpenses();
    } catch (error) {
      console.error('Error importando Excel:', error);
      toast.error(
        'Error al leer el archivo Excel. Verifica que el formato sea correcto.',
      );
    } finally {
      setIsImporting(false);
      // Reset file input para permitir reimportar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = '';
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
          onImportExcel={handleImportExcel}
          isLoading={loading}
          isImporting={isImporting}
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
          expenseCategories={categoryNames}
          accountTypes={[...ACCOUNT_TYPES]}
          onFormChange={handleFormChange}
          onSubmit={handleSubmitExpense}
          onClose={handleCloseModal}
        />
      }
      floatingButton={<ExpenseFloatingButton onClick={openModal} />}
    >
      {/* Input oculto para importar Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={processExcelFile}
        className="hidden"
      />

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeDeleteExpense}
        title="Eliminar gasto"
        message={`¿Estás seguro de que deseas eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
      />
    </ExpensePageTemplate>
  );
}
