/**
 * BudgetPage - Page Level
 * 
 * Specific instance of BudgetPageLayout with real data and functionality.
 * Handles data fetching, state management, and user interactions.
 * 
 * This page demonstrates the complete Atomic Design hierarchy:
 * - Atoms: CurrencyInput, Button, Card
 * - Molecules: FormField, BudgetItem
 * - Organisms: BudgetTable
 * - Templates: BudgetPageLayout
 * - Pages: This component
 */
"use client";

import { useState } from "react";
import BudgetPageLayout from "@/components/templates/BudgetPageLayout/BudgetPageLayout";
import BudgetTable from "@/components/organisms/BudgetTable/BudgetTable";
import FormField from "@/components/molecules/FormField/FormField";
import CurrencyInput from "@/components/atoms/CurrencyInput/CurrencyInput";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { Plus, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

// Mock data for demonstration
const mockBudgetItems = [
  {
    id: "1",
    category: "Vivienda",
    amount: 7904114,
    spent: 8009845,
    remaining: -105731,
    status: "over-budget" as const,
  },
  {
    id: "2",
    category: "Deudas",
    amount: 6337850,
    spent: 9887850,
    remaining: -3550000,
    status: "over-budget" as const,
  },
  {
    id: "3",
    category: "Transporte",
    amount: 875000,
    spent: 719910,
    remaining: 155090,
    status: "on-track" as const,
  },
  {
    id: "4",
    category: "Mercado",
    amount: 1210000,
    spent: 312507,
    remaining: 897493,
    status: "under-budget" as const,
  },
  {
    id: "5",
    category: "Salud",
    amount: 729000,
    spent: 25735,
    remaining: 703265,
    status: "under-budget" as const,
  },
  {
    id: "6",
    category: "Alice",
    amount: 2305323,
    spent: 0,
    remaining: 2305323,
    status: "under-budget" as const,
  },
  {
    id: "7",
    category: "Gastos Personales",
    amount: 250000,
    spent: 157446,
    remaining: 92554,
    status: "on-track" as const,
  },
  {
    id: "8",
    category: "Comunicaciones",
    amount: 46751,
    spent: 0,
    remaining: 46751,
    status: "under-budget" as const,
  },
  {
    id: "9",
    category: "Educación",
    amount: 379000,
    spent: 0,
    remaining: 379000,
    status: "under-budget" as const,
  },
  {
    id: "10",
    category: "Mascotas",
    amount: 62000,
    spent: 0,
    remaining: 62000,
    status: "under-budget" as const,
  },
  {
    id: "11",
    category: "Ahorros",
    amount: 5000000,
    spent: 0,
    remaining: 5000000,
    status: "under-budget" as const,
  },
  {
    id: "12",
    category: "Impuestos",
    amount: 0,
    spent: 0,
    remaining: 0,
    status: "on-track" as const,
  },
];

export default function DashboardPage() {
  const [budgetItems, setBudgetItems] = useState(mockBudgetItems);
  const [isLoading, setIsLoading] = useState(false);

  // Handle budget item updates
  const handleItemUpdate = (id: string, newAmount: number) => {
    setBudgetItems(prev => 
      prev.map(item => 
        item.id === id 
          ? { ...item, amount: newAmount, remaining: newAmount - item.spent }
          : item
      )
    );
  };

  // Handle budget item deletion (removed - no longer needed)
  // const handleItemDelete = (id: string) => {
  //   setBudgetItems(prev => prev.filter(item => item.id !== id));
  // };

  // Handle budget item edit (placeholder for modal/dialog)
  const handleItemEdit = (id: string) => {
    console.log("Edit item:", id);
    // In a real app, this would open an edit dialog
  };

  // Función para formatear moneda consistente con otras páginas
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Header component
  const PageHeader = () => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu presupuesto y controla tus gastos
        </p>
      </div>
      <Button variant="gradient" size="lg">
        <Plus className="w-4 h-4 mr-2" />
        Agregar Categoría
      </Button>
    </div>
  );

  // Quick Stats calculation
  const totalBudget = budgetItems.reduce((sum, item) => sum + item.amount, 0);
  const totalSpent = budgetItems.reduce((sum, item) => sum + item.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  // Sidebar component with quick actions
  const QuickActions = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <Card variant="glass" className="p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg text-white">Resumen Rápido</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Presupuesto</span>
            <span className="font-semibold text-white">{formatCurrency(totalBudget)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gastado</span>
            <span className="font-semibold text-green-400">{formatCurrency(totalSpent)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Restante</span>
            <span className={`font-semibold ${totalRemaining >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
              {formatCurrency(totalRemaining)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card variant="glass" className="p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg text-white">Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-2">
          <Button variant="outline" size="sm" className="w-full justify-start text-white border-gray-600 hover:bg-gray-700">
            <TrendingUp className="w-4 h-4 mr-2" />
            Ver Reportes
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-white border-gray-600 hover:bg-gray-700">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Alertas
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start text-white border-gray-600 hover:bg-gray-700">
            <CheckCircle className="w-4 h-4 mr-2" />
            Metas
          </Button>
        </CardContent>
      </Card>

      {/* Quick Add Form */}
      <Card variant="glass" className="p-4">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg text-white">Agregar Gasto</CardTitle>
        </CardHeader>
        <CardContent className="p-0 space-y-3">
          <FormField label="Categoría" required>
            <input 
              type="text" 
              placeholder="Ej: Comida"
              className="w-full px-3 py-2 border border-gray-600 rounded-md text-sm bg-gray-800 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20"
            />
          </FormField>
          <FormField label="Monto" required>
            <CurrencyInput 
              value={0}
              onChange={() => {}}
              placeholder="0.00"
            />
          </FormField>
          <Button variant="gradient" size="sm" className="w-full">
            Agregar
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <BudgetPageLayout
      header={<PageHeader />}
      mainContent={
        <BudgetTable
          items={budgetItems}
          onItemUpdate={handleItemUpdate}
          onItemEdit={handleItemEdit}
          loading={isLoading}
        />
      }
      sidebar={<QuickActions />}
    />
  );
} 