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

import Toast from '@/components/atoms/Toast/Toast';
import BudgetHeader from '@/components/organisms/BudgetHeader/BudgetHeader';
import BudgetItemModal from '@/components/organisms/BudgetItemModal/BudgetItemModal';
import BudgetStatusPanels from '@/components/organisms/BudgetStatusPanels/BudgetStatusPanels';
import BudgetTable from '@/components/organisms/BudgetTable/BudgetTable';
import BudgetPageTemplate from '@/components/templates/BudgetPageTemplate/BudgetPageTemplate';
import { useMonth } from '@/contexts/MonthContext';
import { useMonthlyBudget } from '@/hooks/useMonthlyBudget';
import { formatCurrency } from '@/lib/services/budget';

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
  // Nuevos campos para edición encadenada
  chainedEditing?: boolean;
  currentItemIndex?: number;
  totalItemsInCategory?: number;
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
  // Usar contexto global para el mes seleccionado (única fuente de verdad)
  const { selectedMonth, setSelectedMonth, getAvailableMonths } = useMonth();

  // Hook personalizado para manejar presupuesto mensual
  // Ahora recibe el mes del contexto y se sincroniza automáticamente
  const {
    budgetData,
    categories,
    isLoading,
    error,
    refreshBudget,
    refreshCategories,
    toggleCategory,
    addBudgetItem,
    editBudgetItem,
    deleteBudgetItem,
    initializeMonth,
  } = useMonthlyBudget(selectedMonth);

  // Estado del modal
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    mode: 'add',
    categoriaId: '',
    item: undefined,
    chainedEditing: false,
    currentItemIndex: 0,
    totalItemsInCategory: 0,
  });

  // Estado para toast notifications
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error';
  }>({
    show: false,
    message: '',
    type: 'success',
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
    chainedEditing: boolean = false,
  ) => {
    // Encontrar la categoría y el índice del item
    const category = categories.find(cat => cat.id === categoriaId);
    const itemIndex = category?.items.findIndex(i => i.id === item.id) ?? 0;
    const totalItems = category?.items.length ?? 0;

    setModalState({
      isOpen: true,
      mode: 'edit',
      categoriaId,
      item,
      chainedEditing,
      currentItemIndex: itemIndex,
      totalItemsInCategory: totalItems,
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
      chainedEditing: false,
      currentItemIndex: 0,
      totalItemsInCategory: 0,
    });
  };

  // Función para mostrar toast
  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  // Función para abrir el siguiente item en edición encadenada
  const openNextItemForEdit = (
    currentCategoryId: string,
    currentItemIndex: number,
  ) => {
    const category = categories.find(cat => cat.id === currentCategoryId);
    if (!category) return false;

    const nextIndex = currentItemIndex + 1;
    if (nextIndex < category.items.length) {
      const nextItem = category.items[nextIndex];
      // Pequeño delay para permitir que se complete la actualización del estado
      setTimeout(() => {
        openEditModal(currentCategoryId, nextItem, true);
      }, 100);
      return true;
    }
    return false;
  };

  const handleSave = async (saveAndNext: boolean = false) => {
    try {
      if (modalState.mode === 'add') {
        const success = await addBudgetItem(modalState.categoriaId, formData);
        if (success) {
          showToast('Item agregado exitosamente');
          closeModal();
        } else {
          showToast('Error al agregar el item', 'error');
        }
      } else if (modalState.item) {
        const success = await editBudgetItem(modalState.item.id, formData);
        if (success) {
          // Asegurar que la categoría del item editado permanezca expandida
          const editedItemCategory = categories.find(cat =>
            cat.items.some(item => item.id === modalState.item?.id),
          );
          if (editedItemCategory && !editedItemCategory.expanded) {
            toggleCategory(editedItemCategory.id);
          }

          showToast('Item guardado exitosamente');

          // Si se solicita guardar y pasar al siguiente, o si está en modo de edición encadenada
          if (saveAndNext || modalState.chainedEditing) {
            const hasNext = openNextItemForEdit(
              modalState.categoriaId,
              modalState.currentItemIndex ?? 0,
            );

            if (!hasNext) {
              // Si no hay siguiente item, cerrar modal y mostrar mensaje
              closeModal();
              showToast('Edición completada - último item de la categoría');
            }
          } else {
            closeModal();
          }
        } else {
          showToast('Error al guardar el item', 'error');
        }
      }
    } catch (error) {
      console.error('Error en handleSave:', error);
      showToast('Error inesperado al guardar', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalState.item) {
      const success = await deleteBudgetItem(modalState.item.id);
      if (success) {
        closeModal();
      }
    }
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
    <>
      <BudgetPageTemplate
        header={
          <BudgetHeader
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            onRefresh={refreshBudget}
            isLoading={isLoading}
            monthOptions={monthOptions}
            onCategoryCreated={async () => {
              await refreshCategories();
              await refreshBudget();
            }}
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
            onDelete={handleDelete}
            chainedEditing={modalState.chainedEditing}
            currentItemIndex={modalState.currentItemIndex}
            totalItemsInCategory={modalState.totalItemsInCategory}
          />
        }
      />

      {/* Toast notifications */}
      <Toast
        show={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </>
  );
}
