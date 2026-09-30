# ADR-002 — Allowlist de registro en Supabase Auth

Estado: aceptada (2026-09-30). Registro con allowlist: decisión de la persona. Mecanismo: orquestador; verificado y cerrado en S03 (2026-09-30).

## Contexto
`disable_signup = false` y la anon key es pública: cualquiera puede llamar `/auth/v1/signup` sin pasar por el formulario. Cada usuario gasta IA, Twilio y el scraper DIAN, sin cuotas.

## Opciones
1. Validar en el server action: se salta llamando a la API directo.
2. Hook "Before User Created": oficial, error 403 con mensaje propio; requiere activarlo en el dashboard y que el plan lo permita.
3. Trigger `BEFORE INSERT ON auth.users`: funciona en cualquier plan; el cliente ve "Database error saving new user".

## Decisión
Tabla `signup_allowlist` administrada por SQL/dashboard y función `is_signup_allowed`. Enforcement con **hook (2) como barrera principal y trigger (3) como respaldo**, ambos en `supabase/migrations/20260930120000_signup_allowlist.sql`:
- `public.hook_before_user_created(event jsonb)`: `{}` si el correo está en la lista; si no, `{"error":{"http_code":403,"message":"signup_not_allowed"}}`.
- Trigger `enforce_signup_allowlist` `BEFORE INSERT ON auth.users`: `RAISE EXCEPTION 'signup_not_allowed'`.

En ambos casos `translateAuthError` (S04) traduce el mensaje.

## Verificación (S03, 2026-09-30)
- **Plan.** "Before User Created" está disponible en Free y Pro (tabla "Available on Plan" de https://supabase.com/docs/guides/auth/auth-hooks). No depende del plan del proyecto.
- **Entrada.** `{ metadata: { uuid, time, name: "before-user-created", ip_address }, user: { id, aud, role, email, phone, app_metadata, user_metadata, identities, created_at, updated_at, is_anonymous } }`. El usuario todavía no existe en `auth.users` (https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).
- **Salida.** `{}` permite. `{ "error": { "http_code": 4xx, "message": "…" } }` rechaza y el mensaje llega al cliente; sin `http_code`, Auth responde 500. En el código de Auth (`internal/hooks/hookserrors/hookserrors.go`) el error sale sin `error_code`: supabase-js entrega `status 403`, `message 'signup_not_allowed'` y ningún `code` propio. El rechazo del trigger llega como `500`, `code 'unexpected_failure'`, `message 'Database error saving new user'` (en la API de admin: `'Database error creating new user'`).
- **Grants.** Auth llama la función como `supabase_auth_admin`: `GRANT EXECUTE … TO supabase_auth_admin`, `GRANT USAGE ON SCHEMA public TO supabase_auth_admin`, `REVOKE EXECUTE … FROM authenticated, anon, public`. La documentación desaconseja `SECURITY DEFINER` en el hook; por eso el hook es INVOKER y lee la tabla solo a través de `is_signup_allowed` (SECURITY DEFINER, EXECUTE solo para `supabase_auth_admin`). Así no hace falta política RLS para `supabase_auth_admin`.
- **Flujos cubiertos por el hook.** La documentación no los enumera; se verificó en el código de `github.com/supabase/auth` (commit `ce9a8eee0cc0`, 2026-09-22): `triggerBeforeUserCreated` se llama en `signup.go`, `invite.go` (`inviteUserByEmail` e "Invite user" del dashboard), `mail.go` (`generateLink` de tipo signup e invite), `external.go`, `token_oidc.go`, `samlacs.go`, `web3.go` (OAuth, OIDC, SAML, Web3) y `anonymous.go`. **No** se llama en `admin.go` → `adminUserCreate` (`auth.admin.createUser` y "Add user → Create new user" del dashboard).
- **Proyecto** (SELECT de solo lectura, 2026-09-30): Postgres 17.4; `citext` no instalada (por eso `text` con CHECK de minúsculas); `supabase_auth_admin` ya tiene USAGE en `public`; `postgres` tiene privilegio TRIGGER sobre `auth.users`, donde ya existe `on_auth_user_created`; los usuarios actuales tienen el correo normalizado y ninguno es anónimo.

## Por qué también el trigger
1. El hook solo actúa después de activarlo a mano (H5) y la migración se aplica antes (H8). Sin trigger, entre H8 y H5 el registro seguiría abierto.
2. `auth.admin.createUser` y "Add user" del dashboard no pasan por el hook.
3. Si alguien desactiva el hook, el registro no queda abierto en silencio.

No repite el rechazo: con el hook activo, un registro rechazado nunca llega al `INSERT`, así que el trigger no se dispara y el cliente ve un solo mensaje (`signup_not_allowed`). El trigger solo actúa cuando el hook no lo hizo. Costo: una función de trigger de 8 líneas.

## Consecuencias
- Invitar = insertar el correo en la tabla (H6) **antes** de que la persona se registre o de invitarla desde el dashboard. Sin UI de administración por ahora.
- Quitar un correo de la lista no borra una cuenta ya creada.
- Usuarios sin correo (teléfono, anónimos) quedan bloqueados; la app no los usa.
- `translateAuthError` debe mirar `message` aunque `code` venga con un valor que no está en su tabla (`unexpected_failure`) o no venga.
