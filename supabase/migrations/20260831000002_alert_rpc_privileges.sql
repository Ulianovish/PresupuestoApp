-- Los dos RPCs de alertas son SECURITY DEFINER y reciben p_user_id POR
-- PARÁMETRO, así que sin esto cualquiera con la anon key podía pasarle el id de
-- otra persona: leerle el presupuesto, o marcarle un umbral altísimo y dejarla
-- sin alertas para siempre. Postgres le da EXECUTE a PUBLIC por defecto en las
-- funciones (no en las tablas), y ese default acá no estaba revocado.

-- 1. mark_budget_alert_sent escribe, y SOLO lo llama el webhook con
-- service-role, que no pasa por estos grants. Nadie más tiene por qué tocarlo.
REVOKE EXECUTE ON FUNCTION mark_budget_alert_sent(UUID, VARCHAR, UUID, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION mark_budget_alert_sent(UUID, VARCHAR, UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION mark_budget_alert_sent(UUID, VARCHAR, UUID, INT) FROM authenticated;

-- 2. get_budget_alert_status SÍ lo llama el navegador (el panel del dashboard),
-- así que no se puede revocar: se blinda por dentro. Un cliente autenticado solo
-- puede pedir lo suyo; el service-role (auth.uid() NULL) sigue pasando libre.
CREATE OR REPLACE FUNCTION get_budget_alert_status(
    p_user_id UUID,
    p_month_year VARCHAR(7)
)
RETURNS TABLE (
    budget_item_id UUID,
    item_name VARCHAR,
    category_name VARCHAR,
    budgeted DECIMAL(12,2),
    spent DECIMAL(12,2)
) AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'No podés consultar el presupuesto de otro usuario';
    END IF;

    RETURN QUERY
    SELECT
        bi.id,
        bi.name,
        c.name,
        bi.budgeted_amount,
        COALESCE(SUM(t.amount), 0)::DECIMAL(12,2)
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    LEFT JOIN categories c ON c.id = bi.category_id
    LEFT JOIN classifications cl ON cl.id = bi.classification_id
    LEFT JOIN transactions t
           ON t.budget_item_id = bi.id
          AND t.month_year = p_month_year
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND bi.is_active = true
      AND bi.budgeted_amount > 0
      AND COALESCE(bi.alerts_enabled, cl.name = 'Variable')
    GROUP BY bi.id, bi.name, c.name, bi.budgeted_amount
    ORDER BY c.name, bi.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION get_budget_alert_status(UUID, VARCHAR) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_budget_alert_status(UUID, VARCHAR) FROM anon;
GRANT EXECUTE ON FUNCTION get_budget_alert_status(UUID, VARCHAR) TO authenticated;
