/**
 * AddCategoryButton - Atom Level
 *
 * Botón especializado para agregar nuevas categorías al presupuesto.
 * Utiliza el diseño glassmorphism y se posiciona en la esquina superior derecha.
 *
 * @param onClick - Función que se ejecuta al hacer clic en el botón
 * @param loading - Estado de carga del botón
 * @param className - Clases CSS adicionales
 *
 * @example
 * <AddCategoryButton onClick={handleOpenModal} loading={isCreating} />
 */
'use client';

import { Plus } from 'lucide-react';

import Button from '@/components/atoms/Button/Button';
import { cn } from '@/lib/utils';

interface AddCategoryButtonProps {
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

export default function AddCategoryButton({
  onClick,
  loading = false,
  className,
}: AddCategoryButtonProps) {
  return (
    <Button
      variant="glass"
      size="sm"
      onClick={onClick}
      loading={loading}
      className={cn(
        'flex items-center gap-2 text-sm font-medium',
        'hover:bg-white/20 dark:hover:bg-slate-700/30',
        'transition-all duration-200 ease-in-out',
        className,
      )}
    >
      <Plus className="h-4 w-4" />
      <span className="hidden sm:inline">Agregar Categoría</span>
      <span className="sm:hidden">Nueva</span>
    </Button>
  );
}
