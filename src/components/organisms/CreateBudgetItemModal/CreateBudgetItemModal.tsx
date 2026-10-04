'use client';

import React, { useEffect, useState } from 'react';

import Button from '@/components/atoms/Button/Button';
import ItemNameAutocomplete from '@/components/molecules/ItemNameAutocomplete/ItemNameAutocomplete';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getItemNameSuggestions } from '@/lib/services/budget';

interface CategoryRef {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryRef[];
  /** Categoría preseleccionada (p.ej. la del gasto). */
  defaultCategoryId?: string;
  /** Nombre sugerido (p.ej. la descripción del gasto). */
  defaultName?: string;
  /** Crea el ítem y (en el padre) lo asigna al gasto en curso. */
  onCreate: (categoryId: string, name: string) => Promise<void>;
}

export default function CreateBudgetItemModal({
  isOpen,
  onClose,
  categories,
  defaultCategoryId,
  defaultName,
  onCreate,
}: Props) {
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  // Los nombres ya usados en otros meses, para no inventar uno nuevo cuando ya
  // existe (es así como acaban conviviendo "Embutidos" y "Embutido").
  useEffect(() => {
    if (!isOpen || sugerencias.length > 0) return;
    let vigente = true;
    void getItemNameSuggestions().then(nombres => {
      if (vigente) setSugerencias(nombres);
    });
    return () => {
      vigente = false;
    };
  }, [isOpen, sugerencias.length]);

  // Reiniciar los campos con los valores por defecto cada vez que se abre
  useEffect(() => {
    if (isOpen) {
      setCategoryId(defaultCategoryId || categories[0]?.id || '');
      setName(defaultName || '');
    }
  }, [isOpen, defaultCategoryId, defaultName, categories]);

  const handleCreate = async () => {
    if (!categoryId || !name.trim() || isCreating) return;
    setIsCreating(true);
    try {
      await onCreate(categoryId, name.trim());
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            Crear ítem de presupuesto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-white">Categoría</Label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nuevo-item" className="text-white">
              Nombre del ítem
            </Label>
            <ItemNameAutocomplete
              id="nuevo-item"
              value={name}
              onChange={setName}
              suggestions={sugerencias}
              onEnter={() => void handleCreate()}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isCreating}>
              Cancelar
            </Button>
            <Button
              variant="gradient"
              onClick={handleCreate}
              disabled={isCreating || !name.trim() || !categoryId}
            >
              {isCreating ? 'Creando...' : 'Crear y asignar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
