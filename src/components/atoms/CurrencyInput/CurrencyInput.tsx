/**
 * CurrencyInput - Atom Level
 * 
 * A specialized input component for entering monetary values.
 * Handles currency formatting and validation.
 * 
 * @param value - The current monetary value
 * @param onChange - Callback when value changes
 * @param placeholder - Placeholder text (default: "0.00")
 * @param disabled - Whether the input is disabled
 * @param error - Whether to show error styling
 * @param className - Additional CSS classes
 * 
 * @example
 * <CurrencyInput 
 *   value={amount}
 *   onChange={setAmount}
 *   placeholder="Enter amount"
 * />
 */
"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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
  placeholder = "0.00",
  disabled = false,
  error = false,
  className = ""
}: CurrencyInputProps) {
  // Internal state for display formatting
  const [displayValue, setDisplayValue] = useState(value.toString());

  // Update display value when prop changes
  useEffect(() => {
    setDisplayValue(value.toString());
  }, [value]);

  // Handle input change with proper formatting
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Allow empty string for better UX
    if (inputValue === "") {
      setDisplayValue("");
      onChange(0);
      return;
    }

    // Parse numeric value
    const numValue = parseFloat(inputValue);
    
    // Only update if it's a valid number
    if (!isNaN(numValue)) {
      setDisplayValue(inputValue);
      onChange(numValue);
    }
  };

  // Handle blur to format the display
  const handleBlur = () => {
    if (value > 0) {
      setDisplayValue(value.toFixed(2));
    }
  };

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full bg-slate-800 border-slate-600 text-white placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500/20",
        error && "border-red-500 focus:border-red-500 focus:ring-red-500/20",
        className
      )}
      aria-describedby={error ? "currency-error" : undefined}
    />
  );
} 