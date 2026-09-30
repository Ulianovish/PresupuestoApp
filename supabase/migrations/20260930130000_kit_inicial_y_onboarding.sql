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
--    resuelvan por nombre. Inserta (o reactiva) 6 categorías, la cuenta
--    Efectivo, la plantilla del mes y los rubros que falten (NOT EXISTS por
--    plantilla + categoría + lower(nombre)) en la misma transacción. NO usa
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

    -- Categorías (MAYÚSCULAS, activas). Si ya existían inactivas con el mismo
    -- nombre, se reactivan (único: categories_name_user_id_key).
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
    ON CONFLICT (name, user_id) DO UPDATE SET is_active = true;

    -- Cuenta Efectivo, si no hay una con ese nombre (accounts no tiene único por nombre)
    INSERT INTO public.accounts (user_id, name, type, is_active)
    SELECT p_user_id, 'Efectivo', 'cash', true
    WHERE NOT EXISTS (
        SELECT 1 FROM public.accounts a
        WHERE a.user_id = p_user_id
          AND lower(btrim(a.name)) = 'efectivo'
    );

    -- Plantilla del mes (único: idx_budget_templates_user_month)
    INSERT INTO public.budget_templates (user_id, name, month_year, is_active)
    VALUES (p_user_id, 'Presupuesto ' || p_month_year, p_month_year, true)
    ON CONFLICT (user_id, month_year) DO NOTHING;

    SELECT id INTO v_template_id
    FROM public.budget_templates
    WHERE user_id = p_user_id AND month_year = p_month_year;

    -- Rubros ya resueltos (v_kit). Los que ya estén en la plantilla (misma
    -- categoría y mismo nombre sin distinguir mayúsculas) no se repiten: una
    -- recarga del kit puede insertar menos de 12, y está bien.
    INSERT INTO public.budget_items (user_id, template_id, category_id, classification_id, control_id, status_id, name, budgeted_amount, is_active, alerts_enabled)
    SELECT p_user_id, v_template_id, cat.id, (kit.item->>'classification_id')::uuid, (kit.item->>'control_id')::uuid, v_status_id, kit.item->>'rubro', 0, true, (kit.item->>'alerts')::boolean
    FROM jsonb_array_elements(v_kit) AS kit(item)
    JOIN public.categories cat ON cat.user_id = p_user_id AND cat.name = kit.item->>'categoria'
    WHERE NOT EXISTS (
        SELECT 1 FROM public.budget_items bi
        WHERE bi.template_id = v_template_id
          AND bi.category_id = cat.id
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
