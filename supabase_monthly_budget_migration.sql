-- ============================================
-- MIGRACIÓN PARA PRESUPUESTOS MENSUALES
-- Mejoras para manejar presupuestos por mes
-- ============================================

-- Agregar campo month_year a budget_templates
ALTER TABLE budget_templates 
ADD COLUMN month_year VARCHAR(7) DEFAULT '2025-07'; -- Formato YYYY-MM

-- Crear índice único para user_id + month_year
CREATE UNIQUE INDEX idx_budget_templates_user_month 
ON budget_templates(user_id, month_year);

-- Agregar campos faltantes a budget_items para manejar mejor los datos
ALTER TABLE budget_items 
ADD COLUMN due_date VARCHAR(50), -- Para fechas como "5/mes", "29/mes"
ADD COLUMN real_amount DECIMAL(12,2) DEFAULT 0.00; -- Monto real gastado

-- Comentar que spent_amount será para el total acumulado y real_amount para transacciones individuales
COMMENT ON COLUMN budget_items.spent_amount IS 'Monto total acumulado gastado';
COMMENT ON COLUMN budget_items.real_amount IS 'Monto real de la transacción específica';

-- Actualizar budget_templates existentes (si hay alguna)
UPDATE budget_templates 
SET month_year = '2025-07' 
WHERE month_year IS NULL;

-- Hacer el campo month_year obligatorio
ALTER TABLE budget_templates 
ALTER COLUMN month_year SET NOT NULL;

-- Agregar índice para mejorar búsquedas por mes
CREATE INDEX idx_budget_templates_month_year 
ON budget_templates(month_year);

-- Crear función para obtener presupuesto por mes
CREATE OR REPLACE FUNCTION get_budget_by_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    template_id UUID,
    template_name VARCHAR(255),
    category_id UUID,
    category_name VARCHAR(100),
    category_color VARCHAR(7),
    category_icon VARCHAR(50),
    item_id UUID,
    item_name VARCHAR(255),
    item_description TEXT,
    due_date VARCHAR(50),
    classification_name VARCHAR(50),
    classification_color VARCHAR(7),
    control_name VARCHAR(50),
    control_color VARCHAR(7),
    budgeted_amount DECIMAL(12,2),
    real_amount DECIMAL(12,2),
    spent_amount DECIMAL(12,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bt.id as template_id,
        bt.name as template_name,
        c.id as category_id,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        bi.id as item_id,
        bi.name as item_name,
        bi.description as item_description,
        bi.due_date,
        cl.name as classification_name,
        cl.color as classification_color,
        co.name as control_name,
        co.color as control_color,
        bi.budgeted_amount,
        bi.real_amount,
        bi.spent_amount
    FROM budget_templates bt
    LEFT JOIN budget_items bi ON bt.id = bi.template_id
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN classifications cl ON bi.classification_id = cl.id
    LEFT JOIN controls co ON bi.control_id = co.id
    WHERE bt.user_id = p_user_id 
    AND bt.month_year = p_month_year
    AND bt.is_active = true
    AND (bi.is_active = true OR bi.id IS NULL)
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear o actualizar presupuesto mensual
CREATE OR REPLACE FUNCTION upsert_monthly_budget(
    p_user_id UUID,
    p_month_year VARCHAR(7),
    p_template_name VARCHAR(255) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    template_id UUID;
    default_name VARCHAR(255);
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

    RETURN template_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear categorías adicionales que faltan en los datos mockeados
INSERT INTO categories (name, description, color, icon) VALUES
('IMPUESTOS', 'Impuestos y obligaciones fiscales', '#dc2626', 'receipt'),
('ALICE', 'Gastos relacionados con Alice', '#ec4899', 'user'),
('ABRIL', 'Gastos relacionados con Abril', '#f97316', 'user'),
('MASCOTAS', 'Gastos de mascotas', '#84cc16', 'heart'),
('COMUNICACIONES', 'Gastos de comunicación', '#06b6d4', 'phone'),
('MERCADO', 'Gastos de supermercado y alimentación', '#10b981', 'shopping-cart'),
('GASTOS PERSONALES', 'Gastos personales y entretenimiento', '#8b5cf6', 'user-circle')
ON CONFLICT (name) DO NOTHING;

-- Otorgar permisos a las nuevas funciones
GRANT EXECUTE ON FUNCTION get_budget_by_month(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_monthly_budget(UUID, VARCHAR, VARCHAR) TO authenticated;

-- Comentarios para documentación
COMMENT ON FUNCTION get_budget_by_month IS 'Obtiene el presupuesto completo de un usuario para un mes específico';
COMMENT ON FUNCTION upsert_monthly_budget IS 'Crea o actualiza un template de presupuesto mensual'; 