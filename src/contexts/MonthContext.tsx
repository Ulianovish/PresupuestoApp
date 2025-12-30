'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface MonthContextType {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  getCurrentMonth: () => string;
}

const MonthContext = createContext<MonthContextType | undefined>(undefined);

interface MonthProviderProps {
  children: React.ReactNode;
}

/**
 * Obtiene el mes actual en formato YYYY-MM
 */
const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export function MonthProvider({ children }: MonthProviderProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Intentar obtener el mes desde localStorage, si no existe usar el mes actual
    if (typeof window !== 'undefined') {
      const savedMonth = localStorage.getItem('selectedMonth');
      return savedMonth || getCurrentMonth();
    }
    return getCurrentMonth();
  });

  // Guardar el mes seleccionado en localStorage cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedMonth', selectedMonth);
    }
  }, [selectedMonth]);

  const contextValue: MonthContextType = {
    selectedMonth,
    setSelectedMonth,
    getCurrentMonth,
  };

  return (
    <MonthContext.Provider value={contextValue}>
      {children}
    </MonthContext.Provider>
  );
}

/**
 * Hook para usar el contexto de mes
 * @throws Error si se usa fuera del MonthProvider
 */
export function useMonth(): MonthContextType {
  const context = useContext(MonthContext);

  if (context === undefined) {
    throw new Error('useMonth debe ser usado dentro de un MonthProvider');
  }

  return context;
}

export default MonthContext;
