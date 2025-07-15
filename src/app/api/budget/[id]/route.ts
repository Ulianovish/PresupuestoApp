import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

// Schema para validar datos de actualización de presupuesto
const UpdateBudgetItemSchema = z.object({
  descripcion: z.string().optional(),
  fecha: z.string().optional(),
  presupuestado: z.number().optional(),
  real: z.number().optional(),
  clasificacion: z.string().optional(),
  control: z.string().optional(),
});

/**
 * PATCH /api/budget/[id]
 * Actualiza un item de presupuesto existente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        { status: 401 }
      );
    }

    // Parsear y validar datos del request
    const body = await request.json();
    const validatedData = UpdateBudgetItemSchema.parse(body);

    // Preparar datos de actualización
    const updateData: {
      name?: string;
      due_date?: string;
      budgeted_amount?: number;
      real_amount?: number;
    } = {};

    if (validatedData.descripcion !== undefined) {
      updateData.name = validatedData.descripcion;
    }
    if (validatedData.fecha !== undefined) {
      updateData.due_date = validatedData.fecha;
    }
    if (validatedData.presupuestado !== undefined) {
      updateData.budgeted_amount = validatedData.presupuestado;
    }
    if (validatedData.real !== undefined) {
      updateData.real_amount = validatedData.real;
    }

    // Actualizar el item de presupuesto en Supabase
    const { data, error } = await supabase
      .from('budget_items')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando item de presupuesto:', error);
      return NextResponse.json(
        { error: `Error actualizando item de presupuesto: ${error.message}` },
        { status: 500 }
      );
    }

    // Transformar datos para respuesta
    const transformedData = {
      id: data.id,
      descripcion: data.name,
      fecha: data.due_date || '',
      clasificacion: validatedData.clasificacion || '',
      control: validatedData.control || '',
      presupuestado: parseFloat(data.budgeted_amount) || 0,
      real: parseFloat(data.real_amount) || 0,
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      message: 'Item de presupuesto actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error en PATCH /api/budget/[id]:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/budget/[id]
 * Elimina un item de presupuesto existente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
        { status: 401 }
      );
    }

    // Eliminar el item de presupuesto
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error eliminando item de presupuesto:', error);
      return NextResponse.json(
        { error: `Error eliminando item de presupuesto: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Item de presupuesto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/budget/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
