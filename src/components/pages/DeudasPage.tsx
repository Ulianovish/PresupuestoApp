'use client';

import React, { useState } from 'react';

import {
  Plus,
  RefreshCw,
  CreditCard,
  Landmark,
  Edit,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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
  actualizarDeuda,
  eliminarDeuda,
  type Deuda,
} from '@/lib/services/ingresos-deudas';

interface User {
  id: string;
  email?: string;
}

interface DeudasPageProps {
  user: User;
}

interface DeudaFormData {
  descripcion: string;
  acreedor: string;
  monto: number;
  fecha_vencimiento: string;
  tipo_deuda: 'banco' | 'tarjeta_credito';
  // V2 fields
  valor_total: number;
  saldo_pendiente: number;
  plazo_meses: number;
  valor_cuota: number;
  fecha_corte: string;
  fecha_pago: string;
  tasa_interes: number;
  cuotas_pagas: number;
  cuotas_faltantes: number;
  valor_polizas: number;
}

const EMPTY_FORM: DeudaFormData = {
  descripcion: '',
  acreedor: '',
  monto: 0,
  fecha_vencimiento: '',
  tipo_deuda: 'banco',
  valor_total: 0,
  saldo_pendiente: 0,
  plazo_meses: 0,
  valor_cuota: 0,
  fecha_corte: '',
  fecha_pago: '',
  tasa_interes: 0,
  cuotas_pagas: 0,
  cuotas_faltantes: 0,
  valor_polizas: 0,
};

export default function DeudasPage({ user: _user }: DeudasPageProps) {
  const { deudas, loading, agregarDeuda, recargarDatos, formatCurrency } =
    useIngresosDeudas();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDetalles, setShowDetalles] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: '', name: '' });
  const [formData, setFormData] = useState<DeudaFormData>({ ...EMPTY_FORM });

  // Determinar si una deuda es tarjeta de crédito (por tipo o descripción)
  const esTarjetaCredito = (d: Deuda) => {
    if (d.tipo === 'tarjeta_credito' || d.tipo_deuda === 'tarjeta_credito')
      return true;
    const desc = d.descripcion.toLowerCase();
    return (
      desc.includes('tarjeta de credito') || desc.includes('tarjeta de crédito')
    );
  };

  // Separar deudas por tipo
  const deudasTarjeta = deudas.filter(esTarjetaCredito);
  const deudasBanco = deudas.filter(d => !esTarjetaCredito(d));

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingId(null);
    setShowDetalles(false);
  };

  const openAddModal = (tipo: 'banco' | 'tarjeta_credito' = 'banco') => {
    resetForm();
    setFormData(prev => ({ ...prev, tipo_deuda: tipo }));
    setModalOpen(true);
  };

  const openEditModal = (deuda: Deuda) => {
    setEditingId(deuda.id);
    setFormData({
      descripcion: deuda.descripcion,
      acreedor: deuda.acreedor,
      monto: deuda.monto,
      fecha_vencimiento: deuda.fecha_vencimiento,
      tipo_deuda:
        ((deuda.tipo_deuda || deuda.tipo) as 'banco' | 'tarjeta_credito') ||
        'banco',
      valor_total: deuda.valor_total || 0,
      saldo_pendiente: deuda.saldo_pendiente || 0,
      plazo_meses: deuda.plazo_meses || 0,
      valor_cuota: deuda.valor_cuota || 0,
      fecha_corte: deuda.fecha_corte || '',
      fecha_pago: deuda.fecha_pago || '',
      tasa_interes: deuda.tasa_interes || 0,
      cuotas_pagas: deuda.cuotas_pagas || 0,
      cuotas_faltantes: deuda.cuotas_faltantes || 0,
      valor_polizas: deuda.valor_polizas || 0,
    });
    // Mostrar detalles si algún campo v2 tiene valor
    const hasV2Data =
      deuda.valor_total > 0 || deuda.plazo_meses > 0 || deuda.valor_cuota > 0;
    setShowDetalles(hasV2Data);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const deudaData = {
        descripcion: formData.descripcion,
        acreedor: formData.acreedor,
        monto: formData.monto,
        fecha_vencimiento: formData.fecha_vencimiento,
        tipo_deuda: formData.tipo_deuda,
        valor_total: formData.valor_total,
        saldo_pendiente: formData.saldo_pendiente,
        plazo_meses: formData.plazo_meses,
        valor_cuota: formData.valor_cuota,
        fecha_corte: formData.fecha_corte,
        fecha_pago: formData.fecha_pago,
        tasa_interes: formData.tasa_interes,
        cuotas_pagas: formData.cuotas_pagas,
        cuotas_faltantes: formData.cuotas_faltantes,
        valor_polizas: formData.valor_polizas,
      };

      if (editingId) {
        await actualizarDeuda(editingId, deudaData);
        toast.success('Deuda actualizada');
      } else {
        await agregarDeuda(deudaData);
        toast.success('Deuda agregada');
      }
      setModalOpen(false);
      resetForm();
      await recargarDatos();
    } catch {
      toast.error('Error al guardar la deuda');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    const deuda = deudas.find(d => d.id === id);
    setConfirmDelete({
      isOpen: true,
      id,
      name: deuda?.descripcion || 'esta deuda',
    });
  };

  const executeDelete = async () => {
    const { id } = confirmDelete;
    setConfirmDelete(prev => ({ ...prev, isOpen: false }));
    try {
      await eliminarDeuda(id);
      toast.success('Deuda eliminada');
      await recargarDatos();
    } catch {
      toast.error('Error al eliminar la deuda');
    }
  };

  const renderDeudaList = (deudaList: typeof deudas, emptyMessage: string) => {
    if (deudaList.length === 0) {
      return (
        <div className="text-center py-6">
          <p className="text-gray-400">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {deudaList.map(deuda => (
          <div key={deuda.id} className="p-3 bg-white/5 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-white font-medium">{deuda.descripcion}</p>
                <p className="text-sm text-gray-400">
                  {deuda.acreedor} &bull; Vence:{' '}
                  {new Date(deuda.fecha_vencimiento).toLocaleDateString(
                    'es-CO',
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p
                    className={`font-bold ${deuda.pagada ? 'text-green-400' : 'text-orange-400'}`}
                  >
                    {formatCurrency(
                      deuda.valor_cuota > 0 ? deuda.valor_cuota : deuda.monto,
                    )}
                  </p>
                  {deuda.valor_cuota > 0 && (
                    <p className="text-xs text-gray-500">cuota/mes</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditModal(deuda)}
                  title="Editar"
                >
                  <Edit className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(deuda.id)}
                  className="text-red-400 hover:text-red-300"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {/* V2 info: progreso de cuotas y saldo */}
            {deuda.plazo_meses > 0 && (
              <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                <span>
                  Cuotas: {deuda.cuotas_pagas}/{deuda.plazo_meses}
                </span>
                {deuda.saldo_pendiente > 0 && (
                  <span>Saldo: {formatCurrency(deuda.saldo_pendiente)}</span>
                )}
                {deuda.tasa_interes > 0 && (
                  <span>Tasa: {deuda.tasa_interes}%</span>
                )}
                {/* Barra de progreso */}
                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{
                      width: `${Math.min((deuda.cuotas_pagas / deuda.plazo_meses) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400 mb-2">Deudas</h1>
            <p className="text-gray-300">
              Gestiona tus deudas bancarias y tarjetas de crédito
            </p>
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
          </div>
        </div>

        {loading ? (
          <Card variant="glass" className="p-6">
            <CardContent className="text-center">
              <RefreshCw className="w-16 h-16 animate-spin text-blue-400 mx-auto mb-4" />
              <p className="text-gray-400">Cargando deudas...</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Deudas Bancarias */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <Landmark className="w-5 h-5 mr-2 text-blue-400" />
                    Deudas Bancarias
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAddModal('banco')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderDeudaList(
                  deudasBanco,
                  'No hay deudas bancarias registradas',
                )}
              </CardContent>
            </Card>

            {/* Tarjetas de Crédito */}
            <Card variant="glass">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <div className="flex items-center">
                    <CreditCard className="w-5 h-5 mr-2 text-orange-400" />
                    Tarjetas de Crédito
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openAddModal('tarjeta_credito')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {renderDeudaList(
                  deudasTarjeta,
                  'No hay tarjetas de crédito registradas',
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modal de confirmación de eliminación */}
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          onClose={() => setConfirmDelete(prev => ({ ...prev, isOpen: false }))}
          onConfirm={executeDelete}
          title="Eliminar deuda"
          message={`¿Estás seguro de que deseas eliminar "${confirmDelete.name}"? Esta acción no se puede deshacer.`}
        />

        {/* Modal agregar/editar */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-[500px] bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center">
                <AlertCircle className="w-5 h-5 mr-2 text-orange-400" />
                {editingId ? 'Editar Deuda' : 'Agregar Nueva Deuda'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <FormField label="Tipo" required>
                <select
                  value={formData.tipo_deuda}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      tipo_deuda: e.target.value as 'banco' | 'tarjeta_credito',
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="banco">Banco</option>
                  <option value="tarjeta_credito">Tarjeta de Crédito</option>
                </select>
              </FormField>
              <FormField label="Descripción" required>
                <Input
                  variant="glass"
                  placeholder="Ej: Crédito vehículo"
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
              <FormField label="Acreedor" required>
                <Input
                  variant="glass"
                  placeholder="Ej: Banco Davivienda"
                  value={formData.acreedor}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      acreedor: e.target.value,
                    }))
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
              <FormField label="Fecha de Vencimiento" required>
                <Input
                  variant="glass"
                  type="date"
                  value={formData.fecha_vencimiento}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      fecha_vencimiento: e.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              {/* Sección colapsable: Detalles Financieros */}
              <div className="border-t border-slate-700 pt-3">
                <button
                  type="button"
                  onClick={() => setShowDetalles(!showDetalles)}
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors w-full"
                >
                  {showDetalles ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Detalles Financieros
                </button>

                {showDetalles && (
                  <div className="space-y-4 mt-3">
                    {/* Valores */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Valor Total">
                        <CurrencyInput
                          value={formData.valor_total}
                          onChange={value =>
                            setFormData(prev => ({
                              ...prev,
                              valor_total: value,
                            }))
                          }
                          className="bg-slate-700/50 border-slate-600 text-white"
                          placeholder="$0"
                        />
                      </FormField>
                      <FormField label="Saldo Pendiente">
                        <CurrencyInput
                          value={formData.saldo_pendiente}
                          onChange={value =>
                            setFormData(prev => ({
                              ...prev,
                              saldo_pendiente: value,
                            }))
                          }
                          className="bg-slate-700/50 border-slate-600 text-white"
                          placeholder="$0"
                        />
                      </FormField>
                      <FormField label="Valor Cuota">
                        <CurrencyInput
                          value={formData.valor_cuota}
                          onChange={value =>
                            setFormData(prev => ({
                              ...prev,
                              valor_cuota: value,
                            }))
                          }
                          className="bg-slate-700/50 border-slate-600 text-white"
                          placeholder="$0"
                        />
                      </FormField>
                      <FormField label="Valor Pólizas">
                        <CurrencyInput
                          value={formData.valor_polizas}
                          onChange={value =>
                            setFormData(prev => ({
                              ...prev,
                              valor_polizas: value,
                            }))
                          }
                          className="bg-slate-700/50 border-slate-600 text-white"
                          placeholder="$0"
                        />
                      </FormField>
                    </div>

                    {/* Plazo */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Plazo (meses)">
                        <Input
                          variant="glass"
                          type="number"
                          min={0}
                          value={formData.plazo_meses || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              plazo_meses: parseInt(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </FormField>
                      <FormField label="Tasa de Interés (%)">
                        <Input
                          variant="glass"
                          type="number"
                          min={0}
                          step={0.01}
                          value={formData.tasa_interes || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              tasa_interes: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder="0.00"
                        />
                      </FormField>
                      <FormField label="Cuotas Pagas">
                        <Input
                          variant="glass"
                          type="number"
                          min={0}
                          value={formData.cuotas_pagas || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              cuotas_pagas: parseInt(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </FormField>
                      <FormField label="Cuotas Faltantes">
                        <Input
                          variant="glass"
                          type="number"
                          min={0}
                          value={formData.cuotas_faltantes || ''}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              cuotas_faltantes: parseInt(e.target.value) || 0,
                            }))
                          }
                          placeholder="0"
                        />
                      </FormField>
                    </div>

                    {/* Fechas de corte y pago */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Fecha de Corte">
                        <Input
                          variant="glass"
                          placeholder="Ej: 15"
                          value={formData.fecha_corte}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              fecha_corte: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <FormField label="Fecha de Pago">
                        <Input
                          variant="glass"
                          placeholder="Ej: 5"
                          value={formData.fecha_pago}
                          onChange={e =>
                            setFormData(prev => ({
                              ...prev,
                              fecha_pago: e.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </div>
                  </div>
                )}
              </div>

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
