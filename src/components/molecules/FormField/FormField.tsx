/**
 * FormField - Molecule Level
 * 
 * Combines Label and Input atoms for form field functionality.
 * Handles error display and validation states.
 * 
 * @param label - Field label text
 * @param error - Error message to display
 * @param required - Whether the field is required
 * @param children - Input component (CurrencyInput, Input, etc.)
 * @param className - Additional CSS classes
 * 
 * @example
 * <FormField label="Budget Amount" error={errors.amount} required>
 *   <CurrencyInput 
 *     value={amount}
 *     onChange={setAmount}
 *     error={!!errors.amount}
 *   />
 * </FormField>
 */
"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}

export default function FormField({ 
  label, 
  error, 
  required = false, 
  children,
  className = "",
  htmlFor
}: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label 
        htmlFor={htmlFor}
        className={cn(
          "text-sm font-medium",
          required && "after:content-['*'] after:ml-1 after:text-red-500"
        )}
      >
        {label}
      </Label>
      
      {children}
      
      {error && (
        <p className="text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
} 