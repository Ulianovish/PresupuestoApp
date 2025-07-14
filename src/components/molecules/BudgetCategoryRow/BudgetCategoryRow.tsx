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

import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

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
  formatCurrency: (amount: number) => string;
}

export default function BudgetCategoryRow({
  category,
  onToggle,
  onAddItem,
  formatCurrency,
}: BudgetCategoryRowProps) {
  const handleRowClick = () => {
    onToggle(category.id);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddItem(category.id);
  };

  return (
    <tr
      className="bg-slate-800/50 hover:bg-slate-800/70 cursor-pointer transition-colors"
      onClick={handleRowClick}
    >
      {/* Nombre de la categoría con icono de expansión */}
      <td className="px-4 py-4 font-semibold text-white flex items-center">
        {category.expanded ? (
          <ChevronDown className="w-4 h-4 mr-2" />
        ) : (
          <ChevronRight className="w-4 h-4 mr-2" />
        )}
        {category.nombre}
      </td>

      {/* Fecha - vacía para categorías */}
      <td className="px-4 py-4 text-gray-300">-</td>

      {/* Clasificación - etiqueta de categoría */}
      <td className="px-4 py-4">
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-200">
          Categoría
        </span>
      </td>

      {/* Control - vacío para categorías */}
      <td className="px-4 py-4 text-gray-300">-</td>

      {/* Total presupuestado */}
      <td className="px-4 py-4 font-semibold text-blue-300">
        {formatCurrency(category.totalPresupuestado)}
      </td>

      {/* Total real */}
      <td className="px-4 py-4 font-semibold text-emerald-300">
        {formatCurrency(category.totalReal)}
      </td>

      {/* Botón de agregar */}
      <td className="px-4 py-4">
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddClick}
          className="flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Agregar
        </Button>
      </td>
    </tr>
  );
}
