/**
 * ExpenseFloatingButton - Molecule Level
 *
 * Botón flotante para agregar nuevos gastos.
 * Posicionado fijo en la esquina inferior derecha.
 *
 * @param onClick - Función para manejar el click del botón
 *
 * @example
 * <ExpenseFloatingButton
 *   onClick={openModal}
 * />
 */

import React from 'react';

interface ExpenseFloatingButtonProps {
  onClick: () => void;
}

export default function ExpenseFloatingButton({
  onClick,
}: ExpenseFloatingButtonProps) {
  return (
    <button
      className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full w-16 h-16 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
      onClick={onClick}
    >
      <svg
        className="w-8 h-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    </button>
  );
}
