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
"use client";

import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'gradient' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loading?: boolean;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
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
  // Custom variants for SIRME design system
  const variants = {
    gradient: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200',
    glass: 'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20 hover:bg-white/20 dark:hover:bg-slate-700/30 transition-all duration-200 text-white',
    default: 'bg-slate-700 text-white hover:bg-slate-600 border-slate-600',
    secondary: 'bg-slate-700 text-white hover:bg-slate-600 border-slate-600',
    outline: 'text-white border-slate-600 hover:bg-slate-700',
  };

  return (
    <ShadcnButton
      className={cn(
        variant === 'gradient' && variants.gradient,
        variant === 'glass' && variants.glass,
        variant === 'default' && variants.default,
        variant === 'secondary' && variants.secondary,
        variant === 'outline' && variants.outline,
        loading && 'pointer-events-none opacity-70',
        className
      )}
      variant={variant === 'gradient' || variant === 'glass' || variant === 'default' || variant === 'secondary' || variant === 'outline' ? 'default' : variant}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      type={type}
      {...props}
    >
      {loading && (
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </ShadcnButton>
  );
} 