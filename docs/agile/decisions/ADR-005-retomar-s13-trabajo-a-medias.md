# ADR-005 — Retomar S13 desde el trabajo a medias sin commitear

Estado: aceptada (2026-09-30, deliberación por consenso).

> Número: ADR-004 ya existe en los flujos AUTH y principal (`ADR-004-middleware-en-src.md`); este es el siguiente libre para no chocar al integrar.

## Contexto
El worktree del flujo APP (`stream/app`, HEAD `1cbedb1`) tenía la Task 5 de S13 hecha pero sin commit: `src/app/settings/page.tsx` modificado y `src/components/molecules/UnlinkPhoneButton/` (botón + test de texto) sin seguimiento. Los archivos llevaban quietos más de 15 minutos y no había procesos de vitest, node ni claude ligados al worktree.

## Opciones
1. Retomar el trabajo a medias: revisarlo, completarlo y commitear la Task 5; seguir con el plan.
2. Descartarlo y rehacer la Task 5 desde cero con TDD.
3. Esperar/relanzar por si otro agente seguía activo.

## Votos
- Perfil pragmático: opción 1. El cambio es pequeño (page.tsx +28/−20, dos archivos nuevos), usa `unlinkWhatsAppLinkAction` ya commiteada y `enmascararTelefono`. Rehacerlo cuesta lo mismo sin aportar; la opción 3 solo retrasa (no hay agente activo).
- Perfil de riesgos/seguridad: opción 1, con condiciones: el número completo no cruza al cliente (solo `linkId` y `maskedPhone`), `key = l.id`, la acción filtra por el usuario de la sesión, fixtures solo con números ficticios, ningún log imprime `phone_e164`, suite completa en verde antes del commit.

## Decisión
Opción 1, con las condiciones del perfil de riesgos:
- (a) `unlinkWhatsAppLinkAction` toma el usuario con `auth.getUser()` en el servidor y borra con `id = linkId AND user_id = user.id` (además de la política DELETE de RLS). El test "el link no es del usuario (0 filas borradas)" cubre el link ajeno: no hay éxito falso y el mensaje es el mismo que para un id inexistente (`No encontramos ese número entre los tuyos.`), así que no revela si el id existe.
- (b) El test nuevo no usa teléfonos; los tests de la acción solo usan `+573000000000`.
- (c) `enmascararTelefono` muestra prefijo + 3 dígitos + últimos 4 (`+57 300 ••• 4567`), la misma exposición que el `maskPhone` viejo (`+57300 ***4567`) y menos en formatos no colombianos; cambia solo el glifo. Ni el botón ni la página tienen `console.*`; el único log de la acción imprime solo `error.code`.
- (d) Antes de commitear se verificó que el test de texto falla sin los cambios (3 fallos) y pasa con ellos; se agregó un test que exige que al botón solo lleguen `linkId` y `maskedPhone`.

## Consecuencias
No cambia ningún contrato (§5.2 ya fija `unlinkWhatsAppLinkAction(linkId)` y `key = l.id`). El webhook del bot sigue buscando por `phone_e164`; no se toca.
