-- ============================================================
-- Texto uniforme en descripción y lugar de los gastos
-- Los gastos llegan de fuentes distintas (facturas DIAN en MAYÚSCULAS,
-- Excel, WhatsApp, escritura manual). Se guardan con formato de título
-- (initcap): cada palabra con la inicial en mayúscula.
-- ============================================================

-- 0. title_case: initcap de Postgres no trata los puntos como separador
--    ("S.a.s."), mientras la app sí ("S.A.S."). Esta función replica la
--    semántica de la app para que el texto quede igual lo normalice quien lo
--    normalice (app, facturas o WhatsApp).
CREATE OR REPLACE FUNCTION title_case(txt text) RETURNS text AS $fn$
DECLARE
  result text := '';
  ch text;
  prev_is_sep boolean := true;
  i int;
BEGIN
  IF txt IS NULL THEN RETURN NULL; END IF;
  FOR i IN 1..length(txt) LOOP
    ch := substr(txt, i, 1);
    IF prev_is_sep THEN
      result := result || upper(ch);
    ELSE
      result := result || lower(ch);
    END IF;
    prev_is_sep := ch !~ '[[:alnum:]]';
  END LOOP;
  RETURN result;
END;
$fn$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Normalizar lo ya registrado
UPDATE transactions
SET description = title_case(description)
WHERE description IS NOT NULL AND description <> title_case(description);

UPDATE transactions
SET place = title_case(place)
WHERE place IS NOT NULL AND place <> title_case(place);

-- 2. Que todo lo nuevo entre normalizado (cubre app, facturas y WhatsApp)
CREATE OR REPLACE FUNCTION upsert_monthly_expense(
    p_user_id UUID,
    p_description TEXT,
    p_amount DECIMAL(12,2),
    p_transaction_date DATE,
    p_category_name VARCHAR(100),
    p_account_name VARCHAR(255),
    p_place VARCHAR(255) DEFAULT NULL,
    p_month_year VARCHAR(7) DEFAULT NULL
)
RETURNS UUID AS $$
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
        account_id, place, month_year, type_id
    ) VALUES (
        p_user_id,
        title_case(p_description),  -- texto uniforme
        p_amount,
        p_transaction_date,
        p_category_name,
        v_account_id,
        title_case(p_place),        -- texto uniforme
        v_month_year,
        (SELECT id FROM transaction_types WHERE name = 'Gasto')
    )
    RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
