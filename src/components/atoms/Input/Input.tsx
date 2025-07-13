import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

// Props interface para el componente Input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'glass' | 'gradient-focus';
  error?: boolean;
  className?: string;
}

/**
 * Input - Atom Level Component
 * 
 * Enhanced input component with glassmorphism support and error states.
 * Built with SIRME design system principles.
 * 
 * @param variant - Input style variant ('default', 'glass', 'gradient-focus')
 * @param error - Whether the input has an error state
 * @param className - Additional CSS classes
 * @param props - Standard HTML input props
 * 
 * @example
 * <Input
 *   variant="glass"
 *   placeholder="Enter your email"
 *   error={false}
 * />
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ variant = 'default', error = false, className, ...props }, ref) => {
    // Estilos base para todos los inputs
    const baseStyles = [
      'w-full px-3 py-2 rounded-md text-sm transition-all duration-200',
      'border focus:outline-none focus:ring-2 focus:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-50',
    ];

    // Variantes de estilo
    const variants = {
      default: [
        'bg-white border-gray-300 text-gray-900',
        'placeholder-gray-500',
        'focus:border-blue-500 focus:ring-blue-500/20',
        'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
        'dark:placeholder-gray-400 dark:focus:border-blue-500',
      ],
      glass: [
        'bg-white/10 dark:bg-slate-700/20 backdrop-blur-sm',
        'border-white/20 dark:border-slate-700/20 text-white',
        'placeholder-gray-400 dark:placeholder-gray-400',
        'focus:bg-white/20 dark:focus:bg-slate-700/30',
        'focus:border-white/40 dark:focus:border-slate-600/40',
        'focus:ring-blue-500/20',
      ],
      'gradient-focus': [
        'bg-white border-gray-300 text-gray-900',
        'placeholder-gray-500',
        'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20',
        'dark:bg-gray-800 dark:border-gray-600 dark:text-white',
        'dark:placeholder-gray-400',
      ],
    };

    // Estilos de error
    const errorStyles = error ? [
      'border-red-500 focus:border-red-500',
      'focus:ring-red-500/20',
      'dark:border-red-500 dark:focus:border-red-500',
    ] : [];

    // Combinar todas las clases
    const inputClasses = cn(
      baseStyles,
      variants[variant],
      errorStyles,
      className
    );

    return (
      <input
        ref={ref}
        className={inputClasses}
        {...props}
      />
    );
  }
);

// Establecer nombre de display para debugging
Input.displayName = 'Input';

export default Input; 