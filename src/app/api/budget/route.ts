import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

// Schema para validar datos de creación de presupuesto
const CreateBudgetItemSchema = z.object({
  template_id: z.string(),
  category_id: z.string(),
  descripcion: z.string(),
  fecha: z.string(),
  clasificacion: z.string(),
  control: z.string(),
  presupuestado: z.number(),
  real: z.number(),
});

/**
 * POST /api/budget
 * Crea un nuevo item de presupuesto
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
        { error: 'Usuario no autenticado' },
        { status: 401 },
      );
    }

    // Parsear y validar datos del request
    const body = await request.json();
    const validatedData = CreateBudgetItemSchema.parse(body);

    // Buscar IDs de clasificación, control y status por nombre
    const [classificationResult, controlResult, statusResult] =
      await Promise.all([
        supabase
          .from('classifications')
          .select('id')
          .eq('name', validatedData.clasificacion)
          .single(),
        supabase
          .from('controls')
          .select('id')
          .eq('name', validatedData.control)
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
      console.error('Error obteniendo IDs:', {
        classificationResult: classificationResult.error,
        controlResult: controlResult.error,
        statusResult: statusResult.error,
      });
      return NextResponse.json(
        { error: 'Error obteniendo clasificación, control o status' },
        { status: 400 },
      );
    }

    // Crear el nuevo item de presupuesto
    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        user_id: user.id,
        template_id: validatedData.template_id,
        category_id: validatedData.category_id,
        classification_id: classificationResult.data.id,
        control_id: controlResult.data.id,
        status_id: statusResult.data.id, // Usar el UUID del status activo
        name: validatedData.descripcion,
        budgeted_amount: validatedData.presupuestado,
        real_amount: validatedData.real,
        due_date: validatedData.fecha,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creando item de presupuesto:', error);
      return NextResponse.json(
        { error: `Error creando item de presupuesto: ${error.message}` },
        { status: 500 },
      );
    }

    // Transformar datos para respuesta
    const transformedData = {
      id: data.id,
      descripcion: data.name,
      fecha: data.due_date || '',
      clasificacion: validatedData.clasificacion,
      control: validatedData.control,
      presupuestado: parseFloat(data.budgeted_amount) || 0,
      real: parseFloat(data.real_amount) || 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      message: 'Item de presupuesto creado exitosamente',
    });
  } catch (error) {
    console.error('Error en POST /api/budget:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
