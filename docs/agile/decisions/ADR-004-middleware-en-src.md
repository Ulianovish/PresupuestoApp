# ADR-004 — El middleware vive en `src/middleware.ts`

Estado: aceptada. Deliberación inicial el 2026-09-30 (surgió implementando S06); resuelta el mismo día con la verificación de H10 y la historia S15.

## Contexto
El proyecto usa `src/app/` y `next` ^15.5.12. El único middleware era `middleware.ts` en la raíz. Con carpeta `src/`, Next.js solo busca el middleware en `src/middleware.ts`: el de la raíz se ignora sin ningún error. `/gastos` y el resto de páginas privadas no tienen guardia propia.

El archivo existía desde `8c8197d` y `e749c71`, y S04 lo tocó en `e044bdf`. Como nunca corrió, producción siempre funcionó sin sus reglas (`getRouteAccess`, `redirectsSignedInUser`) ni el refresco de sesión en el borde, y las garantías de S04 (`/auth/confirm`, `/bienvenida` protegida) no existían en producción.

## Verificación (H10, 2026-09-30)
- El build de producción no lista la entrada "ƒ Middleware".
- `GET /gastos` sin sesión responde 200 en lugar de redirigir al login.

Conclusión: el middleware de la raíz no se ejecutaba.

## Deliberación original
1. Verificar primero en un preview (tarea humana H10).
2. Mover ya el archivo a `src/middleware.ts`.
3. Dejarlo como está (descartada por ambos perfiles).

El árbitro eligió la 1 y, si el middleware no corría, abrir la historia que lo mueve (la 2). La verificación confirmó que no corría: esa historia es S15.

## Decisión
- `git mv middleware.ts src/middleware.ts` sin cambiar sus reglas de acceso (S15).
- `src/middleware-location.test.ts` fija que el archivo está en `src/`, que no hay otro en la raíz y que el matcher no toca `/api` (webhook de WhatsApp y crons), `/_next/*`, `favicon.ico` ni archivos estáticos.
- Las redirecciones del middleware copian las cookies que Supabase escribió al refrescar la sesión (patrón oficial de `@supabase/ssr`). Sin esto, una redirección tras rotar el refresh token dejaría al navegador con el token viejo y la sesión se perdería al activarse el middleware por primera vez.

## Riesgo
Activarlo cambia el comportamiento de producción por primera vez: redirecciones al login, `/auth/login` y `/auth/register` mandan al dashboard con sesión, y el refresco de cookies pasa a hacerse en cada petición. Un error aquí podría dejar al usuario real fuera de la app o en un bucle de redirección.

Reglas relevantes (ver `src/lib/auth/route-access.ts`):
- Públicas (exactas): `/`, `/test`, `/terms`, `/privacy`.
- Auth (siempre accesibles; login y registro redirigen con sesión): `/auth/*`.
- Protegidas: `/dashboard`, `/bienvenida`, `/presupuesto`, `/gastos`, `/ingresos` (incluye `/ingresos-deudas`), `/deudas`, `/profile`, `/settings`.
- Sesión vencida: `getUser()` devuelve usuario nulo → las protegidas van a `/auth/login?redirectTo=…`, que es ruta de auth y pasa sin sesión: no hay bucle.

## Prueba en preview (antes de fusionar a `main`, integración S14, con OK de la persona)
En un preview de Vercel:
1. El build lista "ƒ Middleware".
2. Sin sesión (ventana privada): `/gastos` y `/bienvenida` redirigen a `/auth/login?redirectTo=…`; `/`, `/terms` y `/privacy` cargan.
3. Iniciar sesión: vuelve a la ruta pedida; `/auth/login` con sesión manda a `/dashboard`.
4. Cerrar sesión y volver a entrar.
5. `/auth/confirm` desde un correo real de prueba funciona.
6. `/api/whatsapp/webhook` y los crons no se ven afectados (el matcher excluye `/api`).

## Consecuencias
- Ya no aplica la regla de v2.1 de no declarar protección por middleware en los criterios de aceptación, una vez que S15 esté en `main` y pase la prueba en preview.
- Nadie debe volver a poner un `middleware.ts` en la raíz: el test de ubicación lo impide.
