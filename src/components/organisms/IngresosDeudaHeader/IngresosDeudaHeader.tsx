/**
 * IngresosDeudaHeader - Organism Level Component
 *
 * Componente de encabezado para la página de ingresos y deudas.
 * Incluye título, descripción y botón de recarga.
 *
 * @param onRefresh - Función para refrescar los datos
 * @param isLoading - Estado de carga
 *
 * @example
 * <IngresosDeudaHeader
 *   onRefresh={() => console.log("refresh")}
 *   isLoading={false}
 * />
 */

import React from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface IngresosDeudaHeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
}

export default function IngresosDeudaHeader({
  onRefresh,
  isLoading,
}: IngresosDeudaHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div className="mb-4 sm:mb-0">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent mb-2">
          Ingresos y Deudas
        </h1>
        <p className="text-gray-400">
          Gestiona tus fuentes de ingresos y controla tus deudas pendientes
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button
          variant="glass"
          size="default"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>
    </div>
  );
}
