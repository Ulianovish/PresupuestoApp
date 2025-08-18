import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

// Schema para validar datos de creación de presupuesto mensual
const CreateBudgetSchema = z.object({
  month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Formato debe ser YYYY-MM'),
  template_name: z.string().optional(),
});

/**
 * POST /api/budget/create
 * Crea un nuevo presupuesto mensual (para debugging)
 */
export async function POST(request: NextRequest) {
  try {
    // Crear cliente de Supabase para server-side
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado', details: authError },
        { status: 401 },
      );
    }

    console.error('🟡 API - Usuario autenticado:', user.id);

    // Parsear y validar datos del request
    const body = await request.json();
    console.error('🟡 API - Request body:', body);
    const validatedData = CreateBudgetSchema.parse(body);
    console.error('🟡 API - Datos validados:', validatedData);

    // Llamar a la función RPC directamente
    console.error('🟡 API - Llamando RPC upsert_monthly_budget...');
    const { data, error } = await supabase.rpc('upsert_monthly_budget', {
      p_user_id: user.id,
      p_month_year: validatedData.month_year,
      p_template_name: validatedData.template_name,
    });

    if (error) {
      console.error('🔴 API - Error del RPC:', error);
      return NextResponse.json(
        {
          error: 'Error al crear presupuesto mensual',
          details: error,
          rpc_error: {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          },
        },
        { status: 500 },
      );
    }

    console.error(
      '🟡 API - ✅ Presupuesto creado exitosamente, template_id:',
      data,
    );

    // Verificar que se creó consultando la base de datos
    const { data: budgetData, error: fetchError } = await supabase.rpc(
      'get_budget_by_month',
      {
        p_user_id: user.id,
        p_month_year: validatedData.month_year,
      },
    );

    if (fetchError) {
      console.error(
        '🔴 API - Error al verificar presupuesto creado:',
        fetchError,
      );
    } else {
      console.log('🟡 API - Presupuesto verificado:', budgetData);
    }

    return NextResponse.json({
      success: true,
      template_id: data,
      month_year: validatedData.month_year,
      verification: budgetData,
    });
  } catch (error) {
    console.error('🔴 API - Error general:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 },
    );
  }
}

/**
 * GET /api/budget/create
 * Obtiene información sobre presupuestos existentes (para debugging)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 },
      );
    }

    // Obtener todos los templates del usuario
    const { data: templates, error: templatesError } = await supabase
      .from('budget_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('month_year', { ascending: true });

    if (templatesError) {
      console.error('🔴 API - Error obteniendo templates:', templatesError);
      return NextResponse.json(
        { error: 'Error al obtener templates', details: templatesError },
        { status: 500 },
      );
    }

    return NextResponse.json({
      user_id: user.id,
              templates,
      total_templates: templates?.length || 0,
    });
  } catch (error) {
    console.error('🔴 API - Error general en GET:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 },
    );
  }
}
