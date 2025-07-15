/**
 * IngresosDeudaActionButtons - Organism Level Component
 *
 * Componente que renderiza los botones de acción para agregar ingresos y deudas.
 * Incluye modales para formularios de creación.
 *
 * @param onAddIngreso - Función para agregar un ingreso
 * @param onAddDeuda - Función para agregar una deuda
 * @param isSubmitting - Estado de envío de formulario
 *
 * @example
 * <IngresosDeudaActionButtons
 *   onAddIngreso={(data) => console.log("add ingreso", data)}
 *   onAddDeuda={(data) => console.log("add deuda", data)}
 *   isSubmitting={false}
 * />
 */

import React, { useState } from 'react';

import { Plus, TrendingUp, CreditCard } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import Input from '@/components/atoms/Input/Input';
import FormField from '@/components/molecules/FormField/FormField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

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

interface IngresosDeudaActionButtonsProps {
  onAddIngreso: (data: IngresoData) => Promise<void>;
  onAddDeuda: (data: DeudaData) => Promise<void>;
  isSubmitting: boolean;
}

export default function IngresosDeudaActionButtons({
  onAddIngreso,
  onAddDeuda,
  isSubmitting,
}: IngresosDeudaActionButtonsProps) {
  // Estados para modales
  const [modalIngresoAbierto, setModalIngresoAbierto] = useState(false);
  const [modalDeudaAbierto, setModalDeudaAbierto] = useState(false);

  // Estados para formularios
  const [nuevoIngreso, setNuevoIngreso] = useState<IngresoData>({
    descripcion: '',
    fuente: '',
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
  });

  const [nuevaDeuda, setNuevaDeuda] = useState<DeudaData>({
    descripcion: '',
    acreedor: '',
    monto: '',
    fechaVencimiento: '',
  });

  // Manejar envío del formulario de ingresos
  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddIngreso(nuevoIngreso);
    setNuevoIngreso({
      descripcion: '',
      fuente: '',
      monto: '',
      fecha: new Date().toISOString().split('T')[0],
    });
    setModalIngresoAbierto(false);
  };

  // Manejar envío del formulario de deudas
  const handleSubmitDeuda = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAddDeuda(nuevaDeuda);
    setNuevaDeuda({
      descripcion: '',
      acreedor: '',
      monto: '',
      fechaVencimiento: '',
    });
    setModalDeudaAbierto(false);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {/* Botón para Modal de Ingresos */}
      <Dialog open={modalIngresoAbierto} onOpenChange={setModalIngresoAbierto}>
        <DialogTrigger asChild>
          <Button variant="gradient" size="lg" className="flex-1 sm:flex-none">
            <TrendingUp className="w-5 h-5 mr-2" />
            Agregar Ingreso
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
              Agregar Nuevo Ingreso
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitIngreso} className="space-y-4 mt-4">
            <FormField label="Descripción" required>
              <Input
                variant="glass"
                placeholder="Ej: Salario mensual"
                value={nuevoIngreso.descripcion}
                onChange={e =>
                  setNuevoIngreso(prev => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Fuente" required>
              <Input
                variant="glass"
                placeholder="Ej: Empresa XYZ"
                value={nuevoIngreso.fuente}
                onChange={e =>
                  setNuevoIngreso(prev => ({
                    ...prev,
                    fuente: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Monto" required>
              <Input
                variant="glass"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={nuevoIngreso.monto}
                onChange={e =>
                  setNuevoIngreso(prev => ({
                    ...prev,
                    monto: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Fecha" required>
              <Input
                variant="glass"
                type="date"
                value={nuevoIngreso.fecha}
                onChange={e =>
                  setNuevoIngreso(prev => ({
                    ...prev,
                    fecha: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setModalIngresoAbierto(false)}
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

      {/* Botón para Modal de Deudas */}
      <Dialog open={modalDeudaAbierto} onOpenChange={setModalDeudaAbierto}>
        <DialogTrigger asChild>
          <Button variant="glass" size="lg" className="flex-1 sm:flex-none">
            <CreditCard className="w-5 h-5 mr-2" />
            Agregar Deuda
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-orange-400" />
              Agregar Nueva Deuda
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitDeuda} className="space-y-4 mt-4">
            <FormField label="Descripción" required>
              <Input
                variant="glass"
                placeholder="Ej: Préstamo personal"
                value={nuevaDeuda.descripcion}
                onChange={e =>
                  setNuevaDeuda(prev => ({
                    ...prev,
                    descripcion: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Acreedor" required>
              <Input
                variant="glass"
                placeholder="Ej: Banco XYZ"
                value={nuevaDeuda.acreedor}
                onChange={e =>
                  setNuevaDeuda(prev => ({
                    ...prev,
                    acreedor: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Monto" required>
              <Input
                variant="glass"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={nuevaDeuda.monto}
                onChange={e =>
                  setNuevaDeuda(prev => ({
                    ...prev,
                    monto: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Fecha de Vencimiento" required>
              <Input
                variant="glass"
                type="date"
                value={nuevaDeuda.fechaVencimiento}
                onChange={e =>
                  setNuevaDeuda(prev => ({
                    ...prev,
                    fechaVencimiento: e.target.value,
                  }))
                }
                required
              />
            </FormField>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setModalDeudaAbierto(false)}
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
    </div>
  );
}
