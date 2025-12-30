/**
 * BudgetItemModal - Organism Level
 *
 * Modal para agregar o editar items de presupuesto.
 * Incluye formulario completo con validación y manejo de estado.
 *
 * @param isOpen - Si el modal está abierto
 * @param mode - Modo del modal ('add' o 'edit')
 * @param formData - Datos del formulario
 * @param onFormDataChange - Función para actualizar los datos del formulario
 * @param onSave - Función para guardar los cambios
 * @param onClose - Función para cerrar el modal
 *
 * @example
 * <BudgetItemModal
 *   isOpen={modalState.isOpen}
 *   mode={modalState.mode}
 *   formData={formData}
 *   onFormDataChange={setFormData}
 *   onSave={handleSave}
 *   onClose={closeModal}
 * />
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import BudgetFormFields from '@/components/molecules/BudgetFormFields/BudgetFormFields';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormData {
  descripcion: string;
  fecha: string;
  clasificacion: 'Fijo' | 'Variable' | 'Discrecional';
  control: 'Necesario' | 'Discrecional';
  presupuestado: number;
  real: number;
}

interface BudgetItemModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: FormData;
  onFormDataChange: (data: FormData | ((prev: FormData) => FormData)) => void;
  onSave: (saveAndNext?: boolean) => void;
  onClose: () => void;
  onDelete?: () => void;
  chainedEditing?: boolean;
  currentItemIndex?: number;
  totalItemsInCategory?: number;
}

export default function BudgetItemModal({
  isOpen,
  mode,
  formData,
  onFormDataChange,
  onSave,
  onClose,
  onDelete,
  chainedEditing = false,
  currentItemIndex = 0,
  totalItemsInCategory = 0,
}: BudgetItemModalProps) {
  // Manejar atajos de teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      onSave(mode === 'edit'); // En modo edit, auto-avanza al siguiente
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md bg-slate-800 border-slate-700"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'add' ? 'Agregar Detalle' : 'Editar Detalle'}
            {chainedEditing && mode === 'edit' && (
              <span className="text-sm text-gray-400 ml-2">
                ({currentItemIndex + 1} de {totalItemsInCategory})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Campos del formulario */}
          <BudgetFormFields
            formData={formData}
            onFormDataChange={onFormDataChange}
          />

          {/* Botones de acción */}
          <div className="flex justify-between pt-4">
            {/* Botón de eliminar (solo en modo edit) */}
            <div>
              {mode === 'edit' && onDelete && (
                <Button
                  variant="outline"
                  onClick={onDelete}
                  className="border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                >
                  Eliminar
                </Button>
              )}
            </div>

            {/* Botones de cancelar y guardar */}
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>

              {/* Botón de guardar (con auto-avance en modo edit) */}
              <Button
                variant="gradient"
                onClick={() => onSave(mode === 'edit')}
              >
                {mode === 'add' ? 'Agregar' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
