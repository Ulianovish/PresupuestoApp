-- Los dos RPC que crean y leen gastos tienen que conocer el total y las cuotas:
-- al registrar para poder guardarlos, y al leer para que el formulario de
-- edición los muestre y no los pise al guardar (pisarlos movería el saldo de
-- la tarjeta vía trigger).
CREATE OR REPLACE FUNCTION public.upsert_monthly_expense(
    p_user_id uuid,
    p_description text,
    p_amount numeric,
    p_transaction_date date,
    p_category_name character varying,
    p_account_name character varying,
    p_place character varying DEFAULT NULL::character varying,
    p_month_year character varying DEFAULT NULL::character varying,
    p_purchase_total numeric DEFAULT NULL::numeric,
    p_installments integer DEFAULT NULL::integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_account_id UUID;
    v_transaction_id UUID;
    v_month_year VARCHAR(7);
BEGIN
    IF p_month_year IS NULL THEN
        v_month_year := TO_CHAR(p_transaction_date, 'YYYY-MM');
    ELSE
        v_month_year := p_month_year;
    END IF;

    SELECT id INTO v_account_id
    FROM accounts
    WHERE name = p_account_name AND user_id = p_user_id;

    IF v_account_id IS NULL THEN
        INSERT INTO accounts (user_id, name, type)
        VALUES (
            p_user_id,
            p_account_name,
            CASE
                WHEN p_account_name ILIKE '%TC%' OR p_account_name ILIKE '%tarjeta%' OR p_account_name ILIKE '%credito%' THEN 'credit'
                WHEN p_account_name ILIKE '%efectivo%' OR p_account_name ILIKE '%cash%' THEN 'cash'
                ELSE 'bank'
            END
        )
        RETURNING id INTO v_account_id;
    END IF;

    INSERT INTO transactions (
        user_id, description, amount, transaction_date, category_name,
        account_id, place, month_year, type_id, purchase_total, installments
    ) VALUES (
        p_user_id,
        title_case(p_description),
        p_amount,
        p_transaction_date,
        p_category_name,
        v_account_id,
        title_case(p_place),
        v_month_year,
        (SELECT id FROM transaction_types WHERE name = 'Gasto'),
        p_purchase_total,
        p_installments
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.get_expenses_by_month(uuid, character varying);

CREATE OR REPLACE FUNCTION public.get_expenses_by_month(
  p_user_id uuid,
  p_month_year character varying
)
RETURNS TABLE(
  id uuid,
  description text,
  amount numeric,
  transaction_date date,
  category_name character varying,
  account_name character varying,
  place character varying,
  created_at timestamp with time zone,
  budget_item_id uuid,
  purchase_total numeric,
  installments integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    t.id, t.description, t.amount, t.transaction_date, t.category_name,
    a.name, t.place, t.created_at, t.budget_item_id,
    t.purchase_total, t.installments
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN transaction_types tt ON tt.id = t.type_id
  WHERE t.user_id = p_user_id
    AND t.month_year = p_month_year
    AND tt.name = 'Gasto'
  ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$function$;
