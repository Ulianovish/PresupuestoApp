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
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = `${defaultYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Inicializar con valores por defecto (sin localStorage) para evitar hydration mismatch
  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [hydrated, setHydrated] = useState(false);

  // Leer localStorage DESPUÉS de la hidratación
  useEffect(() => {
    const savedYear = localStorage.getItem('selectedYear');
    const savedMonth = localStorage.getItem('selectedMonth');

    const year = savedYear ? parseInt(savedYear, 10) : defaultYear;
    setSelectedYear(year);

    if (savedMonth) {
      const [savedYearStr] = savedMonth.split('-');
      if (parseInt(savedYearStr, 10) === year) {
        setSelectedMonth(savedMonth);
      } else {
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        setSelectedMonth(
          year === defaultYear ? `${year}-${currentMonth}` : `${year}-01`,
        );
      }
    }

    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistir año en localStorage (solo después de hidratación)
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('selectedYear', selectedYear.toString());
    }
  }, [selectedYear, hydrated]);

  // Persistir mes en localStorage (solo después de hidratación)
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem('selectedMonth', selectedMonth);
    }
  }, [selectedMonth, hydrated]);

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
