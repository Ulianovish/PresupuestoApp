# Multiusuario — investigación (fase 1)

Fecha: 2026-09-29. Cuatro investigadores en paralelo, solo lectura (SELECT de catálogo y conteos en producción, sin montos ni datos personales).

## Veredicto

La base de datos ya aísla bien a los usuarios: todas las tablas con datos llevan `user_id`, RLS con `auth.uid()`, y las RPC SECURITY DEFINER tienen guard desde `3023f2f`. Lo que impide que un segundo usuario use la app está en cuatro lugares: el flujo de registro, el kit inicial, el onboarding y algunos restos de usuario único en el código.

## A. Seguridad antes de abrir el registro

| # | Hallazgo | Prioridad |
|---|---|---|
| A1 | `get_previous_month_overspend(p_user_id, p_month_year)` es SECURITY DEFINER, sin guard, ejecutable por `anon`/`authenticated`. No está en el repo (advisor 0028). | 🔴 bloqueante |
| A2 | Funciones solo en remoto sin cuerpo en el repo: `copy_budget_items_from_template`, `fix_templates_without_items`, `check_cufe_exists`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier`. Hay que confirmar que filtran por `p_user_id`. | 🔴 verificar |
| A3 | `get_budget_by_month` corre como INVOKER sin guard; seguro por RLS pero conviene el mismo guard. | medio |
| A4 | `whatsapp_link_codes.code` sin UNIQUE + `redeemLinkCode` sin LIMIT: dos códigos iguales vinculan el número al usuario equivocado. Sin rate limit de canje. | importante |
| A5 | `supabase_schema.sql:384` hace `GRANT ALL … TO anon, authenticated`: toda tabla nueva sin RLS queda abierta. | vigilar |
| A6 | `callback/page.tsx:29` redirige a `params.redirectTo` sin validar (redirección abierta). | medio |
| A7 | Sin cuota ni rate limit por usuario en IA (`/api/expenses/classify`, `/api/invoices/process`) ni en WhatsApp. Cualquiera registrado gasta. | decisión |
| A8 | Leaked password protection apagada (requiere plan Pro). | menor |

## B. Registro con correo y contraseña

Verificado en `/auth/v1/settings`: registros **habilitados**, confirmación de correo **obligatoria**, solo proveedor email. 1 usuario en `auth.users`.

Existe: `/auth/register`, `/auth/login`, `registerAction` (`src/lib/actions/auth.ts:68-130`), trigger `handle_new_user` → `profiles`.

Roto o faltante:
1. No hay `/auth/confirm` (route handler con `verifyOtp({ token_hash, type })`).
2. `/auth/callback` es un Server Component: `exchangeCodeForSession` no puede escribir cookies (el error se traga en `src/lib/supabase/server.ts:27-30`). La sesión no queda.
3. `signUp` no pasa `emailRedirectTo`; no hay `NEXT_PUBLIC_SITE_URL`.
4. `/auth/forgot-password`, `/auth/reset-password`, `/terms`, `/privacy` dan 404 (se enlazan desde login y registro).
5. UI dice "mayúscula, minúscula y número"; Zod solo pide `min(6)`.
6. Mapa de errores no traduce "Email address not authorized", "email rate limit exceeded", "Database error saving new user".
7. `loginAction` ignora `redirectTo`.

No verificable por MCP (dashboard de Supabase): SMTP propio o integrado, Site URL y Redirect URLs, plantillas de correo, rate limits, plan.

SMTP integrado de Supabase: 2 correos/hora y solo a miembros del equipo del proyecto. No sirve para usuarios reales.

Flujo recomendado (docs Supabase): `signUp` con `emailRedirectTo` → plantilla "Confirm signup" a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=…` → route handler `verifyOtp` → redirect. Mismo patrón para recuperación (`type=recovery`) e invitación (`type=invite`).

Opciones para restringir registro: (A) registro cerrado + invitaciones desde admin; (B) hook "Before User Created" con allowlist; (C) código de invitación en el form — solo válido con registro cerrado; (D) captcha Turnstile; (E) cuotas/flags por usuario para IA y WhatsApp.

## C. Categorías y rubros iniciales

Modelo: categoría (`categories`, por usuario) → rubro (`budget_items`, una fila por mes en `budget_templates`) → gasto (`transactions`, con `category_name` como texto y `budget_item_id`). Clasificación, control, estado: catálogos globales.

Hoy: 22 categorías, todas del único usuario. Un usuario nuevo arranca con 0 categorías, 0 plantillas, 0 rubros. El primer mes no se copia de ninguno.

Dependencias duras en el código:
- `OTROS` es el respaldo escrito en `categorizer.ts:1`, `whatsapp-expenses.ts:104,253`, `process-invoice.ts:450`, `historial-clasificacion.ts:565`, `gastos/page.tsx:137`.
- `DEUDAS` es obligatoria en `deudas-budget.ts:36-43`.
- TRANSPORTE, VIVIENDA, MERCADO se adivinan por palabras clave en la importación (`gastos/page.tsx:48-115`).
- El clasificador solo manda a la IA los rubros del mes y de la misma categoría; categoría sin rubros se salta (`expense-classification.ts:143-206`).
- Sin categorías, `resolveUserCategoryNames` responde las 5 de la constante y el bot clasifica en categorías que el usuario no tiene.

Bug: al crear un rubro se toma la primera clasificación y el primer control activos en orden alfabético → "Basico / Eliminar" (135 ítems mal marcados; `categories.ts:284-300`, `:396-411`, `deudas-budget.ts`).

Propuesta de kit (resumen; detalle en el diseño): VIVIENDA, MERCADO, TRANSPORTE, SALUD, COMUNICACIONES, ENTRETENIMIENTO, GASTOS PERSONALES, GASTOS HORMIGA, EDUCACIÓN, DEUDAS, AHORRO E INVERSIÓN, IMPUESTOS, OTROS, con 2-6 rubros genéricos cada una y clasificación/control explícitos. Paquetes opcionales: MASCOTAS, HIJOS, vehículo sí/no. Nada de nombres propios ni marcas locales (EPM, Metro, DiDi).

## D. Onboarding — estado actual con 0 datos

| Pantalla | Con 0 datos |
|---|---|
| `/dashboard` | vacío decente; "Agregar Gasto" es un botón muerto (`DashboardQuickActions.tsx:22-26`) |
| `/presupuesto` | **callejón sin salida**: "Crear Presupuesto" crea plantilla sin rubros y vuelve al mismo panel; el único `AddCategoryButton` está en la tabla que no se muestra |
| `/gastos` | **bloqueado**: select de categoría vacío y `required`; cuenta por defecto "Nequi" y lista fija con las cuentas del dueño (`expense-categories.ts:16-23`) |
| `/ingresos`, `/deudas` | OK |
| `/settings` | buenos vacíos; única salida para crear categorías |
| Menú móvil | **sin Ajustes ni Cerrar sesión** (`MobileSidebar.tsx:44-80`); `/test` visible |

Datos del dueño en el código que ve o recibe cualquier usuario:
- `inicializarDatosEjemplo()` (`src/lib/services/ingresos-deudas.ts:391-470`) inserta ingresos y deudas reales del dueño a cualquier usuario sin datos; se dispara solo desde `useIngresosDeudas.ts:124-129`. 🔴
- Presupuesto mock en la barra lateral (`src/hooks/useBudgetData.ts:32-138`, `Sidebar.tsx`). 🔴
- `ACCOUNT_TYPES` con las cuentas del dueño; guardar un gasto así crea "Nequi" al otro usuario.

WhatsApp: el panel de vinculación no muestra el número del bot; `MSG_LINKED_OK` desactualizado; no se puede desvincular; con 0 cuentas la pregunta de cuenta sale vacía.

Producto: hoy dos personas comparten un mismo `user_id` a propósito ("familia → un presupuesto").

Referencias de onboarding: YNAB (checklist + plantillas de categorías), Monefy/Wallet (primer gasto en dos toques con categorías precargadas), NN/g sobre estados vacíos, onboarding progresivo.
