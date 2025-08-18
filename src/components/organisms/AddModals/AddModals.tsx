/**
 * AddModals - Organism Level Component
 *
 * Modales compartidos para agregar ingresos y deudas.
 * Centralizan la lógica de formularios y pueden ser utilizados
 * por diferentes triggers (botones principales, flotantes, rápidos).
 *
 * Características:
 * - Formularios completos con validación
 * - Estados de loading y error
 * - Diseño consistente con glassmorphism
 * - Integración con hooks personalizados
 *
 * @param modalIngresoAbierto - Estado del modal de ingreso
 * @param modalDeudaAbierto - Estado del modal de deuda
 * @param onCloseModalIngreso - Callback para cerrar modal de ingreso
 * @param onCloseModalDeuda - Callback para cerrar modal de deuda
 * @param onSubmitIngreso - Callback para enviar formulario de ingreso
 * @param onSubmitDeuda - Callback para enviar formulario de deuda
 * @param ingresoData - Datos del formulario de ingreso
 * @param deudaData - Datos del formulario de deuda
 * @param onUpdateIngreso - Callback para actualizar datos de ingreso
 * @param onUpdateDeuda - Callback para actualizar datos de deuda
 * @param isSubmitting - Estado de envío
 */

import React from 'react';

import { Plus, TrendingUp, CreditCard } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Input from '@/components/atoms/Input/Input';
import FormField from '@/components/molecules/FormField/FormField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Tipos para los datos de formularios
interface IngresoData {
  descripcion: string;
  fuente: string;
  monto: string;
  fecha: string;
}

interface DeudaData {
  descripcion: string;
  acreedor: string;
  monto: string;
  fechaVencimiento: string;
}

interface AddModalsProps {
  // Estados de modales
  modalIngresoAbierto: boolean;
  modalDeudaAbierto: boolean;

  // Callbacks de control de modales
  onCloseModalIngreso: () => void;
  onCloseModalDeuda: () => void;

  // Callbacks de envío
  onSubmitIngreso: (e: React.FormEvent) => Promise<void>;
  onSubmitDeuda: (e: React.FormEvent) => Promise<void>;

  // Datos de formularios
  ingresoData: IngresoData;
  deudaData: DeudaData;

  // Callbacks de actualización
  onUpdateIngreso: (campo: keyof IngresoData, valor: string) => void;
  onUpdateDeuda: (campo: keyof DeudaData, valor: string) => void;

  // Estado de envío
  isSubmitting: boolean;
}

export default function AddModals({
  modalIngresoAbierto,
  modalDeudaAbierto,
  onCloseModalIngreso,
  onCloseModalDeuda,
  onSubmitIngreso,
  onSubmitDeuda,
  ingresoData,
  deudaData,
  onUpdateIngreso,
  onUpdateDeuda,
  isSubmitting,
}: AddModalsProps) {
  return (
    <>
      {/* Modal para Agregar Ingreso */}
      <Dialog open={modalIngresoAbierto} onOpenChange={onCloseModalIngreso}>
        <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
              Agregar Nuevo Ingreso
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitIngreso} className="space-y-4 mt-4">
            <FormField label="Descripción" required>
              <Input
                variant="glass"
                placeholder="Ej: Salario mensual"
                value={ingresoData.descripcion}
                onChange={e => onUpdateIngreso('descripcion', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Fuente" required>
              <Input
                variant="glass"
                placeholder="Ej: Empresa XYZ"
                value={ingresoData.fuente}
                onChange={e => onUpdateIngreso('fuente', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Monto" required>
              <Input
                variant="glass"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={ingresoData.monto}
                onChange={e => onUpdateIngreso('monto', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Fecha" required>
              <Input
                variant="glass"
                type="date"
                value={ingresoData.fecha}
                onChange={e => onUpdateIngreso('fecha', e.target.value)}
                required
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCloseModalIngreso}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
                className="flex-1"
                loading={isSubmitting}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Agregar Deuda */}
      <Dialog open={modalDeudaAbierto} onOpenChange={onCloseModalDeuda}>
        <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-orange-400" />
              Agregar Nueva Deuda
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitDeuda} className="space-y-4 mt-4">
            <FormField label="Descripción" required>
              <Input
                variant="glass"
                placeholder="Ej: Préstamo personal"
                value={deudaData.descripcion}
                onChange={e => onUpdateDeuda('descripcion', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Acreedor" required>
              <Input
                variant="glass"
                placeholder="Ej: Banco XYZ"
                value={deudaData.acreedor}
                onChange={e => onUpdateDeuda('acreedor', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Monto" required>
              <Input
                variant="glass"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={deudaData.monto}
                onChange={e => onUpdateDeuda('monto', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Fecha de Vencimiento" required>
              <Input
                variant="glass"
                type="date"
                value={deudaData.fechaVencimiento}
                onChange={e =>
                  onUpdateDeuda('fechaVencimiento', e.target.value)
                }
                required
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onCloseModalDeuda}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
                className="flex-1"
                loading={isSubmitting}
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Exportar tipos
export type { IngresoData, DeudaData };
