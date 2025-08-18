/**
 * IngresosDeudas - Page Level Component
 *
 * Componente principal para gestionar ingresos y deudas refactorizado.
 * Ahora se enfoca en la orquestación de datos y lógica de negocio,
 * mientras delega la presentación al Template y Organisms.
 *
 * Estructura refactorizada:
 * - Hook de datos (useIngresosDeudas)
 * - Funciones de negocio (agregar, formatear)
 * - Renderizado usando IngresosDeudaTemplate
 */
'use client';

import React, { useState } from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import AddModals from '@/components/organisms/AddModals/AddModals';
import DeudasSection from '@/components/organisms/DeudasSection/DeudasSection';
import FloatingActionButtons from '@/components/molecules/FloatingActionButtons/FloatingActionButtons';
import IngresosDeudaActionButtons from '@/components/organisms/IngresosDeudaActionButtons/IngresosDeudaActionButtons';
import IngresosDeudaHeader from '@/components/organisms/IngresosDeudaHeader/IngresosDeudaHeader';
import IngresosSection from '@/components/organisms/IngresosSection/IngresosSection';
import IngresosDeudaTemplate from '@/components/templates/IngresosDeudaTemplate/IngresosDeudaTemplate';
import { useAddModals } from '@/hooks/useAddModals';
import { useIngresosDeudas } from '@/hooks/useIngresosDeudas';

// Tipo User definido localmente basado en la estructura de Supabase
interface User {
  id: string;
  email?: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

interface IngresosDeudasProps {
  user: User;
}

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

export default function IngresosDeudas({ user: _user }: IngresosDeudasProps) {
  // Usar el hook personalizado para manejar el estado
  const {
    ingresos,
    deudas,
    resumen: _resumen,
    loading,
    error,
    agregarIngreso,
    agregarDeuda,
    editarIngreso,
    editarDeuda,
    eliminarIngresoById,
    eliminarDeudaById,
    recargarDatos,
    formatCurrency,
  } = useIngresosDeudas();

  // Hook para manejar modales y formularios
  const {
    modalIngresoAbierto,
    modalDeudaAbierto,
    abrirModalIngreso,
    cerrarModalIngreso,
    abrirModalDeuda,
    cerrarModalDeuda,
    nuevoIngreso,
    nuevaDeuda,
    actualizarIngreso,
    actualizarDeuda,
    resetearFormularioIngreso: _resetearFormularioIngreso,
    resetearFormularioDeuda: _resetearFormularioDeuda,
  } = useAddModals();

  // Estado para el envío de formularios
  const [submitting, setSubmitting] = useState(false);

  // Manejar envío del formulario de ingresos
  const handleSubmitIngreso = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Validar datos
      if (!nuevoIngreso.descripcion.trim() || !nuevoIngreso.fuente.trim()) {
        throw new Error('Todos los campos son obligatorios');
      }

      const monto = parseFloat(nuevoIngreso.monto);
      if (isNaN(monto) || monto <= 0) {
        throw new Error('El monto debe ser un número positivo');
      }

      // Crear objeto de ingreso
      const ingresoParaCrear = {
        descripcion: nuevoIngreso.descripcion.trim(),
        fuente: nuevoIngreso.fuente.trim(),
        monto,
        fecha: nuevoIngreso.fecha,
      };

      // Agregar ingreso usando el hook
      await agregarIngreso(ingresoParaCrear);

      // Cerrar modal y resetear formulario
      cerrarModalIngreso();
    } catch (err) {
      console.error('Error al agregar ingreso:', err);
      // TODO: Implementar mejor manejo de errores con toast o modal
      if (err instanceof Error) {
        console.error('Error específico:', err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Manejar envío del formulario de deudas
  const handleSubmitDeuda = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Validar datos
      if (!nuevaDeuda.descripcion.trim() || !nuevaDeuda.acreedor.trim()) {
        throw new Error('Todos los campos son obligatorios');
      }

      const monto = parseFloat(nuevaDeuda.monto);
      if (isNaN(monto) || monto <= 0) {
        throw new Error('El monto debe ser un número positivo');
      }

      if (!nuevaDeuda.fechaVencimiento) {
        throw new Error('La fecha de vencimiento es obligatoria');
      }

      // Crear objeto de deuda
      const deudaParaCrear = {
        descripcion: nuevaDeuda.descripcion.trim(),
        acreedor: nuevaDeuda.acreedor.trim(),
        monto,
        fecha_vencimiento: nuevaDeuda.fechaVencimiento,
        pagada: false,
      };

      // Agregar deuda usando el hook
      await agregarDeuda(deudaParaCrear);

      // Cerrar modal y resetear formulario
      cerrarModalDeuda();
    } catch (err) {
      console.error('Error al agregar deuda:', err);
      // TODO: Implementar mejor manejo de errores con toast o modal
      if (err instanceof Error) {
        console.error('Error específico:', err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Funciones de compatibilidad con el componente existente
  const handleAddIngreso = async (ingresoData: IngresoData) => {
    // Actualizar datos del formulario
    actualizarIngreso('descripcion', ingresoData.descripcion);
    actualizarIngreso('fuente', ingresoData.fuente);
    actualizarIngreso('monto', ingresoData.monto);
    actualizarIngreso('fecha', ingresoData.fecha);

    // Simular envío del formulario
    const mockEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmitIngreso(mockEvent);
  };

  const handleAddDeuda = async (deudaData: DeudaData) => {
    // Actualizar datos del formulario
    actualizarDeuda('descripcion', deudaData.descripcion);
    actualizarDeuda('acreedor', deudaData.acreedor);
    actualizarDeuda('monto', deudaData.monto);
    actualizarDeuda('fechaVencimiento', deudaData.fechaVencimiento);

    // Simular envío del formulario
    const mockEvent = { preventDefault: () => {} } as React.FormEvent;
    await handleSubmitDeuda(mockEvent);
  };

  // Componentes para el template
  const header = (
    <IngresosDeudaHeader onRefresh={recargarDatos} isLoading={loading} />
  );

  const summaryCards: React.ReactNode[] = []; // Aquí se pueden agregar tarjetas de resumen en el futuro

  const actionButtons = (
    <IngresosDeudaActionButtons
      onAddIngreso={handleAddIngreso}
      onAddDeuda={handleAddDeuda}
      isSubmitting={submitting}
    />
  );

  const ingresosSection = (
    <IngresosSection
      ingresos={ingresos}
      formatCurrency={formatCurrency}
      onEditIngreso={editarIngreso}
      onDeleteIngreso={eliminarIngresoById}
      onQuickAddIngreso={abrirModalIngreso}
      isLoading={loading}
    />
  );

  const deudasSection = (
    <DeudasSection
      deudas={deudas}
      formatCurrency={formatCurrency}
      onEditDeuda={editarDeuda}
      onDeleteDeuda={eliminarDeudaById}
      onQuickAddDeuda={abrirModalDeuda}
      isLoading={loading}
    />
  );

  const refreshButton = (
    <Button
      variant="glass"
      size="default"
      onClick={recargarDatos}
      disabled={loading}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      Reintentar
    </Button>
  );

  // Renderizar usando el template
  return (
    <>
      <IngresosDeudaTemplate
        header={header}
        summaryCards={summaryCards}
        actionButtons={actionButtons}
        ingresosSection={ingresosSection}
        deudasSection={deudasSection}
        isLoading={loading}
        error={error}
        refreshButton={refreshButton}
      />

      {/* Botones flotantes para acceso rápido */}
      <FloatingActionButtons
        onAddIngreso={abrirModalIngreso}
        onAddDeuda={abrirModalDeuda}
      />

      {/* Modales compartidos */}
      <AddModals
        modalIngresoAbierto={modalIngresoAbierto}
        modalDeudaAbierto={modalDeudaAbierto}
        onCloseModalIngreso={cerrarModalIngreso}
        onCloseModalDeuda={cerrarModalDeuda}
        onSubmitIngreso={handleSubmitIngreso}
        onSubmitDeuda={handleSubmitDeuda}
        ingresoData={nuevoIngreso}
        deudaData={nuevaDeuda}
        onUpdateIngreso={actualizarIngreso}
        onUpdateDeuda={actualizarDeuda}
        isSubmitting={submitting}
      />
    </>
  );
}
