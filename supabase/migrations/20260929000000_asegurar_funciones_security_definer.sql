-- Blindaje de las funciones SECURITY DEFINER del esquema public.
--
-- PROBLEMA: 19 funciones SECURITY DEFINER reciben el id del usuario POR
-- PARÁMETRO (p_user_id / usuario_id), no lo comparan con auth.uid() y tenían
-- EXECUTE para PUBLIC/anon/authenticated (default de Postgres + Supabase).
-- Como SECURITY DEFINER corre como `postgres` y se salta RLS, cualquiera con la
-- anon key pública podía llamar /rest/v1/rpc/<fn> con el uuid de otra persona:
-- leerle gastos, presupuesto, facturas, ingresos y deudas, crearle gastos
-- (upsert_monthly_expense) o reasignarle rubros (assign_expense_budget_item).
--
-- ARREGLO, según quién llama a cada función (ver src/):
--   A. Funciones que llama la app (navegador con sesión, server con cookie, o el
--      webhook de WhatsApp con service-role): guard al inicio del cuerpo + solo
--      authenticated/service_role pueden ejecutarlas. El cuerpo queda IDÉNTICO;
--      la firma se copió de pg_get_functiondef para que CREATE OR REPLACE
--      reemplace y NO cree un overload nuevo.
--   B. Funciones SIN llamadores en src/: se les quita EXECUTE a todos menos
--      service_role (sin tocar el cuerpo). Las llamadas anidadas (p. ej.
--      upsert_monthly_budget -> copy_budget_items_from_template) no se rompen:
--      dentro de un SECURITY DEFINER el chequeo de EXECUTE es contra el dueño
--      (postgres), no contra el cliente.
--   C. Funciones de trigger: EXECUTE fuera para PUBLIC/anon/authenticated
--      (Postgres no chequea EXECUTE cuando dispara un trigger).
--   D. Todas las SECURITY DEFINER: search_path fijo (public, pg_temp).
--
-- El guard: el service-role (webhook, after(), alertas) pasa libre porque su
-- JWT trae role = 'service_role'; cualquier otro solo puede pedir lo suyo.
-- OJO: una conexión SQL directa (SQL editor / MCP como postgres, sin JWT) ya NO
-- puede llamar estas funciones tal cual; hay que simular el JWT con
-- `set local request.jwt.claims` (ver bloque de verificación al final).


-- ============================================================================
-- A. Funciones con llamadores en la app: guard + grants
-- ============================================================================

-- A1. assign_expense_budget_item
--     navegador (expenses.ts), server cookie (/api/expenses/classify),
--     service-role (whatsapp-expenses.ts, invoices.ts classifyApprovedExpenses)
CREATE OR REPLACE FUNCTION public.assign_expense_budget_item(p_user_id uuid, p_transaction_id uuid, p_budget_item_id uuid, p_source character varying)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

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
$function$;

-- A2. get_budget_items_for_month
--     navegador (expenses.ts), server cookie (/api/expenses/classify),
--     service-role (whatsapp-expenses.ts, whatsapp-queries.ts, invoices.ts)
CREATE OR REPLACE FUNCTION public.get_budget_items_for_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(item_id uuid, item_name character varying, category_name character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

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
$function$;

-- A3. get_unclassified_expenses
--     navegador (expenses.ts), server cookie (/api/expenses/classify)
CREATE OR REPLACE FUNCTION public.get_unclassified_expenses(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(id uuid, description text, amount numeric, category_name character varying, transaction_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

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
$function$;

-- A4. upsert_monthly_expense (la de 10 parámetros; la de 8 ya se borró en
--     20260926120000). navegador (expenses.ts), service-role
--     (whatsapp-expenses.ts, invoices.ts createInvoiceDirect)
CREATE OR REPLACE FUNCTION public.upsert_monthly_expense(p_user_id uuid, p_description text, p_amount numeric, p_transaction_date date, p_category_name character varying, p_account_name character varying, p_place character varying DEFAULT NULL::character varying, p_month_year character varying DEFAULT NULL::character varying, p_purchase_total numeric DEFAULT NULL::numeric, p_installments integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_account_id UUID;
    v_transaction_id UUID;
    v_month_year VARCHAR(7);
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

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

-- A5. upsert_monthly_budget
--     navegador (budget.ts), server cookie (actions/categories.ts)
CREATE OR REPLACE FUNCTION public.upsert_monthly_budget(p_user_id uuid, p_month_year character varying, p_template_name character varying DEFAULT NULL::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    template_id UUID;
    default_name VARCHAR(255);
    previous_template_id UUID;
    items_copied INTEGER := 0;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    -- Generar nombre por defecto si no se proporciona
    IF p_template_name IS NULL THEN
        default_name := 'Presupuesto ' || p_month_year;
    ELSE
        default_name := p_template_name;
    END IF;

    -- Insertar o actualizar template
    INSERT INTO budget_templates (user_id, name, month_year)
    VALUES (p_user_id, default_name, p_month_year)
    ON CONFLICT (user_id, month_year)
    DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW()
    RETURNING id INTO template_id;

    -- Buscar template anterior para copiar items
    SELECT id INTO previous_template_id
    FROM budget_templates
    WHERE user_id = p_user_id
    AND month_year < p_month_year
    AND is_active = true
    ORDER BY month_year DESC
    LIMIT 1;

    -- Si hay template anterior, copiar items
    IF previous_template_id IS NOT NULL THEN
        SELECT copy_budget_items_from_template(
            p_user_id,
            previous_template_id,
            template_id
        ) INTO items_copied;

        RAISE NOTICE 'Template % creado con % items copiados', template_id, items_copied;
    ELSE
        RAISE NOTICE 'Template % creado sin items (no hay template anterior)', template_id;
    END IF;

    RETURN template_id;
END;
$function$;

-- A6. get_expenses_by_month — navegador (expenses.ts)
CREATE OR REPLACE FUNCTION public.get_expenses_by_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(id uuid, description text, amount numeric, transaction_date date, category_name character varying, account_name character varying, place character varying, created_at timestamp with time zone, budget_item_id uuid, purchase_total numeric, installments integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.description,
    t.amount,
    t.transaction_date,
    t.category_name,
    a.name,
    t.place,
    t.created_at,
    t.budget_item_id,
    t.purchase_total,
    t.installments
  FROM transactions t
  LEFT JOIN accounts a ON a.id = t.account_id
  LEFT JOIN transaction_types tt ON tt.id = t.type_id
  WHERE t.user_id = p_user_id
    AND t.month_year = p_month_year
    AND tt.name = 'Gasto'
  ORDER BY t.transaction_date DESC, t.created_at DESC;
END;
$function$;

-- A7. get_expenses_summary_by_month — navegador (expenses.ts)
CREATE OR REPLACE FUNCTION public.get_expenses_summary_by_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(category_name character varying, total_amount numeric, transaction_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        t.category_name,
        SUM(t.amount) as total_amount,
        COUNT(*) as transaction_count
    FROM transactions t
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND t.month_year = p_month_year
      AND tt.name = 'Gasto'
    GROUP BY t.category_name
    ORDER BY total_amount DESC;
END;
$function$;

-- A8. get_available_expense_months — navegador (expenses.ts)
CREATE OR REPLACE FUNCTION public.get_available_expense_months(p_user_id uuid)
 RETURNS TABLE(month_year character varying)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT DISTINCT t.month_year
    FROM transactions t
    LEFT JOIN transaction_types tt ON t.type_id = tt.id
    WHERE t.user_id = p_user_id
      AND tt.name = 'Gasto'
    ORDER BY t.month_year DESC;
END;
$function$;

-- A9. get_credit_cards_summary — navegador (credit-cards.ts)
CREATE OR REPLACE FUNCTION public.get_credit_cards_summary(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(account_id uuid, account_name character varying, gastado numeric, pagado numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;

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

-- Grants del grupo A. authenticated + service_role para todas (las que hoy
-- solo llama el navegador igual quedan protegidas por el guard; darle
-- service_role no abre nada porque service_role ya se salta RLS).
REVOKE EXECUTE ON FUNCTION public.assign_expense_budget_item(uuid, uuid, uuid, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_budget_items_for_month(uuid, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unclassified_expenses(uuid, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_monthly_expense(uuid, text, numeric, date, character varying, character varying, character varying, character varying, numeric, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.upsert_monthly_budget(uuid, character varying, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_expenses_by_month(uuid, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_expenses_summary_by_month(uuid, character varying) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_available_expense_months(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_credit_cards_summary(uuid, character varying) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.assign_expense_budget_item(uuid, uuid, uuid, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_budget_items_for_month(uuid, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_unclassified_expenses(uuid, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_monthly_expense(uuid, text, numeric, date, character varying, character varying, character varying, character varying, numeric, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_monthly_budget(uuid, character varying, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expenses_by_month(uuid, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_expenses_summary_by_month(uuid, character varying) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_available_expense_months(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_cards_summary(uuid, character varying) TO authenticated, service_role;

-- ============================================================================
-- B. SECURITY DEFINER con id de usuario y SIN llamadores en src/:
--    solo service_role (y el dueño postgres). Cuerpo intacto.
--    copy_budget_items_from_template sigue funcionando desde
--    upsert_monthly_budget / fix_templates_without_items (llamada anidada,
--    se chequea contra el dueño).
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_ingresos(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_deudas(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_balance_neto(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) TO service_role;
GRANT EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_ingresos(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_total_deudas(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_balance_neto(uuid) TO service_role;

-- ============================================================================
-- C. Funciones de trigger SECURITY DEFINER: nadie las llama por RPC.
--    Postgres no chequea EXECUTE al disparar un trigger, así que revocar no
--    rompe el alta de usuarios ni el trigger de deudas de tarjeta. El GRANT a
--    supabase_auth_admin es solo cinturón y tirantes.
-- ============================================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

REVOKE EXECUTE ON FUNCTION public.sincronizar_deuda_tarjeta() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_deuda_tarjeta() TO service_role;

-- ============================================================================
-- D. search_path fijo en el resto de las SECURITY DEFINER (las del grupo A ya
--    lo llevan en su CREATE OR REPLACE). ALTER no toca el cuerpo ni la firma.
--    Alertas: grants ya correctos desde 20260831000002 (mark_budget_alert_sent
--    solo service_role; get_budget_alert_status con guard + authenticated).
-- ============================================================================
ALTER FUNCTION public.check_cufe_exists(uuid, character varying) SET search_path = public, pg_temp;
ALTER FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.fix_templates_without_items(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_total_ingresos(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_total_deudas(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_balance_neto(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.sincronizar_deuda_tarjeta() SET search_path = public, pg_temp;
ALTER FUNCTION public.mark_budget_alert_sent(uuid, character varying, uuid, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_budget_alert_status(uuid, character varying) SET search_path = public, pg_temp;


-- ============================================================================
-- VERIFICACIÓN (correr a mano DESPUÉS de aplicar; todo va con ROLLBACK)
-- ============================================================================
--
-- 1) No quedaron overloads nuevos (debe salir 1 fila por nombre):
-- SELECT proname, count(*) FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace AND prosecdef
-- GROUP BY 1 HAVING count(*) > 1;              -- esperado: 0 filas
--
-- 2) Grants y search_path de todas las SECURITY DEFINER:
-- SELECT p.oid::regprocedure AS fn, p.proconfig,
--        (SELECT string_agg(CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE g.grantee::regrole::text END, ',')
--           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
--          WHERE g.privilege_type = 'EXECUTE') AS execute_para
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
-- ORDER BY 1;
-- -- esperado: ninguna con PUBLIC ni anon; grupo A = postgres,authenticated,service_role;
-- --           grupo B = postgres,service_role; todas con search_path=public, pg_temp
--
-- 3) anon ya no puede ejecutar (esperado: ERROR 42501 permission denied):
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SET LOCAL request.jwt.claims = '{"role":"anon"}';
--   SELECT * FROM public.get_unclassified_expenses('00000000-0000-0000-0000-000000000000', '2026-09');
-- ROLLBACK;
--
-- 4) authenticated con uid AJENO (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
--   SELECT * FROM public.get_budget_items_for_month((SELECT id FROM auth.users LIMIT 1), '2026-09');
-- ROLLBACK;
-- -- repetir con assign_expense_budget_item(<uid real>, gen_random_uuid(), NULL, 'manual')
-- -- y con upsert_monthly_expense(<uid real>, 'x', 1, current_date, 'OTROS', 'Efectivo')
--
-- 5) authenticated con SU PROPIO uid (esperado: devuelve filas, sin error):
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--          json_build_object('role','authenticated','sub',(SELECT id FROM auth.users LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) FROM public.get_budget_items_for_month((SELECT id FROM auth.users LIMIT 1), to_char(now(),'YYYY-MM'));
--   SELECT count(*) FROM public.get_expenses_by_month((SELECT id FROM auth.users LIMIT 1), to_char(now(),'YYYY-MM'));
-- ROLLBACK;
-- -- (auth.users no es legible como authenticated: por eso el set_config va ANTES del SET ROLE;
-- --  si las subconsultas fallan, pegar el uuid literal)
--
-- 6) service_role con cualquier uid (esperado: funciona — es lo que usa el bot):
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   SET LOCAL request.jwt.claims = '{"role":"service_role"}';
--   SELECT count(*) FROM public.get_budget_items_for_month('<uuid real>', to_char(now(),'YYYY-MM'));
--   SELECT public.upsert_monthly_expense('<uuid real>', 'prueba guard', 1, current_date, 'OTROS', 'Efectivo');
-- ROLLBACK;
--
-- 7) El trigger de deudas sigue disparando como authenticated (esperado: sin error):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uuid real>"}';
--   SELECT public.upsert_monthly_expense('<uuid real>', 'prueba trigger', 1, current_date, 'OTROS', 'TC prueba', NULL, NULL, 3, 3);
-- ROLLBACK;
--
-- 8) Advisors: get_advisors(security) ya no debe listar
--    anon_security_definer_function_executable ni function_search_path_mutable
--    para estas funciones (authenticated_* seguirá para el grupo A: es esperado,
--    el guard es la protección).
