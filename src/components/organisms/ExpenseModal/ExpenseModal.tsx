/**
 * ExpenseModal - Organism Level
 *
 * Modal para agregar o editar gastos.
 * Incluye formulario completo con validación y manejo de estado.
 *
 * @param isOpen - Si el modal está abierto
 * @param isEditing - Si estamos editando (vs. agregando)
 * @param formData - Datos del formulario
 * @param expenseCategories - Lista de categorías disponibles
 * @param accountTypes - Lista de tipos de cuenta disponibles
 * @param onFormChange - Función para manejar cambios en el formulario
 * @param onSubmit - Función para enviar el formulario
 * @param onClose - Función para cerrar el modal
 *
 * @example
 * <ExpenseModal
 *   isOpen={isModalOpen}
 *   isEditing={isEditing}
 *   formData={form}
 *   expenseCategories={EXPENSE_CATEGORIES}
 *   accountTypes={ACCOUNT_TYPES}
 *   onFormChange={handleFormChange}
 *   onSubmit={handleSubmitExpense}
 *   onClose={handleCloseModal}
 * />
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import ExpenseFormFields from '@/components/molecules/ExpenseFormFields/ExpenseFormFields';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: FormData;
  expenseCategories: string[];
  accountTypes: string[];
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function ExpenseModal({
  isOpen,
  isEditing,
  formData,
  expenseCategories,
  accountTypes,
  onFormChange,
  onSubmit,
  onClose,
}: ExpenseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditing ? 'Editar Gasto' : 'Agregar Nuevo Gasto'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditing
              ? 'Modifica los datos del gasto seleccionado.'
              : 'Completa la información del nuevo gasto.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="py-4">
          {/* Campos del formulario */}
          <ExpenseFormFields
            formData={formData}
            expenseCategories={expenseCategories}
            accountTypes={accountTypes}
            onFormChange={onFormChange}
          />

          {/* Botones de acción */}
          <div className="flex justify-end space-x-2 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-slate-600 text-slate-300"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="gradient">
              {isEditing ? 'Actualizar' : 'Agregar'} Gasto
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
