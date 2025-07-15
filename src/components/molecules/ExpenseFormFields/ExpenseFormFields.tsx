/**
 * ExpenseFormFields - Molecule Level
 *
 * Campos del formulario para agregar/editar gastos.
 * Incluye todos los campos necesarios: descripción, fecha, categoría, cuenta, lugar, monto.
 *
 * @param formData - Datos del formulario
 * @param expenseCategories - Lista de categorías disponibles
 * @param accountTypes - Lista de tipos de cuenta disponibles
 * @param onFormChange - Función para manejar cambios en el formulario
 *
 * @example
 * <ExpenseFormFields
 *   formData={form}
 *   expenseCategories={EXPENSE_CATEGORIES}
 *   accountTypes={ACCOUNT_TYPES}
 *   onFormChange={handleFormChange}
 * />
 */

import React from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
}

interface ExpenseFormFieldsProps {
  formData: FormData;
  expenseCategories: string[];
  accountTypes: string[];
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
}

export default function ExpenseFormFields({
  formData,
  expenseCategories,
  accountTypes,
  onFormChange,
}: ExpenseFormFieldsProps) {
  return (
    <div className="space-y-4">
      {/* Descripción */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-white">
          Descripción *
        </Label>
        <Input
          id="description"
          name="description"
          value={formData.description}
          onChange={onFormChange}
          placeholder="Ej: Supermercado, Gasolina, etc."
          className="bg-slate-700/50 border-slate-600 text-white"
          required
        />
      </div>

      {/* Monto */}
      <div className="space-y-2">
        <Label htmlFor="amount" className="text-white">
          Monto *
        </Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.amount}
          onChange={onFormChange}
          placeholder="0.00"
          className="bg-slate-700/50 border-slate-600 text-white"
          required
        />
      </div>

      {/* Fecha */}
      <div className="space-y-2">
        <Label htmlFor="transaction_date" className="text-white">
          Fecha *
        </Label>
        <Input
          id="transaction_date"
          name="transaction_date"
          type="date"
          value={formData.transaction_date}
          onChange={onFormChange}
          className="bg-slate-700/50 border-slate-600 text-white"
          required
        />
      </div>

      {/* Categoría */}
      <div className="space-y-2">
        <Label htmlFor="category_name" className="text-white">
          Categoría *
        </Label>
        <select
          id="category_name"
          name="category_name"
          value={formData.category_name}
          onChange={onFormChange}
          className="w-full p-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {expenseCategories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Cuenta */}
      <div className="space-y-2">
        <Label htmlFor="account_name" className="text-white">
          Cuenta *
        </Label>
        <select
          id="account_name"
          name="account_name"
          value={formData.account_name}
          onChange={onFormChange}
          className="w-full p-2 bg-slate-700/50 border border-slate-600 text-white rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {accountTypes.map(account => (
            <option key={account} value={account}>
              {account}
            </option>
          ))}
        </select>
      </div>

      {/* Lugar */}
      <div className="space-y-2">
        <Label htmlFor="place" className="text-white">
          Lugar
        </Label>
        <Input
          id="place"
          name="place"
          value={formData.place}
          onChange={onFormChange}
          placeholder="Opcional: nombre del establecimiento"
          className="bg-slate-700/50 border-slate-600 text-white"
        />
      </div>
    </div>
  );
}
