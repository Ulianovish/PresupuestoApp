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
  onSave: () => void;
  onClose: () => void;
}

export default function BudgetItemModal({
  isOpen,
  mode,
  formData,
  onFormDataChange,
  onSave,
  onClose,
}: BudgetItemModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            {mode === 'add' ? 'Agregar Detalle' : 'Editar Detalle'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Campos del formulario */}
          <BudgetFormFields
            formData={formData}
            onFormDataChange={onFormDataChange}
          />

          {/* Botones de acción */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="gradient" onClick={onSave}>
              {mode === 'add' ? 'Agregar' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
