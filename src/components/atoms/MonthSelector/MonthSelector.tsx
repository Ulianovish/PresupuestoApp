/**
 * MonthSelector - Atom Level
 *
 * Selector dropdown para elegir mes de presupuesto
 * Usa el sistema de diseño con glassmorphism y gradientes
 */

import React from 'react';

import { ChevronDown, Calendar } from 'lucide-react';

import { cn } from '@/lib/utils';

interface MonthOption {
  value: string;
  label: string;
}

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
  options: MonthOption[];
  disabled?: boolean;
  className?: string;
}

export default function MonthSelector({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
}: MonthSelectorProps) {
  // Encontrar la opción seleccionada
  const selectedOption = options.find(option => option.value === value);
  const selectedLabel = selectedOption?.label || 'Seleccionar mes';

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Label con icono */}
      <div className="flex items-center gap-2 mb-2">
        <Calendar className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-gray-300">Período</span>
      </div>

      {/* Selector principal */}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            // Estilo base
            'appearance-none w-full px-4 py-3 pr-10',
            'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm',
            'border border-white/20 dark:border-slate-700/20 rounded-lg',
            'text-white placeholder-gray-400',
            'font-medium text-sm',

            // Estados de focus
            'focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500',
            'transition-all duration-200',

            // Estados hover
            'hover:bg-white/20 dark:hover:bg-slate-700/30',
            'hover:border-blue-400/40',

            // Estado disabled
            disabled && 'opacity-50 cursor-not-allowed',

            // Efecto de glassmorphism
            'shadow-lg backdrop-filter'
          )}
        >
          {options.map(option => (
            <option
              key={option.value}
              value={option.value}
              className="bg-slate-800 text-white"
            >
              {option.label}
            </option>
          ))}
        </select>

        {/* Icono de dropdown */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown
            className={cn(
              'w-4 h-4 text-gray-400 transition-transform duration-200',
              disabled && 'opacity-50'
            )}
          />
        </div>
      </div>

      {/* Indicador visual adicional */}
      <div className="mt-1 text-xs text-gray-400">
        Mostrando:{' '}
        <span className="text-blue-400 font-medium">{selectedLabel}</span>
      </div>
    </div>
  );
}
