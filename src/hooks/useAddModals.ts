/**
 * Hook personalizado para manejar modales de agregar ingresos y deudas
 *
 * Este hook centraliza la lógica de estado de los modales y formularios
 * para agregar nuevos ingresos y deudas, permitiendo reutilización
 * entre diferentes componentes como botones flotantes y botones normales.
 */

import { useState } from 'react';

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

interface UseAddModalsReturn {
  // Estados de modales
  modalIngresoAbierto: boolean;
  modalDeudaAbierto: boolean;

  // Funciones para controlar modales
  abrirModalIngreso: () => void;
  cerrarModalIngreso: () => void;
  abrirModalDeuda: () => void;
  cerrarModalDeuda: () => void;

  // Estados de formularios
  nuevoIngreso: IngresoData;
  nuevaDeuda: DeudaData;

  // Funciones para actualizar formularios
  actualizarIngreso: (campo: keyof IngresoData, valor: string) => void;
  actualizarDeuda: (campo: keyof DeudaData, valor: string) => void;

  // Funciones para resetear formularios
  resetearFormularioIngreso: () => void;
  resetearFormularioDeuda: () => void;
}

export function useAddModals(): UseAddModalsReturn {
  // Estados para modales
  const [modalIngresoAbierto, setModalIngresoAbierto] = useState(false);
  const [modalDeudaAbierto, setModalDeudaAbierto] = useState(false);

  // Estados iniciales para formularios
  const estadoInicialIngreso: IngresoData = {
    descripcion: '',
    fuente: '',
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
  };

  const estadoInicialDeuda: DeudaData = {
    descripcion: '',
    acreedor: '',
    monto: '',
    fechaVencimiento: '',
  };

  // Estados para formularios
  const [nuevoIngreso, setNuevoIngreso] =
    useState<IngresoData>(estadoInicialIngreso);
  const [nuevaDeuda, setNuevaDeuda] = useState<DeudaData>(estadoInicialDeuda);

  // Funciones para controlar modales de ingreso
  const abrirModalIngreso = () => setModalIngresoAbierto(true);
  const cerrarModalIngreso = () => {
    setModalIngresoAbierto(false);
    resetearFormularioIngreso();
  };

  // Funciones para controlar modales de deuda
  const abrirModalDeuda = () => setModalDeudaAbierto(true);
  const cerrarModalDeuda = () => {
    setModalDeudaAbierto(false);
    resetearFormularioDeuda();
  };

  // Funciones para actualizar formularios
  const actualizarIngreso = (campo: keyof IngresoData, valor: string) => {
    setNuevoIngreso(prev => ({ ...prev, [campo]: valor }));
  };

  const actualizarDeuda = (campo: keyof DeudaData, valor: string) => {
    setNuevaDeuda(prev => ({ ...prev, [campo]: valor }));
  };

  // Funciones para resetear formularios
  const resetearFormularioIngreso = () => {
    setNuevoIngreso(estadoInicialIngreso);
  };

  const resetearFormularioDeuda = () => {
    setNuevaDeuda(estadoInicialDeuda);
  };

  return {
    // Estados de modales
    modalIngresoAbierto,
    modalDeudaAbierto,

    // Funciones para controlar modales
    abrirModalIngreso,
    cerrarModalIngreso,
    abrirModalDeuda,
    cerrarModalDeuda,

    // Estados de formularios
    nuevoIngreso,
    nuevaDeuda,

    // Funciones para actualizar formularios
    actualizarIngreso,
    actualizarDeuda,

    // Funciones para resetear formularios
    resetearFormularioIngreso,
    resetearFormularioDeuda,
  };
}

// Exportar tipos para uso en otros componentes
export type { IngresoData, DeudaData };
