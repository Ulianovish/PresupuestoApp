import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { itemSigueEnCategoria } from '@/lib/services/expense-category-item';
import { createClient } from '@/lib/supabase/server';
import { toTitleCase } from '@/lib/text-case';

// Schema para validar datos de actualización de gastos
const UpdateExpenseSchema = z.object({
  description: z.string().optional(),
  amount: z.coerce.number().optional(),
  transaction_date: z.string().optional(),
  category_name: z.string().optional(),
  account_name: z.string().optional(),
  place: z.string().optional(),
  purchase_total: z.coerce.number().nullable().optional(),
  installments: z.coerce.number().int().nullable().optional(),
});

/**
 * PATCH /api/expenses/[id]
 * Actualiza un gasto existente
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
        { status: 401 },
      );
    }

    // Parsear y validar datos del request
    const body = await request.json();
    const validatedData = UpdateExpenseSchema.parse(body);

    // Obtener ID de la cuenta si se está actualizando
    let accountId: string | undefined;
    if (validatedData.account_name) {
      const { data: account } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', validatedData.account_name)
        .maybeSingle();

      if (account) {
        accountId = account.id;
      } else {
        // La cuenta aún no existe para este usuario: se crea al vuelo, igual
        // que al registrar un gasto (upsert_monthly_expense). Antes esto
        // devolvía 400 y la edición fallaba en silencio.
        const name = validatedData.account_name;
        const type = /TC|tarjeta|credito/i.test(name)
          ? 'credit'
          : /efectivo|cash/i.test(name)
            ? 'cash'
            : 'bank';
        const { data: created, error: createError } = await supabase
          .from('accounts')
          .insert({ user_id: user.id, name, type })
          .select('id')
          .single();

        if (createError || !created) {
          console.error('Error creando cuenta:', createError);
          return NextResponse.json(
            { error: `No se pudo crear la cuenta "${name}"` },
            { status: 400 },
          );
        }
        accountId = created.id;
      }
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
      budget_item_id?: string | null;
      purchase_total?: number | null;
      installments?: number | null;
    } = {};
    if (validatedData.description !== undefined) {
      updateData.description = toTitleCase(validatedData.description);
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

      // El ítem asignado puede ser de la categoría anterior. Si ya no
      // corresponde se suelta: el gasto queda sin clasificar (visible en rojo)
      // en vez de seguir sumando en una categoría que no es la suya.
      const { data: actual } = await supabase
        .from('transactions')
        .select('budget_item_id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (actual?.budget_item_id) {
        const { data: item } = await supabase
          .from('budget_items')
          .select('categories(name)')
          .eq('id', actual.budget_item_id)
          .single();

        const categoriaDelItem = (
          item as { categories?: { name?: string } | null } | null
        )?.categories?.name;

        if (
          !itemSigueEnCategoria(validatedData.category_name, categoriaDelItem)
        ) {
          updateData.budget_item_id = null;
        }
      }
    }
    if (validatedData.place !== undefined) {
      updateData.place = toTitleCase(validatedData.place);
    }
    // Compras a cuotas: el trigger de la base ajusta el saldo de la tarjeta
    // con la diferencia, así que basta con guardar el valor nuevo.
    if (validatedData.purchase_total !== undefined) {
      updateData.purchase_total = validatedData.purchase_total;
    }
    if (validatedData.installments !== undefined) {
      updateData.installments = validatedData.installments;
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
        { status: 500 },
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
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/expenses/[id]
 * Elimina un gasto existente
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
        { status: 401 },
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
        { status: 500 },
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
      { status: 500 },
    );
  }
}
