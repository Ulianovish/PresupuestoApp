/**
 * DashboardContent - Page Level Component
 * 
 * Componente principal del dashboard que muestra:
 * - Saludo personalizado al usuario
 * - Selector de mes para dashboard mensual
 * - Tarjetas de resumen del presupuesto con datos reales
 * - Tabla completa de elementos de presupuesto
 * - Acciones rápidas y navegación
 */
"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { useDashboardData } from '@/hooks/useDashboardData';
import { BudgetCategory, BudgetItem } from '@/lib/services/budget';
import BudgetTable from '@/components/organisms/BudgetTable/BudgetTable';
import MonthSelector from '@/components/atoms/MonthSelector/MonthSelector';
import Button from '@/components/atoms/Button/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/atoms/Card/Card';
import { 
  Wallet, 
  TrendingUp, 
  PieChart, 
  Plus, 
  Edit3,
  Target,
  DollarSign,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({ user }: DashboardContentProps) {
  // Usar el hook personalizado para obtener datos integrados
  const {
    summary,
    budgetData,
    isLoading,
    error,
    selectedMonth,
    availableMonths,
    setSelectedMonth,
    refreshData
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

  // Obtener nombre del mes actual
  const getCurrentMonthName = () => {
    const selectedOption = availableMonths.find(m => m.value === selectedMonth);
    return selectedOption?.label || 'Mes actual';
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
        id: category.id,
        category: category.nombre,
        amount: totalPresupuestado,
        spent: totalReal,
        remaining: totalRemaining,
        status
      };
    });
  }, [budgetData?.categories]);

  // Funciones para manejar actualizaciones de items (para mantener compatibilidad)
  const handleItemUpdate = (id: string, value: number) => {
    console.log('Actualizando item:', id, 'con valor:', value);
    // En una implementación completa, aquí se actualizaría la base de datos
  };

  const handleItemEdit = (id: string) => {
    console.log('Editando item:', id);
    // Aquí se implementaría la lógica para abrir modal de edición
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card variant="glass" className="p-8 max-w-md">
          <div className="text-center text-red-400">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error al cargar datos</h2>
            <p className="text-gray-300 mb-4">{error}</p>
            <Button onClick={refreshData} variant="gradient">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header con saludo personalizado y selector de mes */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
              {getGreeting()}, {user.email?.split('@')[0]}
            </h1>
            <p className="text-gray-300 text-lg">
              Resumen financiero de {getCurrentMonthName()}
            </p>
          </div>
          
          {/* Controles de mes y actualización */}
          <div className="flex flex-wrap gap-4 items-center">
            <MonthSelector
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={availableMonths}
              disabled={isLoading}
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={isLoading}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Tarjetas de resumen con datos reales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Presupuesto Total */}
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-600/10"></div>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-500/20 rounded-lg">
                  <Wallet className="w-6 h-6 text-blue-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Presupuesto Total</p>
                  <p className="text-2xl font-bold text-white">
                    {isLoading ? "..." : formatCurrency(summary.totalBudget)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Gastado */}
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-600/10"></div>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-red-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Total Gastado</p>
                  <p className="text-2xl font-bold text-white">
                    {isLoading ? "..." : formatCurrency(summary.totalSpent)}
                  </p>
                </div>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    summary.spentPercentage > 100 ? 'bg-red-500' : 
                    summary.spentPercentage > 80 ? 'bg-amber-500' : 
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(summary.spentPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {summary.spentPercentage.toFixed(1)}% del presupuesto
              </p>
            </CardContent>
          </Card>

          {/* Disponible */}
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-purple-600/10"></div>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-500/20 rounded-lg">
                  <DollarSign className="w-6 h-6 text-purple-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Disponible</p>
                  <p className={`text-2xl font-bold ${summary.totalRemaining < 0 ? 'text-red-400' : 'text-white'}`}>
                    {isLoading ? "..." : formatCurrency(summary.totalRemaining)}
                  </p>
                </div>
              </div>
              {summary.overBudgetCount > 0 && (
                <div className="flex items-center text-xs text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {summary.overBudgetCount} categorías excedidas
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ingresos Totales */}
          <Card variant="glass" className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-green-600/10"></div>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-emerald-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">Ingresos Totales</p>
                  <p className="text-2xl font-bold text-white">
                    {isLoading ? "..." : formatCurrency(summary.totalIncome)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                Balance: {formatCurrency(summary.totalIncome - summary.totalSpent)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Acciones rápidas */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Button variant="gradient" size="lg" className="flex-1">
            <Plus className="w-5 h-5 mr-2" />
            Agregar Gasto
          </Button>
          <Link href="/presupuesto" className="flex-1">
            <Button variant="glass" size="lg" className="w-full">
              <Edit3 className="w-5 h-5 mr-2" />
              Editar Presupuesto
            </Button>
          </Link>
          <Link href="/gastos" className="flex-1">
            <Button variant="outline" size="lg" className="w-full text-white border-slate-600 hover:bg-slate-700">
              <PieChart className="w-5 h-5 mr-2" />
              Ver Gastos
            </Button>
          </Link>
        </div>

        {/* Tabla de presupuesto con datos reales */}
        <Card variant="glass" className="p-6">

          <CardContent className="px-0">
            {/* Mostrar mensaje si no hay datos de presupuesto */}
            {!isLoading && (!budgetData || !budgetData.categories || budgetData.categories.length === 0) ? (
              <div className="text-center py-8">
                <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-300 mb-2">
                  No hay presupuesto para este mes
                </h3>
                <p className="text-gray-400 mb-4">
                  Crea tu presupuesto mensual para comenzar a gestionar tus finanzas
                </p>
                <Link href="/presupuesto">
                  <Button variant="gradient">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Presupuesto
                  </Button>
                </Link>
              </div>
            ) : (
              <BudgetTable
                items={budgetItems}
                onItemUpdate={handleItemUpdate}
                onItemEdit={handleItemEdit}
                loading={isLoading}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 