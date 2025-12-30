/**
 * Servicio para manejo de presupuestos mensuales
 * Conecta con Supabase para CRUD de datos de presupuesto
 */

import { createClient } from '@/lib/supabase/client';

// Tipos para el servicio de presupuesto

// Tipo para resultados de consulta SQL de presupuesto
interface BudgetQueryRow {
  template_id: string;
  template_name: string;
  category_id: string;
  category_name: string;
  item_id: string;
  item_name: string;
  due_date: string;
  classification_name: string;
  control_name: string;
  budgeted_amount: string | number;
  real_amount: string | number;
}

export interface BudgetItem {
  id: string;
  descripcion: string;
  fecha: string;
  clasificacion: string;
  control: string;
  presupuestado: number;
  real: number;
}

export interface BudgetCategory {
  id: string;
  nombre: string;
  totalPresupuestado: number;
  totalReal: number;
  items: BudgetItem[];
  expanded: boolean;
}

export interface MonthlyBudgetData {
  template_id: string;
  template_name: string;
  categories: BudgetCategory[];
  total_presupuestado: number;
  total_real: number;
}

// Cliente Supabase
const supabase = createClient();

/**
 * Obtiene el presupuesto de un mes específico
 */
export async function getBudgetByMonth(
  monthYear: string,
): Promise<MonthlyBudgetData | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.error('Usuario no autenticado');
      return null;
    }

    // Obtener datos usando la función SQL
    const { data: budgetData, error: budgetError } = await supabase.rpc(
      'get_budget_by_month',
      {
        p_user_id: user.id,
        p_month_year: monthYear,
      },
    );

    if (budgetError) {
      console.error('Error obteniendo presupuesto:', budgetError);
      return null;
    }

    // Obtener todas las categorías del usuario (incluso las que no tienen items de presupuesto)
    const { data: allCategories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name');

    if (categoriesError) {
      console.error('Error obteniendo categorías:', categoriesError);
      return null;
    }

    // Si no hay datos de presupuesto pero sí categorías, crear estructura básica
    if (
      (!budgetData || budgetData.length === 0) &&
      allCategories &&
      allCategories.length > 0
    ) {
      return {
        template_id: '',
        template_name: `Presupuesto ${monthYear}`,
        categories: allCategories.map(cat => ({
          id: cat.id,
          nombre: cat.name,
          totalPresupuestado: 0,
          totalReal: 0,
          items: [],
          expanded: false,
        })),
        total_presupuestado: 0,
        total_real: 0,
      };
    }

    if (!budgetData || budgetData.length === 0) {
      return null;
    }

    // Crear mapa de todas las categorías del usuario
    const categoriesMap = new Map<string, BudgetCategory>();

    // Inicializar todas las categorías del usuario
    allCategories?.forEach(cat => {
      categoriesMap.set(cat.id, {
        id: cat.id,
        nombre: cat.name,
        totalPresupuestado: 0,
        totalReal: 0,
        items: [],
        expanded: false,
      });
    });

    let templateId = '';
    let templateName = '';
    let totalPresupuestado = 0;
    let totalReal = 0;

    // Procesar datos del presupuesto
    budgetData.forEach((row: BudgetQueryRow) => {
      if (!templateId) {
        templateId = row.template_id;
        templateName = row.template_name;
      }

      if (row.category_id && categoriesMap.has(row.category_id)) {
        const category = categoriesMap.get(row.category_id)!;

        if (row.item_id) {
          const item: BudgetItem = {
            id: row.item_id,
            descripcion: row.item_name,
            fecha: row.due_date || '',
            clasificacion: row.classification_name,
            control: row.control_name,
            presupuestado: Number(row.budgeted_amount) || 0,
            real: Number(row.real_amount) || 0,
          };

          category.items.push(item);
          category.totalPresupuestado += item.presupuestado;
          category.totalReal += item.real;

          totalPresupuestado += item.presupuestado;
          totalReal += item.real;
        }
      }
    });

    return {
      template_id: templateId,
      template_name: templateName,
      categories: Array.from(categoriesMap.values()),
      total_presupuestado: totalPresupuestado,
      total_real: totalReal,
    };
  } catch (error) {
    console.error('Error en getBudgetByMonth:', error);
    return null;
  }
}

/**
 * Crea o actualiza un template de presupuesto mensual
 */
export async function createMonthlyBudget(
  monthYear: string,
  templateName?: string,
): Promise<string | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase.rpc('upsert_monthly_budget', {
      p_user_id: user.user.id,
      p_month_year: monthYear,
      p_template_name: templateName,
    });

    if (error) {
      console.error('Error creando presupuesto mensual:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error en createMonthlyBudget:', error);
    return null;
  }
}

/**
 * Obtiene las categorías disponibles
 */
export async function getCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error obteniendo categorías:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en getCategories:', error);
    return [];
  }
}

/**
 * Obtiene las clasificaciones disponibles
 */
export async function getClassifications() {
  try {
    const { data, error } = await supabase
      .from('classifications')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error obteniendo clasificaciones:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en getClassifications:', error);
    return [];
  }
}

/**
 * Obtiene los controles disponibles
 */
export async function getControls() {
  try {
    const { data, error } = await supabase
      .from('controls')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error obteniendo controles:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error en getControls:', error);
    return [];
  }
}

/**
 * Crea un nuevo item de presupuesto usando la API proxy
 */
export async function createBudgetItem(
  templateId: string,
  categoryId: string,
  item: Omit<BudgetItem, 'id'>,
): Promise<BudgetItem | null> {
  try {
    // Usar la API proxy para evitar problemas de CORS
    const response = await fetch('/api/budget', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        template_id: templateId,
        category_id: categoryId,
        descripcion: item.descripcion,
        fecha: item.fecha,
        clasificacion: item.clasificacion,
        control: item.control,
        presupuestado: item.presupuestado,
        real: item.real,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error creando item de presupuesto:', errorData.error);
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      console.error('Error creando item de presupuesto:', result.error);
      return null;
    }

    // Mensaje de éxito - se puede eliminar en producción
    // console.log('Item de presupuesto creado exitosamente:', result.message);
    return result.data;
  } catch (error) {
    console.error('Error en createBudgetItem:', error);
    return null;
  }
}

/**
 * Actualiza un item de presupuesto existente usando la API proxy
 */
export async function updateBudgetItem(
  itemId: string,
  updates: Partial<Omit<BudgetItem, 'id'>>,
): Promise<BudgetItem | null> {
  try {
    // Usar la API proxy para evitar problemas de CORS
    const response = await fetch(`/api/budget/${itemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error actualizando item de presupuesto:', errorData.error);
      return null;
    }

    const result = await response.json();

    if (!result.success) {
      console.error('Error actualizando item de presupuesto:', result.error);
      return null;
    }

    // Mensaje de éxito - se puede eliminar en producción
    // console.log('Item de presupuesto actualizado exitosamente:', result.message);
    return result.data;
  } catch (error) {
    console.error('Error en updateBudgetItem:', error);
    return null;
  }
}

/**
 * Elimina un item de presupuesto usando la API proxy
 */
export async function deleteBudgetItem(itemId: string): Promise<boolean> {
  try {
    // Usar la API proxy para evitar problemas de CORS
    const response = await fetch(`/api/budget/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error eliminando item de presupuesto:', errorData.error);
      return false;
    }

    const result = await response.json();

    if (!result.success) {
      console.error('Error eliminando item de presupuesto:', result.error);
      return false;
    }

    // Mensaje de éxito - se puede eliminar en producción
    // console.log('Item de presupuesto eliminado exitosamente:', result.message);
    return true;
  } catch (error) {
    console.error('Error en deleteBudgetItem:', error);
    return false;
  }
}

/**
 * Formatea una cantidad como moneda colombiana
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Obtiene la lista de meses disponibles para el selector
 */
export function getAvailableMonths(): Array<{ value: string; label: string }> {
  const months = [
    { value: '2025-01', label: 'Enero 2025' },
    { value: '2025-02', label: 'Febrero 2025' },
    { value: '2025-03', label: 'Marzo 2025' },
    { value: '2025-04', label: 'Abril 2025' },
    { value: '2025-05', label: 'Mayo 2025' },
    { value: '2025-06', label: 'Junio 2025' },
    { value: '2025-07', label: 'Julio 2025' },
    { value: '2025-08', label: 'Agosto 2025' },
    { value: '2025-09', label: 'Septiembre 2025' },
    { value: '2025-10', label: 'Octubre 2025' },
    { value: '2025-11', label: 'Noviembre 2025' },
    { value: '2025-12', label: 'Diciembre 2025' },
  ];

  return months;
}
