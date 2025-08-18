/**
 * FloatingActionButtons - Molecule Level Component
 *
 * Botones de acción flotantes para agregar ingresos y deudas rápidamente.
 * Se posicionan de manera fija en la pantalla para acceso rápido.
 *
 * Características:
 * - Posicionamiento fijo en la esquina inferior derecha
 * - Animaciones suaves de hover y aparición
 * - Diseño responsivo (se adapta a móvil)
 * - Iconos claros y colores diferenciados
 *
 * @param onAddIngreso - Callback para abrir modal de agregar ingreso
 * @param onAddDeuda - Callback para abrir modal de agregar deuda
 * @param className - Clases CSS adicionales
 *
 * @example
 * <FloatingActionButtons
 *   onAddIngreso={() => setModalIngresoOpen(true)}
 *   onAddDeuda={() => setModalDeudaOpen(true)}
 * />
 */

import React from 'react';

import { TrendingUp, CreditCard } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface FloatingActionButtonsProps {
  onAddIngreso: () => void;
  onAddDeuda: () => void;
  className?: string;
}

export default function FloatingActionButtons({
  onAddIngreso,
  onAddDeuda,
  className = '',
}: FloatingActionButtonsProps) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex flex-col gap-3 ${className}`}
    >
      {/* Botón flotante para agregar ingreso */}
      <Button
        variant="gradient"
        size="default"
        onClick={onAddIngreso}
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group"
        title="Agregar Ingreso"
      >
        <TrendingUp className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
      </Button>

      {/* Botón flotante para agregar deuda */}
      <Button
        variant="glass"
        size="default"
        onClick={onAddDeuda}
        className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 group border-2 border-orange-400/30 hover:border-orange-400/60"
        title="Agregar Deuda"
      >
        <CreditCard className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform duration-200" />
      </Button>

      {/* Botón principal expandible (opcional - comentado por ahora) */}
      {/*
      <div className="relative">
        <Button
          variant="gradient"
          size="default"
          className="h-16 w-16 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
        >
          <Plus className="w-8 h-8" />
        </Button>
      </div>
      */}
    </div>
  );
}
