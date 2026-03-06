/**
 * BudgetItemModal - Organism Level
 *
 * Modal para agregar o editar items de presupuesto.
 * Incluye formulario completo con validación y manejo de estado.
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import BudgetFormFields, {
  type BudgetFormData,
} from '@/components/molecules/BudgetFormFields/BudgetFormFields';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface LookupItem {
  id: string;
  name: string;
}

interface DeudaOption {
  id: string;
  descripcion: string;
}

interface BudgetItemModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  formData: BudgetFormData;
  onFormDataChange: (
    data: BudgetFormData | ((prev: BudgetFormData) => BudgetFormData),
  ) => void;
  onSave: (saveAndNext?: boolean) => void;
  onClose: () => void;
  onDelete?: () => void;
  chainedEditing?: boolean;
  currentItemIndex?: number;
  totalItemsInCategory?: number;
  classifications?: LookupItem[];
  controls?: LookupItem[];
  deudas?: DeudaOption[];
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
  classifications,
  controls,
  deudas,
}: BudgetItemModalProps) {
  // Manejar atajos de teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA') return;
      e.preventDefault();
      onSave(false);
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
            classifications={classifications}
            controls={controls}
            deudas={deudas}
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

export type { BudgetFormData };
