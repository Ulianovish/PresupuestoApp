/**
 * EnhancedCard - Atom Level
 * 
 * Enhanced shadcn/ui Card with SIRME design system integration.
 * Supports glassmorphism, gradient borders, and hover effects.
 * 
 * @param variant - Card style variant including 'glass' and 'gradient-border'
 * @param hover - Whether to show hover effects
 * @param blur - Whether to apply backdrop blur
 * @param children - Card content
 * @param className - Additional CSS classes
 * 
 * @example
 * <Card variant="glass" hover className="p-6">
 *   <CardHeader>
 *     <CardTitle>Budget Summary</CardTitle>
 *   </CardHeader>
 *   <CardContent>
 *     Content here
 *   </CardContent>
 * </Card>
 */
"use client";

import { Card as ShadcnCard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  variant?: 'default' | 'glass' | 'gradient-border';
  hover?: boolean;
  blur?: boolean;
  children: ReactNode;
  className?: string;
}

function Card({ 
  className, 
  variant = 'default',
  hover = false,
  blur = false,
  children,
  ...props 
}: CardProps) {
  // Custom variants for SIRME design system
  const variants = {
    default: 'bg-slate-800 border-slate-700 text-white',
    glass: 'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm border border-white/20 dark:border-slate-700/20',
    'gradient-border': 'bg-white/5 dark:bg-slate-800/20 backdrop-blur-sm border-2 border-transparent bg-gradient-to-r from-blue-500/20 to-purple-500/20 bg-clip-padding',
  };

  return (
    <ShadcnCard
      className={cn(
        variant === 'default' && variants.default,
        variant === 'glass' && variants.glass,
        variant === 'gradient-border' && variants['gradient-border'],
        hover && 'hover:shadow-xl hover:scale-[1.02] transition-all duration-300',
        blur && 'backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {children}
    </ShadcnCard>
  );
}

// Export the enhanced Card as default and the sub-components
export default Card;
export { CardContent, CardHeader, CardTitle }; 