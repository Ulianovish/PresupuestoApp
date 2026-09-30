# Épicas e historias — Multiusuario

Contratos: `docs/agile/contracts.md`. Diseño: `docs/superpowers/specs/2026-09-30-multiusuario-design.md`.

## E0 — Seguridad previa (bloquea abrir el registro)

### S01 — Blindar funciones que solo existen en remoto
- [ ] Migración `20260930100000_blindar_funciones_remotas.sql` con la definición real (de `pg_get_functiondef`) de `get_previous_month_overspend`, `copy_budget_items_from_template`, `fix_templates_without_items`, `check_cufe_exists`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier`.
- [ ] `get_previous_month_overspend` con guard; sin EXECUTE para `anon`/`PUBLIC`.
- [ ] Toda función que reciba `p_user_id` filtra por él; si no filtraba, se corrige y se documenta.
- [ ] `get_budget_by_month` con guard.
- [ ] Bloque comentado de verificación: tablas `public` sin RLS y grants de las funciones.
- [ ] Test de texto que verifica guard, `search_path`, revokes y que ninguna firma crea un overload nuevo.

### S02 — Vinculación de WhatsApp segura con varios usuarios
- [ ] Índice único parcial de códigos pendientes; generación con reintento ante `23505` (máx. 5) y limpieza de vencidos propios.
- [ ] Tabla `whatsapp_link_attempts`; 5 fallos por número en 15 min → `MSG_TOO_MANY_ATTEMPTS` sin consultar el código.
- [ ] Revincular a otro usuario borra `whatsapp_conversations` del número.
- [ ] Tests unitarios de generación, canje, límite y revinculación (cliente mockeado, reloj inyectado).

## E1 — Registro y acceso

### S03 — Allowlist de registro
- [ ] Tabla `signup_allowlist`, `is_signup_allowed`, hook o trigger según ADR-002 (verificar disponibilidad del hook en el plan con la documentación oficial y dejarlo escrito en la ADR).
- [ ] Backfill de los correos existentes.
- [ ] Test de texto de la migración (RLS, revokes, grants a `supabase_auth_admin`, mensaje `signup_not_allowed`).
- [ ] Instrucciones exactas de H5/H6 en la historia.

### S04 — Confirmación de correo y sesión
- [ ] `getSiteUrl`, `safeRedirectPath`, `translateAuthError`, `getPostLoginPath` con tests.
- [ ] `GET /auth/confirm` con `verifyOtp`; `/auth/callback` como route handler; página vieja eliminada.
- [ ] `registerAction` con `emailRedirectTo`; `loginAction` respeta `redirectTo` y usa `getPostLoginPath`; todos los errores pasan por `translateAuthError`.
- [ ] `middleware.ts` actualizado; `.env.example` con `NEXT_PUBLIC_SITE_URL`.
- [ ] Texto de la plantilla "Confirm signup" para H4 en la historia.

### S05 — Recuperar contraseña
- [ ] `/auth/forgot-password` con respuesta idéntica exista o no el correo.
- [ ] `/auth/reset-password` con `passwordSchema`, requiere sesión, redirige a `/dashboard`.
- [ ] Texto de la plantilla "Reset password" para H4.

### S06 — Términos, privacidad y regla de contraseña
- [ ] `/terms` y `/privacy` mínimas y honestas (qué datos se guardan: gastos, facturas, número de WhatsApp, cédula; proveedores: Supabase, Vercel, Twilio, proveedor de IA; cómo pedir borrado).
- [ ] `passwordSchema` (8–72) en registro y reset; la UI dice "Mínimo 8 caracteres."

## E2 — Quitar restos de usuario único

### S07 — Sin datos del dueño en el código
- [ ] `inicializarDatosEjemplo` y su disparo eliminados; test que confirma que un usuario sin datos no recibe inserts.
- [ ] Presupuesto mock fuera del sidebar.
- [ ] `ACCOUNT_TYPES` eliminado; /gastos con cuentas del usuario y `DEFAULT_ACCOUNT_NAME`.
- [ ] `category_name` inicial = primera categoría; sin categorías, guardar deshabilitado con aviso.

### S08 — Clasificación y control por defecto explícitos
- [ ] `budget-defaults.ts`; `categories.ts` y `deudas-budget.ts` buscan por nombre; respaldo con `console.warn`.
- [ ] Tests de la selección por nombre y del respaldo.

## E3 — Kit inicial

### S09 — Kit inicial y columnas de onboarding
- [ ] Migración `20260930130000_kit_inicial_y_onboarding.sql`: columnas de `profiles` con backfill, `_seed_starter_kit`, `ensure_starter_kit`, `handle_new_user` con bloque de excepción.
- [ ] Kit exacto de contratos §1.3; idempotente.
- [ ] Test de texto de la migración (grants, `search_path`, idempotencia, 12 rubros, 6 categorías, bloque EXCEPTION).

## E4 — Onboarding

### S10 — Estados vacíos y navegación
- [ ] `/presupuesto` sin categorías ofrece crear categoría (o reparar el kit con `ensureStarterKitAction`) en el panel vacío.
- [ ] Menú móvil con Ajustes y Cerrar sesión; `/test` fuera de ambos menús.
- [ ] "Agregar Gasto" del dashboard lleva a `/gastos` y abre el formulario.
- [ ] Se quita el texto "Migrar Datos de Julio".

### S11 — Bienvenida
- [ ] `/bienvenida` con 3 pasos saltables según contratos §2.7.
- [ ] `suggest503020` con tests (grupos, redondeo, grupos vacíos, ingreso 0).
- [ ] Acciones de onboarding con tests (filtro por usuario, montos inválidos).
- [ ] Al terminar: `onboarding_completed_at` y `/dashboard`.

### S12 — Checklist del dashboard
- [ ] `computeChecklist` y `loadChecklistInput` con tests.
- [ ] `OnboardingChecklist` en el dashboard; "Ocultar" guarda `onboarding_dismissed_at`.
- [ ] El dashboard llama `ensureStarterKitAction()` al cargar.

### S13 — WhatsApp en Ajustes
- [ ] `buildWhatsAppLinkUrl` con tests; enlace `wa.me` en el panel.
- [ ] `MSG_LINKED_OK` nuevo; botón desvincular con `unlinkWhatsAppPhoneAction`.
- [ ] `.env.example` con `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`.

## E5 — Integración

### S14 — Punta a punta con un segundo usuario
- [ ] Suite completa y typecheck en verde en la rama integrada.
- [ ] Guion de prueba manual (para después de H1–H8) con un usuario de prueba: registro → confirmación → bienvenida → gasto web → vinculación → gasto por WhatsApp; verificar que no ve nada del usuario 1.
- [ ] Consultas SQL de solo lectura para verificar aislamiento después de aplicar las migraciones.
