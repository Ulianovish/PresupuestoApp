/**
 * IngresoRow - Molecule Level Component
 *
 * Componente editable para mostrar y editar una fila de ingreso.
 * Permite edición inline con validación y acciones de eliminación.
 *
 * Características:
 * - Edición inline con toggle entre vista y edición
 * - Validación de datos en tiempo real
 * - Botones de acción (editar, eliminar, guardar, cancelar)
 * - Formateo de moneda automático
 *
 * @param ingreso - Objeto de ingreso a mostrar/editar
 * @param formatCurrency - Función para formatear moneda
 * @param onEdit - Callback cuando se edita un ingreso
 * @param onDelete - Callback cuando se elimina un ingreso
 * @param isLoading - Estado de carga para operaciones async
 *
 * @example
 * <IngresoRow
 *   ingreso={ingresoData}
 *   formatCurrency={formatMoney}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   isLoading={false}
 * />
 */

import React, { useState } from 'react';

import { Edit, Trash2, Save, X } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Input from '@/components/atoms/Input/Input';

// Tipo para ingreso basado en el servicio
interface Ingreso {
  id: string;
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
}

// Tipo para datos de edición
interface IngresoEditData {
  descripcion: string;
  fuente: string;
  monto: string;
  fecha: string;
}

// Tipo para el callback de edición (con number para monto)
interface IngresoEditCallback {
  descripcion?: string;
  fuente?: string;
  monto?: number;
  fecha?: string;
}

interface IngresoRowProps {
  ingreso: Ingreso;
  formatCurrency: (amount: number) => string;
  onEdit: (id: string, datosActualizados: IngresoEditCallback) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function IngresoRow({
  ingreso,
  formatCurrency,
  onEdit,
  onDelete,
  isLoading = false,
}: IngresoRowProps) {
  // Estado para modo de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<IngresoEditData>({
    descripcion: ingreso.descripcion,
    fuente: ingreso.fuente,
    monto: ingreso.monto.toString(),
    fecha: ingreso.fecha,
  });

  // Estado para validación
  const [errors, setErrors] = useState<Partial<IngresoEditData>>({});

  // Función para validar los datos
  const validateData = (): boolean => {
    const newErrors: Partial<IngresoEditData> = {};

    if (!editData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!editData.fuente.trim()) {
      newErrors.fuente = 'La fuente es obligatoria';
    }

    const monto = parseFloat(editData.monto);
    if (isNaN(monto) || monto < 0) {
      newErrors.monto = 'El monto debe ser un número válido mayor o igual a 0';
    }

    if (!editData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Manejar inicio de edición
  const handleEditStart = () => {
    setIsEditing(true);
    setEditData({
      descripcion: ingreso.descripcion,
      fuente: ingreso.fuente,
      monto: ingreso.monto.toString(),
      fecha: ingreso.fecha,
    });
    setErrors({});
  };

  // Manejar cancelación de edición
  const handleEditCancel = () => {
    setIsEditing(false);
    setErrors({});
  };

  // Manejar guardar cambios
  const handleSave = async () => {
    if (!validateData()) {
      return;
    }

    try {
      // Convertir datos para envío (convertir monto de string a number)
      const datosActualizados: IngresoEditCallback = {
        descripcion: editData.descripcion.trim(),
        fuente: editData.fuente.trim(),
        monto: parseFloat(editData.monto),
        fecha: editData.fecha,
      };

      await onEdit(ingreso.id, datosActualizados);
      setIsEditing(false);
      setErrors({});
    } catch (error) {
      console.error('Error al guardar ingreso:', error);
      // El error se maneja en el hook padre
    }
  };

  // Manejar eliminación
  const handleDelete = async () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('¿Estás seguro de que quieres eliminar este ingreso?')) {
      try {
        await onDelete(ingreso.id);
      } catch (error) {
        console.error('Error al eliminar ingreso:', error);
        // El error se maneja en el hook padre
      }
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (field: keyof IngresoEditData, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Renderizar vista de edición
  if (isEditing) {
    return (
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-blue-500/30">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Descripción */}
          <div>
            <Input
              value={editData.descripcion}
              onChange={e => handleInputChange('descripcion', e.target.value)}
              placeholder="Descripción"
              variant="glass"
              error={!!errors.descripcion}
              className="text-sm"
            />
            {errors.descripcion && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.descripcion}
              </span>
            )}
          </div>

          {/* Fuente */}
          <div>
            <Input
              value={editData.fuente}
              onChange={e => handleInputChange('fuente', e.target.value)}
              placeholder="Fuente"
              variant="glass"
              error={!!errors.fuente}
              className="text-sm"
            />
            {errors.fuente && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.fuente}
              </span>
            )}
          </div>

          {/* Monto */}
          <div>
            <Input
              type="number"
              step="0.01"
              value={editData.monto}
              onChange={e => handleInputChange('monto', e.target.value)}
              placeholder="Monto"
              variant="glass"
              error={!!errors.monto}
              className="text-sm"
            />
            {errors.monto && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.monto}
              </span>
            )}
          </div>

          {/* Fecha */}
          <div>
            <Input
              type="date"
              value={editData.fecha}
              onChange={e => handleInputChange('fecha', e.target.value)}
              variant="glass"
              error={!!errors.fecha}
              className="text-sm"
            />
            {errors.fecha && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.fecha}
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción para edición */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="gradient"
            size="sm"
            onClick={handleSave}
            disabled={isLoading}
            className="text-xs"
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEditCancel}
            disabled={isLoading}
            className="text-xs"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Renderizar vista normal
  return (
    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">
              {ingreso.descripcion}
            </p>
            <p className="text-sm text-gray-400">
              {ingreso.fuente} •{' '}
              {new Date(ingreso.fecha).toLocaleDateString('es-CO')}
            </p>
          </div>
          <div className="text-right">
            <p
              className={`font-bold text-sm ${
                ingreso.monto > 0 ? 'text-emerald-400' : 'text-gray-500'
              }`}
            >
              {ingreso.monto > 0 ? formatCurrency(ingreso.monto) : 'Pendiente'}
            </p>
          </div>
        </div>
      </div>

      {/* Botones de acción para vista normal */}
      <div className="flex items-center gap-2 ml-4">
        <Button
          variant="glass"
          size="sm"
          onClick={handleEditStart}
          disabled={isLoading}
          className="text-xs"
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDelete}
          disabled={isLoading}
          className="text-xs text-red-400 hover:text-red-300"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
