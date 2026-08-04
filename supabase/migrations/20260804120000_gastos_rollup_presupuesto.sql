-- ============================================================
-- Roll-up de Gastos -> Presupuesto
-- - budget_item_source: marca si el vínculo lo puso la IA o el usuario
-- - assign_expense_budget_item: asigna un gasto a un ítem (validando mismo mes)
-- - get_unclassified_expenses: gastos del mes sin ítem asignado
-- - get_budget_items_for_month: ítems del mes (para dropdown y clasificador)
-- - get_budget_by_month: "Real" híbrido (suma de gastos o valor manual)
-- ============================================================

-- 1. Columna para saber el origen del vínculo ('ai' | 'manual')
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS budget_item_source VARCHAR(10);

-- 2. Asignar un gasto a un ítem del presupuesto (solo del mismo mes del gasto)
CREATE OR REPLACE FUNCTION assign_expense_budget_item(
    p_user_id UUID,
    p_transaction_id UUID,
    p_budget_item_id UUID,
    p_source VARCHAR
)
RETURNS VOID AS $$
BEGIN
    UPDATE transactions t
    SET budget_item_id = p_budget_item_id,
        budget_item_source = p_source,
        updated_at = now()
    WHERE t.id = p_transaction_id
      AND t.user_id = p_user_id
      AND (
        p_budget_item_id IS NULL
        OR EXISTS (
            SELECT 1
            FROM budget_items bi
            JOIN budget_templates bt ON bt.id = bi.template_id
            WHERE bi.id = p_budget_item_id
              AND bt.user_id = p_user_id
              AND bt.month_year = t.month_year
        )
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ítems del presupuesto de un mes (id, nombre, categoría)
CREATE OR REPLACE FUNCTION get_budget_items_for_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    item_id UUID,
    item_name VARCHAR,
    category_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT bi.id, bi.name, c.name
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    LEFT JOIN categories c ON c.id = bi.category_id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND bi.is_active = true
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Gastos del mes sin ítem asignado (para el panel rojo)
CREATE OR REPLACE FUNCTION get_unclassified_expenses(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    id UUID,
    description TEXT,
    amount DECIMAL(12,2),
    category_name VARCHAR(100),
    transaction_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.description, t.amount, t.category_name, t.transaction_date
    FROM transactions t
    JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto'
      AND t.budget_item_id IS NULL
    ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. get_budget_by_month con "Real" híbrido
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

GRANT EXECUTE ON FUNCTION assign_expense_budget_item(UUID, UUID, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_budget_items_for_month(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_unclassified_expenses(UUID, VARCHAR) TO authenticated;
