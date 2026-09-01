-- Task 8 (alertas de presupuesto): get_budget_by_month no devolvía
-- alerts_enabled, así que cada carga de /presupuesto perdía el override del
-- usuario en el primer guardado posterior (el formulario mandaba el objeto
-- completo, con alertsEnabled undefined -> null, pisando true/false con NULL
-- sin avisar). Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md
--
-- Postgres no deja cambiar el RETURNS TABLE de una función con
-- CREATE OR REPLACE (falla con "cannot change return type of existing
-- function"), así que hace falta DROP + CREATE. El cuerpo es una copia
-- textual del de supabase/migrations/20260804120000_gastos_rollup_presupuesto.sql
-- (líneas ~93-138): mismo WHERE, mismo JOIN, mismo ORDER BY. Único cambio:
-- la columna alerts_enabled agregada al final del RETURNS TABLE y del SELECT.

DROP FUNCTION IF EXISTS get_budget_by_month(UUID, VARCHAR);

CREATE FUNCTION get_budget_by_month(p_user_id UUID, p_month_year VARCHAR)
RETURNS TABLE(
    template_id UUID,
    template_name VARCHAR,
    category_id UUID,
    category_name VARCHAR,
    category_color VARCHAR,
    category_icon VARCHAR,
    item_id UUID,
    item_name VARCHAR,
    item_description TEXT,
    due_date VARCHAR,
    classification_name VARCHAR,
    classification_color VARCHAR,
    control_name VARCHAR,
    control_color VARCHAR,
    budgeted_amount NUMERIC,
    real_amount NUMERIC,
    spent_amount NUMERIC,
    deuda_id UUID,
    alerts_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        bt.id, bt.name, c.id, c.name, c.color, c.icon,
        bi.id, bi.name, bi.description, bi.due_date,
        cl.name, cl.color, co.name, co.color,
        bi.budgeted_amount,
        -- Real híbrido: si hay gastos asignados, su suma; si no, el manual
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             JOIN transaction_types tt ON t.type_id = tt.id
             WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
            bi.real_amount
        ) AS real_amount,
        bi.spent_amount,
        bi.deuda_id,
        bi.alerts_enabled
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_budget_by_month(UUID, VARCHAR) TO authenticated;
