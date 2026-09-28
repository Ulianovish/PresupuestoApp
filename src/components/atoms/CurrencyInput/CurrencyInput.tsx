/**
 * CurrencyInput - Atom Level
 *
 * A specialized input component for entering monetary values.
 * Handles currency formatting with Colombian peso format ($123.456).
 * Accepts "," as decimal separator while typing ("$563.091,09") and parses
 * pasted text with `parseCopAmount`; the emitted value is always whole pesos.
 *
 * @param value - The current monetary value
 * @param onChange - Callback when value changes
 * @param placeholder - Placeholder text (default: "$0")
 * @param disabled - Whether the input is disabled
 * @param error - Whether to show error styling
 * @param className - Additional CSS classes
 *
 * @example
 * <CurrencyInput
 *   value={amount}
 *   onChange={setAmount}
 *   placeholder="$0"
 * />
 */
'use client';

import { useState, useEffect, useRef } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import {
  editCurrencyText,
  formatCurrencyDisplay,
  pasteCurrencyText,
} from './currency-input-format';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '$0',
  disabled = false,
  error = false,
  className = '',
}: CurrencyInputProps) {
  // Internal state for display formatting
  const [displayValue, setDisplayValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Último valor que emitió el propio input. Mientras se escribe "1.234,5" el
  // padre recibe 1235 y lo devuelve por `value`: si reformateáramos ahí, la
  // coma y los decimales desaparecerían a mitad de escribir.
  const lastEmittedRef = useRef<number | null>(null);

  const emit = (num: number) => {
    lastEmittedRef.current = num;
    onChange(num);
  };

  // Update display value when prop changes (solo si el cambio vino de afuera)
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = null;
    setDisplayValue(formatCurrencyDisplay(value));
  }, [value]);

  // Handle input change with proper formatting
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Allow empty string or just $ for better UX
    if (inputValue === '' || inputValue === '$') {
      setDisplayValue('');
      emit(0);
      return;
    }

    const { display: formatted, value: numValue } =
      editCurrencyText(inputValue);
    setDisplayValue(formatted);
    emit(numValue);

    // Restore cursor position after formatting
    setTimeout(() => {
      if (inputRef.current) {
        const newLength = formatted.length;
        const oldLength = inputValue.length;
        const adjustment = newLength - oldLength;
        const newPosition = Math.max(1, cursorPosition + adjustment); // At least after $
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  // Handle key down for better UX
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Teclas de control (Backspace, flechas, Tab, Enter...) y atajos
    // (Ctrl/Cmd+A/C/V/X) pasan tal cual.
    if (e.key.length > 1 || e.ctrlKey || e.metaKey) return;
    // Dígitos y la coma decimal. El "." no: es la agrupación de miles que pone
    // el propio input.
    if (/^[0-9,]$/.test(e.key)) return;
    e.preventDefault();
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = pasteCurrencyText(e.clipboardData.getData('text'));
    if (!pasted) return;
    setDisplayValue(pasted.display);
    emit(pasted.value);
  };

  // Al salir del campo se muestra el valor que realmente se guarda (pesos
  // redondeados), sin la coma decimal a medio escribir.
  const handleBlur = () => {
    if (lastEmittedRef.current === null) return;
    setDisplayValue(formatCurrencyDisplay(lastEmittedRef.current));
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        'w-full bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20',
        error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
        className,
      )}
      aria-describedby={error ? 'currency-error' : undefined}
    />
  );
}
