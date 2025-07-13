/**
 * IngresosDeudas - Page Level Component
 * 
 * Componente principal para gestionar ingresos y deudas:
 * - Formulario para agregar nuevos ingresos
 * - Formulario para agregar nuevas deudas
 * - Lista de ingresos existentes
 * - Lista de deudas existentes
 * - Resumen financiero con balance neto
 */
"use client";

import { useState } from 'react';
import { User } from '@supabase/supabase-js';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/atoms/Card/Card';
import Button from '@/components/atoms/Button/Button';
import Input from '@/components/atoms/Input/Input';
import FormField from '@/components/molecules/FormField/FormField';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  CreditCard, 
  DollarSign, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';

interface IngresosDeudasProps {
  user: User;
}

// Interfaces para tipos de datos
interface Ingreso {
  id: string;
  descripcion: string;
  fuente: string; // Cambiado de categoría a fuente
  monto: number;
  fecha: string;
  tipo: 'ingreso';
}

interface Deuda {
  id: string;
  descripcion: string;
  acreedor: string;
  monto: number;
  fechaVencimiento: string;
  tipo: 'deuda';
  pagada: boolean;
}

export default function IngresosDeudas({ user }: IngresosDeudasProps) {
  // Estados para formularios
  const [nuevoIngreso, setNuevoIngreso] = useState({
    descripcion: '',
    fuente: '', // Cambiado de categoría a fuente
    monto: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [nuevaDeuda, setNuevaDeuda] = useState({
    descripcion: '',
    acreedor: '',
    monto: '',
    fechaVencimiento: ''
  });

  // Data mockeada inicial para ingresos basada en la imagen
  const ingresosIniciales: Ingreso[] = [
    {
      id: "1",
      descripcion: "Salario mensual",
      fuente: "Phi Dimension",
      monto: 16000000,
      fecha: "2025-01-01",
      tipo: "ingreso"
    },
    {
      id: "2", 
      descripcion: "Proyecto freelance",
      fuente: "Hactch Works",
      monto: 16400000,
      fecha: "2025-01-01",
      tipo: "ingreso"
    },
    {
      id: "3",
      descripcion: "Consultoría",
      fuente: "Hasugue",
      monto: 0,
      fecha: "2025-01-01", 
      tipo: "ingreso"
    },
    {
      id: "4",
      descripcion: "Inversión MOF",
      fuente: "MOF",
      monto: 0,
      fecha: "2025-01-01",
      tipo: "ingreso"
    },
    {
      id: "5",
      descripcion: "Arriendo apartamento",
      fuente: "Apto 216", 
      monto: 0,
      fecha: "2025-01-01",
      tipo: "ingreso"
    },
    {
      id: "6",
      descripcion: "Arriendo parqueadero",
      fuente: "Parking",
      monto: 100000,
      fecha: "2025-01-01",
      tipo: "ingreso"
    }
  ];

  // Data mockeada inicial para deudas
  const deudasIniciales: Deuda[] = [
    {
      id: "1",
      descripcion: "Crédito vehículo",
      acreedor: "Banco Davivienda",
      monto: 25000000,
      fechaVencimiento: "2025-02-15",
      tipo: "deuda",
      pagada: false
    },
    {
      id: "2", 
      descripcion: "Hipoteca casa",
      acreedor: "Banco de Bogotá",
      monto: 45000000,
      fechaVencimiento: "2025-02-01",
      tipo: "deuda",
      pagada: false
    }
  ];

  // Estados para listas de datos
  const [ingresos, setIngresos] = useState<Ingreso[]>(ingresosIniciales);
  const [deudas, setDeudas] = useState<Deuda[]>(deudasIniciales);
  const [loading, setLoading] = useState(false);
  
  // Estados para modales
  const [modalIngresoAbierto, setModalIngresoAbierto] = useState(false);
  const [modalDeudaAbierto, setModalDeudaAbierto] = useState(false);

  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Manejar envío del formulario de ingresos
  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const ingreso: Ingreso = {
        id: Date.now().toString(),
        descripcion: nuevoIngreso.descripcion,
        fuente: nuevoIngreso.fuente,
        monto: parseFloat(nuevoIngreso.monto),
        fecha: nuevoIngreso.fecha,
        tipo: 'ingreso'
      };

      setIngresos(prev => [ingreso, ...prev]);
      
      // Limpiar formulario
      setNuevoIngreso({
        descripcion: '',
        fuente: '',
        monto: '',
        fecha: new Date().toISOString().split('T')[0]
      });
      
      // Cerrar modal
      setModalIngresoAbierto(false);
    } catch (error) {
      console.error('Error al agregar ingreso:', error);
    } finally {
      setLoading(false);
    }
  };

  // Manejar envío del formulario de deudas
  const handleSubmitDeuda = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const deuda: Deuda = {
        id: Date.now().toString(),
        descripcion: nuevaDeuda.descripcion,
        acreedor: nuevaDeuda.acreedor,
        monto: parseFloat(nuevaDeuda.monto),
        fechaVencimiento: nuevaDeuda.fechaVencimiento,
        tipo: 'deuda',
        pagada: false
      };

      setDeudas(prev => [deuda, ...prev]);
      
      // Limpiar formulario
      setNuevaDeuda({
        descripcion: '',
        acreedor: '',
        monto: '',
        fechaVencimiento: ''
      });
      
      // Cerrar modal
      setModalDeudaAbierto(false);
    } catch (error) {
      console.error('Error al agregar deuda:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular totales
  const totalIngresos = ingresos.reduce((sum, ingreso) => sum + ingreso.monto, 0);
  const totalDeudas = deudas.reduce((sum, deuda) => sum + deuda.monto, 0);
  const deudasPendientes = deudas.filter(deuda => !deuda.pagada).length;

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-2">
            Gestión de Ingresos y Deudas
          </h1>
          <p className="text-gray-300 text-lg">
            Administra tus gastos y deudas de manera eficiente
          </p>
        </div>

        {/* Tarjetas de resumen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Ingresos */}
          <Card variant="glass" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-600/10"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Ingresos</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(totalIngresos)}
                  </p>
                  <p className="text-xs text-gray-400">{ingresos.length} registros</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Deudas */}
          <Card variant="glass" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-orange-600/10"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-orange-500/20 rounded-lg">
                  <CreditCard className="w-6 h-6 text-orange-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Deudas</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCurrency(totalDeudas)}
                  </p>
                  <p className="text-xs text-gray-400">{deudasPendientes} pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Balance */}
          <Card variant="glass" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-600/10"></div>
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Balance Neto</p>
                  <p className={`text-2xl font-bold ${totalIngresos - totalDeudas < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {formatCurrency(totalIngresos - totalDeudas)}
                  </p>
                  <p className="text-xs text-gray-400">Ingresos - Deudas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center">
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
                    onChange={(e) => setNuevoIngreso(prev => ({ ...prev, descripcion: e.target.value }))}
                    required
                  />
                </FormField>

                <FormField label="Fuente" required>
                  <Input
                    variant="glass"
                    placeholder="Ej: Empresa XYZ"
                    value={nuevoIngreso.fuente}
                    onChange={(e) => setNuevoIngreso(prev => ({ ...prev, fuente: e.target.value }))}
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
                    onChange={(e) => setNuevoIngreso(prev => ({ ...prev, monto: e.target.value }))}
                    required
                  />
                </FormField>

                <FormField label="Fecha" required>
                  <Input
                    variant="glass"
                    type="date"
                    value={nuevoIngreso.fecha}
                    onChange={(e) => setNuevoIngreso(prev => ({ ...prev, fecha: e.target.value }))}
                    required
                  />
                </FormField>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setModalIngresoAbierto(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="flex-1"
                    loading={loading}
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
                    onChange={(e) => setNuevaDeuda(prev => ({ ...prev, descripcion: e.target.value }))}
                    required
                  />
                </FormField>

                <FormField label="Acreedor" required>
                  <Input
                    variant="glass"
                    placeholder="Ej: Banco XYZ"
                    value={nuevaDeuda.acreedor}
                    onChange={(e) => setNuevaDeuda(prev => ({ ...prev, acreedor: e.target.value }))}
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
                    onChange={(e) => setNuevaDeuda(prev => ({ ...prev, monto: e.target.value }))}
                    required
                  />
                </FormField>

                <FormField label="Fecha de Vencimiento" required>
                  <Input
                    variant="glass"
                    type="date"
                    value={nuevaDeuda.fechaVencimiento}
                    onChange={(e) => setNuevaDeuda(prev => ({ ...prev, fechaVencimiento: e.target.value }))}
                    required
                  />
                </FormField>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setModalDeudaAbierto(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="gradient"
                    className="flex-1"
                    loading={loading}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Listas de Ingresos y Deudas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de Ingresos */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Ingresos Recientes
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
                    {ingresos.slice(0, 5).map((ingreso) => (
                      <div key={ingreso.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div>
                          <p className="text-white font-medium">{ingreso.descripcion}</p>
                          <p className="text-sm text-gray-400">{ingreso.fuente} • {ingreso.fecha}</p>
                        </div>
                        <p className={`font-bold ${ingreso.monto > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {ingreso.monto > 0 ? formatCurrency(ingreso.monto) : 'Pendiente'}
                        </p>
                      </div>
                    ))}
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Lista de Deudas */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                Deudas Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deudas.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No hay deudas registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {deudas.slice(0, 5).map((deuda) => (
                    <div key={deuda.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="text-white font-medium">{deuda.descripcion}</p>
                        <p className="text-sm text-gray-400">{deuda.acreedor} • Vence: {deuda.fechaVencimiento}</p>
                      </div>
                      <p className="text-orange-400 font-bold">{formatCurrency(deuda.monto)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 