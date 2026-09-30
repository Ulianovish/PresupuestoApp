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
  actualizarDeuda,
  eliminarDeuda,
  obtenerResumenFinanciero,
  formatearMoneda,
  type Ingreso,
  type Deuda,
  type NuevoIngreso,
  type NuevaDeuda,
  type ResumenFinanciero,
} from '@/lib/services/ingresos-deudas';

// ============================================
// CARGA (sin efectos secundarios)
// ============================================

/**
 * Lee ingresos, deudas y el resumen del usuario autenticado. Solo lee:
 * un usuario sin datos se queda sin datos (nunca se le siembra nada).
 */
export async function cargarIngresosDeudas(): Promise<{
  ingresos: Ingreso[];
  deudas: Deuda[];
  resumen: ResumenFinanciero;
}> {
  const [ingresos, deudas, resumen] = await Promise.all([
    obtenerIngresos(),
    obtenerDeudas(),
    obtenerResumenFinanciero(),
  ]);
  return { ingresos, deudas, resumen };
}

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

  // Funciones para deudas
  agregarDeuda: (nuevaDeuda: NuevaDeuda) => Promise<Deuda>;
  editarDeuda: (
    id: string,
    datos: Partial<NuevaDeuda> & { pagada?: boolean },
  ) => Promise<void>;
  borrarDeuda: (id: string) => Promise<void>;

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

      const {
        ingresos: ingresosData,
        deudas: deudasData,
        resumen: resumenData,
      } = await cargarIngresosDeudas();

      setIngresos(ingresosData);
      setDeudas(deudasData);
      setResumen(resumenData);
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
  // EFECTOS
  // ============================================

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

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

      return deudaCreada;
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

  const editarDeudaHandler = useCallback(
    async (id: string, datos: Partial<NuevaDeuda> & { pagada?: boolean }) => {
      try {
        setError(null);
        await actualizarDeuda(id, datos);
        await cargarDatos();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Error al editar deuda';
        setError(errorMessage);
        throw err;
      }
    },
    [cargarDatos],
  );

  const borrarDeudaHandler = useCallback(async (id: string) => {
    try {
      setError(null);
      await eliminarDeuda(id);
      setDeudas(prev => prev.filter(d => d.id !== id));
      const nuevoResumen = await obtenerResumenFinanciero();
      setResumen(nuevoResumen);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error al eliminar deuda';
      setError(errorMessage);
      throw err;
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

    // Funciones para deudas
    agregarDeuda,
    editarDeuda: editarDeudaHandler,
    borrarDeuda: borrarDeudaHandler,

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
