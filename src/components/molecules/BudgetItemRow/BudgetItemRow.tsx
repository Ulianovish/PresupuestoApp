/**
 * BudgetItemRow - Molecule Level
 *
 * Fila de item individual en la tabla de presupuesto que incluye:
 * - Descripción del item
 * - Fecha, clasificación y control
 * - Valores presupuestado y real
 * - Botón para editar
 *
 * @param item - Datos del item
 * @param categoryId - ID de la categoría padre
 * @param onEdit - Función para editar el item
 * @param formatCurrency - Función para formatear moneda
 * @param getClasificacionColor - Función para obtener color de clasificación
 * @param getControlColor - Función para obtener color de control
 *
 * @example
 * <BudgetItemRow
 *   item={itemData}
 *   categoryId="categoria1"
 *   onEdit={handleEditItem}
 *   formatCurrency={formatCurrency}
 *   getClasificacionColor={getClasificacionColor}
 *   getControlColor={getControlColor}
 * />
 */

import React from 'react';

import { Edit } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface BudgetItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
}

interface BudgetItemRowProps {
  item: BudgetItem;
  categoryId: string;
  onEdit: (categoryId: string, item: BudgetItem) => void;
  formatCurrency: (amount: number) => string;
  getClasificacionColor: (clasificacion: string) => string;
  getControlColor: (control: string) => string;
}

export default function BudgetItemRow({
  item,
  categoryId,
  onEdit,
  formatCurrency,
  getClasificacionColor,
  getControlColor,
}: BudgetItemRowProps) {
  const handleEditClick = () => {
    onEdit(categoryId, item);
  };

  return (
    <tr className="hover:bg-white/5 transition-colors bg-slate-900/30">
      {/* Descripción del item */}
      <td className="px-4 py-3 pl-12 text-gray-200">{item.descripcion}</td>

      {/* Fecha */}
      <td className="px-4 py-3 text-gray-300">{item.fecha}</td>

      {/* Clasificación con color */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClasificacionColor(
            item.clasificacion
          )}`}
        >
          {item.clasificacion}
        </span>
      </td>

      {/* Control con color */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getControlColor(
            item.control
          )}`}
        >
          {item.control}
        </span>
      </td>

      {/* Valor presupuestado */}
      <td className="px-4 py-3 text-blue-300">
        {formatCurrency(item.presupuestado)}
      </td>

      {/* Valor real */}
      <td className="px-4 py-3 text-emerald-300">
        {item.real > 0 ? formatCurrency(item.real) : '—'}
      </td>

      {/* Botón de editar */}
      <td className="px-4 py-3">
        <Button
          size="sm"
          variant="ghost"
          onClick={handleEditClick}
          className="flex items-center gap-1"
        >
          <Edit className="w-3 h-3" />
          Editar
        </Button>
      </td>
    </tr>
  );
}
