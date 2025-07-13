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

import BudgetItem from "@/components/molecules/BudgetItem/BudgetItem";
import { cn } from "@/lib/utils";

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



export default function BudgetTable({ 
  items, 
  onItemUpdate, 
  onItemEdit, 
  loading = false,
  className = "" 
}: BudgetTableProps) {


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
      {/* Budget Items Grid - Solo los widgets de categorías */}
      {items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">
            No se encontraron elementos de presupuesto
          </div>
          <div className="text-gray-500 text-sm mt-2">
            Agrega tu primer elemento de presupuesto
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
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