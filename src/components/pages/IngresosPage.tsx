'use client';

import React, { useState } from 'react';

import { Plus, RefreshCw, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import ConfirmModal from '@/components/atoms/ConfirmModal/ConfirmModal';
import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import Input from '@/components/atoms/Input/Input';
import FormField from '@/components/molecules/FormField/FormField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIngresosDeudas } from '@/hooks/useIngresosDeudas';
import {
  actualizarIngreso,
  eliminarIngreso,
} from '@/lib/services/ingresos-deudas';

interface User {
  id: string;
  email?: string;
}

interface IngresosPageProps {
  user: User;
}

interface IngresoFormData {
  descripcion: string;
  fuente: string;
  monto: number;
  fecha: string;
}

export default function IngresosPage({ user: _user }: IngresosPageProps) {
  const { ingresos, loading, agregarIngreso, recargarDatos, formatCurrency } =
    useIngresosDeudas();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: '', name: '' });
  const [formData, setFormData] = useState<IngresoFormData>({
    descripcion: '',
    fuente: '',
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setFormData({
      descripcion: '',
      fuente: '',
      monto: 0,
      fecha: new Date().toISOString().split('T')[0],
    });
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (ingreso: {
    id: string;
    descripcion: string;
    fuente: string;
    monto: number;
    fecha: string;
  }) => {
    setEditingId(ingreso.id);
    setFormData({
      descripcion: ingreso.descripcion,
      fuente: ingreso.fuente,
      monto: ingreso.monto,
      fecha: ingreso.fecha,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await actualizarIngreso(editingId, formData);
        toast.success('Ingreso actualizado');
      } else {
        await agregarIngreso(formData);
        toast.success('Ingreso agregado');
      }
      setModalOpen(false);
      resetForm();
      await recargarDatos();
    } catch {
      toast.error('Error al guardar el ingreso');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const ingreso = ingresos.find(i => i.id === id);
    setConfirmDelete({
      isOpen: true,
      id,
      name: ingreso?.descripcion || 'este ingreso',
    });
  };

  const executeDelete = async () => {
    const { id } = confirmDelete;
    setConfirmDelete(prev => ({ ...prev, isOpen: false }));
    try {
      await eliminarIngreso(id);
      toast.success('Ingreso eliminado');
      await recargarDatos();
    } catch {
      toast.error('Error al eliminar el ingreso');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400 mb-2">Ingresos</h1>
            <p className="text-gray-300">Gestiona tus fuentes de ingreso</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={recargarDatos}
              disabled={loading}
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button variant="gradient" onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Ingreso
            </Button>
          </div>
        </div>

        {/* Lista de ingresos */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Todos los Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ingresos.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">No hay ingresos registrados</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ingresos.map(ingreso => (
                  <div
                    key={ingreso.id}
                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                  >
                    <div>
                      <p className="text-white font-medium">
                        {ingreso.descripcion}
                      </p>
                      <p className="text-sm text-gray-400">
                        {ingreso.fuente} &bull; {ingreso.fecha}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p
                        className={`font-bold ${ingreso.monto > 0 ? 'text-emerald-400' : 'text-gray-500'}`}
                      >
                        {ingreso.monto > 0
                          ? formatCurrency(ingreso.monto)
                          : 'Pendiente'}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditModal(ingreso)}
                        title="Editar"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(ingreso.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal de confirmación de eliminación */}
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
          onConfirm={executeDelete}
          title="Eliminar ingreso"
          message={`¿Estás seguro de que deseas eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
        />

        {/* Modal agregar/editar */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[425px] bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
                {editingId ? 'Editar Ingreso' : 'Agregar Nuevo Ingreso'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <FormField label="Descripción" required>
                <Input
                  variant="glass"
                  placeholder="Ej: Salario mensual"
                  value={formData.descripcion}
                  onChange={e =>
                    setFormData(prev => ({
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
                  value={formData.fuente}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, fuente: e.target.value }))
                  }
                  required
                />
              </FormField>
              <FormField label="Monto" required>
                <CurrencyInput
                  value={formData.monto}
                  onChange={value =>
                    setFormData(prev => ({ ...prev, monto: value }))
                  }
                  className="bg-slate-700/50 border-slate-600 text-white"
                  placeholder="$0"
                />
              </FormField>
              <FormField label="Fecha" required>
                <Input
                  variant="glass"
                  type="date"
                  value={formData.fecha}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, fecha: e.target.value }))
                  }
                  required
                />
              </FormField>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  className="flex-1"
                  loading={submitting}
                >
                  {editingId ? 'Guardar' : 'Agregar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
