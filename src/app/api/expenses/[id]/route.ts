import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

// Schema para validar datos de actualización de gastos
const UpdateExpenseSchema = z.object({
  description: z.string().optional(),
  amount: z.number().optional(),
  transaction_date: z.string().optional(),
  category_name: z.string().optional(),
  account_name: z.string().optional(),
  place: z.string().optional(),
});

/**
 * PATCH /api/expenses/[id]
 * Actualiza un gasto existente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extraer params de forma async (Next.js 15)
    const { id } = await params;

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
    const validatedData = UpdateExpenseSchema.parse(body);

    // Obtener ID de la cuenta si se está actualizando
    let accountId: string | undefined;
    if (validatedData.account_name) {
      const { data: accounts, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', validatedData.account_name)
        .single();

      if (accountError) {
        return NextResponse.json(
          { error: 'Cuenta no encontrada' },
          { status: 400 }
        );
      }

      accountId = accounts?.id;
    }

    // Preparar datos de actualización
    const updateData: {
      description?: string;
      amount?: number;
      transaction_date?: string;
      month_year?: string;
      category_name?: string;
      place?: string;
      account_id?: string;
    } = {};
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    if (validatedData.amount !== undefined) {
      updateData.amount = validatedData.amount;
    }
    if (validatedData.transaction_date !== undefined) {
      updateData.transaction_date = validatedData.transaction_date;
      updateData.month_year = validatedData.transaction_date.slice(0, 7); // YYYY-MM
    }
    if (validatedData.category_name !== undefined) {
      updateData.category_name = validatedData.category_name;
    }
    if (validatedData.place !== undefined) {
      updateData.place = validatedData.place;
    }
    if (accountId) {
      updateData.account_id = accountId;
    }

    // Actualizar la transacción en Supabase
    const { data, error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando gasto:', error);
      return NextResponse.json(
        { error: `Error actualizando gasto: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Gasto actualizado exitosamente',
    });
  } catch (error) {
    console.error('Error en PATCH /api/expenses/[id]:', error);

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
 * DELETE /api/expenses/[id]
 * Elimina un gasto existente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Extraer params de forma async (Next.js 15)
    const { id } = await params;

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

    // Eliminar la transacción
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error eliminando gasto:', error);
      return NextResponse.json(
        { error: `Error eliminando gasto: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Gasto eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error en DELETE /api/expenses/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
