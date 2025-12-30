/**
 * CategoryModal - Organism Level
 *
 * Modal para crear nuevas categorías de presupuesto.
 * Combina el formulario CategoryForm con la funcionalidad de modal.
 * Maneja la creación de categorías y la comunicación con el servidor.
 *
 * @param isOpen - Si el modal está abierto
 * @param onClose - Función para cerrar el modal
 * @param onCategoryCreated - Función que se ejecuta cuando se crea una categoría exitosamente
 *
 * @example
 * <CategoryModal
 *   isOpen={showCategoryModal}
 *   onClose={handleCloseModal}
 *   onCategoryCreated={handleCategoryCreated}
 * />
 */
'use client';

import { useState } from 'react';

import { FolderPlus } from 'lucide-react';
import { toast } from 'sonner';

import CategoryForm from '@/components/molecules/CategoryForm/CategoryForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  createCategory,
  type CreateCategoryInput,
} from '@/lib/actions/categories';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated?: () => void;
}

export default function CategoryModal({
  isOpen,
  onClose,
  onCategoryCreated,
}: CategoryModalProps) {
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (data: CreateCategoryInput) => {
    setIsCreating(true);

    try {
      const result = await createCategory(data);

      if (result.success) {
        toast.success('Categoría creada exitosamente', {
          description: `La categoría "${data.name}" ha sido agregada al presupuesto.`,
        });

        // Cerrar modal y notificar al componente padre
        onClose();
        onCategoryCreated?.();
      } else {
        toast.error('Error al crear la categoría', {
          description: result.error || 'Ocurrió un error inesperado.',
        });
      }
    } catch (error) {
      console.error('Error al crear categoría:', error);
      toast.error('Error al crear la categoría', {
        description:
          'Ocurrió un error inesperado. Por favor, intenta nuevamente.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-slate-800/95 backdrop-blur-sm border-slate-700/50 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30">
              <FolderPlus className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-white">
                Nueva Categoría
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-1">
                Crea una nueva categoría para organizar mejor tu presupuesto
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2">
          <CategoryForm
            onSubmit={handleSubmit}
            loading={isCreating}
            onCancel={handleClose}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
