/**
 * CurrencyInput - Atom Level
 *
 * A specialized input component for entering monetary values.
 * Handles currency formatting with Colombian peso format ($123.456).
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

  // Format number to Colombian currency format
  const formatCurrency = (num: number): string => {
    if (num === 0) return '';
    return `$${num.toLocaleString('es-CO')}`;
  };

  // Parse formatted currency string to number
  const parseCurrency = (str: string): number => {
    if (!str || str === '$') return 0;
    // Remove $ and dots, then parse
    const cleanStr = str.replace(/[$.,]/g, '');
    const num = parseInt(cleanStr, 10);
    return isNaN(num) ? 0 : num;
  };

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(formatCurrency(value));
  }, [value]);

  // Handle input change with proper formatting
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;

    // Allow empty string or just $ for better UX
    if (inputValue === '' || inputValue === '$') {
      setDisplayValue('');
      onChange(0);
      return;
    }

    // Only allow numbers, $ and dots
    const cleanInput = inputValue.replace(/[^$0-9]/g, '');

    // Parse the numeric value
    const numValue = parseCurrency(cleanInput);

    // Format and update display
    const formatted = formatCurrency(numValue);
    setDisplayValue(formatted);
    onChange(numValue);

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
    // Allow backspace, delete, tab, escape, enter
    if (
      [8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
      // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
      (e.keyCode === 65 && e.ctrlKey === true) ||
      (e.keyCode === 67 && e.ctrlKey === true) ||
      (e.keyCode === 86 && e.ctrlKey === true) ||
      (e.keyCode === 88 && e.ctrlKey === true)
    ) {
      return;
    }
    // Ensure that it is a number and stop the keypress
    if (
      (e.shiftKey || e.keyCode < 48 || e.keyCode > 57) &&
      (e.keyCode < 96 || e.keyCode > 105)
    ) {
      e.preventDefault();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const numValue = parseCurrency(pastedText);
    const formatted = formatCurrency(numValue);
    setDisplayValue(formatted);
    onChange(numValue);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      value={displayValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
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
