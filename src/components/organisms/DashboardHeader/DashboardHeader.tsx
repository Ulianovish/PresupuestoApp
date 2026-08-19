/**
 * DashboardHeader - Organism Level Component
 *
 * Componente que renderiza el encabezado del dashboard.
 * Incluye saludo personalizado, selector de mes y botón de refresh.
 *
 * @param greeting - Mensaje de saludo personalizado
 * @param onRefresh - Función para refrescar los datos
 * @param isLoading - Estado de carga
 *
 * @example
 * <DashboardHeader
 *   greeting="🌅 Buenos días"
 *   onRefresh={() => console.log("refresh")}
 *   isLoading={false}
 * />
 */

import React from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface DashboardHeaderProps {
  greeting: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function DashboardHeader({
  greeting,
  onRefresh,
  isLoading,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div className="mb-4 sm:mb-0">
        <h1 className="text-3xl font-bold text-white mb-2">{greeting}</h1>
        <p className="text-gray-400">
          Gestiona tu presupuesto mensual y controla tus finanzas
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
          Refresh
        </Button>
      </div>
    </div>
  );
}
