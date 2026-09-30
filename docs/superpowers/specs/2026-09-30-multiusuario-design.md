# Multiusuario: registro, kit inicial y onboarding — diseño

Fecha: 2026-09-30. Investigación: [2026-09-29-multiusuario-investigacion.md](../research/2026-09-29-multiusuario-investigacion.md).

## Objetivo

Que una persona nueva, cuyo correo esté en la allowlist, pueda registrarse con correo y contraseña, confirme el correo, entre con un presupuesto funcional ya sembrado y quede lista para registrar gastos por web o por WhatsApp. Todo sin ver ni recibir datos de otro usuario.

Fuera de alcance: hogares con varios logins sobre un mismo presupuesto, separar al segundo usuario actual, cuotas de IA por usuario, sección completa de cuentas, OAuth.

## Decisiones

| # | Decisión | Quién | Motivo |
|---|---|---|---|
| D1 | Registro con **allowlist de correos**, aplicada dentro de Supabase Auth (no en el formulario) | Persona | Costos de IA/WhatsApp/DIAN sin cuota; el formulario se salta llamando a la API |
| D2 | Correo transaccional con **Resend y dominio propio** vía SMTP de Supabase | Persona | El SMTP integrado solo envía a miembros del equipo, 2/hora |
| D3 | **Un usuario = un presupuesto (hogar)**; varios números de WhatsApp pueden apuntar a él. Nada se migra | Persona | Es el modelo actual y funciona |
| D4 | **Kit mínimo**: 6 categorías, 12 rubros | Persona | Simplicidad; el usuario crece su lista |
| D5 | **Bienvenida de 3 pasos saltables + checklist** en el dashboard | Persona | Onboarding progresivo; primer valor rápido |
| D6 | El kit se siembra con una función SQL idempotente `seed_starter_kit(p_user_id)`, llamada desde `handle_new_user` dentro de un bloque `EXCEPTION` que nunca bloquea el registro, y de nuevo desde una acción de servidor `ensureStarterKit()` al entrar a `/bienvenida` o `/dashboard` | Orquestador (ADR-001) | El trigger garantiza el kit; la acción repara si el trigger falló. La idempotencia hace seguras ambas llamadas |
| D7 | La allowlist vive en `public.signup_allowlist(email citext PK, note, created_at)`, sin acceso para `anon`/`authenticated`, administrada por SQL/dashboard. Enforcement: hook **Before User Created**; si el plan no lo permite, trigger `BEFORE INSERT ON auth.users` que lanza excepción | Orquestador (ADR-002) | Una sola persona administra; una UI de admin no se justifica todavía |
| D8 | Confirmación y recuperación con `token_hash` + route handler `/auth/confirm` (`verifyOtp`). El `/auth/callback` actual se reemplaza por route handler o se elimina | Orquestador (ADR-003) | Patrón oficial; funciona si el correo se abre en otro dispositivo |
| D9 | Contraseña: mínimo 8 caracteres, sin reglas de composición; la UI dice lo mismo que Zod | Orquestador | NIST 800-63B; hoy UI y validación se contradicen |
| D10 | Los rubros creados desde la app toman clasificación y control por nombre explícito ("Basico"/"Necesario" para DEUDAS, "Estilo de Vida"/"Reducir" por defecto), no el primero alfabético | Orquestador | Hoy 135 rubros quedaron como "Eliminar" |

## Kit inicial (D4)

Formato: rubro — clasificación / control. Montos en 0.

| Categoría | Rubros |
|---|---|
| VIVIENDA | Arriendo o cuota — Basico / Necesario · Servicios públicos — Basico / Necesario · Internet — Calidad de Vida / Simplificar |
| MERCADO | Mercado — Basico / Necesario · Aseo del hogar — Basico / Necesario |
| TRANSPORTE | Transporte — Basico / Necesario · Vehículo — Basico / Reducir |
| SALUD | Salud — Basico / Necesario · Droguería — Basico / Necesario |
| DEUDAS | Tarjetas — Basico / Necesario · Créditos — Basico / Necesario |
| OTROS | Otros — Estilo de Vida / Reducir |

Además: cuenta `Efectivo` (tipo efectivo) y plantilla del mes actual (`upsert_monthly_budget`). Los meses siguientes se copian solos.

Sugerencia 50/30/20 del paso 2: "Basico" = necesidades (50 %), "Estilo de Vida"/"Caprichos" = deseos (30 %), "Calidad de Vida" = ahorro (20 %). Se reparte en partes iguales entre los rubros de cada grupo y el usuario ajusta. Como el kit no tiene rubro de ahorro, el 20 % se muestra como "sin asignar: ahorro" y no se crea rubro.

## Onboarding (D5)

**Entrada.** `/auth/confirm` redirige a `/bienvenida` en el primer ingreso (`profiles.onboarding_completed_at IS NULL`); después, a `/dashboard`.

**`/bienvenida`, tres pasos, cada uno con "Saltar":**
1. Ingreso mensual → `ingresos` (descripción, fuente, monto, fecha del mes actual).
2. Presupuesto del mes → montos de los 12 rubros del kit, con botón "Sugerir con 50/30/20" si hay ingreso.
3. Primer gasto → formulario corto (monto, descripción, categoría; cuenta Efectivo), o "Mándalo por WhatsApp" con código y enlace `wa.me`.

Al terminar o saltar el último paso: `profiles.onboarding_completed_at = now()` → `/dashboard`.

**Checklist en el dashboard.** Estado calculado desde los datos, sin columnas nuevas por ítem. Se oculta con `profiles.onboarding_dismissed_at`.
- Agrega tus cuentas (más de una cuenta)
- Registra tarjetas y deudas (hay `deudas`)
- Vincula WhatsApp (hay `whatsapp_links`)
- Carga tu cédula para facturas DIAN (`whatsapp_links.documento`)
- Revisa qué rubros te avisan (hay algún `alerts_enabled` explícito)

## Épicas e historias

Dependencias entre corchetes.

**E0 — Seguridad previa** (bloquea abrir el registro)
- S01 Blindar funciones solo-remotas: traer al repo los cuerpos de `get_previous_month_overspend` y las 5 del grupo B, agregar guard `auth.role()='service_role' OR auth.uid()=p_user_id`, revocar a `anon`; guard en `get_budget_by_month`; migración que audita tablas `public` sin RLS.
- S02 Vinculación de WhatsApp segura con varios usuarios: `UNIQUE(code)` en `whatsapp_link_codes` (reintento si choca), canje atómico de un solo código, límite de intentos fallidos por número, limpiar `whatsapp_conversations` al revincular.

**E1 — Registro y acceso**
- S03 Allowlist (D7): tabla, enforcement (hook o trigger), mensajes de error traducidos. [S01]
- S04 Confirmación de correo (D8): `NEXT_PUBLIC_SITE_URL`, `emailRedirectTo`, `/auth/confirm`, reemplazo de `/auth/callback`, redirect seguro (solo rutas relativas), `loginAction` respeta `redirectTo`, mapa de errores completo.
- S05 Recuperar contraseña: `/auth/forgot-password`, `/auth/reset-password`. [S04]
- S06 Páginas `/terms` y `/privacy` mínimas; regla de contraseña D9 en UI y Zod.

**E2 — Quitar restos de usuario único**
- S07 Borrar `inicializarDatosEjemplo` y su disparo; quitar el presupuesto mock del sidebar; reemplazar `ACCOUNT_TYPES` por las cuentas del usuario (Efectivo por defecto); inicializar `category_name` con la primera categoría.
- S08 Clasificación y control por defecto explícitos (D10) en `categories.ts` y `deudas-budget.ts`.

**E3 — Kit inicial**
- S09 `seed_starter_kit` + llamada segura en `handle_new_user` + `ensureStarterKit()` (D6). [S08]

**E4 — Onboarding**
- S10 Estados vacíos y navegación: salida del callejón de `/presupuesto`, Ajustes y Cerrar sesión en el menú móvil, "Agregar Gasto" del dashboard funcional, `/test` fuera del menú.
- S11 `/bienvenida` (3 pasos) + `profiles.onboarding_completed_at`. [S09, S04]
- S12 Checklist del dashboard + `onboarding_dismissed_at`. [S11]
- S13 Panel de WhatsApp: número del bot (`NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`) y enlace `wa.me/<n>?text=VINCULAR%20<código>`, `MSG_LINKED_OK` actualizado, botón desvincular. [S02]

**E5 — Integración y puesta en marcha**
- S14 Prueba de punta a punta con un segundo usuario de prueba en local: registro → confirmación → bienvenida → gasto web → vinculación → gasto por WhatsApp simulado. Verificar que no ve nada del usuario 1.

Paralelismo: E0, S04/S06, E2 y S10 no comparten archivos y pueden ir en worktrees separados. S03 después de S01 (ambos migraciones de seguridad). S09 → S11 → S12 en serie.

## Tareas humanas

- H1 Comprar o elegir dominio; crear cuenta Resend; verificar dominio (DNS).
- H2 Supabase → Authentication → SMTP: pegar credenciales de Resend; subir rate limit de correos.
- H3 Supabase → URL Configuration: Site URL de producción; Redirect URLs `http://localhost:3001/**` y previews de Vercel.
- H4 Supabase → Email Templates: pegar las plantillas "Confirm signup", "Reset password" con `token_hash` (el texto lo entrega S04/S05).
- H5 Supabase → Auth Hooks: activar Before User Created (si S03 usa hook).
- H6 Agregar los correos invitados a `signup_allowlist` (incluido el propio).
- H7 Vercel: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_BOT_NUMBER`.
- H8 Autorizar aplicar las migraciones a producción.

## Reglas para los agentes

Producción ya corre con datos reales:
- Ningún agente aplica migraciones a producción ni escribe en la base remota; las migraciones se escriben y se prueban con tests. Se aplican en la puesta en marcha con autorización (H8).
- No usar el puerto 3001 si la app está corriendo; no enviar mensajes reales de WhatsApp ni correos.
- Ningún dato personal en logs, tests ni fixtures: solo identificadores internos y montos de prueba.
- Commits de solo docs o solo migraciones con `--no-verify` (husky revierte cambios).
