DROP FUNCTION IF EXISTS get_budget_by_month(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION get_budget_by_month(p_user_id UUID, p_month_year VARCHAR)
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
    deuda_id UUID
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
        bi.spent_amount,
        bi.deuda_id
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
