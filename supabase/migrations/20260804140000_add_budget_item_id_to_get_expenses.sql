-- ============================================================
-- get_expenses_by_month: incluir budget_item_id
-- Permite mostrar y reasignar el ítem de presupuesto de cada gasto
-- desde la página de Gastos.
-- ============================================================

DROP FUNCTION IF EXISTS get_expenses_by_month(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION get_expenses_by_month(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    id UUID,
    description TEXT,
    amount DECIMAL(12,2),
    transaction_date DATE,
    category_name VARCHAR(100),
    account_name VARCHAR(255),
    place VARCHAR(255),
    created_at TIMESTAMPTZ,
    budget_item_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.description,
        t.amount,
        t.transaction_date,
        t.category_name,
        a.name as account_name,
        t.place,
        t.created_at,
        t.budget_item_id
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto'
    ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_expenses_by_month(UUID, VARCHAR) TO authenticated;
