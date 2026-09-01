-- Alertas de presupuesto por rubro.
-- Ver docs/superpowers/specs/2026-08-31-alertas-presupuesto-design.md

-- 1. Qué rubros se vigilan.
-- NULL a propósito: significa "decide por clasificación" (Variable → vigila).
-- true/false es override explícito del usuario y manda sobre el default, para
-- que cambiar la clasificación de un rubro no le pise una decisión manual.
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN;

COMMENT ON COLUMN budget_items.alerts_enabled IS
  'NULL = automático por clasificación (Variable vigila). true/false = override del usuario.';

-- 2. Dedupe: UNA fila por rubro por mes, con el umbral más alto ya avisado.
-- Una fila por umbral cruzado explotaría: un rubro al 938% son 19 umbrales.
CREATE TABLE IF NOT EXISTS budget_alerts_sent (
    user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year     TEXT NOT NULL,
    budget_item_id UUID NOT NULL REFERENCES budget_items(id) ON DELETE CASCADE,
    last_threshold INT  NOT NULL,
    sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, month_year, budget_item_id)
);

-- Solo el webhook (service-role) escribe aquí; el navegador nunca la lee,
-- porque el panel calcula en vivo. RLS activo SIN políticas = nadie más entra.
ALTER TABLE budget_alerts_sent ENABLE ROW LEVEL SECURITY;

-- 3. Gasto vs presupuesto de los rubros vigilados.
-- Lo usan las dos puntas: el webhook de WhatsApp y el panel del dashboard.
-- El gasto se calcula desde transactions y NO desde budget_items.spent_amount,
-- que depende del roll-up y puede estar desfasado.
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

GRANT EXECUTE ON FUNCTION get_budget_alert_status(UUID, VARCHAR) TO authenticated;
