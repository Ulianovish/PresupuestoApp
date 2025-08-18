import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

/**
 * Copia budget_items del mes anterior al nuevo presupuesto
 */
export async function copyBudgetItemsFromPreviousMonth(
  userId: string,
  newTemplateId: string,
  targetMonthYear: string,
): Promise<number> {
  try {
    console.log(
      '🔄 copyBudgetItems - Iniciando copia para template:',
      newTemplateId,
    );

    // 1. Buscar el template del mes anterior más reciente
    const { data: previousTemplates, error: templateError } = await supabase
      .from('budget_templates')
      .select('id, month_year')
      .eq('user_id', userId)
      .lt('month_year', targetMonthYear)
      .eq('is_active', true)
      .order('month_year', { ascending: false })
      .limit(1);

    if (templateError) {
      console.error('🔄 Error buscando template anterior:', templateError);
      return 0;
    }

    if (!previousTemplates || previousTemplates.length === 0) {
      console.log('🔄 No se encontró template anterior para copiar');
      return 0;
    }

    const previousTemplateId = previousTemplates[0].id;
    console.log(
      '🔄 Template anterior encontrado:',
      previousTemplateId,
      'mes:',
      previousTemplates[0].month_year,
    );

    // 2. Verificar si ya existen items en el nuevo template
    const { data: existingItems, error: existingError } = await supabase
      .from('budget_items')
      .select('id')
      .eq('template_id', newTemplateId)
      .eq('is_active', true);

    if (existingError) {
      console.error('🔄 Error verificando items existentes:', existingError);
      return 0;
    }

    if (existingItems && existingItems.length > 0) {
      console.log('🔄 Ya existen items en el nuevo template, saltando copia');
      return existingItems.length;
    }

    // 3. Obtener budget_items del template anterior
    const { data: sourceItems, error: sourceError } = await supabase
      .from('budget_items')
      .select(
        `
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        due_date
      `,
      )
      .eq('template_id', previousTemplateId)
      .eq('is_active', true);

    if (sourceError) {
      console.error('🔄 Error obteniendo items anteriores:', sourceError);
      return 0;
    }

    if (!sourceItems || sourceItems.length === 0) {
      console.log('🔄 No hay items en el template anterior para copiar');
      return 0;
    }

    console.log('🔄 Encontrados', sourceItems.length, 'items para copiar');

    // 4. Preparar datos para insertar
    const newItems = sourceItems.map(item => ({
      user_id: userId,
      template_id: newTemplateId,
      category_id: item.category_id,
      classification_id: item.classification_id,
      control_id: item.control_id,
      status_id: item.status_id,
      name: item.name,
      description: item.description,
      budgeted_amount: item.budgeted_amount,
      spent_amount: 0.0, // Resetear gastos
      real_amount: 0.0, // Resetear montos reales
      due_date: item.due_date,
      is_active: true,
    }));

    // 5. Insertar los nuevos items
    const { data: insertedItems, error: insertError } = await supabase
      .from('budget_items')
      .insert(newItems)
      .select('id');

    if (insertError) {
      console.error('🔄 Error insertando nuevos items:', insertError);
      return 0;
    }

    const itemsCreated = insertedItems?.length || 0;
    console.log(
      '🔄 ✅ Copiados exitosamente',
      itemsCreated,
      'items del mes anterior',
    );

    return itemsCreated;
  } catch (error) {
    console.error('🔄 Error general en copyBudgetItems:', error);
    return 0;
  }
}

/**
 * Función mejorada para crear presupuesto mensual con items copiados
 */
export async function createMonthlyBudgetWithItems(
  monthYear: string,
  templateName?: string,
): Promise<{ templateId: string | null; itemsCopied: number }> {
  try {
    console.log(
      '🔵 createMonthlyBudgetWithItems - Iniciando para mes:',
      monthYear,
    );

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    // 1. Crear el template usando la función original
    const { data: templateId, error } = await supabase.rpc(
      'upsert_monthly_budget',
      {
        p_user_id: user.user.id,
        p_month_year: monthYear,
        p_template_name: templateName,
      },
    );

    if (error) {
      console.error('🔵 Error creando template:', error);
      return { templateId: null, itemsCopied: 0 };
    }

    console.log('🔵 Template creado:', templateId);

    // 2. Copiar items del mes anterior
    const itemsCopied = await copyBudgetItemsFromPreviousMonth(
      user.user.id,
      templateId,
      monthYear,
    );

    console.log('🔵 ✅ Presupuesto creado con', itemsCopied, 'items copiados');

    return { templateId, itemsCopied };
  } catch (error) {
    console.error('🔵 Error en createMonthlyBudgetWithItems:', error);
    return { templateId: null, itemsCopied: 0 };
  }
}

/**
 * Función para arreglar presupuestos existentes sin items (usando SQL optimizado)
 */
export async function fixExistingBudgetsWithoutItems(): Promise<{
  templatesFixed: number;
  totalItemsCreated: number;
}> {
  try {
    console.log(
      '🔧 fixExistingBudgets - Iniciando reparación usando función SQL...',
    );

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      throw new Error('Usuario no autenticado');
    }

    // Usar la función SQL optimizada para reparar templates
    const { data: repairResults, error } = await supabase.rpc(
      'fix_templates_without_items',
      {
        p_user_id: user.user.id,
      },
    );

    if (error) {
      console.error('🔧 Error llamando función SQL de reparación:', error);
      return { templatesFixed: 0, totalItemsCreated: 0 };
    }

    if (!repairResults || repairResults.length === 0) {
      console.log('🔧 No hay templates que requieran reparación');
      return { templatesFixed: 0, totalItemsCreated: 0 };
    }

    // Calcular totales
    const templatesFixed = repairResults.length;
    const totalItemsCreated = repairResults.reduce(
      (total: number, result: Record<string, unknown>) => {
        return total + (result.items_copied || 0);
      },
      0,
    );

    console.error('🔧 ✅ Reparación completada:');
    repairResults.forEach((result: Record<string, unknown>) => {
      console.error(
        `  - ${result.month_year}: ${result.items_copied} items copiados`,
      );
    });
    console.error(
      `  - Total: ${templatesFixed} templates reparados, ${totalItemsCreated} items creados`,
    );

    return { templatesFixed, totalItemsCreated };
  } catch (error) {
    console.error('🔧 Error en fixExistingBudgets:', error);
    return { templatesFixed: 0, totalItemsCreated: 0 };
  }
}
