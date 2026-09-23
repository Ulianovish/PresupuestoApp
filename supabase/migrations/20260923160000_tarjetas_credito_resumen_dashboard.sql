-- Resumen de tarjetas de crédito en el dashboard: cuánto se gastó con cada
-- tarjeta y cuánto se le abonó en el mes.
--
-- Los pagos a una tarjeta se registran con la cuenta de ORIGEN (Efectivo,
-- Nequi...), no con la tarjeta destino, y los nombres de los ítems de deuda no
-- coinciden con los de las cuentas ("TC NuBank" vs "TC Nu Bank Migue"). Por eso
-- el vínculo ítem -> tarjeta se hace explícito en una columna.
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN budget_items.account_id IS
  'Tarjeta de crédito a la que corresponden los pagos de este ítem de deuda. NULL para ítems que no son de tarjeta.';

CREATE INDEX IF NOT EXISTS idx_budget_items_account_id ON budget_items(account_id);

-- Emparejamiento de los ítems existentes, verificado contra el historial de pagos.
WITH mapa(item_name, account_name) AS (
  VALUES
    ('Consumo · Davivienda', 'TC Davivienda'),
    ('TC Falabella', 'TC Falabella'),
    ('TC NuBank', 'TC Nu Bank Migue'),
    ('Tarjeta Nu Bank Milo · Tarjeta Nu Bank Milo', 'TC Nu Bank Milo'),
    ('TC Nu Bank Milo · Nu Bank Milo', 'TC Nu Bank Milo'),
    ('Tarjeta de Credito', 'TC Rappi'),
    ('TC Rappi', 'TC Rappi')
)
UPDATE budget_items bi
SET account_id = a.id
FROM mapa m
JOIN accounts a ON a.name = m.account_name
WHERE bi.name = m.item_name
  AND a.user_id = bi.user_id
  AND bi.account_id IS DISTINCT FROM a.id;

CREATE OR REPLACE FUNCTION public.get_credit_cards_summary(
  p_user_id uuid,
  p_month_year character varying
)
RETURNS TABLE(
  account_id uuid,
  account_name character varying,
  gastado numeric,
  pagado numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      LEFT JOIN transaction_types tt ON tt.id = t.type_id
      WHERE t.user_id = p_user_id
        AND t.month_year = p_month_year
        AND t.account_id = a.id
        AND tt.name = 'Gasto'
    ), 0)::numeric,
    COALESCE((
      SELECT SUM(t.amount)
      FROM transactions t
      LEFT JOIN transaction_types tt ON tt.id = t.type_id
      JOIN budget_items bi ON bi.id = t.budget_item_id
      WHERE t.user_id = p_user_id
        AND t.month_year = p_month_year
        AND bi.account_id = a.id
        AND tt.name = 'Gasto'
    ), 0)::numeric
  FROM accounts a
  WHERE a.user_id = p_user_id
    AND a.type = 'credit'
    AND COALESCE(a.is_active, true)
  ORDER BY a.name;
END;
$function$;
