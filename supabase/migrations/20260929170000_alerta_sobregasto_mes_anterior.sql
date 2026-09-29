-- Alerta histórica: por cada ítem del mes que se está viendo, cuánto se excedió
-- ese mismo ítem en el MES ANTERIOR.
--
-- Es solo informativa: no toca los valores del mes nuevo (que arranca con el
-- gasto en 0). El emparejamiento entre meses se hace por categoría + nombre del
-- ítem, la misma regla con la que "Copiar mes anterior" evita duplicados.
CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(
  p_user_id uuid,
  p_month_year character varying
)
RETURNS TABLE(
  item_id uuid,
  previous_month character varying,
  budgeted numeric,
  spent numeric,
  excess numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_prev character varying;
BEGIN
  v_prev := to_char(
    (to_date(p_month_year, 'YYYY-MM') - interval '1 month'), 'YYYY-MM'
  );

  RETURN QUERY
  WITH anterior AS (
    SELECT
      bi.category_id,
      lower(trim(bi.name)) AS nombre,
      SUM(bi.budgeted_amount) AS presupuestado,
      SUM(
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           JOIN transaction_types tt ON tt.id = t.type_id
           WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
          bi.real_amount
        )
      ) AS gastado
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = v_prev
      AND bt.is_active = true
      AND bi.is_active = true
    GROUP BY bi.category_id, lower(trim(bi.name))
  )
  SELECT
    actual.id,
    v_prev,
    anterior.presupuestado,
    anterior.gastado,
    anterior.gastado - anterior.presupuestado
  FROM budget_items actual
  JOIN budget_templates bt ON bt.id = actual.template_id
  JOIN anterior
    ON anterior.category_id = actual.category_id
   AND anterior.nombre = lower(trim(actual.name))
  WHERE bt.user_id = p_user_id
    AND bt.month_year = p_month_year
    AND bt.is_active = true
    AND actual.is_active = true
    AND anterior.gastado > anterior.presupuestado;
END;
$function$;
