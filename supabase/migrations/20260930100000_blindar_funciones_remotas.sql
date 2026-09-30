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
--      -> guard + search_path; EXECUTE a authenticated y service_role (la llama
--         getPreviousMonthOverspend en src/lib/services/budget.ts desde el navegador).
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
-- 1. get_previous_month_overspend: guard + search_path + authenticated/service_role
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
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
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

-- La llama el navegador con sesión (getPreviousMonthOverspend en
-- src/lib/services/budget.ts, alerta de sobregasto de origin/main 2b799df)
-- con su propio user.id: el guard de arriba impide pedir el de otro.
REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) TO authenticated, service_role;


-- ============================================================================
-- 2. copy_budget_items_from_template: guard + ambas plantillas del usuario.
--    El resto del cuerpo es el de producción.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    items_copied INTEGER := 0;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    -- S01: la plantilla fuente y la destino deben ser de p_user_id
    -- (antes se copiaban rubros de cualquier plantilla).
    IF NOT EXISTS (
        SELECT 1 FROM budget_templates bt
        WHERE bt.id = p_source_template_id
        AND bt.user_id = p_user_id
    ) OR NOT EXISTS (
        SELECT 1 FROM budget_templates bt
        WHERE bt.id = p_target_template_id
        AND bt.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    -- Verificar que el template destino no tenga items ya
    IF EXISTS (
        SELECT 1 FROM budget_items
        WHERE template_id = p_target_template_id
        AND is_active = true
    ) THEN
        RAISE NOTICE 'Template destino ya tiene items, saltando copia';
        RETURN 0;
    END IF;

    -- Copiar items del template fuente al destino
    INSERT INTO budget_items (
        user_id,
        template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        spent_amount,
        real_amount,
        due_date,
        is_active
    )
    SELECT
        p_user_id,
        p_target_template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        0.00 as spent_amount,  -- Resetear gastos
        0.00 as real_amount,   -- Resetear montos reales
        due_date,
        true as is_active
    FROM budget_items
    WHERE template_id = p_source_template_id
    AND is_active = true;

    -- Obtener cantidad de items copiados
    GET DIAGNOSTICS items_copied = ROW_COUNT;

    RAISE NOTICE 'Copiados % items del template % al template %', items_copied, p_source_template_id, p_target_template_id;

    RETURN items_copied;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) TO service_role;


-- ============================================================================
-- 3. Ya filtraban por p_user_id: cuerpo de producción SIN cambios, solo se
--    traen al repo. Grants y search_path iguales a los de 20260929000000.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fix_templates_without_items(p_user_id uuid)
 RETURNS TABLE(template_id uuid, month_year character varying, items_copied integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    template_record RECORD;
    previous_template_id UUID;
    items_copied_count INTEGER;
BEGIN
    -- Iterar sobre todos los templates del usuario que no tienen items
    FOR template_record IN
        SELECT bt.id, bt.month_year, bt.name
        FROM budget_templates bt
        LEFT JOIN budget_items bi ON bt.id = bi.template_id AND bi.is_active = true
        WHERE bt.user_id = p_user_id
        AND bt.is_active = true
        AND bi.id IS NULL
        ORDER BY bt.month_year
    LOOP
        -- Buscar el template anterior más reciente
        SELECT bt2.id INTO previous_template_id
        FROM budget_templates bt2
        WHERE bt2.user_id = p_user_id
        AND bt2.month_year < template_record.month_year
        AND bt2.is_active = true
        ORDER BY bt2.month_year DESC
        LIMIT 1;

        -- Si hay template anterior, copiar items
        IF previous_template_id IS NOT NULL THEN
            -- Llamar función de copia
            SELECT copy_budget_items_from_template(
                p_user_id,
                previous_template_id,
                template_record.id
            ) INTO items_copied_count;

            -- Retornar resultado
            template_id := template_record.id;
            month_year := template_record.month_year;
            items_copied := items_copied_count;

            RETURN NEXT;
        END IF;
    END LOOP;

    RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_cufe_exists(p_user_id uuid, p_cufe_code character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM electronic_invoices
    WHERE user_id = p_user_id
    AND cufe_code = p_cufe_code
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_electronic_invoices_by_date_range(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, cufe_code character varying, supplier_name character varying, supplier_nit character varying, invoice_date date, total_amount numeric, processed_at timestamp with time zone, has_expenses boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.id,
    ei.cufe_code,
    ei.supplier_name,
    ei.supplier_nit,
    ei.invoice_date,
    ei.total_amount,
    ei.processed_at,
    EXISTS(
      SELECT 1
      FROM transactions t
      WHERE t.electronic_invoice_id = ei.id
    ) as has_expenses
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  ORDER BY ei.invoice_date DESC, ei.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoice_stats_by_supplier(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(supplier_name character varying, supplier_nit character varying, invoice_count bigint, total_amount numeric, avg_amount numeric, last_invoice_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.supplier_name,
    ei.supplier_nit,
    COUNT(*) as invoice_count,
    SUM(ei.total_amount) as total_amount,
    AVG(ei.total_amount) as avg_amount,
    MAX(ei.invoice_date) as last_invoice_date
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  GROUP BY ei.supplier_name, ei.supplier_nit
  ORDER BY total_amount DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) TO service_role;


-- ============================================================================
-- 4. get_budget_by_month: guard. Sigue INVOKER (RLS sigue aplicando).
--    Llamadores: src/lib/services/budget.ts y src/scripts/migrate-july-data.ts
--    (navegador con sesión, p_user_id = su propio id).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_budget_by_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(template_id uuid, template_name character varying, category_id uuid, category_name character varying, category_color character varying, category_icon character varying, item_id uuid, item_name character varying, item_description text, due_date character varying, classification_name character varying, classification_color character varying, control_name character varying, control_color character varying, budgeted_amount numeric, real_amount numeric, spent_amount numeric, deuda_id uuid, alerts_enabled boolean)
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        bt.id, bt.name, c.id, c.name, c.color, c.icon,
        bi.id, bi.name, bi.description, bi.due_date,
        cl.name, cl.color, co.name, co.color,
        bi.budgeted_amount,
        -- Real híbrido: si hay gastos asignados, su suma; si no, el manual
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             JOIN transaction_types tt ON t.type_id = tt.id
             WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
            bi.real_amount
        ) AS real_amount,
        bi.spent_amount,
        bi.deuda_id,
        bi.alerts_enabled
    FROM budget_templates bt
    LEFT JOIN budget_items bi ON bt.id = bi.template_id
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN classifications cl ON bi.classification_id = cl.id
    LEFT JOIN controls co ON bi.control_id = co.id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND (bi.is_active = true OR bi.id IS NULL)
    ORDER BY c.name, bi.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) TO authenticated, service_role;


-- ============================================================================
-- VERIFICACIÓN (correr a mano DESPUÉS de aplicar, en H8; todo con ROLLBACK)
-- Reemplazar <uuid propio> por el id de la cuenta de quien verifica.
-- ============================================================================
--
-- 0) ANTES de aplicar: huella del cuerpo de las 7 en producción, para detectar
--    desfase entre lo que hay en la base y lo que esta migración reemplaza. Si
--    algún md5 cambió respecto al de la revisión del 2026-09-30, comparar con
--    pg_get_functiondef antes de aplicar (alguien la tocó fuera del repo):
-- SELECT proname, md5(prosrc) FROM pg_proc WHERE proname IN ('get_previous_month_overspend', 'copy_budget_items_from_template', 'fix_templates_without_items', 'check_cufe_exists', 'get_electronic_invoices_by_date_range', 'get_invoice_stats_by_supplier', 'get_budget_by_month') AND pronamespace = 'public'::regnamespace ORDER BY 1;
--
-- 1) Sin overloads de las 7 (esperado: 0 filas):
-- SELECT proname, count(*) FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('get_previous_month_overspend', 'copy_budget_items_from_template',
--                   'fix_templates_without_items', 'check_cufe_exists',
--                   'get_electronic_invoices_by_date_range', 'get_invoice_stats_by_supplier',
--                   'get_budget_by_month')
-- GROUP BY 1 HAVING count(*) > 1;
--
-- 2) SECURITY, search_path y grants de las 7:
-- SELECT p.oid::regprocedure AS fn, p.prosecdef, p.proconfig,
--        (SELECT string_agg(CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE g.grantee::regrole::text END, ',')
--           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
--          WHERE g.privilege_type = 'EXECUTE') AS execute_para
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.proname IN ('get_previous_month_overspend', 'copy_budget_items_from_template',
--                     'fix_templates_without_items', 'check_cufe_exists',
--                     'get_electronic_invoices_by_date_range', 'get_invoice_stats_by_supplier',
--                     'get_budget_by_month')
-- ORDER BY 1;
-- -- esperado: get_budget_by_month          -> prosecdef = f, execute_para = postgres,authenticated,service_role
-- --           get_previous_month_overspend -> prosecdef = t, execute_para = postgres,authenticated,service_role
-- --           las otras 5                  -> prosecdef = t, execute_para = postgres,service_role
-- --           las 7 con proconfig = {"search_path=public, pg_temp"}
--
-- 3) Tablas de public sin RLS (esperado: 0 filas; el 2026-09-30 las 24 tenían RLS):
-- SELECT c.relname
-- FROM pg_class c
-- WHERE c.relnamespace = 'public'::regnamespace
--   AND c.relkind IN ('r', 'p')
--   AND c.relrowsecurity = false
-- ORDER BY 1;
--
-- 4) anon ya no ejecuta get_previous_month_overspend (esperado: ERROR 42501 permission denied):
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SET LOCAL request.jwt.claims = '{"role":"anon"}';
--   SELECT * FROM public.get_previous_month_overspend('00000000-0000-0000-0000-000000000000', '2026-09');
-- ROLLBACK;
--
-- 5) get_budget_by_month con un uid AJENO (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
--   SELECT count(*) FROM public.get_budget_by_month('22222222-2222-2222-2222-222222222222', '2026-09');
-- ROLLBACK;
--
-- 6) get_budget_by_month con SU propio uid (esperado: un número, sin error):
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uuid propio>"}';
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) FROM public.get_budget_by_month('<uuid propio>', to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
-- ROLLBACK;
--
-- 7) copy_budget_items_from_template con plantillas que no son del usuario
--    (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   SET LOCAL request.jwt.claims = '{"role":"service_role"}';
--   SELECT public.copy_budget_items_from_template('<uuid propio>', gen_random_uuid(), gen_random_uuid());
-- ROLLBACK;
--
-- 7b) copy_budget_items_from_template con una plantilla REAL de otro usuario
--     (esperado en los dos casos: ERROR 42501 'no autorizado'; el ROLLBACK
--     deshace cualquier copia si el chequeo fallara).
--     <plantilla ajena>: un budget_templates.id con user_id <> '<uuid propio>'
--       SELECT id FROM budget_templates WHERE user_id <> '<uuid propio>' LIMIT 1;
--     <plantilla propia>: un budget_templates.id con user_id = '<uuid propio>'
--       SELECT id FROM budget_templates WHERE user_id = '<uuid propio>' LIMIT 1;
--   Fuente ajena, destino propio:
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   SET LOCAL request.jwt.claims = '{"role":"service_role"}';
--   SELECT public.copy_budget_items_from_template('<uuid propio>', '<plantilla ajena>', '<plantilla propia>');
-- ROLLBACK;
--   Fuente propia, destino ajeno:
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   SET LOCAL request.jwt.claims = '{"role":"service_role"}';
--   SELECT public.copy_budget_items_from_template('<uuid propio>', '<plantilla propia>', '<plantilla ajena>');
-- ROLLBACK;
--
-- 8) upsert_monthly_budget sigue copiando rubros al crear un mes nuevo
--    (esperado: devuelve un uuid y el conteo es > 0):
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uuid propio>"}';
--   SET LOCAL ROLE authenticated;
--   SELECT public.upsert_monthly_budget('<uuid propio>', '2099-01');
--   SELECT count(*) FROM budget_items bi
--     JOIN budget_templates bt ON bt.id = bi.template_id
--    WHERE bt.user_id = '<uuid propio>' AND bt.month_year = '2099-01';
-- ROLLBACK;
--
-- 9) Advisors: get_advisors(security) ya no lista anon_security_definer_function_executable
--    ni function_search_path_mutable para get_previous_month_overspend ni get_budget_by_month.
