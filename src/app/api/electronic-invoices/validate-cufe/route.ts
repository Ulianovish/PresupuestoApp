/**
 * API Route para validación rápida de códigos CUFE
 * Valida formato y verifica duplicados sin procesar la factura completa
 */

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import {
  validateCufeCode,
  normalizeCufeCode,
  extractCufeFromQR,
} from '@/lib/validations/cufe-validator';

// POST /api/electronic-invoices/validate-cufe - Validar código CUFE
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
    const { cufe_code, qr_content } = body;

    if (!cufe_code && !qr_content) {
      return NextResponse.json(
        { error: 'Se requiere cufe_code o qr_content' },
        { status: 400 },
      );
    }

    let finalCufeCode = cufe_code;

    // Si se proporciona contenido de QR, extraer CUFE
    if (qr_content && !cufe_code) {
      finalCufeCode = extractCufeFromQR(qr_content);

      if (!finalCufeCode) {
        return NextResponse.json({
          success: false,
          valid: false,
          error:
            'No se pudo extraer un código CUFE válido del contenido del QR',
          details: {
            qr_content_received: true,
            cufe_extracted: false,
          },
        });
      }
    }

    if (!finalCufeCode) {
      return NextResponse.json(
        { error: 'Código CUFE requerido' },
        { status: 400 },
      );
    }

    // Normalizar CUFE
    const normalizedCufe = normalizeCufeCode(finalCufeCode);

    // Función para verificar duplicados específica para este usuario
    const checkCufeExists = async (cufe: string): Promise<boolean> => {
      const { data } = await supabase.rpc('check_cufe_exists', {
        p_user_id: user.id,
        p_cufe_code: cufe,
      });
      return data || false;
    };

    // Validar formato
    const validationResult = validateCufeCode(normalizedCufe);

    // Verificar si ya existe
    const alreadyExists = await checkCufeExists(normalizedCufe);

    // Información adicional sobre la factura si ya existe
    let existingInvoiceInfo = null;
    if (alreadyExists) {
      const { data: existingInvoice } = await supabase
        .from('electronic_invoices')
        .select(
          `
          id,
          supplier_name,
          supplier_nit,
          invoice_date,
          total_amount,
          processed_at,
          related_expenses:transactions!electronic_invoice_id(count)
        `,
        )
        .eq('user_id', user.id)
        .eq('cufe_code', normalizedCufe)
        .single();

      if (existingInvoice) {
        existingInvoiceInfo = {
          id: existingInvoice.id,
          supplier_name: existingInvoice.supplier_name,
          supplier_nit: existingInvoice.supplier_nit,
          invoice_date: existingInvoice.invoice_date,
          total_amount: existingInvoice.total_amount,
          processed_at: existingInvoice.processed_at,
          has_expenses:
            (existingInvoice.related_expenses as { count: number }[])?.[0]
              ?.count > 0,
        };
      }
    }

    const response: {
      success: boolean;
      valid: boolean;
      cufe_code: string;
      original_cufe: string;
      validation: {
        format_valid: boolean;
        already_exists: boolean;
        error_message?: string;
      };
      existing_invoice: {
        id: string;
        supplier_name: string;
        supplier_nit: string;
        invoice_date: string;
        total_amount: number;
        processed_at: string;
        has_expenses: boolean;
      } | null;
      qr_processing?: {
        original_content: string;
        cufe_extracted: boolean;
        extraction_method: string;
      };
    } = {
      success: true,
      valid: validationResult.isValid,
      cufe_code: normalizedCufe,
      original_cufe: finalCufeCode,
      validation: {
        format_valid: validationResult.isValid,
        already_exists: alreadyExists,
        error_message: validationResult.error,
      },
      existing_invoice: existingInvoiceInfo,
    };

    // Si se extrajo de QR, incluir información adicional
    if (qr_content) {
      response.qr_processing = {
        original_content: qr_content,
        cufe_extracted: !!finalCufeCode,
        extraction_method: 'automatic',
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error(
      'Error en POST /api/electronic-invoices/validate-cufe:',
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 },
    );
  }
}

// GET /api/electronic-invoices/validate-cufe?cufe=... - Validar CUFE por GET
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
    const cufeCode = searchParams.get('cufe');

    if (!cufeCode) {
      return NextResponse.json(
        { error: 'Parámetro cufe requerido' },
        { status: 400 },
      );
    }

    // Normalizar CUFE
    const normalizedCufe = normalizeCufeCode(cufeCode);

    // Función para verificar duplicados
    const checkCufeExists = async (cufe: string): Promise<boolean> => {
      const { data } = await supabase.rpc('check_cufe_exists', {
        p_user_id: user.id,
        p_cufe_code: cufe,
      });
      return data || false;
    };

    // Validar formato
    const validationResult = await validateCufeCode(normalizedCufe);

    // Verificar si ya existe
    const alreadyExists = await checkCufeExists(normalizedCufe);

    return NextResponse.json({
      success: true,
      valid: validationResult.isValid,
      cufe_code: normalizedCufe,
      original_cufe: cufeCode,
      validation: {
        format_valid: validationResult.isValid,
        already_exists: alreadyExists,
        error_message: validationResult.error,
      },
    });
  } catch (error) {
    console.error(
      'Error en GET /api/electronic-invoices/validate-cufe:',
      error,
    );
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 },
    );
  }
}
