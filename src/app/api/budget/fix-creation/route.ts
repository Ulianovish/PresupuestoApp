import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/budget/fix-creation
 * Aplica fix para crear presupuestos con budget_items
 */
export async function POST(_request: NextRequest) {
  try {
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

    console.log(
      '🔧 Fix - Aplicando migración para mejorar creación de presupuestos...',
    );

    // Crear la función mejorada
    const migrationSQL = `
-- Función mejorada para crear presupuesto mensual con items
CREATE OR REPLACE FUNCTION upsert_monthly_budget_with_items(
    p_user_id UUID,
    p_month_year VARCHAR(7),
    p_template_name VARCHAR(255) DEFAULT NULL,
    p_copy_from_previous BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    template_id UUID;
    default_name VARCHAR(255);
    previous_template_id UUID;
    items_copied INTEGER := 0;
BEGIN
    -- Generar nombre por defecto si no se proporciona
    IF p_template_name IS NULL THEN
        default_name := 'Presupuesto ' || p_month_year;
    ELSE
        default_name := p_template_name;
    END IF;

    -- Insertar o actualizar template
    INSERT INTO budget_templates (user_id, name, month_year)
    VALUES (p_user_id, default_name, p_month_year)
    ON CONFLICT (user_id, month_year) 
    DO UPDATE SET 
        name = EXCLUDED.name,
        updated_at = NOW()
    RETURNING id INTO template_id;

    -- Si queremos copiar del mes anterior y el template es nuevo
    IF p_copy_from_previous THEN
        -- Buscar el template del mes anterior más reciente
        SELECT id INTO previous_template_id
        FROM budget_templates 
        WHERE user_id = p_user_id 
        AND month_year < p_month_year
        AND is_active = true
        ORDER BY month_year DESC
        LIMIT 1;

        -- Si encontramos un template anterior, copiar sus budget_items
        IF previous_template_id IS NOT NULL THEN
            -- Verificar si ya existen items para este template
            IF NOT EXISTS (
                SELECT 1 FROM budget_items 
                WHERE template_id = template_id 
                AND is_active = true
            ) THEN
                -- Copiar budget_items del template anterior
                INSERT INTO budget_items (
                    user_id,
                    template_id,
                    category_id,
                    classification_id,
                    control_id,
                    status_id,
                    name,
                    description,
                    budgeted_amount,
                    spent_amount,
                    real_amount,
                    due_date
                )
                SELECT 
                    p_user_id,
                    template_id,
                    category_id,
                    classification_id,
                    control_id,
                    status_id,
                    name,
                    description,
                    budgeted_amount,
                    0.00 as spent_amount,  -- Resetear gastos
                    0.00 as real_amount,   -- Resetear montos reales
                    due_date
                FROM budget_items
                WHERE template_id = previous_template_id
                AND is_active = true;

                -- Contar items copiados
                GET DIAGNOSTICS items_copied = ROW_COUNT;
            END IF;
        END IF;
    END IF;

    RETURN template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

    const { error: migrationError } = await supabase.rpc('exec', {
      query: migrationSQL,
    });

    if (migrationError) {
      console.error('🔧 Fix - Error aplicando migración:', migrationError);

      // Intentar con método alternativo usando supabase.from
      try {
        const { error: altError } = await supabase.rpc('query', {
          query: migrationSQL,
        });

        if (altError) {
          throw altError;
        }
      } catch (altError) {
        return NextResponse.json(
          {
            error: 'Error aplicando migración',
            details: migrationError,
            alternative_error: altError,
          },
          { status: 500 },
        );
      }
    }

    console.log('🔧 Fix - ✅ Migración aplicada exitosamente');

    // Actualizar la función original
    const updateOriginalSQL = `
CREATE OR REPLACE FUNCTION upsert_monthly_budget(
    p_user_id UUID,
    p_month_year VARCHAR(7),
    p_template_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
    -- Usar la nueva función que copia items automáticamente
    RETURN upsert_monthly_budget_with_items(
        p_user_id, 
        p_month_year, 
        p_template_name, 
        TRUE  -- Copiar del mes anterior por defecto
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

    const { error: updateError } = await supabase.rpc('exec', {
      query: updateOriginalSQL,
    });

    if (updateError) {
      console.warn(
        '🔧 Fix - Warning al actualizar función original:',
        updateError,
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Migración aplicada exitosamente',
      migration_applied: true,
      original_function_updated: !updateError,
    });
  } catch (error) {
    console.error('🔧 Fix - Error general:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 },
    );
  }
}

/**
 * GET /api/budget/fix-creation
 * Prueba la función mejorada de creación de presupuestos
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

    // Probar la nueva función con septiembre
    const { data, error } = await supabase.rpc(
      'upsert_monthly_budget_with_items',
      {
        p_user_id: user.id,
        p_month_year: '2025-09',
        p_template_name: 'Presupuesto Septiembre 2025 (Con Items)',
        p_copy_from_previous: true,
      },
    );

    if (error) {
      return NextResponse.json(
        {
          error: 'Error probando función mejorada',
          details: error,
        },
        { status: 500 },
      );
    }

    // Verificar cuántos items se crearon
    const { data: itemsData, error: itemsError } = await supabase
      .from('budget_items')
      .select('*')
      .eq('template_id', data)
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      template_id: data,
      items_created: itemsData?.length || 0,
      items_details: itemsData || [],
      test_month: '2025-09',
    });
  } catch (error) {
    console.error('🔧 Fix - Error general en GET:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor', details: error },
      { status: 500 },
    );
  }
}
