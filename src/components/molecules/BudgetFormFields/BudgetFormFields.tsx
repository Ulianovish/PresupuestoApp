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
}

export default function BudgetFormFields({
  formData,
  onFormDataChange,
  classifications = [],
  controls = [],
  deudas,
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

      {/* Campo fecha */}
      <div className="space-y-2">
        <Label htmlFor="fecha" className="text-white">
          Fecha
        </Label>
        <Input
          id="fecha"
          value={formData.fecha}
          onChange={e =>
            onFormDataChange(prev => ({ ...prev, fecha: e.target.value }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="Ej: 5/mes, 15/mes"
        />
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
