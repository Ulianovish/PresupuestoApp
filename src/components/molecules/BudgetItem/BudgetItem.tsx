/**
 * BudgetItem - Molecule Level
 * 
 * Displays a single budget item with amount, category, and edit functionality.
 * Combines Card, Button, and Badge atoms.
 * 
 * @param item - Budget item data
 * @param onEdit - Callback when edit button is clicked
 * @param onDelete - Callback when delete button is clicked
 * @param className - Additional CSS classes
 * 
 * @example
 * <BudgetItem 
 *   item={budgetItem}
 *   onEdit={() => handleEdit(item.id)}
 *   onDelete={() => handleDelete(item.id)}
 * />
 */
"use client";

import { Badge } from "@/components/ui/badge";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { cn } from "@/lib/utils";
import { Edit, Trash2 } from "lucide-react";

interface BudgetItemData {
  id: string;
  category: string;
  amount: number;
  spent: number;
  remaining: number;
  status: 'on-track' | 'over-budget' | 'under-budget';
}

interface BudgetItemProps {
  item: BudgetItemData;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export default function BudgetItem({ 
  item, 
  onEdit, 
  onDelete, 
  className = "" 
}: BudgetItemProps) {
  // Calculate percentage spent
  const percentageSpent = item.amount > 0 ? (item.spent / item.amount) * 100 : 0;
  
  // Determine status badge variant
  const getStatusVariant = () => {
    switch (item.status) {
      case 'over-budget':
        return 'destructive';
      case 'under-budget':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Card variant="glass" hover className={cn("p-4", className)}>
      <CardHeader className="flex flex-row items-center justify-between p-0 pb-3">
        <CardTitle className="text-lg font-semibold text-white">
          {item.category}
        </CardTitle>
        <Badge variant={getStatusVariant()}>
          {item.status.replace('-', ' ')}
        </Badge>
      </CardHeader>
      
      <CardContent className="p-0 space-y-3">
        {/* Amount display */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Budget</span>
          <span className="text-lg font-bold text-white">${item.amount.toFixed(2)}</span>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spent: ${item.spent.toFixed(2)}</span>
            <span className="text-muted-foreground">{percentageSpent.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                percentageSpent > 100 ? "bg-red-500" : "bg-blue-500"
              )}
              style={{ width: `${Math.min(percentageSpent, 100)}%` }}
            />
          </div>
        </div>
        
        {/* Remaining amount */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Remaining</span>
          <span className={cn(
            "font-semibold",
            item.remaining < 0 ? "text-red-400" : "text-green-400"
          )}>
            ${item.remaining.toFixed(2)}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit(item.id)}
            className="flex-1 text-white border-slate-600 hover:bg-slate-700"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDelete(item.id)}
            className="text-red-400 hover:text-red-300 border-red-600 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 