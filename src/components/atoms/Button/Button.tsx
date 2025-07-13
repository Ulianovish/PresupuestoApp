/**
 * EnhancedButton - Atom Level
 *
 * Enhanced shadcn/ui Button with SIRME design system integration.
 * Supports glassmorphism, gradients, and loading states.
 *
 * @param variant - Button style variant including custom 'gradient' and 'glass'
 * @param size - Button size (default, sm, lg, icon)
 * @param loading - Shows loading spinner when true
 * @param children - Button content
 * @param className - Additional CSS classes
 *
 * @example
 * <Button variant="gradient" size="lg" loading={isSubmitting}>
 *   Create Budget
 * </Button>
 */
'use client';

import { ReactNode } from 'react';

import { Button as ShadcnButton } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ButtonProps {
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'gradient'
    | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  onClick?: (e?: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  children,
  disabled,
  onClick,
  type = 'button',
  ...props
}: ButtonProps) {
  const variants = {
    gradient: `
      relative overflow-hidden
      bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 
      hover:from-blue-600 hover:via-blue-700 hover:to-purple-700
      active:from-blue-700 active:via-blue-800 active:to-purple-800
      text-white font-semibold
      border-0 shadow-lg hover:shadow-xl active:shadow-md
      transform transition-all duration-200 ease-in-out
      hover:scale-105 active:scale-95
      focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900
      before:absolute before:inset-0 before:bg-gradient-to-r before:from-white/20 before:to-transparent before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300
    `,
    glass: `
      bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm 
      border border-white/20 dark:border-slate-700/20 
      hover:bg-white/20 dark:hover:bg-slate-700/30 
      text-white font-medium
      shadow-md hover:shadow-lg
      transition-all duration-200 ease-in-out
      hover:scale-105 active:scale-95
      focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2 focus:ring-offset-slate-900
    `,
  };

  return (
    <ShadcnButton
      className={cn(
        // Base styles for all variants
        'relative transition-all duration-200 ease-in-out',
        // Custom variant styles
        variant === 'gradient' && variants.gradient,
        variant === 'glass' && variants.glass,
        // Loading state
        loading && 'pointer-events-none opacity-70',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed hover:scale-100',
        className
      )}
      variant={
        variant === 'gradient' || variant === 'glass' ? 'default' : variant
      }
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props}
    >
      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </div>
      )}

      {/* Button content */}
      <span className={cn('flex items-center gap-2', loading && 'invisible')}>
        {children}
      </span>

      {/* Gradient overlay for extra shine effect */}
      {variant === 'gradient' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}
    </ShadcnButton>
  );
}
