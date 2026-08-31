-- Registra el umbral avisado y dice si ES NUEVO, en una sola sentencia atómica.
-- La escritura es la decisión: dos gastos simultáneos no pueden mandar el mismo
-- aviso dos veces, sin locks.
CREATE OR REPLACE FUNCTION mark_budget_alert_sent(
    p_user_id UUID,
    p_month_year VARCHAR(7),
    p_budget_item_id UUID,
    p_threshold INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_insertado INT;
BEGIN
    INSERT INTO budget_alerts_sent (user_id, month_year, budget_item_id, last_threshold)
    VALUES (p_user_id, p_month_year, p_budget_item_id, p_threshold)
    ON CONFLICT (user_id, month_year, budget_item_id)
    DO UPDATE SET last_threshold = EXCLUDED.last_threshold, sent_at = now()
    WHERE budget_alerts_sent.last_threshold < EXCLUDED.last_threshold;

    GET DIAGNOSTICS v_insertado = ROW_COUNT;
    RETURN v_insertado > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
