/**
 * ExpenseModal - Organism Level
 *
 * Modal para agregar o editar gastos.
 * Incluye formulario completo con validación y manejo de estado.
 *
 * @param isOpen - Si el modal está abierto
 * @param isEditing - Si estamos editando (vs. agregando)
 * @param formData - Datos del formulario
 * @param expenseCategories - Lista de categorías disponibles
 * @param accountTypes - Lista de tipos de cuenta disponibles
 * @param onFormChange - Función para manejar cambios en el formulario
 * @param onSubmit - Función para enviar el formulario
 * @param onClose - Función para cerrar el modal
 * @param submitDisabled - Deshabilita el botón de guardar
 * @param submitDisabledLabel - Texto del botón mientras está deshabilitado
 *
 * @example
 * <ExpenseModal
 *   isOpen={isModalOpen}
 *   isEditing={isEditing}
 *   formData={form}
 *   expenseCategories={categoryNames}
 *   accountTypes={buildAccountOptions(accountNames, form.account_name)}
 *   submitDisabled={categoryNames.length === 0}
 *   submitDisabledLabel={NO_CATEGORIES_LABEL}
 *   onFormChange={handleFormChange}
 *   onSubmit={handleSubmitExpense}
 *   onClose={handleCloseModal}
 * />
 */

import React, { useState } from 'react';

import Link from 'next/link';

import Button from '@/components/atoms/Button/Button';
import ExpenseFormFields from '@/components/molecules/ExpenseFormFields/ExpenseFormFields';
import CufeScanForm from '@/components/organisms/CufeScanForm/CufeScanForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FormData {
  description: string;
  amount: number;
  transaction_date: string;
  category_name: string;
  account_name: string;
  purchase_total?: number | null;
  installments?: number | null;
  place: string;
}

interface ExpenseModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: FormData;
  expenseCategories: string[];
  accountTypes: string[];
  onFormChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onCufeSaved?: () => void;
  /** Cuentas que son tarjeta de crédito: habilitan los campos de cuotas. */
  creditAccounts?: string[];
  /** Deshabilita el botón de guardar (p. ej. el usuario no tiene categorías). */
  submitDisabled?: boolean;
  /** Texto del botón de guardar mientras está deshabilitado. */
  submitDisabledLabel?: string;
}

export default function ExpenseModal({
  isOpen,
  isEditing,
  formData,
  expenseCategories,
  accountTypes,
  creditAccounts,
  onFormChange,
  onSubmit,
  onClose,
  onCufeSaved,
  submitDisabled = false,
  submitDisabledLabel,
}: ExpenseModalProps) {
  const [mode, setMode] = useState<'manual' | 'cufe'>('manual');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditing ? 'Editar Gasto' : 'Agregar Nuevo Gasto'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEditing
              ? 'Modifica los datos del gasto seleccionado.'
              : 'Completa la información del nuevo gasto.'}
          </DialogDescription>
        </DialogHeader>

        {!isEditing && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setMode('cufe')}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
                mode === 'cufe'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300'
              }`}
            >
              Factura (CUFE)
            </button>
          </div>
        )}

        {mode === 'cufe' && !isEditing ? (
          <CufeScanForm
            onSaved={() => {
              onCufeSaved?.();
              onClose();
            }}
          />
        ) : (
          <form onSubmit={onSubmit} className="py-4">
            {/* Campos del formulario */}
            <ExpenseFormFields
              formData={formData}
              expenseCategories={expenseCategories}
              accountTypes={accountTypes}
              creditAccounts={creditAccounts}
              onFormChange={onFormChange}
            />

            {submitDisabled && (
              <p className="pt-4 text-sm text-amber-300">
                Aún no tienes categorías para clasificar el gasto.{' '}
                <Link href="/settings" className="underline">
                  Créala en Ajustes
                </Link>
                .
              </p>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end space-x-2 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-600 text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="gradient"
                disabled={submitDisabled}
              >
                {submitDisabled && submitDisabledLabel
                  ? submitDisabledLabel
                  : `${isEditing ? 'Actualizar' : 'Agregar'} Gasto`}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
