'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

interface MonthContextType {
  selectedMonth: string;
  selectedYear: number;
  setSelectedMonth: (month: string) => void;
  setSelectedYear: (year: number) => void;
  getAvailableYears: () => number[];
  getAvailableMonths: () => Array<{ value: string; label: string }>;
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
  // Estado del año seleccionado
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedYear');
      return saved ? parseInt(saved, 10) : new Date().getFullYear();
    }
    return new Date().getFullYear();
  });

  // Estado del mes seleccionado
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const savedMonth = localStorage.getItem('selectedMonth');
      if (savedMonth) {
        // Validar que el mes pertenezca al año seleccionado
        const [year] = savedMonth.split('-');
        if (parseInt(year, 10) === selectedYear) {
          return savedMonth;
        }
      }
    }
    // Default: mes actual del año seleccionado
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

    // Si el año seleccionado es el actual, usar el mes actual
    // Si no, usar enero del año seleccionado
    if (selectedYear === currentYear) {
      return `${selectedYear}-${currentMonth}`;
    }
    return `${selectedYear}-01`;
  });

  // Persistir año en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedYear', selectedYear.toString());
    }
  }, [selectedYear]);

  // Persistir mes en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedMonth', selectedMonth);
    }
  }, [selectedMonth]);

  // Función para cambiar año
  const handleSetSelectedYear = useCallback(
    (year: number) => {
      setSelectedYear(year);
      // Ajustar el mes seleccionado al nuevo año
      const [, currentMonth] = selectedMonth.split('-');
      setSelectedMonth(`${year}-${currentMonth}`);
    },
    [selectedMonth],
  );

  // Obtener años disponibles (desde 2024 hasta 3 años en el futuro)
  const getAvailableYears = useCallback((): number[] => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    const startYear = 2024;
    const endYear = currentYear + 3;

    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years;
  }, []);

  // Obtener meses del año seleccionado
  const getAvailableMonths = useCallback((): Array<{
    value: string;
    label: string;
  }> => {
    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];

    return monthNames.map((name, index) => {
      const month = String(index + 1).padStart(2, '0');
      return {
        value: `${selectedYear}-${month}`,
        label: `${name} ${selectedYear}`,
      };
    });
  }, [selectedYear]);

  const contextValue: MonthContextType = {
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear: handleSetSelectedYear,
    getAvailableYears,
    getAvailableMonths,
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
