/**
 * BudgetTable - Organism Level
 * 
 * Complex component that manages budget items with filtering, sorting, and CRUD operations.
 * Combines multiple molecules and atoms for complete budget management functionality.
 * 
 * @param items - Array of budget items
 * @param onItemUpdate - Callback when item is updated
 * @param onItemEdit - Callback when item edit is requested
 * @param loading - Whether the table is in loading state
 * @param className - Additional CSS classes
 * 
 * @example
 * <BudgetTable 
 *   items={budgetItems}
 *   onItemUpdate={(id, value) => updateBudgetItem(id, value)}
 *   onItemEdit={(id) => openEditDialog(id)}
 *   loading={isLoading}
 * />
 */
"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import BudgetItem from "@/components/molecules/BudgetItem/BudgetItem";
import { cn } from "@/lib/utils";
import { Search, Filter, SortAsc } from "lucide-react";

interface BudgetItemData {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  status: 'on-track' | 'over-budget' | 'under-budget';
}

interface BudgetTableProps {
  items: BudgetItemData[];
  onItemUpdate: (id: string, value: number) => void;
  onItemEdit: (id: string) => void;
  loading?: boolean;
  className?: string;
}

type SortOption = 'category' | 'amount' | 'spent' | 'remaining' | 'status';
type FilterStatus = 'all' | 'on-track' | 'over-budget' | 'under-budget';

export default function BudgetTable({ 
  items, 
  onItemUpdate, 
  onItemEdit, 
  loading = false,
  className = "" 
}: BudgetTableProps) {
  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('category');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // Filter and sort items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      // Search filter
      const matchesSearch = item.category.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort items
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'category':
          return a.category.localeCompare(b.category);
        case 'amount':
          return b.amount - a.amount;
        case 'spent':
          return b.spent - a.spent;
        case 'remaining':
          return b.remaining - a.remaining;
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  }, [items, searchTerm, sortBy, statusFilter]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    return {
      totalBudget: items.reduce((sum, item) => sum + item.amount, 0),
      totalSpent: items.reduce((sum, item) => sum + item.spent, 0),
      totalRemaining: items.reduce((sum, item) => sum + item.remaining, 0),
      overBudgetCount: items.filter(item => item.status === 'over-budget').length,
      onTrackCount: items.filter(item => item.status === 'on-track').length,
    };
  }, [items]);

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="animate-pulse">
          <div className="h-10 bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-32 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-600 text-white placeholder-gray-400"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
            className="px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white"
          >
            <option value="all">Todos</option>
            <option value="on-track">En curso</option>
            <option value="over-budget">Sobre presupuesto</option>
            <option value="under-budget">Bajo presupuesto</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border border-slate-600 rounded-md text-sm bg-slate-800 text-white"
          >
            <option value="category">Categoría</option>
            <option value="amount">Presupuesto</option>
            <option value="spent">Gastado</option>
            <option value="remaining">Restante</option>
            <option value="status">Estado</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-500/10 backdrop-blur-sm rounded-lg border border-blue-500/20">
          <div className="text-sm text-blue-400">Presupuesto Total</div>
          <div className="text-2xl font-bold text-blue-300">
            ${summary.totalBudget.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-green-500/10 backdrop-blur-sm rounded-lg border border-green-500/20">
          <div className="text-sm text-green-400">Gastado</div>
          <div className="text-2xl font-bold text-green-300">
            ${summary.totalSpent.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-purple-500/10 backdrop-blur-sm rounded-lg border border-purple-500/20">
          <div className="text-sm text-purple-400">Restante</div>
          <div className="text-2xl font-bold text-purple-300">
            ${summary.totalRemaining.toFixed(2)}
          </div>
        </div>
        <div className="p-4 bg-orange-500/10 backdrop-blur-sm rounded-lg border border-orange-500/20">
          <div className="text-sm text-orange-400">Sobre Presupuesto</div>
          <div className="text-2xl font-bold text-orange-300">
            {summary.overBudgetCount}
          </div>
        </div>
      </div>

      {/* Budget Items Grid */}
      {filteredAndSortedItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">
            No se encontraron elementos de presupuesto
          </div>
          <div className="text-gray-500 text-sm mt-2">
            {searchTerm ? 'Intenta con otros términos de búsqueda' : 'Agrega tu primer elemento de presupuesto'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedItems.map((item) => (
            <BudgetItem
              key={item.id}
              item={item}
              onEdit={onItemEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
} 