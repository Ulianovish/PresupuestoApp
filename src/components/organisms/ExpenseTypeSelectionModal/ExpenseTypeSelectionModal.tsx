/**
 * ExpenseTypeSelectionModal - Organism Level
 *
 * Modal para seleccionar el tipo de método para agregar un gasto.
 * Presenta tres opciones: manual, desde factura, y desde QR.
 *
 * @param isOpen - Si el modal está abierto
 * @param onClose - Función para cerrar el modal
 * @param onSelectManual - Función para seleccionar entrada manual
 * @param onSelectInvoice - Función para seleccionar desde factura
 * @param onSelectQR - Función para seleccionar desde QR
 *
 * @example
 * <ExpenseTypeSelectionModal
 *   isOpen={isTypeSelectionOpen}
 *   onClose={closeTypeSelection}
 *   onSelectManual={handleSelectManual}
 *   onSelectInvoice={handleSelectInvoice}
 *   onSelectQR={handleSelectQR}
 * />
 */

import React from 'react';

import Button from '@/components/atoms/Button/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ExpenseTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onSelectInvoice: () => void;
  onSelectQR: () => void;
}

export default function ExpenseTypeSelectionModal({
  isOpen,
  onClose,
  onSelectManual,
  onSelectInvoice,
  onSelectQR,
}: ExpenseTypeSelectionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white text-center">
            ¿Cómo quieres agregar el gasto?
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-center">
            Selecciona el método que prefieras para registrar tu gasto.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-4">
          {/* Opción: Agregar Manual */}
          <button
            onClick={onSelectManual}
            className="w-full p-6 bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-all duration-200 rounded-lg group"
          >
            <div className="flex items-center space-x-4">
              {/* Ícono de entrada manual */}
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-semibold group-hover:text-blue-300 transition-colors">
                  Agregar Gasto Manual
                </h3>
                <p className="text-slate-400 text-sm">
                  Llena el formulario manualmente con los datos del gasto
                </p>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-blue-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Opción: Desde Factura */}
          <button
            onClick={onSelectInvoice}
            className="w-full p-6 bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-all duration-200 rounded-lg group"
          >
            <div className="flex items-center space-x-4">
              {/* Ícono de factura */}
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-semibold group-hover:text-emerald-300 transition-colors">
                  Agregar desde Factura
                </h3>
                <p className="text-slate-400 text-sm">
                  Sube una foto de tu factura para extraer los datos
                </p>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-emerald-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>

          {/* Opción: Desde QR */}
          <button
            onClick={onSelectQR}
            className="w-full p-6 bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-all duration-200 rounded-lg group"
          >
            <div className="flex items-center space-x-4">
              {/* Ícono de QR */}
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-white font-semibold group-hover:text-amber-300 transition-colors">
                  Agregar desde QR
                </h3>
                <p className="text-slate-400 text-sm">
                  Escanea el código QR de tu factura para importar datos
                </p>
              </div>
              <div className="flex-shrink-0">
                <svg
                  className="w-5 h-5 text-slate-400 group-hover:text-amber-300 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </button>
        </div>

        {/* Botón de cancelar */}
        <div className="flex justify-center pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
