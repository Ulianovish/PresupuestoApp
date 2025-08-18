/**
 * Hook personalizado para gestionar ingresos y deudas
 *
 * Este hook maneja todo el estado y las operaciones relacionadas
 * con ingresos y deudas usando Supabase como backend.
 */

import { useState, useEffect, useCallback } from 'react';

import {
  obtenerIngresos,
  obtenerDeudas,
  crearIngreso,
  crearDeuda,
  actualizarIngreso,
  actualizarDeuda,
  eliminarIngreso,
  eliminarDeuda,
  marcarDeudaComoPagada,
  obtenerResumenFinanciero,
  inicializarDatosEjemplo,
  formatearMoneda,
  type Ingreso,
  type Deuda,
  type NuevoIngreso,
  type NuevaDeuda,
  type ResumenFinanciero,
} from '@/lib/services/ingresos-deudas';

// ============================================
// INTERFACE DEL HOOK
// ============================================

interface UseIngresosDeudasReturn {
  // Estados de datos
  ingresos: Ingreso[];
  deudas: Deuda[];
  resumen: ResumenFinanciero;

  // Estados de UI
  loading: boolean;
  error: string | null;

  // Funciones para ingresos
  agregarIngreso: (nuevoIngreso: NuevoIngreso) => Promise<void>;
  editarIngreso: (
    id: string,
    datosActualizados: Partial<NuevoIngreso>,
  ) => Promise<void>;
  eliminarIngresoById: (id: string) => Promise<void>;

  // Funciones para deudas
  agregarDeuda: (nuevaDeuda: NuevaDeuda) => Promise<void>;
  editarDeuda: (
    id: string,
    datosActualizados: Partial<NuevaDeuda> & { pagada?: boolean },
  ) => Promise<void>;
  eliminarDeudaById: (id: string) => Promise<void>;
  marcarDeudaPagada: (id: string) => Promise<void>;

  // Funciones de utilidad
  recargarDatos: () => Promise<void>;
  formatCurrency: (amount: number) => string;
}

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useIngresosDeudas(): UseIngresosDeudasReturn {
  // Estados principales
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [resumen, setResumen] = useState<ResumenFinanciero>({
    totalIngresos: 0,
    totalDeudas: 0,
    balanceNeto: 0,
    cantidadIngresos: 0,
    cantidadDeudas: 0,
    deudasPendientes: 0,
  });

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================
  // FUNCIÓN PARA CARGAR TODOS LOS DATOS
  // ============================================

  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos en paralelo para mejor rendimiento
      const [ingresosData, deudasData, resumenData] = await Promise.all([
        obtenerIngresos(),
        obtenerDeudas(),
        obtenerResumenFinanciero(),
      ]);

      setIngresos(ingresosData);
      setDeudas(deudasData);
      setResumen(resumenData);

      // console.log('Datos cargados exitosamente:', {
      //   totalIngresos,
      //   totalDeudas,
      //   ingresosCount: ingresos.length,
      //   deudasCount: deudas.length,
      // });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error desconocido';
      console.error('Error al cargar datos:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // FUNCIÓN PARA INICIALIZAR DATOS
  // ============================================

  const inicializarDatos = useCallback(async () => {
    try {
      // Primero intentar cargar datos existentes
      await cargarDatos();

      // Si no hay datos, inicializar con ejemplos
      if (ingresos.length === 0 && deudas.length === 0) {
        // console.log(
        //   'No se encontraron datos, inicializando datos de ejemplo...'
        // );
        await inicializarDatosEjemplo();
        // Recargar después de inicializar
        await cargarDatos();
      }
    } catch (err) {
      console.error('Error al inicializar datos:', err);
      // En caso de error, solo cargar datos sin ejemplos
      await cargarDatos();
    }
  }, [cargarDatos, ingresos.length, deudas.length]);

  // ============================================
  // EFECTOS
  // ============================================

  // Cargar datos al montar el componente
  useEffect(() => {
    inicializarDatos();
  }, [inicializarDatos]); // Incluir dependencia correcta

  // ============================================
  // FUNCIONES PARA MANEJAR INGRESOS
  // ============================================

  const agregarIngreso = useCallback(async (nuevoIngreso: NuevoIngreso) => {
    try {
      setLoading(true);
      setError(null);

      // Crear el nuevo ingreso en Supabase
      const ingresoCreado = await crearIngreso(nuevoIngreso);

      // Actualizar el estado local inmediatamente
      setIngresos(prevIngresos => [ingresoCreado, ...prevIngresos]);

      // Recargar el resumen para mantener consistencia
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);

      // console.log('Ingreso agregado exitosamente:', ingresoCreado);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al agregar ingreso';
      console.error('Error al agregar ingreso:', err);
      setError(errorMessage);
      throw err; // Re-lanzar para que el componente pueda manejarlo
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // FUNCIONES PARA MANEJAR DEUDAS
  // ============================================

  const agregarDeuda = useCallback(async (nuevaDeuda: NuevaDeuda) => {
    try {
      setLoading(true);
      setError(null);

      // Crear la nueva deuda en Supabase
      const deudaCreada = await crearDeuda(nuevaDeuda);

      // Actualizar el estado local inmediatamente
      setDeudas(prevDeudas => [deudaCreada, ...prevDeudas]);

      // Recargar el resumen para mantener consistencia
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);

      // console.log('Deuda agregada exitosamente:', deudaCreada);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al agregar deuda';
      console.error('Error al agregar deuda:', err);
      setError(errorMessage);
      throw err; // Re-lanzar para que el componente pueda manejarlo
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // FUNCIONES PARA EDITAR Y ELIMINAR INGRESOS
  // ============================================

  const editarIngreso = useCallback(
    async (id: string, datosActualizados: Partial<NuevoIngreso>) => {
      try {
        setLoading(true);
        setError(null);

        // Actualizar el ingreso en Supabase
        const ingresoActualizado = await actualizarIngreso(
          id,
          datosActualizados,
        );

        // Actualizar el estado local
        setIngresos(prevIngresos =>
          prevIngresos.map(ingreso =>
            ingreso.id === id ? ingresoActualizado : ingreso,
          ),
        );

        // Recargar el resumen para mantener consistencia
        const nuevoResumen = await obtenerResumenFinanciero();
        setResumen(nuevoResumen);

        console.error('Ingreso actualizado exitosamente:', ingresoActualizado);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error al actualizar ingreso';
        console.error('Error al actualizar ingreso:', err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const eliminarIngresoById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Eliminar el ingreso en Supabase (soft delete)
      await eliminarIngreso(id);

      // Actualizar el estado local removiendo el ingreso
      setIngresos(prevIngresos =>
        prevIngresos.filter(ingreso => ingreso.id !== id),
      );

      // Recargar el resumen para mantener consistencia
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);

      console.error('Ingreso eliminado exitosamente:', id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al eliminar ingreso';
      console.error('Error al eliminar ingreso:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // FUNCIONES PARA EDITAR Y ELIMINAR DEUDAS
  // ============================================

  const editarDeuda = useCallback(
    async (
      id: string,
      datosActualizados: Partial<NuevaDeuda> & { pagada?: boolean },
    ) => {
      try {
        setLoading(true);
        setError(null);

        // Actualizar la deuda en Supabase
        const deudaActualizada = await actualizarDeuda(id, datosActualizados);

        // Actualizar el estado local
        setDeudas(prevDeudas =>
          prevDeudas.map(deuda => (deuda.id === id ? deudaActualizada : deuda)),
        );

        // Recargar el resumen para mantener consistencia
        const nuevoResumen = await obtenerResumenFinanciero();
        setResumen(nuevoResumen);

        console.error('Deuda actualizada exitosamente:', deudaActualizada);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error al actualizar deuda';
        console.error('Error al actualizar deuda:', err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const eliminarDeudaById = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Eliminar la deuda en Supabase (soft delete)
      await eliminarDeuda(id);

      // Actualizar el estado local removiendo la deuda
      setDeudas(prevDeudas => prevDeudas.filter(deuda => deuda.id !== id));

      // Recargar el resumen para mantener consistencia
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);

      console.error('Deuda eliminada exitosamente:', id);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al eliminar deuda';
      console.error('Error al eliminar deuda:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const marcarDeudaPagada = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Marcar como pagada en Supabase
      const deudaActualizada = await marcarDeudaComoPagada(id);

      // Actualizar el estado local
      setDeudas(prevDeudas =>
        prevDeudas.map(deuda => (deuda.id === id ? deudaActualizada : deuda)),
      );

      // Recargar el resumen para mantener consistencia
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);

      console.error(
        'Deuda marcada como pagada exitosamente:',
        deudaActualizada,
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Error al marcar deuda como pagada';
      console.error('Error al marcar deuda como pagada:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // FUNCIONES DE UTILIDAD
  // ============================================

  const recargarDatos = useCallback(async () => {
    // console.log('Recargando datos...');
    await cargarDatos();
  }, [cargarDatos]);

  const formatCurrency = useCallback((amount: number): string => {
    return formatearMoneda(amount);
  }, []);

  // ============================================
  // RETORNO DEL HOOK
  // ============================================

  return {
    // Estados de datos
    ingresos,
    deudas,
    resumen,

    // Estados de UI
    loading,
    error,

    // Funciones para ingresos
    agregarIngreso,
    editarIngreso,
    eliminarIngresoById,

    // Funciones para deudas
    agregarDeuda,
    editarDeuda,
    eliminarDeudaById,
    marcarDeudaPagada,

    // Funciones de utilidad
    recargarDatos,
    formatCurrency,
  };
}

// ============================================
// HOOK PARA FORMATEO DE MONEDA (REUTILIZABLE)
// ============================================

/**
 * Hook simple para formatear moneda
 * Puede ser usado en otros componentes
 */
export function useFormatCurrency() {
  return useCallback((amount: number): string => {
    return formatearMoneda(amount);
  }, []);
}

// ============================================
// EXPORTACIONES ADICIONALES
// ============================================

// Re-exportar tipos para facilitar el uso
export type {
  Ingreso,
  Deuda,
  NuevoIngreso,
  NuevaDeuda,
  ResumenFinanciero,
} from '@/lib/services/ingresos-deudas';

// Exportar funciones de utilidad
export {
  formatearMoneda,
  estaProximaAVencer,
  obtenerColorMonto,
} from '@/lib/services/ingresos-deudas';
