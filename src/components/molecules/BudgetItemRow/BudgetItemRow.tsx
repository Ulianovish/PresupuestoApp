/**
 * BudgetItemRow - Molecule Level
 *
 * Fila de item individual en la tabla de presupuesto que incluye:
 * - Descripción del item
 * - Fecha, clasificación y control
 * - Valores presupuestado y real
 * - Botón para editar
 *
 * Clasificación y Control son editables inline con dropdowns.
 */

import React, { useState, useRef, useEffect } from 'react';

import { Edit, Trash2 } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface BudgetItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
  deuda_id?: string | null;
}

interface LookupItem {
  id: string;
  name: string;
}

interface BudgetItemRowProps {
  item: BudgetItem;
  categoryId: string;
  onEdit: (categoryId: string, item: BudgetItem) => void;
  onDelete?: (itemId: string) => void;
  onInlineUpdate?: (
    itemId: string,
    updates: Partial<{ clasificacion: string; control: string }>,
  ) => Promise<void>;
  classifications?: LookupItem[];
  controls?: LookupItem[];
  formatCurrency: (amount: number) => string;
  getClasificacionColor: (clasificacion: string) => string;
  getControlColor: (control: string) => string;
}

function InlineDropdown({
  value,
  options,
  getColor,
  onSelect,
}: {
  value: string;
  options: LookupItem[];
  getColor: (v: string) => string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-opacity hover:opacity-80 ${getColor(value)}`}
      >
        {value}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 min-w-[140px] bg-slate-800 border border-white/20 rounded-lg shadow-xl overflow-hidden">
          {options.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (opt.name !== value) onSelect(opt.name);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                opt.name === value
                  ? 'bg-white/10 font-semibold'
                  : 'hover:bg-white/5'
              }`}
            >
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full ${getColor(opt.name)}`}
              >
                {opt.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BudgetItemRow({
  item,
  categoryId,
  onEdit,
  onDelete,
  onInlineUpdate,
  classifications,
  controls,
  formatCurrency,
  getClasificacionColor,
  getControlColor,
}: BudgetItemRowProps) {
  const handleEditClick = () => {
    onEdit(categoryId, item);
  };

  const canInlineEdit = !!onInlineUpdate;

  return (
    <tr className="hover:bg-white/5 transition-colors bg-slate-900/30">
      {/* Descripción del item */}
      <td className="px-4 py-3 pl-12 text-gray-200">{item.descripcion}</td>

      {/* Fecha */}
      <td className="px-4 py-3 text-gray-300">{item.fecha}</td>

      {/* Clasificación con color - editable inline */}
      <td className="px-4 py-3">
        {canInlineEdit && classifications && classifications.length > 0 ? (
          <InlineDropdown
            value={item.clasificacion}
            options={classifications}
            getColor={getClasificacionColor}
            onSelect={name => onInlineUpdate(item.id, { clasificacion: name })}
          />
        ) : (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getClasificacionColor(
              item.clasificacion,
            )}`}
          >
            {item.clasificacion}
          </span>
        )}
      </td>

      {/* Control con color - editable inline */}
      <td className="px-4 py-3">
        {canInlineEdit && controls && controls.length > 0 ? (
          <InlineDropdown
            value={item.control}
            options={controls}
            getColor={getControlColor}
            onSelect={name => onInlineUpdate(item.id, { control: name })}
          />
        ) : (
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getControlColor(
              item.control,
            )}`}
          >
            {item.control}
          </span>
        )}
      </td>

      {/* Valor presupuestado */}
      <td className="px-4 py-3 text-blue-300">
        {formatCurrency(item.presupuestado)}
      </td>

      {/* Valor real */}
      <td className="px-4 py-3 text-emerald-300">
        {item.real > 0 ? formatCurrency(item.real) : '—'}
      </td>

      {/* Botones de acción */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEditClick}
            className="flex items-center gap-1"
            title="Editar"
          >
            <Edit className="w-3 h-3" />
          </Button>
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(item.id)}
              className="flex items-center gap-1 text-red-400 hover:text-red-300"
              title="Eliminar"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
