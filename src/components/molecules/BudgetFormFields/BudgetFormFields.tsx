/**
 * BudgetFormFields - Molecule Level
 *
 * Campos del formulario para agregar/editar items de presupuesto.
 * Incluye todos los campos necesarios: descripción, fecha, clasificación, control, presupuestado, real.
 *
 * @param formData - Datos del formulario
 * @param onFormDataChange - Función para actualizar los datos del formulario
 *
 * @example
 * <BudgetFormFields
 *   formData={formData}
 *   onFormDataChange={setFormData}
 * />
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormData {
  descripcion: string;
  fecha: string;
  clasificacion: 'Fijo' | 'Variable' | 'Discrecional';
  control: 'Necesario' | 'Discrecional';
  presupuestado: number;
  real: number;
}

interface BudgetFormFieldsProps {
  formData: FormData;
  onFormDataChange: (data: FormData | ((prev: FormData) => FormData)) => void;
}

export default function BudgetFormFields({
  formData,
  onFormDataChange,
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

      {/* Campo clasificación */}
      <div className="space-y-2">
        <Label className="text-white">Clasificación</Label>
        <div className="flex gap-4">
          {['Fijo', 'Variable', 'Discrecional'].map(tipo => (
            <label key={tipo} className="flex items-center space-x-2">
              <input
                type="radio"
                name="clasificacion"
                value={tipo}
                checked={formData.clasificacion === tipo}
                onChange={e =>
                  onFormDataChange(prev => ({
                    ...prev,
                    clasificacion: e.target.value as
                      | 'Fijo'
                      | 'Variable'
                      | 'Discrecional',
                  }))
                }
                className="text-blue-500"
              />
              <span className="text-white text-sm">{tipo}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Campo control */}
      <div className="space-y-2">
        <Label className="text-white">Control</Label>
        <div className="flex gap-4">
          {['Necesario', 'Discrecional'].map(tipo => (
            <label key={tipo} className="flex items-center space-x-2">
              <input
                type="radio"
                name="control"
                value={tipo}
                checked={formData.control === tipo}
                onChange={e =>
                  onFormDataChange(prev => ({
                    ...prev,
                    control: e.target.value as 'Necesario' | 'Discrecional',
                  }))
                }
                className="text-blue-500"
              />
              <span className="text-white text-sm">{tipo}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Campo presupuestado */}
      <div className="space-y-2">
        <Label htmlFor="presupuestado" className="text-white">
          Presupuestado
        </Label>
        <Input
          id="presupuestado"
          type="number"
          value={formData.presupuestado}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              presupuestado: Number(e.target.value),
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="0"
        />
      </div>

      {/* Campo real */}
      <div className="space-y-2">
        <Label htmlFor="real" className="text-white">
          Real
        </Label>
        <Input
          id="real"
          type="number"
          value={formData.real}
          onChange={e =>
            onFormDataChange(prev => ({
              ...prev,
              real: Number(e.target.value),
            }))
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="0"
        />
      </div>
    </div>
  );
}
