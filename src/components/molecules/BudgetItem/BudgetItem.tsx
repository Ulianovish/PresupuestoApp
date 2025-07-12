/**
 * BudgetItem - Molecule Level
 * 
 * Displays a single budget item with amount, category, and edit functionality.
 * Combines Card, Button, and Badge atoms.
 * 
 * @param item - Budget item data
 * @param onEdit - Callback when edit button is clicked
 * @param className - Additional CSS classes
 * 
 * @example
 * <BudgetItem 
 *   item={budgetItem}
 *   onEdit={() => handleEdit(item.id)}
 * />
 */
"use client";

import { Badge } from "@/components/ui/badge";
import Button from "@/components/atoms/Button/Button";
import Card, { CardContent, CardHeader, CardTitle } from "@/components/atoms/Card/Card";
import { cn } from "@/lib/utils";
import { Edit } from "lucide-react";

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
  className?: string;
}

export default function BudgetItem({ 
  item, 
  onEdit, 
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
        {/* Badge and edit button container */}
        <div className="flex items-center gap-2">
          <Badge variant={getStatusVariant()}>
            {item.status.replace('-', ' ')}
          </Badge>
          {/* Edit button icon */}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => onEdit(item.id)}
            className="p-1 h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
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
      </CardContent>
    </Card>
  );
} 