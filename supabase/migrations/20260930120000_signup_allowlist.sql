-- S03 — Allowlist de registro (contratos §1.1, ADR-002).
--
-- Solo los correos de public.signup_allowlist pueden crear una cuenta.
-- Doble barrera:
--   1) Hook "Before User Created" (public.hook_before_user_created): rechaza
--      con HTTP 403 y mensaje 'signup_not_allowed'. Cubre signup, invitaciones,
--      generateLink, OAuth/SSO y anónimos. Se activa a mano en el dashboard (H5).
--   2) Trigger BEFORE INSERT ON auth.users (enforce_signup_allowlist): respaldo
--      que protege desde que se aplica la migración (antes de H5) y cubre
--      auth.admin.createUser / "Add user" del dashboard, que no pasan por el hook.
--      Con el hook activo, un registro rechazado nunca llega al INSERT, así que
--      el trigger no repite el rechazo.
-- Invitar = insertar el correo en la tabla (H6), por SQL o desde el dashboard.

-- 1) Tabla. Correo guardado en minúsculas y sin espacios (citext no está
--    instalada en el proyecto; el CHECK obliga a normalizar al insertar).
CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email      text PRIMARY KEY CHECK (email = lower(btrim(email))),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS sin políticas a propósito: ningún cliente (anon/authenticated) la lee ni
-- la escribe. La consulta pasa por is_signup_allowed (SECURITY DEFINER).
ALTER TABLE public.signup_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.signup_allowlist FROM PUBLIC, anon, authenticated;

-- 2) ¿Este correo puede registrarse? NULL o vacío → false.
CREATE OR REPLACE FUNCTION public.is_signup_allowed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.signup_allowlist
    WHERE email = lower(btrim(p_email))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_signup_allowed(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_signup_allowed(text) TO supabase_auth_admin;

-- 3) Backfill: quien ya tiene cuenta queda en la lista. Idempotente.
--    Se omiten usuarios sin correo (teléfono/anónimos: la app no los usa).
INSERT INTO public.signup_allowlist (email, note)
SELECT lower(btrim(u.email)), 'usuario existente (backfill S03)'
FROM auth.users u
WHERE u.email IS NOT NULL AND btrim(u.email) <> ''
ON CONFLICT (email) DO NOTHING;

-- 4) Hook "Before User Created" (se activa en H5: Authentication → Auth Hooks,
--    tipo Postgres, public.hook_before_user_created).
--    Entrada: { metadata: {...}, user: { email, ... } }. Salida: '{}' permite;
--    { error: { http_code, message } } rechaza y el mensaje llega al cliente.
--    INVOKER a propósito (la documentación de Supabase desaconseja SECURITY
--    DEFINER en hooks): corre como supabase_auth_admin y lee la tabla solo a
--    través de is_signup_allowed.
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_signup_allowed(event->'user'->>'email') THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'signup_not_allowed')
  );
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;

-- 5) Trigger de respaldo. Protege antes de activar el hook (H5) y cubre
--    auth.admin.createUser / "Add user" del dashboard, que no llaman al hook.
--    El cliente ve 'Database error saving new user' (translateAuthError lo
--    traduce). Con el hook activo, un correo no invitado nunca llega aquí.
CREATE OR REPLACE FUNCTION public.enforce_signup_allowlist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_signup_allowed(NEW.email) THEN
    RAISE EXCEPTION 'signup_not_allowed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_signup_allowlist() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_signup_allowlist() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS enforce_signup_allowlist ON auth.users;
CREATE TRIGGER enforce_signup_allowlist
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_signup_allowlist();

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN MANUAL (después de aplicar en H8; SQL Editor como postgres).
-- Todo es lectura salvo el bloque 4, que termina en ROLLBACK.
--
-- 1) RLS activo y sin políticas (esperado: true y 0):
-- SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_allowlist'::regclass;
-- SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'signup_allowlist';
--
-- 2) Privilegios (esperado: false, false, false, true, true, true):
-- SELECT has_table_privilege('anon', 'public.signup_allowlist', 'SELECT');
-- SELECT has_table_privilege('authenticated', 'public.signup_allowlist', 'SELECT');
-- SELECT has_function_privilege('anon', 'public.is_signup_allowed(text)', 'EXECUTE');
-- SELECT has_function_privilege('supabase_auth_admin', 'public.is_signup_allowed(text)', 'EXECUTE');
-- SELECT has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'EXECUTE');
-- SELECT has_schema_privilege('supabase_auth_admin', 'public', 'USAGE');
--
-- 3) Backfill: ningún usuario existente quedó fuera (esperado: 0):
-- SELECT count(*) FROM auth.users u
-- WHERE u.email IS NOT NULL AND NOT public.is_signup_allowed(u.email);
--
-- 4) Hook con un correo de ejemplo (esperado: {} y luego el error 403):
-- BEGIN;
--   INSERT INTO public.signup_allowlist (email) VALUES ('usuario@ejemplo.com');
--   SELECT public.hook_before_user_created('{"user":{"email":" Usuario@Ejemplo.com "}}'::jsonb);
--   SELECT public.hook_before_user_created('{"user":{"email":"otro@ejemplo.com"}}'::jsonb);
-- ROLLBACK;
--
-- 5) Triggers de auth.users (esperado: enforce_signup_allowlist y on_auth_user_created):
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgrelid = 'auth.users'::regclass AND NOT tgisinternal;
--
-- 6) Advisors: get_advisors(security) puede listar rls_enabled_no_policy para
--    signup_allowlist (INFO). Es intencional: nadie salvo el dueño la toca.
