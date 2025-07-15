/**
 * DashboardContent - Page Level Component
 *
 * Componente principal del dashboard refactorizado para usar Template y Organisms.
 * Ahora se enfoca en la orquestación de datos y lógica de negocio,
 * mientras delega la presentación al Template y Organisms.
 *
 * Estructura refactorizada:
 * - Hook de datos (useDashboardData)
 * - Funciones de negocio (formateo, saludos, handlers)
 * - Renderizado usando DashboardPageTemplate
 */
'use client';

import React, { useMemo } from 'react';

import { RefreshCw } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import DashboardHeader from '@/components/organisms/DashboardHeader/DashboardHeader';
import DashboardMainContent from '@/components/organisms/DashboardMainContent/DashboardMainContent';
import DashboardQuickActions from '@/components/organisms/DashboardQuickActions/DashboardQuickActions';
import DashboardSummaryCards from '@/components/organisms/DashboardSummaryCards/DashboardSummaryCards';
import DashboardPageTemplate from '@/components/templates/DashboardPageTemplate/DashboardPageTemplate';
import { useDashboardData } from '@/hooks/useDashboardData';
import { BudgetCategory } from '@/lib/services/budget';

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

interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({
  user: _user,
}: DashboardContentProps) {
  // Usar el hook personalizado para obtener datos integrados
  const {
    summary,
    budgetData,
    isLoading,
    error,
    selectedMonth,
    availableMonths,
    setSelectedMonth,
    refreshData,
  } = useDashboardData();

  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Obtener saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Buenos días';
    if (hour < 18) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  // Convertir categorías de presupuesto a resumen consolidado por categoría
  const budgetItems = useMemo(() => {
    if (!budgetData?.categories) return [];

    return budgetData.categories.map((category: BudgetCategory) => {
      // Consolidar totales por categoría
      const totalPresupuestado = category.totalPresupuestado;
      const totalReal = category.totalReal;
      const totalRemaining = totalPresupuestado - totalReal;

      // Determinar estado basado en el total de la categoría
      let status: 'on-track' | 'over-budget' | 'under-budget';
      if (totalReal > totalPresupuestado) {
        status = 'over-budget';
      } else if (totalReal > totalPresupuestado * 0.8) {
        status = 'on-track';
      } else {
        status = 'under-budget';
      }

      return {
        id: category.nombre,
        description: category.nombre,
        amount: totalPresupuestado,
        real: totalReal,
        remaining: totalRemaining,
        status,
        category: category.nombre,
      };
    });
  }, [budgetData]);

  // Handlers para acciones
  const handleItemUpdate = (id: string, value: number) => {
    console.error('Actualizando item:', id, 'con valor:', value);
  };

  const handleItemEdit = (id: string) => {
    console.error('Editando item:', id);
  };

  // Componentes para el template
  const greeting = getGreeting();

  const header = (
    <DashboardHeader
      greeting={greeting}
      selectedMonth={selectedMonth}
      availableMonths={availableMonths}
      onMonthChange={setSelectedMonth}
      onRefresh={refreshData}
      isLoading={isLoading}
    />
  );

  const summaryCards = (
    <DashboardSummaryCards
      summary={summary}
      isLoading={isLoading}
      formatCurrency={formatCurrency}
    />
  );

  const quickActions = <DashboardQuickActions />;

  const mainContent = (
    <DashboardMainContent
      budgetItems={budgetItems}
      budgetData={budgetData}
      isLoading={isLoading}
      onItemUpdate={handleItemUpdate}
      onItemEdit={handleItemEdit}
    />
  );

  const refreshButton = (
    <Button
      variant="glass"
      size="default"
      onClick={refreshData}
      disabled={isLoading}
      className="flex items-center gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      Reintentar
    </Button>
  );

  // Renderizar usando el template
  return (
    <DashboardPageTemplate
      greeting=""
      monthSelector={header}
      summaryCards={summaryCards}
      quickActions={quickActions}
      mainContent={mainContent}
      refreshButton={refreshButton}
      isLoading={isLoading}
      error={error}
    />
  );
}
