-- Kit inicial y columnas de onboarding (S09).
-- Contratos: docs/agile/contracts.md §1.2, §1.3 y enmiendas v2 §5.1. Decisión: ADR-001.
--
-- 1. profiles gana onboarding_completed_at / onboarding_dismissed_at. Los
--    usuarios que ya existen quedan con ambas en now(): no ven la bienvenida ni
--    la checklist. El backfill solo corre la vez que se crean las columnas, así
--    que re-ejecutar la migración no marca como "ya hizo onboarding" a nadie
--    que se haya registrado después.
-- 2. _seed_starter_kit(p_user_id, p_month_year): interna, idempotente (si el
--    usuario ya tiene alguna categoría ACTIVA no hace nada y devuelve false;
--    quien las desactivó todas puede recargar el kit). Antes de insertar nada
--    verifica que el estado Activo y los 12 pares clasificación/control
--    resuelvan por nombre. Reactiva o inserta las 6 categorías (comparando
--    upper(btrim(nombre))), la cuenta Efectivo, la plantilla del mes (o la
--    reactiva) y reactiva o inserta los rubros (NOT EXISTS por plantilla +
--    categoría + lower(nombre)) en la misma transacción. NO usa
--    upsert_monthly_budget: su guard exige auth.uid() = p_user_id y dentro del
--    trigger de signup auth.uid() es NULL. Sin EXECUTE para nadie salvo el
--    dueño (postgres).
-- 3. ensure_starter_kit(): pública para authenticated, sin parámetro de
--    usuario (no se puede apuntar a otro). La llaman /bienvenida y el
--    dashboard para reparar a quien el trigger le falló.
-- 4. handle_new_user(): mismo insert de profiles y DESPUÉS la siembra dentro de
--    BEGIN … EXCEPTION WHEN OTHERS → WARNING: un error del kit nunca bloquea
--    el registro.
--
-- OJO: accounts, budget_templates y budget_items tienen FK user_id → profiles(id).
-- La siembra necesita que el perfil exista (en el trigger se inserta justo antes);
-- sin perfil falla con 23503 (ensureStarterKitAction lo devuelve como error, §5.2).


-- ============================================================================
-- 1. profiles: columnas de onboarding + backfill de usuarios existentes
-- ============================================================================
DO $migracion$
DECLARE
    v_columnas_nuevas boolean;
BEGIN
    v_columnas_nuevas := NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'onboarding_completed_at'
    );

    ALTER TABLE public.profiles
      ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
      ADD COLUMN IF NOT EXISTS onboarding_dismissed_at timestamptz;

    IF v_columnas_nuevas THEN
        UPDATE public.profiles
           SET onboarding_completed_at = now(),
               onboarding_dismissed_at = now();
    END IF;
END
$migracion$;


-- ============================================================================
-- 2. _seed_starter_kit: siembra interna e idempotente del kit inicial
-- ============================================================================
CREATE OR REPLACE FUNCTION public._seed_starter_kit(p_user_id uuid, p_month_year text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_status_id   uuid;
    v_template_id uuid;
    v_kit         jsonb;
    v_total       integer;
    v_resueltos   integer;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'seed_starter_kit: falta el usuario' USING ERRCODE = '22004';
    END IF;
    IF p_month_year IS NULL OR p_month_year !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'seed_starter_kit: mes inválido %', p_month_year USING ERRCODE = '22023';
    END IF;

    -- Dos siembras del mismo usuario a la vez (bienvenida + dashboard) se
    -- esperan una a la otra; la segunda ve las categorías y devuelve false.
    PERFORM pg_advisory_xact_lock(hashtextextended('seed_starter_kit:' || p_user_id::text, 0));

    -- Idempotencia: quien ya tiene alguna categoría ACTIVA no se toca. Quien
    -- las desactivó todas puede recargar el kit.
    IF EXISTS (SELECT 1 FROM public.categories WHERE user_id = p_user_id AND is_active = true) THEN
        RETURN false;
    END IF;

    -- Catálogos ANTES de insertar nada: si falta uno, excepción y nada a medias.
    -- No se inventan catálogos.
    SELECT id INTO v_status_id FROM public.budget_statuses WHERE name = 'Activo';
    IF v_status_id IS NULL THEN
        RAISE EXCEPTION 'seed_starter_kit: no existe el estado Activo';
    END IF;

    -- Los 12 rubros del kit con su clasificación y control resueltos por nombre.
    -- v_total <> 12 = algún nombre de catálogo repetido; v_resueltos <> 12 =
    -- falta una clasificación o un control. El resultado queda en v_kit y el
    -- INSERT de rubros lo lee de ahí (el kit se escribe una sola vez).
    SELECT count(*),
           count(*) FILTER (WHERE cl.id IS NOT NULL AND co.id IS NOT NULL),
           jsonb_agg(jsonb_build_object(
               'categoria', k.categoria,
               'rubro', k.rubro,
               'classification_id', cl.id,
               'control_id', co.id,
               'alerts', k.alerts
           ))
      INTO v_total, v_resueltos, v_kit
    FROM (VALUES
        ('VIVIENDA',   'Arriendo o cuota',   'Basico',          'Necesario',   NULL::boolean),
        ('VIVIENDA',   'Servicios públicos', 'Basico',          'Necesario',   true),
        ('VIVIENDA',   'Internet',           'Calidad de Vida', 'Simplificar', NULL::boolean),
        ('MERCADO',    'Mercado',            'Basico',          'Necesario',   true),
        ('MERCADO',    'Aseo del hogar',     'Basico',          'Necesario',   true),
        ('TRANSPORTE', 'Transporte',         'Basico',          'Necesario',   true),
        ('TRANSPORTE', 'Vehículo',           'Basico',          'Reducir',     true),
        ('SALUD',      'Salud',              'Basico',          'Necesario',   NULL::boolean),
        ('SALUD',      'Droguería',          'Basico',          'Necesario',   true),
        ('DEUDAS',     'Tarjetas',           'Basico',          'Necesario',   NULL::boolean),
        ('DEUDAS',     'Créditos',           'Basico',          'Necesario',   NULL::boolean),
        ('OTROS',      'Otros',              'Estilo de Vida',  'Reducir',     true)
    ) AS k(categoria, rubro, clasificacion, control, alerts)
    LEFT JOIN public.classifications cl ON cl.name = k.clasificacion
    LEFT JOIN public.controls co ON co.name = k.control;

    IF v_total <> 12 OR v_resueltos <> 12 THEN
        RAISE EXCEPTION 'seed_starter_kit: de 12 rubros solo % resuelven clasificación y control por nombre (filas: %)', v_resueltos, v_total;
    END IF;

    -- Categorías del kit que el usuario ya tiene (inactivas), comparando por
    -- upper(btrim(name)): 'Vivienda' o ' vivienda ' cuentan como VIVIENDA. Se
    -- reactivan en vez de crear un duplicado.
    UPDATE public.categories c
       SET is_active = true
     WHERE c.user_id = p_user_id
       AND upper(btrim(c.name)) IN (
           SELECT kit.item->>'categoria' FROM jsonb_array_elements(v_kit) AS kit(item)
       );

    -- Solo las que no existen con ese criterio (MAYÚSCULAS, activas). El
    -- ON CONFLICT es un seguro: con el lock y el NOT EXISTS no debería saltar
    -- (único: categories_name_user_id_key).
    INSERT INTO public.categories (user_id, name, is_active)
    SELECT p_user_id, c.name, true
    FROM (VALUES
        ('VIVIENDA'),
        ('MERCADO'),
        ('TRANSPORTE'),
        ('SALUD'),
        ('DEUDAS'),
        ('OTROS')
    ) AS c(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.categories e
        WHERE e.user_id = p_user_id
          AND upper(btrim(e.name)) = c.name
    )
    ON CONFLICT (name, user_id) DO NOTHING;

    -- Cada rubro del kit guarda el id de su categoría (la misma comparación).
    -- Si el usuario tuviera dos que coinciden, gana la escrita igual al kit y,
    -- entre iguales, la de menor id: resultado determinista.
    SELECT jsonb_agg(kit.item || jsonb_build_object('category_id', (
               SELECT c.id FROM public.categories c
               WHERE c.user_id = p_user_id
                 AND upper(btrim(c.name)) = kit.item->>'categoria'
               ORDER BY (c.name = kit.item->>'categoria') DESC, c.id
               LIMIT 1
           )))
      INTO v_kit
    FROM jsonb_array_elements(v_kit) AS kit(item);

    -- Cuenta Efectivo, si no hay una con ese nombre (accounts no tiene único por nombre)
    INSERT INTO public.accounts (user_id, name, type, is_active)
    SELECT p_user_id, 'Efectivo', 'cash', true
    WHERE NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.user_id = p_user_id
          AND lower(btrim(a.name)) = 'efectivo'
    );

    -- Plantilla del mes (único: idx_budget_templates_user_month). Si ya existía
    -- inactiva, se reactiva: recargar el kit no deja rubros en una plantilla apagada.
    INSERT INTO public.budget_templates (user_id, name, month_year, is_active)
    VALUES (p_user_id, 'Presupuesto ' || p_month_year, p_month_year, true)
    ON CONFLICT (user_id, month_year) DO UPDATE SET is_active = true;

    SELECT id INTO v_template_id
    FROM public.budget_templates
    WHERE user_id = p_user_id AND month_year = p_month_year;

    -- Rubros del kit que ya están en la plantilla pero inactivos: se reactivan
    -- (misma categoría y mismo nombre sin distinguir mayúsculas).
    UPDATE public.budget_items bi
       SET is_active = true
      FROM jsonb_array_elements(v_kit) AS kit(item)
     WHERE bi.template_id = v_template_id
       AND bi.category_id = (kit.item->>'category_id')::uuid
       AND lower(bi.name) = lower(kit.item->>'rubro')
       AND bi.is_active = false;

    -- Rubros ya resueltos (v_kit). Los que ya estén en la plantilla (misma
    -- categoría y mismo nombre sin distinguir mayúsculas) no se repiten: una
    -- recarga del kit puede insertar menos de 12, y está bien.
    INSERT INTO public.budget_items (user_id, template_id, category_id, classification_id, control_id, status_id, name, budgeted_amount, is_active, alerts_enabled)
    SELECT p_user_id, v_template_id, (kit.item->>'category_id')::uuid, (kit.item->>'classification_id')::uuid, (kit.item->>'control_id')::uuid, v_status_id, kit.item->>'rubro', 0, true, (kit.item->>'alerts')::boolean
    FROM jsonb_array_elements(v_kit) AS kit(item)
    WHERE NOT EXISTS (
        SELECT 1 FROM public.budget_items bi
        WHERE bi.template_id = v_template_id
          AND bi.category_id = (kit.item->>'category_id')::uuid
          AND lower(bi.name) = lower(kit.item->>'rubro')
    );

    RETURN true;
END;
$function$;

-- Interna: solo el dueño (postgres). ensure_starter_kit y handle_new_user la
-- llaman como SECURITY DEFINER, así que el chequeo de EXECUTE es contra el dueño.
-- service_role también se revoca: los default privileges de Supabase se lo dan.
REVOKE EXECUTE ON FUNCTION public._seed_starter_kit(uuid, text) FROM PUBLIC, anon, authenticated, service_role;


-- ============================================================================
-- 3. ensure_starter_kit: reparación para el usuario de la sesión
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_starter_kit()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN public._seed_starter_kit(v_uid, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
END;
$function$;

-- Solo authenticated (cliente de cookie). service_role no tiene auth.uid():
-- se revoca también porque los default privileges de Supabase se lo dan.
REVOKE EXECUTE ON FUNCTION public.ensure_starter_kit() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_starter_kit() TO authenticated;


-- ============================================================================
-- 4. handle_new_user: perfil (idéntico a producción) + kit inicial
--    El cuerpo del perfil es el de pg_get_functiondef leído el 2026-09-30.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Kit inicial (ADR-001). Un error aquí NUNCA bloquea el registro: el
    -- subbloque deshace solo la siembra y ensure_starter_kit la repara después.
    BEGIN
        PERFORM public._seed_starter_kit(NEW.id, to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'seed_starter_kit falló para %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$function$;

-- Mismos grants que dejó 20260929000000 (CREATE OR REPLACE los conserva;
-- se repiten para que esta migración sea autosuficiente).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;


-- ============================================================================
-- VERIFICACIÓN (correr a mano DESPUÉS de aplicar — tarea H8; todo va con ROLLBACK)
-- ============================================================================
--
-- 1) Columnas y backfill (esperado: 0 y 0):
-- SELECT count(*) FILTER (WHERE onboarding_completed_at IS NULL) AS sin_completed,
--        count(*) FILTER (WHERE onboarding_dismissed_at IS NULL) AS sin_dismissed
-- FROM public.profiles;
--
-- 2) Grants y search_path (esperado: _seed_starter_kit = solo postgres;
--    ensure_starter_kit = postgres,authenticated; handle_new_user =
--    postgres,supabase_auth_admin,service_role; las tres con search_path=public, pg_temp):
-- SELECT p.oid::regprocedure AS fn, p.proconfig,
--        (SELECT string_agg(CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE g.grantee::regrole::text END, ',')
--           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
--          WHERE g.privilege_type = 'EXECUTE') AS execute_para
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.proname IN ('_seed_starter_kit', 'ensure_starter_kit', 'handle_new_user')
-- ORDER BY 1;
--
-- 3) anon no puede ejecutar ninguna (esperado: ERROR 42501 permission denied):
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SET LOCAL request.jwt.claims = '{"role":"anon"}';
--   SELECT public.ensure_starter_kit();
-- ROLLBACK;
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
--   SELECT public._seed_starter_kit('11111111-1111-1111-1111-111111111111', '2026-09');
-- ROLLBACK;   -- esperado: ERROR 42501 permission denied for function _seed_starter_kit
--
-- 4) authenticated sin sub (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated"}';
--   SELECT public.ensure_starter_kit();
-- ROLLBACK;
--
-- 5) Alta de un usuario de prueba: el trigger crea perfil + kit; ensure es
--    idempotente y repara a quien no tiene categorías. Todo se deshace.
--    Si S03 ya está aplicada, antes del INSERT en auth.users agregar:
--    INSERT INTO public.signup_allowlist(email) VALUES ('usuario@ejemplo.com');
-- BEGIN;
--   INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role)
--   VALUES ('22222222-2222-2222-2222-222222222222', 'usuario@ejemplo.com', '{}'::jsonb, 'authenticated', 'authenticated');
--   SELECT count(*) FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 6
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 12
--   SELECT count(*) FROM public.accounts     WHERE user_id = '22222222-2222-2222-2222-222222222222' AND name = 'Efectivo';  -- 1
--   SELECT name, month_year FROM public.budget_templates WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 'Presupuesto <mes>', mes de Bogotá
--   SELECT c.name, bi.name, cl.name, co.name, bi.alerts_enabled, bi.budgeted_amount
--   FROM public.budget_items bi
--   JOIN public.categories c ON c.id = bi.category_id
--   JOIN public.classifications cl ON cl.id = bi.classification_id
--   JOIN public.controls co ON co.id = bi.control_id
--   WHERE bi.user_id = '22222222-2222-2222-2222-222222222222'
--   ORDER BY 1, 2;                                                   -- tabla de contratos §1.3
--   SELECT onboarding_completed_at IS NULL, onboarding_dismissed_at IS NULL
--   FROM public.profiles WHERE id = '22222222-2222-2222-2222-222222222222';  -- true, true
--
--   SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"22222222-2222-2222-2222-222222222222"}', true);
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- false (ya tiene kit)
--   RESET ROLE;
--   SELECT count(*) FROM public.categories WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- sigue en 6
--
--   -- Desactivó todas sus categorías: puede recargar el kit sin duplicar rubros.
--   UPDATE public.categories SET is_active = false WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- true (reactivó)
--   RESET ROLE;
--   SELECT count(*) FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222' AND is_active;  -- 6
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- sigue en 12 (NOT EXISTS)
--
--   -- Recarga robusta (S09b): plantilla y un rubro del kit inactivos, y la
--   -- categoría renombrada a 'Vivienda' en minúsculas. Todo se reactiva sin duplicar.
--   UPDATE public.categories SET name = 'Vivienda' WHERE user_id = '22222222-2222-2222-2222-222222222222' AND name = 'VIVIENDA';
--   UPDATE public.categories SET is_active = false WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   UPDATE public.budget_templates SET is_active = false WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   UPDATE public.budget_items SET is_active = false WHERE user_id = '22222222-2222-2222-2222-222222222222' AND name = 'Internet';
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- true (recargó)
--   RESET ROLE;
--   SELECT count(*) FROM public.categories WHERE user_id = '22222222-2222-2222-2222-222222222222' AND upper(btrim(name)) = 'VIVIENDA';  -- 1 (Vivienda reactivada, sin VIVIENDA nueva)
--   SELECT count(*), count(*) FILTER (WHERE is_active) FROM public.categories WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 6, 6
--   SELECT is_active FROM public.budget_templates WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- true (una sola fila)
--   SELECT count(*), count(*) FILTER (WHERE is_active) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 12, 12 (Internet reactivado)
--
--   -- Sin categorías ni rubros: el kit se siembra completo otra vez.
--   DELETE FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   DELETE FROM public.categories   WHERE user_id = '22222222-2222-2222-2222-222222222222';
--   SET LOCAL ROLE authenticated;
--   SELECT public.ensure_starter_kit();                               -- true (reparó)
--   RESET ROLE;
--   SELECT count(*) FROM public.budget_items WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 12
--   SELECT count(*) FROM public.accounts     WHERE user_id = '22222222-2222-2222-2222-222222222222';  -- 1 (no duplicó Efectivo)
-- ROLLBACK;
--
-- 6) Advisors: get_advisors(security) no debe listar function_search_path_mutable
--    ni anon_security_definer_function_executable para estas tres funciones
--    (authenticated_security_definer_function_executable para ensure_starter_kit
--    es esperado: la protección es que no recibe usuario y usa auth.uid()).
