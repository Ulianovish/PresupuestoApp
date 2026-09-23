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

import CurrencyInput from '@/components/atoms/CurrencyInput/CurrencyInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cuotaSugerida, esTarjetaDeCredito } from '@/lib/cuotas';

interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  place: string;
  purchase_total?: number | null;
  installments?: number | null;
}

interface ExpenseFormFieldsProps {
  formData: FormData;
  expenseCategories: string[];
  accountTypes: string[];
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onAmountChange?: (amount: number) => void;
  /** Cuentas que son tarjeta de crédito: habilitan los campos de cuotas. */
  creditAccounts?: string[];
}

export default function ExpenseFormFields({
  formData,
  expenseCategories,
  accountTypes,
  onFormChange,
  onAmountChange,
  creditAccounts = [],
}: ExpenseFormFieldsProps) {
  const esCredito = esTarjetaDeCredito(formData.account_name, creditAccounts);

  /** Emite un cambio con la misma forma que espera el formulario del padre. */
  const emitir = (name: string, value: string) => {
    onFormChange({
      target: { name, value },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  /**
   * Al cambiar el total o las cuotas se rellena el monto con la división.
   * Queda editable a propósito: el banco suele cobrar una cuota mayor por los
   * intereses, y ese valor real solo lo sabe quien mira el extracto.
   */
  const sugerirMonto = (total?: number | null, cuotas?: number | null) => {
    const sugerida = cuotaSugerida(total, cuotas);
    if (sugerida === null) return;
    if (onAmountChange) onAmountChange(sugerida);
    else emitir('amount', String(sugerida));
  };

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
        <CurrencyInput
          value={formData.amount}
          onChange={
            onAmountChange ||
            (value => {
              const syntheticEvent = {
                target: { name: 'amount', value: value.toString() },
              } as React.ChangeEvent<HTMLInputElement>;
              onFormChange(syntheticEvent);
            })
          }
          className="bg-slate-700/50 border-slate-600 text-white"
          placeholder="$0"
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

      {/* Compra a cuotas: solo aplica si se pagó con tarjeta de crédito */}
      {esCredito && (
        <div className="space-y-4 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
          <p className="text-xs text-orange-200">
            Compra con tarjeta de crédito. Si la difieres, registra el total y
            las cuotas: el monto de arriba es lo que suma este mes y el total se
            carga a la deuda de la tarjeta.
          </p>

          <div className="space-y-2">
            <Label htmlFor="purchase_total" className="text-white">
              Valor total de la compra
            </Label>
            <CurrencyInput
              value={formData.purchase_total ?? 0}
              onChange={value => {
                emitir('purchase_total', String(value));
                sugerirMonto(value, formData.installments);
              }}
              className="bg-slate-700/50 border-slate-600 text-white"
              placeholder="$0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="installments" className="text-white">
              Número de cuotas
            </Label>
            <Input
              id="installments"
              name="installments"
              type="number"
              min={1}
              inputMode="numeric"
              value={formData.installments ?? ''}
              onChange={e => {
                const cuotas = parseInt(e.target.value, 10) || 0;
                emitir('installments', String(cuotas));
                sugerirMonto(formData.purchase_total, cuotas);
              }}
              placeholder="Ej: 2"
              className="bg-slate-700/50 border-slate-600 text-white"
            />
            {cuotaSugerida(formData.purchase_total, formData.installments) !==
              null && (
              <p className="text-xs text-gray-400">
                Cuota sugerida:{' '}
                {cuotaSugerida(
                  formData.purchase_total,
                  formData.installments,
                )?.toLocaleString('es-CO', {
                  style: 'currency',
                  currency: 'COP',
                  minimumFractionDigits: 0,
                })}
                . Si el banco te cobra otra por intereses, corrige el monto.
              </p>
            )}
          </div>
        </div>
      )}

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
