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
    category: "Alimentación",
    amount: 500,
    spent: 320,
    remaining: 180,
    status: "on-track" as const,
  },
  {
    id: "2",
    category: "Transporte",
    amount: 200,
    spent: 250,
    remaining: -50,
    status: "over-budget" as const,
  },
  {
    id: "3",
    category: "Entretenimiento",
    amount: 150,
    spent: 80,
    remaining: 70,
    status: "under-budget" as const,
  },
  {
    id: "4",
    category: "Servicios",
    amount: 300,
    spent: 280,
    remaining: 20,
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

  // Handle budget item deletion
  const handleItemDelete = (id: string) => {
    setBudgetItems(prev => prev.filter(item => item.id !== id));
  };

  // Handle budget item edit (placeholder for modal/dialog)
  const handleItemEdit = (id: string) => {
    console.log("Edit item:", id);
    // In a real app, this would open an edit dialog
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
            <span className="font-semibold text-white">$1,150.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gastado</span>
            <span className="font-semibold text-green-400">$930.00</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Restante</span>
            <span className="font-semibold text-blue-400">$220.00</span>
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
      mainContent={
        <BudgetTable
          items={budgetItems}
          onItemUpdate={handleItemUpdate}
          onItemDelete={handleItemDelete}
          onItemEdit={handleItemEdit}
          loading={isLoading}
        />
      }
      sidebar={<QuickActions />}
    />
  );
} 