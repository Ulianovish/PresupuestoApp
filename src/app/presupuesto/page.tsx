/**
 * PresupuestoPage - Page Level (Refactored)
 *
 * Página de presupuesto mensual refactorizada usando Atomic Design.
 * Utiliza Template y Organisms para una estructura más limpia y mantenible.
 *
 * Esta versión refactorizada reemplaza la página original de 760 líneas
 * con una estructura más modular y fácil de mantener.
 */
'use client';

import React, { useState } from 'react';

import BudgetHeader from '@/components/organisms/BudgetHeader/BudgetHeader';
import BudgetItemModal from '@/components/organisms/BudgetItemModal/BudgetItemModal';
import BudgetStatusPanels from '@/components/organisms/BudgetStatusPanels/BudgetStatusPanels';
import BudgetTable from '@/components/organisms/BudgetTable/BudgetTable';
import BudgetPageTemplate from '@/components/templates/BudgetPageTemplate/BudgetPageTemplate';
import { useMonthlyBudget } from '@/hooks/useMonthlyBudget';
import { getAvailableMonths, formatCurrency } from '@/lib/services/budget';

// Interfaces para tipos de datos
interface ModalState {
  isOpen: boolean;
  mode: 'add' | 'edit';
  categoriaId: string;
  item?: {
    id: string;
    descripcion: string;
    fecha: string;
    clasificacion: string;
    control: string;
    presupuestado: number;
    real: number;
  };
}

interface FormData {
  descripcion: string;
  fecha: string;
  clasificacion: 'Fijo' | 'Variable' | 'Discrecional';
  control: 'Necesario' | 'Discrecional';
  presupuestado: number;
  real: number;
}

export default function PresupuestoPage() {
  // Hook personalizado para manejar presupuesto mensual
  const {
    budgetData,
    categories,
    isLoading,
    error,
    selectedMonth,
    setSelectedMonth,
    refreshBudget,
    toggleCategory,
    addBudgetItem,
    editBudgetItem,
    initializeMonth,
  } = useMonthlyBudget('2025-07');

  // Estado del modal
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'add',
    categoriaId: '',
    item: undefined,
  });

  // Estado del formulario
  const [formData, setFormData] = useState<FormData>({
    descripcion: '',
    fecha: '',
    clasificacion: 'Fijo',
    control: 'Necesario',
    presupuestado: 0,
    real: 0,
  });

  // Funciones del modal
  const handleMonthChange = async (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (!categories.length && !isLoading) {
      // TODO: Reemplazar con modal de confirmación personalizado
      const shouldCreate = true; // confirm(`No hay datos para ${getAvailableMonths().find(m => m.value === newMonth)?.label}. ¿Deseas crear un presupuesto para este mes?`);
      console.warn('Creando presupuesto para mes:', newMonth);

      if (shouldCreate) {
        await initializeMonth(newMonth);
      }
    }
  };

  const openAddModal = (categoriaId: string) => {
    setModalState({
      isOpen: true,
      mode: 'add',
      categoriaId,
      item: undefined,
    });
    setFormData({
      descripcion: '',
      fecha: '',
      clasificacion: 'Fijo',
      control: 'Necesario',
      presupuestado: 0,
      real: 0,
    });
  };

  const openEditModal = (
    categoriaId: string,
    item: {
      id: string;
      descripcion: string;
      fecha: string;
      clasificacion: string;
      control: string;
      presupuestado: number;
      real: number;
    },
  ) => {
    setModalState({
      isOpen: true,
      mode: 'edit',
      categoriaId,
      item,
    });
    setFormData({
      descripcion: item.descripcion,
      fecha: item.fecha,
      clasificacion: item.clasificacion as 'Fijo' | 'Variable' | 'Discrecional',
      control: item.control as 'Necesario' | 'Discrecional',
      presupuestado: item.presupuestado,
      real: item.real,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      mode: 'add',
      categoriaId: '',
      item: undefined,
    });
  };

  const handleSave = async () => {
    if (modalState.mode === 'add') {
      await addBudgetItem(modalState.categoriaId, formData);
    } else if (modalState.item) {
      await editBudgetItem(modalState.item.id, formData);
    }
    closeModal();
  };

  // Funciones utilitarias
  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      case 'Fijo':
        return 'bg-blue-900/30 text-blue-300';
      case 'Variable':
        return 'bg-purple-900/30 text-purple-300';
      case 'Discrecional':
        return 'bg-pink-900/30 text-pink-300';
      default:
        return 'bg-gray-900/30 text-gray-300';
    }
  };

  const getControlColor = (control: string) => {
    switch (control) {
      case 'Necesario':
        return 'bg-emerald-900/30 text-emerald-300';
      case 'Discrecional':
        return 'bg-amber-900/30 text-amber-300';
      default:
        return 'bg-gray-900/30 text-gray-300';
    }
  };

  // Obtener opciones de mes y etiqueta
  const monthOptions = getAvailableMonths();
  const selectedMonthLabel =
    monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <BudgetPageTemplate
      header={
        <BudgetHeader
          selectedMonth={selectedMonth}
          onMonthChange={handleMonthChange}
          onRefresh={refreshBudget}
          isLoading={isLoading}
          monthOptions={monthOptions}
        />
      }
      statusPanels={
        <BudgetStatusPanels
          isLoading={isLoading}
          error={error}
          hasData={categories.length > 0}
          selectedMonth={selectedMonth}
          selectedMonthLabel={selectedMonthLabel}
          onCreateBudget={initializeMonth}
        />
      }
      budgetTable={
        !isLoading && categories.length > 0 ? (
          <BudgetTable
            categories={categories}
            budgetData={budgetData}
            onToggleCategory={toggleCategory}
            onAddItem={openAddModal}
            onEditItem={openEditModal}
            formatCurrency={formatCurrency}
            getClasificacionColor={getClasificacionColor}
            getControlColor={getControlColor}
          />
        ) : undefined
      }
      modal={
        <BudgetItemModal
          isOpen={modalState.isOpen}
          mode={modalState.mode}
          formData={formData}
          onFormDataChange={setFormData}
          onSave={handleSave}
          onClose={closeModal}
        />
      }
    />
  );
}
