'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

/**
 * Crea un ítem de presupuesto (en la categoría DEUDAS) enlazado a una deuda,
 * en TODOS los templates activos del usuario, para que la deuda aparezca en el
 * listado de ítems al clasificar gastos en cualquier mes. Idempotente: no
 * duplica si ya existe un ítem para esa deuda en un template.
 *
 * Best-effort: si algo falla (p.ej. no hay categoría DEUDAS), no bloquea la
 * creación de la deuda; solo devuelve success:false.
 */
export async function createBudgetItemsForDeuda(
  deudaId: string,
  itemName: string,
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Usuario no autenticado' };
    }

    // Categoría DEUDAS del usuario
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', 'DEUDAS')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!category) {
      return { success: false, error: 'No existe la categoría DEUDAS' };
    }

    // Valores por defecto de clasificación, control y estado
    const [classificationResult, controlResult, statusResult] =
      await Promise.all([
        supabase
          .from('classifications')
          .select('id')
          .eq('is_active', true)
          .order('name')
          .limit(1)
          .single(),
        supabase
          .from('controls')
          .select('id')
          .eq('is_active', true)
          .order('name')
          .limit(1)
          .single(),
        supabase
          .from('budget_statuses')
          .select('id')
          .eq('name', 'Activo')
          .single(),
      ]);

    if (
      classificationResult.error ||
      controlResult.error ||
      statusResult.error
    ) {
      console.error('Error obteniendo valores por defecto:', {
        classificationResult: classificationResult.error,
        controlResult: controlResult.error,
        statusResult: statusResult.error,
      });
      return { success: false, error: 'Faltan valores por defecto' };
    }

    // Todos los templates activos del usuario
    const { data: templates } = await supabase
      .from('budget_templates')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!templates || templates.length === 0) {
      return { success: true }; // no hay presupuestos: nada que crear
    }

    // Templates que ya tienen un ítem para esta deuda (evitar duplicados)
    const { data: existing } = await supabase
      .from('budget_items')
      .select('template_id')
      .eq('deuda_id', deudaId);
    const existingTemplates = new Set(
      (existing || []).map(e => e.template_id as string),
    );

    const rows = templates
      .filter(t => !existingTemplates.has(t.id))
      .map(t => ({
        user_id: user.id,
        template_id: t.id,
        category_id: category.id,
        classification_id: classificationResult.data.id,
        control_id: controlResult.data.id,
        status_id: statusResult.data.id,
        name: itemName,
        budgeted_amount: 0,
        real_amount: 0,
        due_date: null,
        deuda_id: deudaId,
        is_active: true,
      }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from('budget_items')
        .insert(rows);
      if (insertError) {
        console.error('Error creando ítems de deuda:', insertError);
        return { success: false, error: 'No se pudieron crear los ítems' };
      }
    }

    revalidatePath('/presupuesto');
    return { success: true };
  } catch (error) {
    console.error('Error en createBudgetItemsForDeuda:', error);
    return { success: false, error: 'Error interno del servidor' };
  }
}
