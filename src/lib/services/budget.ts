/**
 * Servicio para manejo de presupuestos mensuales
 * Conecta con Supabase para CRUD de datos de presupuesto
 */

import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/database';

// Tipos para el servicio de presupuesto
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
  monthYear: string
): Promise<MonthlyBudgetData | null> {
  try {
    // Obtener datos usando la función SQL
    const { data, error } = await supabase.rpc('get_budget_by_month', {
      p_user_id: (await supabase.auth.getUser()).data.user?.id,
      p_month_year: monthYear
    });

    if (error) {
      console.error('Error obteniendo presupuesto:', error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    // Agrupar datos por categoría
    const categoriesMap = new Map<string, BudgetCategory>();
    let templateId = '';
    let templateName = '';
    let totalPresupuestado = 0;
    let totalReal = 0;

    data.forEach((row: any) => {
      if (!templateId) {
        templateId = row.template_id;
        templateName = row.template_name;
      }

      if (row.category_id) {
        const categoryKey = row.category_id;
        
        if (!categoriesMap.has(categoryKey)) {
          categoriesMap.set(categoryKey, {
            id: row.category_id,
            nombre: row.category_name,
            totalPresupuestado: 0,
            totalReal: 0,
            items: [],
            expanded: false
          });
        }

        const category = categoriesMap.get(categoryKey)!;
        
        if (row.item_id) {
          const item: BudgetItem = {
            id: row.item_id,
            descripcion: row.item_name,
            fecha: row.due_date || '',
            clasificacion: row.classification_name,
            control: row.control_name,
            presupuestado: parseFloat(row.budgeted_amount) || 0,
            real: parseFloat(row.real_amount) || 0
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
      total_real: totalReal
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
  templateName?: string
): Promise<string | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    const { data, error } = await supabase.rpc('upsert_monthly_budget', {
      p_user_id: user.user.id,
      p_month_year: monthYear,
      p_template_name: templateName
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
 * Crea un nuevo item de presupuesto
 */
export async function createBudgetItem(
  templateId: string,
  categoryId: string,
  item: Omit<BudgetItem, 'id'>
): Promise<BudgetItem | null> {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    // Buscar IDs de clasificación y control por nombre
    const [classificationResult, controlResult] = await Promise.all([
      supabase.from('classifications').select('id').eq('name', item.clasificacion).single(),
      supabase.from('controls').select('id').eq('name', item.control).single()
    ]);

    if (classificationResult.error || controlResult.error) {
      console.error('Error obteniendo IDs:', { classificationResult, controlResult });
      return null;
    }

    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        user_id: user.user.id,
        template_id: templateId,
        category_id: categoryId,
        classification_id: classificationResult.data.id,
        control_id: controlResult.data.id,
        status_id: '1', // Asumiendo que existe un status activo
        name: item.descripcion,
        budgeted_amount: item.presupuestado,
        real_amount: item.real,
        due_date: item.fecha
      })
      .select()
      .single();

    if (error) {
      console.error('Error creando item de presupuesto:', error);
      return null;
    }

    return {
      id: data.id,
      descripcion: data.name,
      fecha: data.due_date || '',
      clasificacion: item.clasificacion,
      control: item.control,
      presupuestado: parseFloat(data.budgeted_amount) || 0,
      real: parseFloat(data.real_amount) || 0
    };

  } catch (error) {
    console.error('Error en createBudgetItem:', error);
    return null;
  }
}

/**
 * Actualiza un item de presupuesto existente
 */
export async function updateBudgetItem(
  itemId: string,
  updates: Partial<Omit<BudgetItem, 'id'>>
): Promise<BudgetItem | null> {
  try {
    const updateData: any = {};
    
    if (updates.descripcion) updateData.name = updates.descripcion;
    if (updates.fecha !== undefined) updateData.due_date = updates.fecha;
    if (updates.presupuestado !== undefined) updateData.budgeted_amount = updates.presupuestado;
    if (updates.real !== undefined) updateData.real_amount = updates.real;

    const { data, error } = await supabase
      .from('budget_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando item de presupuesto:', error);
      return null;
    }

    return {
      id: data.id,
      descripcion: data.name,
      fecha: data.due_date || '',
      clasificacion: updates.clasificacion || '',
      control: updates.control || '',
      presupuestado: parseFloat(data.budgeted_amount) || 0,
      real: parseFloat(data.real_amount) || 0
    };

  } catch (error) {
    console.error('Error en updateBudgetItem:', error);
    return null;
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