/**
 * BudgetCategoryRow - Molecule Level
 *
 * Fila de categoría en la tabla de presupuesto que incluye:
 * - Nombre de la categoría con icono de expansión
 * - Totales de presupuestado y real
 * - Botón para agregar nuevos items
 *
 * @param category - Datos de la categoría
 * @param onToggle - Función para expandir/contraer la categoría
 * @param onAddItem - Función para agregar un item a la categoría
 * @param formatCurrency - Función para formatear moneda
 *
 * @example
 * <BudgetCategoryRow
 *   category={categoryData}
 *   onToggle={() => toggleCategory(category.id)}
 *   onAddItem={() => openAddModal(category.id)}
 *   formatCurrency={formatCurrency}
 * />
 */

import React, { useEffect, useRef, useState } from 'react';

import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface BudgetCategory {
  id: string;
  nombre: string;
  expanded: boolean;
  totalPresupuestado: number;
  totalReal: number;
}

interface BudgetCategoryRowProps {
  category: BudgetCategory;
  onToggle: (categoryId: string) => void;
  onAddItem: (categoryId: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onRenameCategory?: (categoryId: string, newName: string) => Promise<void>;
  formatCurrency: (amount: number) => string;
}

export default function BudgetCategoryRow({
  category,
  onToggle,
  onAddItem,
  onDeleteCategory,
  onRenameCategory,
  formatCurrency,
}: BudgetCategoryRowProps) {
  const canRename = !!onRenameCategory;
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(category.nombre);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Enfocar y seleccionar el texto al entrar en modo edición
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const startEditing = (e: React.MouseEvent) => {
    if (!canRename) return;
    e.stopPropagation(); // no expandir/contraer al editar
    setDraftName(category.nombre);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftName(category.nombre);
    setIsEditing(false);
  };

  const commitEditing = async () => {
    if (isSaving) return;
    const trimmed = draftName.trim();
    // Sin cambios o vacío: cancelar sin guardar
    if (!trimmed || trimmed === category.nombre) {
      cancelEditing();
      return;
    }
    setIsSaving(true);
    try {
      await onRenameCategory?.(category.id, trimmed);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEditing();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  const handleRowClick = () => {
    if (isEditing) return; // no togglear mientras se edita
    onToggle(category.id);
  };

  const handleAddClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    onAddItem(category.id);
  };

  const handleDeleteClick = (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.stopPropagation();
    onDeleteCategory(category.id);
  };

  const cellBase =
    'px-4 py-4 bg-white/5 backdrop-blur-sm border-y border-white/10';

  return (
    <tr className="cursor-pointer transition-all" onClick={handleRowClick}>
      {/* Nombre de la categoría con icono de expansión */}
      <td className={`${cellBase} border-l rounded-l-xl`}>
        <div className="flex items-center font-semibold text-white">
          {category.expanded ? (
            <ChevronDown className="w-4 h-4 mr-2 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-2 flex-shrink-0" />
          )}
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={draftName}
              maxLength={50}
              disabled={isSaving}
              onClick={e => e.stopPropagation()}
              onChange={e => setDraftName(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onBlur={() => void commitEditing()}
              className="bg-slate-800 border border-blue-400/60 rounded px-2 py-1 text-white font-semibold outline-none focus:ring-2 focus:ring-blue-400/40 min-w-[160px]"
            />
          ) : (
            <span
              onDoubleClick={startEditing}
              title={canRename ? 'Doble clic para editar el nombre' : undefined}
              className={
                canRename
                  ? 'cursor-text rounded px-1 hover:bg-white/10'
                  : undefined
              }
            >
              {category.nombre}
            </span>
          )}
        </div>
      </td>

      {/* Fecha - vacía para categorías */}
      <td className={cellBase}></td>

      {/* Clasificación - vacía para categorías */}
      <td className={cellBase}></td>

      {/* Control - vacío para categorías */}
      <td className={cellBase}></td>

      {/* Total presupuestado */}
      <td className={`${cellBase} font-semibold text-blue-300`}>
        {formatCurrency(category.totalPresupuestado)}
      </td>

      {/* Total real */}
      <td className={`${cellBase} font-semibold text-emerald-300`}>
        {formatCurrency(category.totalReal)}
      </td>

      {/* Botones de acción */}
      <td className={`${cellBase} border-r rounded-r-xl`}>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleAddClick}
            className="flex items-center gap-1"
            title="Agregar item"
          >
            <Plus className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDeleteClick}
            className="text-red-400 hover:text-red-300"
            title="Eliminar categoría"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
