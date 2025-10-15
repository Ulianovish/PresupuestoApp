/**
 * QuickAddButtons - Molecule Level Component
 *
 * Botones de acceso rápido para agregar elementos en cada sección.
 * Se muestran en el header de cada sección para acceso directo.
 *
 * Características:
 * - Diseño compacto para headers de sección
 * - Iconos claros y tooltips informativos
 * - Colores que coinciden con el tema de cada sección
 * - Animaciones sutiles de hover
 *
 * @param onAction - Callback para la acción del botón
 * @param type - Tipo de botón ('ingreso' o 'deuda')
 * @param className - Clases CSS adicionales
 *
 * @example
 * <QuickAddButtons
 *   onAction={() => setModalOpen(true)}
 *   type="ingreso"
 * />
 */

import React from 'react';

import { Plus, TrendingUp, CreditCard } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';

interface QuickAddButtonsProps {
  onAction: () => void;
  type: 'ingreso' | 'deuda';
  className?: string;
}

export default function QuickAddButtons({
  onAction,
  type,
  className = '',
}: QuickAddButtonsProps) {
  // Configuración específica para cada tipo
  const config = {
    ingreso: {
      icon: TrendingUp,
      label: 'Agregar Ingreso',
      variant: 'gradient' as const,
      className: 'text-emerald-400 hover:text-emerald-300',
    },
    deuda: {
      icon: CreditCard,
      label: 'Agregar Deuda',
      variant: 'glass' as const,
      className: 'text-orange-400 hover:text-orange-300',
    },
  };

  const { icon: Icon, variant } = config[type];

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onAction}
      className={`transition-all duration-200 hover:scale-105 ${className}`}
    >
      <Plus className="w-4 h-4 mr-1" />
      <Icon className="w-4 h-4" />
    </Button>
  );
}
