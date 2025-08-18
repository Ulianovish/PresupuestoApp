/**
 * API Routes para facturas electrónicas
 * Proporciona endpoints REST para operaciones CRUD
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  validateCufeCode,
  normalizeCufeCode,
} from '@/lib/validations/cufe-validator';
import type { CreateElectronicInvoiceData } from '@/types/electronic-invoices';

// GET /api/electronic-invoices - Obtener facturas del usuario
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const supplierName = searchParams.get('supplier_name');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Construir query base
    let query = supabase
      .from('electronic_invoices')
      .select(
        `
        id,
        cufe_code,
        supplier_name,
        supplier_nit,
        invoice_date,
        total_amount,
        extracted_data,
        pdf_url,
        processed_at,
        created_at,
        updated_at
      `,
      )
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false })
      .range(offset, offset + limit - 1);

    // Aplicar filtros opcionales
    if (startDate) {
      query = query.gte('invoice_date', startDate);
    }
    if (endDate) {
      query = query.lte('invoice_date', endDate);
    }
    if (supplierName) {
      query = query.ilike('supplier_name', `%${supplierName}%`);
    }

    const { data: invoices, error } = await query;

    if (error) {
      console.error('Error obteniendo facturas:', error);
      return NextResponse.json(
        { error: 'Error obteniendo facturas' },
        { status: 500 },
      );
    }

    // Obtener estadísticas adicionales
    const { data: stats } = await supabase
      .from('electronic_invoices')
      .select('count(*), total_amount.sum()')
      .eq('user_id', user.id);

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices || [],
        pagination: {
          limit,
          offset,
          total: stats?.[0]?.count || 0,
        },
        summary: {
          total_invoices: stats?.[0]?.count || 0,
          total_amount: stats?.[0]?.sum || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error en GET /api/electronic-invoices:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}

// POST /api/electronic-invoices - Crear nueva factura
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const invoiceData: CreateElectronicInvoiceData = body;

    // Validar datos requeridos
    if (
      !invoiceData.cufe_code ||
      !invoiceData.invoice_date ||
      !invoiceData.total_amount
    ) {
      return NextResponse.json(
        {
          error:
            'Faltan campos requeridos: cufe_code, invoice_date, total_amount',
        },
        { status: 400 },
      );
    }

    // Normalizar y validar CUFE
    const normalizedCufe = normalizeCufeCode(invoiceData.cufe_code);
    const validation = await validateCufeCode(normalizedCufe);

    if (!validation.format_valid) {
      return NextResponse.json(
        { error: 'Formato de CUFE inválido' },
        { status: 400 },
      );
    }

    // Verificar que no exista duplicado
    const { data: existingInvoice } = await supabase
      .from('electronic_invoices')
      .select('id')
      .eq('user_id', user.id)
      .eq('cufe_code', normalizedCufe)
      .single();

    if (existingInvoice) {
      return NextResponse.json(
        { error: 'Ya existe una factura con este código CUFE' },
        { status: 409 },
      );
    }

    // Insertar factura
    const { data: newInvoice, error } = await supabase
      .from('electronic_invoices')
      .insert({
        user_id: user.id,
        cufe_code: normalizedCufe,
        supplier_name: invoiceData.supplier_name,
        supplier_nit: invoiceData.supplier_nit,
        invoice_date: invoiceData.invoice_date,
        total_amount: invoiceData.total_amount,
        extracted_data: invoiceData.extracted_data,
        pdf_url: invoiceData.pdf_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creando factura:', error);
      return NextResponse.json(
        { error: 'Error creando factura' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: newInvoice,
      message: 'Factura creada exitosamente',
    });
  } catch (error) {
    console.error('Error en POST /api/electronic-invoices:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 },
    );
  }
}
