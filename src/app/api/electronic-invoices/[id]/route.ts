/**
 * API Routes para operaciones específicas de facturas electrónicas
 * Maneja GET, PUT, DELETE para una factura individual
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { UpdateElectronicInvoiceData } from '@/types/electronic-invoices';

interface RouteContext {
  params: {
    id: string;
  };
}

// GET /api/electronic-invoices/[id] - Obtener factura específica
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de factura requerido' },
        { status: 400 },
      );
    }

    // Obtener factura con gastos relacionados
    const { data: invoice, error } = await supabase
      .from('electronic_invoices')
      .select(
        `
        *,
        related_expenses:transactions!electronic_invoice_id(
          id,
          description,
          amount,
          transaction_date,
          category_name,
          place,
          created_at
        )
      `,
      )
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Factura no encontrada' },
          { status: 404 },
        );
      }

      console.error('Error obteniendo factura:', error);
      return NextResponse.json(
        { error: 'Error obteniendo factura' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    console.error('Error en GET /api/electronic-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

// PUT /api/electronic-invoices/[id] - Actualizar factura
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const updateData: UpdateElectronicInvoiceData = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de factura requerido' },
        { status: 400 },
      );
    }

    // Verificar que la factura existe y pertenece al usuario
    const { data: existingInvoice, error: checkError } = await supabase
      .from('electronic_invoices')
      .select('id, cufe_code')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (checkError || !existingInvoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 },
      );
    }

    // Preparar datos de actualización
    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.supplier_name !== undefined) {
      updateFields.supplier_name = updateData.supplier_name;
    }
    if (updateData.supplier_nit !== undefined) {
      updateFields.supplier_nit = updateData.supplier_nit;
    }
    if (updateData.invoice_date !== undefined) {
      updateFields.invoice_date = updateData.invoice_date;
    }
    if (updateData.total_amount !== undefined) {
      updateFields.total_amount = updateData.total_amount;
    }
    if (updateData.extracted_data !== undefined) {
      updateFields.extracted_data = updateData.extracted_data;
    }
    if (updateData.pdf_url !== undefined) {
      updateFields.pdf_url = updateData.pdf_url;
    }

    // Actualizar factura
    const { data: updatedInvoice, error } = await supabase
      .from('electronic_invoices')
      .update(updateFields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error actualizando factura:', error);
      return NextResponse.json(
        { error: 'Error actualizando factura' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: 'Factura actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error en PUT /api/electronic-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

// DELETE /api/electronic-invoices/[id] - Eliminar factura
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID de factura requerido' },
        { status: 400 },
      );
    }

    // Verificar que la factura existe y pertenece al usuario
    const { data: existingInvoice, error: checkError } = await supabase
      .from('electronic_invoices')
      .select('id, cufe_code, supplier_name')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (checkError || !existingInvoice) {
      return NextResponse.json(
        { error: 'Factura no encontrada' },
        { status: 404 },
      );
    }

    // Verificar si tiene gastos relacionados
    const { data: relatedExpenses } = await supabase
      .from('transactions')
      .select('id')
      .eq('electronic_invoice_id', id)
      .eq('user_id', user.id);

    const hasRelatedExpenses = relatedExpenses && relatedExpenses.length > 0;

    // Obtener parámetro para forzar eliminación
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    if (hasRelatedExpenses && !force) {
      return NextResponse.json(
        {
          error: 'La factura tiene gastos relacionados',
          details: {
            related_expenses_count: relatedExpenses.length,
            message:
              'Use el parámetro ?force=true para eliminar la factura y sus gastos relacionados',
          },
        },
        { status: 409 },
      );
    }

    // Si se fuerza la eliminación, eliminar gastos relacionados primero
    if (hasRelatedExpenses && force) {
      const { error: deleteExpensesError } = await supabase
        .from('transactions')
        .delete()
        .eq('electronic_invoice_id', id)
        .eq('user_id', user.id);

      if (deleteExpensesError) {
        console.error(
          'Error eliminando gastos relacionados:',
          deleteExpensesError,
        );
        return NextResponse.json(
          { error: 'Error eliminando gastos relacionados' },
          { status: 500 },
        );
      }
    }

    // Eliminar factura
    const { error: deleteError } = await supabase
      .from('electronic_invoices')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error eliminando factura:', deleteError);
      return NextResponse.json(
        { error: 'Error eliminando factura' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Factura de ${existingInvoice.supplier_name} eliminada exitosamente`,
      data: {
        deleted_invoice_id: id,
        deleted_expenses_count: hasRelatedExpenses ? relatedExpenses.length : 0,
      },
    });
  } catch (error) {
    console.error('Error en DELETE /api/electronic-invoices/[id]:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
