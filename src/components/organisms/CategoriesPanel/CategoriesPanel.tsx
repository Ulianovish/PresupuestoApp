'use client';

/**
 * CategoriesPanel - Organism Level
 *
 * Administra las categorías del presupuesto (MERCADO, TRANSPORTE, ALICE...):
 * listar, crear, renombrar y eliminar.
 *
 * Renombrar es seguro para el presupuesto: los ítems apuntan a la categoría
 * por id. Pero los gastos guardan el NOMBRE de la categoría, así que al
 * renombrar se avisa cuántos gastos quedan con el nombre viejo.
 *
 * Eliminar es un borrado suave: la categoría desaparece de los selectores y
 * del presupuesto, y su historial de gastos se mantiene.
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import { useMonth } from '@/contexts/MonthContext';
import {
  createCategory,
  createDefaultBudgetItemForCategory,
  deleteCategory,
  listCategoriesWithUsage,
  updateCategory,
  type CategoryWithUsage,
} from '@/lib/actions/categories';

export default function CategoriesPanel() {
  const { selectedMonth } = useMonth();
  const [categorias, setCategorias] = useState<CategoryWithUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Creación
  const [newName, setNewName] = useState('');

  // Confirmación de eliminación
  const [confirm, setConfirm] = useState<CategoryWithUsage | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setCategorias(await listCategoriesWithUsage());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!newName.trim() || isSaving) return;
    setIsSaving(true);
    try {
      const nombre = newName.trim();
      const result = await createCategory({ name: nombre });
      if (result.success) {
        // Una categoría sin ítems no sirve para clasificar gastos: el panel de
        // sin clasificar y el clasificador trabajan a nivel de ítem. Se crea
        // uno con el mismo nombre, igual que al crearla desde Presupuesto.
        const createdId = (result.data as { id?: string } | undefined)?.id;
        if (createdId && selectedMonth) {
          await createDefaultBudgetItemForCategory(
            createdId,
            nombre,
            selectedMonth,
          );
        }
        toast.success('Categoría creada');
        setNewName('');
        await load();
      } else {
        toast.error(result.error || 'No se pudo crear la categoría');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (c: CategoryWithUsage) => {
    setEditingId(c.id);
    setEditName(c.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim() || isSaving) return;
    const anterior = categorias.find(c => c.id === editingId);
    setIsSaving(true);
    try {
      const result = await updateCategory({
        id: editingId,
        name: editName.trim(),
      });
      if (result.success) {
        // Los gastos guardan el nombre, no el id: si la categoría tenía
        // gastos, quedan con el nombre anterior y hay que decirlo.
        if (anterior && anterior.gastos > 0) {
          toast.success(
            `Categoría renombrada. Ojo: ${anterior.gastos} gastos siguen registrados como "${anterior.name}".`,
          );
        } else {
          toast.success('Categoría renombrada');
        }
        setEditingId(null);
        await load();
      } else {
        toast.error(result.error || 'No se pudo renombrar la categoría');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    const result = await deleteCategory(target.id);
    if (result.success) {
      toast.success('Categoría eliminada');
      await load();
    } else {
      toast.error(result.error || 'No se pudo eliminar la categoría');
    }
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">
        Categorías del presupuesto
      </h3>
      <p className="mb-4 text-sm text-slate-400">
        Los capítulos del presupuesto. Eliminar una categoría la quita del
        presupuesto y de los selectores; los gastos ya registrados conservan su
        historial.
      </p>

      {/* Crear categoría */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="Nombre de la categoría"
          className="min-w-[180px] flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
        />
        <Button
          size="sm"
          variant="gradient"
          onClick={handleCreate}
          disabled={isSaving || !newName.trim()}
          className="flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Agregar
        </Button>
      </div>

      {/* Listado */}
      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando categorías...</p>
      ) : categorias.length === 0 ? (
        <p className="text-sm text-slate-400">
          Aún no tienes categorías. Crea la primera arriba.
        </p>
      ) : (
        <ul className="space-y-2">
          {categorias.map(c => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2"
            >
              {editingId === c.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        setEditingId(null);
                      }
                    }}
                    autoFocus
                    className="min-w-[160px] flex-1 rounded border border-blue-500 bg-slate-700 px-2 py-1 text-sm text-white outline-none"
                  />
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    title="Guardar"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    title="Cancelar"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="min-w-[140px] flex-1 text-sm text-white">
                    {c.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {c.items} {c.items === 1 ? 'ítem' : 'ítems'} · {c.gastos}{' '}
                    {c.gastos === 1 ? 'gasto' : 'gastos'}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(c)}
                    title="Renombrar"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm(c)}
                    className="text-red-400 hover:text-red-300"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message={
          confirm
            ? `¿Eliminar "${confirm.name}"? Dejará de aparecer en el presupuesto y en los selectores. Arrastra ${confirm.items} ${confirm.items === 1 ? 'ítem' : 'ítems'} de presupuesto y ${confirm.gastos} ${confirm.gastos === 1 ? 'gasto' : 'gastos'} ya registrados, que conservan su historial.`
            : ''
        }
      />
    </section>
  );
}
