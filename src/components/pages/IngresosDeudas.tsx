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
import DeudasSection from '@/components/organisms/DeudasSection/DeudasSection';
import IngresosDeudaActionButtons from '@/components/organisms/IngresosDeudaActionButtons/IngresosDeudaActionButtons';
import IngresosDeudaHeader from '@/components/organisms/IngresosDeudaHeader/IngresosDeudaHeader';
import IngresosSection from '@/components/organisms/IngresosSection/IngresosSection';
import IngresosDeudaTemplate from '@/components/templates/IngresosDeudaTemplate/IngresosDeudaTemplate';
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
    recargarDatos,
    formatCurrency,
  } = useIngresosDeudas();

  // Estado para el envío de formularios
  const [submitting, setSubmitting] = useState(false);

  // Manejar envío del formulario de ingresos
  const handleAddIngreso = async (ingresoData: IngresoData) => {
    setSubmitting(true);
    try {
      // Validar datos
      if (!ingresoData.descripcion.trim() || !ingresoData.fuente.trim()) {
        throw new Error('Todos los campos son obligatorios');
      }

      const monto = parseFloat(ingresoData.monto);
      if (isNaN(monto) || monto <= 0) {
        throw new Error('El monto debe ser un número positivo');
      }

      // Crear objeto de ingreso
      const nuevoIngreso = {
        descripcion: ingresoData.descripcion.trim(),
        fuente: ingresoData.fuente.trim(),
        monto,
        fecha: ingresoData.fecha,
      };

      // Agregar ingreso usando el hook
      await agregarIngreso(nuevoIngreso);
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
  const handleAddDeuda = async (deudaData: DeudaData) => {
    setSubmitting(true);
    try {
      // Validar datos
      if (!deudaData.descripcion.trim() || !deudaData.acreedor.trim()) {
        throw new Error('Todos los campos son obligatorios');
      }

      const monto = parseFloat(deudaData.monto);
      if (isNaN(monto) || monto <= 0) {
        throw new Error('El monto debe ser un número positivo');
      }

      if (!deudaData.fechaVencimiento) {
        throw new Error('La fecha de vencimiento es obligatoria');
      }

      // Crear objeto de deuda
      const nuevaDeuda = {
        descripcion: deudaData.descripcion.trim(),
        acreedor: deudaData.acreedor.trim(),
        monto,
        fecha_vencimiento: deudaData.fechaVencimiento,
        pagada: false,
      };

      // Agregar deuda usando el hook
      await agregarDeuda(nuevaDeuda);
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
    <IngresosSection ingresos={ingresos} formatCurrency={formatCurrency} />
  );

  const deudasSection = (
    <DeudasSection deudas={deudas} formatCurrency={formatCurrency} />
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
  );
}
