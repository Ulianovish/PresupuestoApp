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

import React from 'react';

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
  formatCurrency: (amount: number) => string;
}

export default function BudgetCategoryRow({
  category,
  onToggle,
  onAddItem,
  onDeleteCategory,
  formatCurrency,
}: BudgetCategoryRowProps) {
  const handleRowClick = () => {
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
          {category.nombre}
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
