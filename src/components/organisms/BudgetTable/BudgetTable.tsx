/**
 * BudgetTable - Organism Level
 *
 * Tabla principal del presupuesto que muestra categorías y sus items.
 * Incluye funcionalidad de expandir/contraer categorías y editar items.
 *
 * @param categories - Lista de categorías con sus items
 * @param budgetData - Datos del presupuesto (totales)
 * @param onToggleCategory - Función para expandir/contraer categorías
 * @param onAddItem - Función para agregar un item a una categoría
 * @param onEditItem - Función para editar un item
 * @param formatCurrency - Función para formatear moneda
 * @param getClasificacionColor - Función para obtener color de clasificación
 * @param getControlColor - Función para obtener color de control
 *
 * @example
 * <BudgetTable
 *   categories={categories}
 *   budgetData={budgetData}
 *   onToggleCategory={toggleCategory}
 *   onAddItem={openAddModal}
 *   onEditItem={openEditModal}
 *   formatCurrency={formatCurrency}
 *   getClasificacionColor={getClasificacionColor}
 *   getControlColor={getControlColor}
 * />
 */

import React from 'react';

import AddCategoryButton from '@/components/atoms/AddCategoryButton/AddCategoryButton';
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/atoms/Card/Card';
import BudgetCategoryRow from '@/components/molecules/BudgetCategoryRow/BudgetCategoryRow';
import BudgetItemRow from '@/components/molecules/BudgetItemRow/BudgetItemRow';

interface BudgetItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
  deuda_id?: string | null;
}

interface BudgetCategory {
  id: string;
  nombre: string;
  expanded: boolean;
  totalPresupuestado: number;
  totalReal: number;
  items: BudgetItem[];
}

interface BudgetData {
  total_presupuestado: number;
  total_real: number;
}

interface LookupItem {
  id: string;
  name: string;
}

interface BudgetTableProps {
  categories: BudgetCategory[];
  budgetData: BudgetData | null;
  onToggleCategory: (categoryId: string) => void;
  onAddItem: (categoryId: string) => void;
  onEditItem: (categoryId: string, item: BudgetItem) => void;
  onDeleteCategory: (categoryId: string) => void;
  onDeleteItem?: (itemId: string) => void;
  onAddCategory?: () => void;
  onInlineUpdate?: (
    itemId: string,
    updates: Partial<{ clasificacion: string; control: string }>,
  ) => Promise<void>;
  classifications?: LookupItem[];
  controls?: LookupItem[];
  isLoading?: boolean;
  formatCurrency: (amount: number) => string;
  getClasificacionColor: (clasificacion: string) => string;
  getControlColor: (control: string) => string;
}

export default function BudgetTable({
  categories,
  budgetData,
  onToggleCategory,
  onAddItem,
  onEditItem,
  onDeleteCategory,
  onDeleteItem,
  onAddCategory,
  onInlineUpdate,
  classifications,
  controls,
  isLoading,
  formatCurrency,
  getClasificacionColor,
  getControlColor,
}: BudgetTableProps) {
  return (
    <Card variant="glass" className="p-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Categorías de Presupuesto</span>
            {onAddCategory && (
              <AddCategoryButton onClick={onAddCategory} loading={isLoading} />
            )}
          </div>
          <div className="text-sm text-gray-400">
            Total: {formatCurrency(budgetData?.total_presupuestado || 0)} /{' '}
            {formatCurrency(budgetData?.total_real || 0)}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1">
            {/* Cabecera de la tabla */}
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Clasificación
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Control
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Presupuestado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Real
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Acción
                </th>
              </tr>
            </thead>

            {/* Cuerpo de la tabla */}
            <tbody className="divide-y divide-white/10">
              {categories.map(categoria => (
                <React.Fragment key={categoria.id}>
                  {/* Fila de categoría */}
                  <BudgetCategoryRow
                    category={categoria}
                    onToggle={onToggleCategory}
                    onAddItem={onAddItem}
                    onDeleteCategory={onDeleteCategory}
                    formatCurrency={formatCurrency}
                  />

                  {/* Items de la categoría (solo si está expandida) */}
                  {categoria.expanded &&
                    categoria.items.map(item => (
                      <BudgetItemRow
                        key={item.id}
                        item={item}
                        categoryId={categoria.id}
                        onEdit={onEditItem}
                        onDelete={onDeleteItem}
                        onInlineUpdate={onInlineUpdate}
                        classifications={classifications}
                        controls={controls}
                        formatCurrency={formatCurrency}
                        getClasificacionColor={getClasificacionColor}
                        getControlColor={getControlColor}
                      />
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
