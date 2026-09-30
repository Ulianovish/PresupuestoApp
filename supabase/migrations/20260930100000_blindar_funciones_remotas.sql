-- S01 — Blindar funciones que solo existían en remoto (contratos §1.4).
--
-- Estas 7 funciones viven en producción, pero su definición vigente no estaba
-- en el repo. Los cuerpos se copiaron de pg_get_functiondef en producción el
-- 2026-09-30 (solo lectura). Las firmas (nombres de parámetros, tipos, DEFAULT
-- y RETURNS) son IDÉNTICAS a producción para que CREATE OR REPLACE reemplace y
-- NO cree overloads. Diferencias de forma, sin efecto: CRLF -> LF, espacios al
-- final de línea eliminados y `SET search_path TO 'public', 'pg_temp'` escrito
-- como `SET search_path = public, pg_temp` (mismo valor).
--
-- Estado en producción ANTES de esta migración:
--   get_previous_month_overspend          DEFINER, sin search_path, EXECUTE para
--                                         PUBLIC/anon/authenticated, sin guard  <- abierta
--   copy_budget_items_from_template       DEFINER, search_path fijo, solo service_role
--   fix_templates_without_items           DEFINER, search_path fijo, solo service_role
--   check_cufe_exists                     DEFINER, search_path fijo, solo service_role
--   get_electronic_invoices_by_date_range DEFINER, search_path fijo, solo service_role
--   get_invoice_stats_by_supplier         DEFINER, search_path fijo, solo service_role
--   get_budget_by_month                   INVOKER (RLS), EXECUTE para PUBLIC/anon, sin guard
--
-- ¿Filtra cada una por el usuario?
--   1. get_previous_month_overspend: SÍ (bt.user_id = p_user_id en ambos meses),
--      pero era SECURITY DEFINER abierta a anon: cualquiera con la anon key leía
--      presupuestado/gastado de otra persona pasando su uuid.
--      -> guard + search_path + solo service_role (no tiene llamadores en src/).
--   2. copy_budget_items_from_template: NO. Copiaba los rubros de CUALQUIER
--      plantilla fuente (no verificaba el dueño) hacia cualquier plantilla
--      destino. Solo la ejecutaban service_role y las llamadas anidadas desde
--      upsert_monthly_budget / fix_templates_without_items (que pasan
--      plantillas propias). -> guard + ambas plantillas deben ser de p_user_id.
--   3. fix_templates_without_items: SÍ (bt.user_id / bt2.user_id). Sin cambios.
--   4. check_cufe_exists: SÍ (user_id = p_user_id). Sin cambios.
--   5. get_electronic_invoices_by_date_range: SÍ (ei.user_id). El EXISTS sobre
--      transactions solo da un booleano de facturas propias. Sin cambios.
--   6. get_invoice_stats_by_supplier: SÍ (ei.user_id). Sin cambios.
--   7. get_budget_by_month: INVOKER, RLS ya limita a lo propio; el guard vuelve
--      error explícito la consulta de un uid ajeno. Sigue siendo INVOKER.
--
-- Guard y llamadas anidadas: auth.uid()/auth.role() leen request.jwt.claims de
-- la sesión. Dentro de upsert_monthly_budget (con guard propio) la llamada a
-- copy_budget_items_from_template ve al mismo usuario y pasa;
-- fix_templates_without_items solo la ejecuta service_role, que pasa.
-- OJO: una conexión SQL directa sin JWT (SQL editor / MCP como postgres) ya no
-- puede llamar las funciones con guard tal cual: simular el JWT con
-- set_config('request.jwt.claims', ...) (ver VERIFICACIÓN al final).


-- ============================================================================
-- 1. get_previous_month_overspend: guard + search_path + solo service_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(item_id uuid, previous_month character varying, budgeted numeric, spent numeric, excess numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_prev character varying;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) TO service_role;
