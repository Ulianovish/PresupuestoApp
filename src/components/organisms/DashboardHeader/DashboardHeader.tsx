/**
 * DashboardHeader - Organism Level Component
 *
 * Componente que renderiza el encabezado del dashboard.
 * Incluye saludo personalizado, selector de mes y botón de refresh.
 *
 * @param greeting - Mensaje de saludo personalizado
 * @param selectedMonth - Mes seleccionado actualmente
 * @param availableMonths - Lista de meses disponibles
 * @param onMonthChange - Función para cambiar el mes
 * @param onRefresh - Función para refrescar los datos
 * @param isLoading - Estado de carga
 *
 * @example
 * <DashboardHeader
 *   greeting="🌅 Buenos días"
 *   selectedMonth="2024-01"
 *   availableMonths={[{value: "2024-01", label: "Enero 2024"}]}
 *   onMonthChange={(month) => console.log(month)}
 *   onRefresh={() => console.log("refresh")}
 *   isLoading={false}
 * />
 */

import React from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import MonthSelector from '@/components/atoms/MonthSelector/MonthSelector';

interface MonthOption {
  value: string;
  label: string;
}

interface DashboardHeaderProps {
  greeting: string;
  selectedMonth: string;
  availableMonths: MonthOption[];
  onMonthChange: (month: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export default function DashboardHeader({
  greeting,
  selectedMonth,
  availableMonths,
  onMonthChange,
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
        <MonthSelector
          value={selectedMonth}
          options={availableMonths}
          onChange={onMonthChange}
        />
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
