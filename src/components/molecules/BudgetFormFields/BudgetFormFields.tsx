/**
 * BudgetFormFields - Molecule Level
 *
 * Campos del formulario para agregar/editar items de presupuesto.
 * Carga clasificaciones y controles dinámicamente desde la BD.
 */

import React from 'react';

import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface BudgetFormData {
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

interface DeudaOption {
  id: string;
  descripcion: string;
}

interface BudgetFormFieldsProps {
  formData: BudgetFormData;
  onFormDataChange: (
    data: BudgetFormData | ((prev: BudgetFormData) => BudgetFormData),
  ) => void;
  classifications?: LookupItem[];
  controls?: LookupItem[];
  deudas?: DeudaOption[];
  /** Mes seleccionado en formato YYYY-MM, usado para componer la fecha */
  selectedMonth?: string;
}

/** Extrae solo el día (número) de un valor de fecha guardado, p.ej. "05/04/2026" -> "5" */
function extractDay(fecha: string): string {
  const match = fecha?.match(/^\d+/);
  return match ? String(parseInt(match[0], 10)) : '';
}

/**
 * Compone una fecha "DD/MM/AAAA" a partir del día escrito y el mes seleccionado.
 * Toma el mes y el año del mes seleccionado (YYYY-MM) y limita el día al
 * máximo válido de ese mes. Devuelve '' si no hay día válido.
 */
function composeFecha(dayStr: string, monthYear?: string): string {
  const day = parseInt(dayStr, 10);
  if (!dayStr || isNaN(day) || day < 1 || !monthYear) return '';
  const [year, month] = monthYear.split('-').map(Number);
  if (!year || !month) return '';
  const maxDay = new Date(year, month, 0).getDate(); // días del mes
  const clamped = Math.min(day, maxDay);
  const dd = String(clamped).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

export default function BudgetFormFields({
  formData,
  onFormDataChange,
  classifications = [],
  controls = [],
  deudas,
  selectedMonth,
}: BudgetFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Campo descripción */}
      <div className="space-y-2">
        <Label htmlFor="descripcion" className="text-white">
          Descripción
        </Label>
        <Input
          id="descripcion"
          value={formData.descripcion}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              descripcion: e.target.value,
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="Nombre del item"
        />
      </div>

      {/* Campo fecha: solo se escribe el día; el mes y año se toman del mes seleccionado */}
      <div className="space-y-2">
        <Label htmlFor="fecha" className="text-white">
          Día
        </Label>
        <Input
          id="fecha"
          type="number"
          min={1}
          max={31}
          inputMode="numeric"
          value={extractDay(formData.fecha)}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              fecha: composeFecha(e.target.value, selectedMonth),
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="Ej: 5"
        />
        {formData.fecha ? (
          <p className="text-xs text-gray-400">Fecha: {formData.fecha}</p>
        ) : (
          <p className="text-xs text-gray-500">
            Escribe el día y se guardará como DD/MM/AAAA del mes seleccionado.
          </p>
        )}
      </div>

      {/* Campo clasificación - dropdown */}
      <div className="space-y-2">
        <Label className="text-white">Clasificación</Label>
        <select
          value={formData.clasificacion}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              clasificacion: e.target.value,
            }))
          }
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {classifications.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campo control - dropdown */}
      <div className="space-y-2">
        <Label className="text-white">Control</Label>
        <select
          value={formData.control}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              control: e.target.value,
            }))
          }
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {controls.map(c => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Campo presupuestado */}
      <div className="space-y-2">
        <Label htmlFor="presupuestado" className="text-white">
          Presupuestado
        </Label>
        <CurrencyInput
          value={formData.presupuestado}
          onChange={value =>
            onFormDataChange(prev => ({
              ...prev,
              presupuestado: value,
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="$0"
        />
      </div>

      {/* Campo real */}
      <div className="space-y-2">
        <Label htmlFor="real" className="text-white">
          Real
        </Label>
        <CurrencyInput
          value={formData.real}
          onChange={value =>
            onFormDataChange(prev => ({
              ...prev,
              real: value,
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="$0"
        />
      </div>

      {/* Vincular deuda (opcional) */}
      {deudas && deudas.length > 0 && (
        <div className="space-y-2">
          <Label className="text-white">Vincular Deuda (opcional)</Label>
          <select
            value={formData.deuda_id || ''}
            onChange={e =>
              onFormDataChange(prev => ({
                ...prev,
                deuda_id: e.target.value || null,
              }))
            }
            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Sin deuda vinculada</option>
            {deudas.map(d => (
              <option key={d.id} value={d.id}>
                {d.descripcion}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
