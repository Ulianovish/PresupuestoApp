/**
 * Hook para gestionar pagos mensuales de una deuda
 */

import { useState, useEffect, useCallback } from 'react';

import {
  obtenerPagosDeuda,
  crearPagoDeuda,
  actualizarPagoDeuda,
  eliminarPagoDeuda,
  marcarPagoComoPagado,
  type PagoDeuda,
  type NuevoPagoDeuda,
} from '@/lib/services/pagos-deuda';

interface UsePagosDeudaReturn {
  pagos: PagoDeuda[];
  loading: boolean;
  error: string | null;
  agregarPago: (nuevoPago: NuevoPagoDeuda) => Promise<void>;
  editarPago: (id: string, datos: Partial<NuevoPagoDeuda>) => Promise<void>;
  borrarPago: (id: string) => Promise<void>;
  marcarPagado: (id: string, valorPagado: number) => Promise<void>;
  recargarPagos: () => Promise<void>;
}

export function usePagosDeuda(deudaId: string | null): UsePagosDeudaReturn {
  const [pagos, setPagos] = useState<PagoDeuda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarPagos = useCallback(async () => {
    if (!deudaId) {
      setPagos([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await obtenerPagosDeuda(deudaId);
      setPagos(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar pagos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [deudaId]);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

  const agregarPago = useCallback(async (nuevoPago: NuevoPagoDeuda) => {
    try {
      setError(null);
      const pago = await crearPagoDeuda(nuevoPago);
      setPagos(prev => [pago, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar pago';
      setError(msg);
      throw err;
    }
  }, []);

  const editarPago = useCallback(
    async (id: string, datos: Partial<NuevoPagoDeuda>) => {
      try {
        setError(null);
        const actualizado = await actualizarPagoDeuda(id, datos);
        setPagos(prev => prev.map(p => (p.id === id ? actualizado : p)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al editar pago';
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const borrarPago = useCallback(async (id: string) => {
    try {
      setError(null);
      await eliminarPagoDeuda(id);
      setPagos(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar pago';
      setError(msg);
      throw err;
    }
  }, []);

  const marcarPagado = useCallback(async (id: string, valorPagado: number) => {
    try {
      setError(null);
      const actualizado = await marcarPagoComoPagado(id, valorPagado);
      setPagos(prev => prev.map(p => (p.id === id ? actualizado : p)));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Error al marcar como pagado';
      setError(msg);
      throw err;
    }
  }, []);

  return {
    pagos,
    loading,
    error,
    agregarPago,
    editarPago,
    borrarPago,
    marcarPagado,
    recargarPagos: cargarPagos,
  };
}

export type { PagoDeuda, NuevoPagoDeuda } from '@/lib/services/pagos-deuda';
