/**
 * PresupuestoPage - Page Level (Refactored)
 *
 * Página de presupuesto mensual refactorizada usando Atomic Design.
 * Utiliza Template y Organisms para una estructura más limpia y mantenible.
 */
'use client';

import React, { useState, useEffect } from 'react';

import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import Toast from '@/components/atoms/Toast/Toast';
import type { BudgetFormData } from '@/components/molecules/BudgetFormFields/BudgetFormFields';
import BudgetHeader from '@/components/organisms/BudgetHeader/BudgetHeader';
import BudgetItemModal from '@/components/organisms/BudgetItemModal/BudgetItemModal';
import BudgetStatusPanels from '@/components/organisms/BudgetStatusPanels/BudgetStatusPanels';
import BudgetTable from '@/components/organisms/BudgetTable/BudgetTable';
import CategoryModal from '@/components/organisms/CategoryModal/CategoryModal';
import BudgetPageTemplate from '@/components/templates/BudgetPageTemplate/BudgetPageTemplate';
import { useMonth } from '@/contexts/MonthContext';
import { useMonthlyBudget } from '@/hooks/useMonthlyBudget';
import { deleteCategory } from '@/lib/actions/categories';
import {
  formatCurrency,
  getClassifications,
  getControls,
} from '@/lib/services/budget';
import { obtenerDeudas, type Deuda } from '@/lib/services/ingresos-deudas';

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
    deuda_id?: string | null;
  };
  chainedEditing?: boolean;
  currentItemIndex?: number;
  totalItemsInCategory?: number;
}

interface LookupItem {
  id: string;
  name: string;
}

export default function PresupuestoPage() {
  const { selectedMonth, setSelectedMonth, getAvailableMonths } = useMonth();

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

  // Lookups dinámicos desde la BD
  const [classifications, setClassifications] = useState<LookupItem[]>([]);
  const [controls, setControls] = useState<LookupItem[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);

  useEffect(() => {
    async function loadLookups() {
      const [cls, ctrls, deudasData] = await Promise.all([
        getClassifications(),
        getControls(),
        obtenerDeudas(),
      ]);
      setClassifications(cls);
      setControls(ctrls);
      setDeudas(deudasData);
    }
    loadLookups();
  }, []);

  // Estado del modal de categoría
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Estado del modal de confirmación de eliminación
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    type: 'item' | 'category';
    id: string;
    name: string;
  }>({ isOpen: false, type: 'item', id: '', name: '' });

  const handleCategoryCreated = async () => {
    await refreshCategories();
    await refreshBudget();
  };

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
  const defaultClasificacion = classifications[0]?.name || 'Basico';
  const defaultControl = controls[0]?.name || 'Reducir';

  const [formData, setFormData] = useState<BudgetFormData>({
    descripcion: '',
    fecha: '',
    clasificacion: defaultClasificacion,
    control: defaultControl,
    presupuestado: 0,
    real: 0,
    deuda_id: null,
  });

  // Funciones del modal
  const handleMonthChange = async (newMonth: string) => {
    setSelectedMonth(newMonth);
    if (!categories.length && !isLoading) {
      const shouldCreate = true;
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
      clasificacion: classifications[0]?.name || 'Basico',
      control: controls[0]?.name || 'Reducir',
      presupuestado: 0,
      real: 0,
      deuda_id: null,
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
      deuda_id?: string | null;
    },
    chainedEditing: boolean = false,
  ) => {
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
      clasificacion: item.clasificacion,
      control: item.control,
      presupuestado: item.presupuestado,
      real: item.real,
      deuda_id: item.deuda_id || null,
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

  const showToast = (
    message: string,
    type: 'success' | 'error' = 'success',
  ) => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  };

  const openNextItemForEdit = (
    currentCategoryId: string,
    currentItemIndex: number,
  ) => {
    const category = categories.find(cat => cat.id === currentCategoryId);
    if (!category) return false;

    const nextIndex = currentItemIndex + 1;
    if (nextIndex < category.items.length) {
      const nextItem = category.items[nextIndex];
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
          const editedItemCategory = categories.find(cat =>
            cat.items.some(item => item.id === modalState.item?.id),
          );
          if (editedItemCategory && !editedItemCategory.expanded) {
            toggleCategory(editedItemCategory.id);
          }

          showToast('Item guardado exitosamente');

          if (saveAndNext) {
            const hasNext = openNextItemForEdit(
              modalState.categoriaId,
              modalState.currentItemIndex ?? 0,
            );

            if (!hasNext) {
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
      setConfirmDelete({
        isOpen: true,
        type: 'item',
        id: modalState.item.id,
        name: modalState.item.descripcion,
      });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    // Buscar nombre del item para el modal de confirmación
    let itemName = '';
    for (const cat of categories) {
      const found = cat.items.find(i => i.id === itemId);
      if (found) {
        itemName = found.descripcion;
        break;
      }
    }
    setConfirmDelete({
      isOpen: true,
      type: 'item',
      id: itemId,
      name: itemName,
    });
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    if (category.items.length > 0) {
      showToast(
        'No puedes eliminar una categoría con items. Elimina los items primero.',
        'error',
      );
      return;
    }

    setConfirmDelete({
      isOpen: true,
      type: 'category',
      id: categoryId,
      name: category.nombre,
    });
  };

  const executeDelete = async () => {
    const { type, id } = confirmDelete;
    setConfirmDelete(prev => ({ ...prev, isOpen: false }));

    if (type === 'item') {
      const success = await deleteBudgetItem(id);
      if (success) {
        showToast('Item eliminado exitosamente');
        // Si estaba abierto el modal de edición, cerrarlo
        if (modalState.isOpen && modalState.item?.id === id) {
          closeModal();
        }
      } else {
        showToast('Error al eliminar el item', 'error');
      }
    } else if (type === 'category') {
      const result = await deleteCategory(id);
      if (result.success) {
        showToast('Categoría eliminada');
        await refreshCategories();
        await refreshBudget();
      } else {
        showToast(result.error || 'Error al eliminar la categoría', 'error');
      }
    }
  };

  const handleInlineUpdate = async (
    itemId: string,
    updates: Partial<{ clasificacion: string; control: string }>,
  ) => {
    try {
      const success = await editBudgetItem(itemId, updates);
      if (!success) {
        showToast('Error al actualizar', 'error');
      }
    } catch {
      showToast('Error al actualizar', 'error');
    }
  };

  const handleCopyPreviousMonth = async () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      const {
        getBudgetByMonth,
        createBudgetItem: createItem,
        createMonthlyBudget,
      } = await import('@/lib/services/budget');

      const prevBudget = await getBudgetByMonth(prevMonth);
      if (
        !prevBudget ||
        prevBudget.categories.every(c => c.items.length === 0)
      ) {
        showToast('No hay datos en el mes anterior para copiar', 'error');
        return;
      }

      let templateId = budgetData?.template_id;
      if (!templateId) {
        templateId = (await createMonthlyBudget(selectedMonth)) || undefined;
        if (!templateId) {
          showToast('Error al crear el presupuesto del mes', 'error');
          return;
        }
      }

      let itemsCopied = 0;
      for (const category of prevBudget.categories) {
        for (const item of category.items) {
          await createItem(templateId, category.id, {
            descripcion: item.descripcion,
            fecha: item.fecha,
            clasificacion: item.clasificacion,
            control: item.control,
            presupuestado: item.presupuestado,
            real: 0,
            deuda_id: item.deuda_id || null,
          });
          itemsCopied++;
        }
      }

      showToast(`Se copiaron ${itemsCopied} items del mes anterior`);
      await refreshBudget();
    } catch (err) {
      console.error('Error copiando mes anterior:', err);
      showToast('Error al copiar el mes anterior', 'error');
    }
  };

  // Funciones utilitarias de color
  const getClasificacionColor = (clasificacion: string) => {
    switch (clasificacion) {
      // Nuevas clasificaciones
      case 'Basico':
        return 'bg-blue-900/30 text-blue-300';
      case 'Calidad de Vida':
        return 'bg-emerald-900/30 text-emerald-300';
      case 'Estilo de Vida':
        return 'bg-purple-900/30 text-purple-300';
      case 'Caprichos':
        return 'bg-pink-900/30 text-pink-300';
      case 'Impuestos':
        return 'bg-amber-900/30 text-amber-300';
      // Legacy
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
      // Nuevos controles
      case 'Eliminar':
        return 'bg-red-900/30 text-red-300';
      case 'Reducir':
        return 'bg-amber-900/30 text-amber-300';
      case 'Simplificar':
        return 'bg-cyan-900/30 text-cyan-300';
      // Legacy
      case 'Necesario':
        return 'bg-emerald-900/30 text-emerald-300';
      case 'Discrecional':
        return 'bg-amber-900/30 text-amber-300';
      default:
        return 'bg-gray-900/30 text-gray-300';
    }
  };

  const monthOptions = getAvailableMonths();
  const selectedMonthLabel =
    monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Preparar deudas para el selector del modal
  const deudasOptions = deudas
    .filter(d => !d.pagada)
    .map(d => ({ id: d.id, descripcion: d.descripcion }));

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
            onCopyPreviousMonth={handleCopyPreviousMonth}
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
              onDeleteCategory={handleDeleteCategory}
              onDeleteItem={handleDeleteItem}
              onAddCategory={() => setShowCategoryModal(true)}
              onInlineUpdate={handleInlineUpdate}
              classifications={classifications}
              controls={controls}
              isLoading={isLoading}
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
            classifications={classifications}
            controls={controls}
            deudas={deudasOptions}
          />
        }
      />

      {/* Modal para crear categoría */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onCategoryCreated={handleCategoryCreated}
      />

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
        onConfirm={executeDelete}
        title={
          confirmDelete.type === 'category'
            ? 'Eliminar categoría'
            : 'Eliminar item'
        }
        message={`¿Estás seguro de que deseas eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
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
