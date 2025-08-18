/**
 * DeudaRow - Molecule Level Component
 *
 * Componente editable para mostrar y editar una fila de deuda.
 * Permite edición inline con validación y acciones de eliminación.
 *
 * Características:
 * - Edición inline con toggle entre vista y edición
 * - Validación de datos en tiempo real
 * - Botones de acción (editar, eliminar, guardar, cancelar)
 * - Formateo de moneda automático
 * - Indicadores visuales para deudas próximas a vencer
 *
 * @param deuda - Objeto de deuda a mostrar/editar
 * @param formatCurrency - Función para formatear moneda
 * @param onEdit - Callback cuando se edita una deuda
 * @param onDelete - Callback cuando se elimina una deuda
 * @param isLoading - Estado de carga para operaciones async
 *
 * @example
 * <DeudaRow
 *   deuda={deudaData}
 *   formatCurrency={formatMoney}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   isLoading={false}
 * />
 */

import React, { useState } from 'react';

import { Edit, Trash2, Save, X, AlertCircle } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Input from '@/components/atoms/Input/Input';

// Tipo para deuda basado en el servicio
interface Deuda {
  id: string;
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
  pagada: boolean;
}

// Tipo para datos de edición
interface DeudaEditData {
  descripcion: string;
  acreedor: string;
  monto: string;
  fecha_vencimiento: string;
}

// Tipo para el callback de edición (con number para monto)
interface DeudaEditCallback {
  descripcion?: string;
  acreedor?: string;
  monto?: number;
  fecha_vencimiento?: string;
}

interface DeudaRowProps {
  deuda: Deuda;
  formatCurrency: (amount: number) => string;
  onEdit: (id: string, datosActualizados: DeudaEditCallback) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export default function DeudaRow({
  deuda,
  formatCurrency,
  onEdit,
  onDelete,
  isLoading = false,
}: DeudaRowProps) {
  // Estado para modo de edición
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<DeudaEditData>({
    descripcion: deuda.descripcion,
    acreedor: deuda.acreedor,
    monto: deuda.monto.toString(),
    fecha_vencimiento: deuda.fecha_vencimiento,
  });

  // Estado para validación
  const [errors, setErrors] = useState<Partial<DeudaEditData>>({});

  // Función para validar los datos
  const validateData = (): boolean => {
    const newErrors: Partial<DeudaEditData> = {};

    if (!editData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es obligatoria';
    }

    if (!editData.acreedor.trim()) {
      newErrors.acreedor = 'El acreedor es obligatorio';
    }

    const monto = parseFloat(editData.monto);
    if (isNaN(monto) || monto <= 0) {
      newErrors.monto = 'El monto debe ser un número válido mayor a 0';
    }

    if (!editData.fecha_vencimiento) {
      newErrors.fecha_vencimiento = 'La fecha de vencimiento es obligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Función para verificar si está próxima a vencer
  const isNearDue = (): boolean => {
    const today = new Date();
    const dueDate = new Date(deuda.fecha_vencimiento);
    const diffDays = Math.ceil(
      (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays <= 7 && diffDays >= 0;
  };

  // Manejar inicio de edición
  const handleEditStart = () => {
    setIsEditing(true);
    setEditData({
      descripcion: deuda.descripcion,
      acreedor: deuda.acreedor,
      monto: deuda.monto.toString(),
      fecha_vencimiento: deuda.fecha_vencimiento,
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
      const datosActualizados: DeudaEditCallback = {
        descripcion: editData.descripcion.trim(),
        acreedor: editData.acreedor.trim(),
        monto: parseFloat(editData.monto),
        fecha_vencimiento: editData.fecha_vencimiento,
      };

      await onEdit(deuda.id, datosActualizados);
      setIsEditing(false);
      setErrors({});
    } catch (error) {
      console.error('Error al guardar deuda:', error);
      // El error se maneja en el hook padre
    }
  };

  // Manejar eliminación
  const handleDelete = async () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('¿Estás seguro de que quieres eliminar esta deuda?')) {
      try {
        await onDelete(deuda.id);
      } catch (error) {
        console.error('Error al eliminar deuda:', error);
        // El error se maneja en el hook padre
      }
    }
  };

  // Manejar cambios en inputs
  const handleInputChange = (field: keyof DeudaEditData, value: string) => {
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

          {/* Acreedor */}
          <div>
            <Input
              value={editData.acreedor}
              onChange={e => handleInputChange('acreedor', e.target.value)}
              placeholder="Acreedor"
              variant="glass"
              error={!!errors.acreedor}
              className="text-sm"
            />
            {errors.acreedor && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.acreedor}
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

          {/* Fecha de vencimiento */}
          <div>
            <Input
              type="date"
              value={editData.fecha_vencimiento}
              onChange={e =>
                handleInputChange('fecha_vencimiento', e.target.value)
              }
              variant="glass"
              error={!!errors.fecha_vencimiento}
              className="text-sm"
            />
            {errors.fecha_vencimiento && (
              <span className="text-xs text-red-400 mt-1 block">
                {errors.fecha_vencimiento}
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
    <div
      className={`flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors duration-200 ${
        isNearDue() ? 'border-l-4 border-orange-500' : ''
      }`}
    >
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm flex items-center gap-2">
              {deuda.descripcion}
              {isNearDue() && (
                <AlertCircle className="w-4 h-4 text-orange-400" />
              )}
            </p>
            <p className="text-sm text-gray-400">
              {deuda.acreedor} • Vence:{' '}
              {new Date(deuda.fecha_vencimiento).toLocaleDateString('es-CO')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm text-orange-400">
              {formatCurrency(deuda.monto)}
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
