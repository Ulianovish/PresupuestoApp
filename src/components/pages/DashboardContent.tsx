/**
 * DashboardContent - Page Level Component
 * 
 * Componente principal del dashboard que muestra:
 * - Saludo personalizado al usuario
 * - Tarjetas de resumen del presupuesto
 * - Tabla completa de elementos de presupuesto
 * - Acciones rápidas y navegación
 */
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { useBudgetData } from '@/hooks/useBudgetData';
import BudgetTable from '@/components/organisms/BudgetTable/BudgetTable';
import Button from '@/components/atoms/Button/Button';
import Card, { CardContent, CardHeader, CardTitle } from '@/components/atoms/Card/Card';
import { 
  Wallet, 
  TrendingUp, 
  PieChart, 
  Plus, 
  Edit3,
  Target,
  DollarSign 
} from 'lucide-react';

interface DashboardContentProps {
  user: User;
}

export default function DashboardContent({ user }: DashboardContentProps) {
  const { budgetItems, setBudgetItems, summary, isLoading, formatCurrency } = useBudgetData();

  // Obtener saludo según la hora
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Buenos días';
    if (hour < 18) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  // Calcular porcentaje de gasto
  const spentPercentage = summary.totalBudget > 0 
    ? (summary.totalSpent / summary.totalBudget) * 100 
    : 0;

  // Funciones para manejar actualizaciones de items
  const handleItemUpdate = (id: string, value: number) => {
    setBudgetItems(items => 
      items.map(item => 
        item.id === id 
          ? { 
              ...item, 
              spent: value,
              remaining: item.amount - value,
              status: value > item.amount ? 'over-budget' 
                     : value > item.amount * 0.8 ? 'on-track' 
                     : 'under-budget'
            }
          : item
      )
    );
  };

  const handleItemEdit = (id: string) => {
    console.log('Editando item:', id);
    // Aquí se implementaría la lógica para abrir modal de edición
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header con saludo personalizado */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            {getGreeting()}, {user.email?.split('@')[0]}
          </h1>
          <p className="text-gray-300 text-lg">
            Aquí tienes el resumen de tu presupuesto mensual
          </p>
        </div>

        {/* Tarjetas de resumen */}
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
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/20 to-green-600/10"></div>
            <CardContent className="relative">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
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
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(spentPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {spentPercentage.toFixed(1)}% del presupuesto
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
              Ver Análisis
            </Button>
          </Link>
        </div>

        {/* Tabla de presupuesto */}
        <Card variant="glass" className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-white flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Elementos del Presupuesto
            </CardTitle>
            <p className="text-gray-400 text-sm">
              Gestiona tus categorías de gastos y controla tu presupuesto mensual
            </p>
          </CardHeader>
          <CardContent className="px-0">
            <BudgetTable
              items={budgetItems}
              onItemUpdate={handleItemUpdate}
              onItemEdit={handleItemEdit}
              loading={isLoading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 