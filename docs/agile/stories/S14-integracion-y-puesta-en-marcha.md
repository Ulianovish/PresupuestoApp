# S14 — Integración y puesta en marcha

Estado de la integración (2026-09-30): los flujos SEG, AUTH y APP y `origin/main` están fusionados en `feat/multiusuario`. 1.647 tests, typecheck y lint en verde. Build real con variables ficticias: compila y lista `ƒ Middleware`.

Arreglo de integración: `get_previous_month_overspend` tiene un llamador nuevo en `origin/main` (alerta de sobregasto, `src/lib/services/budget.ts`), así que S01 la deja con guard y EXECUTE a `authenticated` y `service_role` (no solo `service_role`).

## Orden de puesta en marcha (cada paso con OK de la persona)

1. **Preview de Vercel.** Push de `feat/multiusuario`. En ventana privada, sin sesión:
   - [ ] `/gastos` y `/bienvenida` redirigen a `/auth/login?redirectTo=…`.
   - [ ] `/`, `/terms`, `/privacy`, `/auth/login`, `/auth/register` cargan sin redirigir.
   - [ ] Con sesión del usuario real: `/dashboard`, `/presupuesto` (alerta de sobregasto incluida), `/gastos` y `/settings` funcionan sin bucles; cerrar sesión funciona.
   - [ ] El build del preview lista `ƒ Middleware`.
2. **Chequeos de solo lectura en producción** (antes de H8):
   - [ ] `20260929000000` y `20260929000100` aplicadas (sí, verificado el 2026-09-30 con `list_migrations`).
   - [ ] Bloque 0 de `20260930100000`: `md5(prosrc)` de las 7 funciones sin desfase inesperado.
   - [ ] Catálogos por nombre: `budget_statuses.Activo`; `classifications` Basico, Calidad de Vida, Estilo de Vida; `controls` Necesario, Simplificar, Reducir.
   - [ ] Constraints del kit: `categories (name, user_id)` único, índice único `idx_budget_templates_user_month`, trigger `on_auth_user_created` AFTER INSERT.
   - [ ] Conteo de códigos de vinculación pendientes vencidos o duplicados que borrará `20260930110000`.
3. **Verificación con escritura revertida** de los bloques de VERIFICACIÓN de S03 y S09 (INSERT en `auth.users` con ROLLBACK): en una rama de Supabase (costo) o dentro de `BEGIN … ROLLBACK` en producción.
4. **H8 — migraciones**, en este orden, cada una seguida de su bloque de verificación de solo lectura:
   1. `20260930100000_blindar_funciones_remotas`
   2. `20260930110000_whatsapp_vinculacion_segura`
   3. `20260930120000_signup_allowlist` (cierra el registro; el usuario existente entra por el backfill)
   4. `20260930130000_kit_inicial_y_onboarding` (después de S03, para que nadie sin invitación reciba el kit)
5. **H6** correos invitados en `signup_allowlist`; **H5** activar el hook Before User Created.
6. **Merge a `main` y deploy a producción.**
7. **H1–H4, H9**: dominio y Resend, SMTP, URLs y plantillas de correo, correo de contacto. Recién entonces se invita a la primera persona.

## Guion de prueba de punta a punta (después del paso 7, con un usuario de prueba invitado)

- [ ] Registro con un correo de la allowlist → llega el correo → el enlace abre `/auth/confirm` → cae en `/bienvenida`.
- [ ] Registro con un correo fuera de la allowlist → "Este correo no tiene invitación…".
- [ ] Bienvenida: ingreso → montos (sugerencia 50/30/20) → primer gasto → `/dashboard` con checklist.
- [ ] `/presupuesto` muestra las 6 categorías y los 12 rubros del kit; el gasto aparece asignado.
- [ ] Ajustes → Conectar WhatsApp → "Abrir WhatsApp" → `VINCULAR <código>` → "¡Listo!…". Un gasto por WhatsApp queda en el presupuesto del usuario de prueba.
- [ ] Olvidé mi contraseña → correo → `/auth/reset-password` → entra.
- [ ] El usuario de prueba no ve nada del usuario real (dashboard, gastos, cuentas, deudas, facturas).

## Consultas de aislamiento (solo lectura, con el usuario de prueba creado)

```sql
-- Cada usuario ve solo lo suyo (sustituir los uuid; correr como service role).
SELECT 'categories' t, user_id, count(*) FROM categories GROUP BY user_id
UNION ALL SELECT 'accounts', user_id, count(*) FROM accounts GROUP BY user_id
UNION ALL SELECT 'budget_items', user_id, count(*) FROM budget_items GROUP BY user_id
UNION ALL SELECT 'transactions', user_id, count(*) FROM transactions GROUP BY user_id
ORDER BY 1, 2;

-- El usuario de prueba recibió el kit completo (6 categorías, 12 rubros, Efectivo).
SELECT (SELECT count(*) FROM categories WHERE user_id = '<uuid_prueba>' AND is_active) AS categorias,
       (SELECT count(*) FROM budget_items WHERE user_id = '<uuid_prueba>') AS rubros,
       (SELECT count(*) FROM accounts WHERE user_id = '<uuid_prueba>' AND name = 'Efectivo') AS efectivo;

-- Con el JWT del usuario de prueba, las RPC con guard rechazan el uuid del usuario real (esperado: 42501).
BEGIN;
  SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims', '{"sub":"<uuid_prueba>","role":"authenticated"}', true);
  SELECT * FROM get_previous_month_overspend('<uuid_real>', to_char(now(), 'YYYY-MM'));
ROLLBACK;
```

## Deuda que queda (backlog)

- Límite global de intentos de VINCULAR entre varios números (riesgo aceptado, S02).
- `getCategories` se traga los errores (S07).
- `/test` sigue pública (ADR-004).
- Casos borde de recarga del kit con dos variantes de una categoría (S09b).
- Varias pruebas de texto frágiles sobre el código fuente (S07, S08, S13).
- `supabase/migrations/20260923160000_*.sql` (ya aplicada) contiene un nombre personal en nombres de tarjeta.
