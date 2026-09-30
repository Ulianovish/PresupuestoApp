# ADR-002 — Allowlist de registro en Supabase Auth

Estado: aceptada (2026-09-30). Registro con allowlist: decisión de la persona. Mecanismo: orquestador.

## Contexto
`disable_signup = false` y la anon key es pública: cualquiera puede llamar `/auth/v1/signup` sin pasar por el formulario. Cada usuario gasta IA, Twilio y el scraper DIAN, sin cuotas.

## Opciones
1. Validar en el server action: se salta llamando a la API directo.
2. Hook "Before User Created": oficial, error 403 con mensaje propio; requiere activarlo en el dashboard y que el plan lo permita.
3. Trigger `BEFORE INSERT ON auth.users`: funciona en cualquier plan; el cliente ve "Database error saving new user".

## Decisión
Tabla `signup_allowlist` administrada por SQL/dashboard y función `is_signup_allowed`. Enforcement con el hook (2); si S03 verifica que el plan no lo permite, trigger (3). En ambos casos `translateAuthError` traduce el mensaje. S03 completa esta ADR con lo verificado.

## Consecuencias
Invitar = insertar un correo en la tabla (tarea H6). Sin UI de administración por ahora.
