/**
 * Hook personalizado para manejar categorías disponibles
 * Maneja el estado y carga de categorías para dropdowns y selects
 */

import { useState, useEffect, useCallback } from 'react';

import { getCategories } from '@/lib/services/budget';

export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface UseCategoriesReturn {
  // Estado
  categories: Category[];
  isLoading: boolean;
  error: string | null;

  // Funciones
  refreshCategories: () => Promise<void>;
}

/**
 * Hook para manejar categorías disponibles
 */
export function useCategories(): UseCategoriesReturn {
  // Estado del hook
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carga las categorías disponibles
   */
  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error('Error cargando categorías:', err);
      setError('Error al cargar las categorías');
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresca las categorías
   */
  const refreshCategories = useCallback(async () => {
    await loadCategories();
  }, [loadCategories]);

  // Cargar categorías al montar el componente
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    // Estado
    categories,
    isLoading,
    error,

    // Funciones
    refreshCategories,
  };
}
