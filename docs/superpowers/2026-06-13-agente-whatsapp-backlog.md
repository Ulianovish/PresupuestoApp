# Agente de WhatsApp — Backlog consolidado

**Fecha:** 2026-06-13
**Estado del proyecto:** Los 4 planes implementados y en `main` (prod). Este documento reúne TODO lo que quedó deliberadamente fuera de alcance, con su origen y por qué se difirió. No hay nada perdido: cada ítem vivía en el spec o en el plan correspondiente; aquí está consolidado.

## Hecho (referencia)

- **Plan 1 — Fundación:** motor CUFE reusable, web fire-and-forget con barra de progreso por polling.
- **Plan 2 — Identidad:** vínculo número↔presupuesto (`VINCULAR`), webhook + firma Twilio. Probado en prod.
- **Plan 3 — Texto:** CUFE por texto → borrador; "20k taxi" → gasto directo; transporte saliente; refactor service-role. (3b: `extractCufe` lee el bloque/QR pegado.)
- **Plan 4 — Visión:** foto de transferencia → gasto (cuenta deducida); foto de factura → borrador con ítems. MiniMax-VL validado.

---

## Backlog (no implementado — prioridad sugerida)

### Funcionalidad del agente
- [ ] **Estado de conversación (`whatsapp_conversations`)** — preguntas de seguimiento en media confianza (confirmar cuenta/categoría, o un monto dudoso) en vez de "edítalo en la app". _Origen: spec + Plan 4._ Siguiente paso natural si la visión/parseo a veces duda.
- [ ] **QR de factura por foto (jimp+jsqr)** — decodificar la imagen del QR. Hoy el QR funciona pegando su **texto** (`extractCufe`). _Origen: Plan 4._
- [ ] **Mapear la cuenta deducida por visión a las cuentas reales del usuario** — hoy se usa el texto deducido tal cual (ej. "Nequi"). _Origen: Plan 4._
- [ ] **Resumen diario/semanal familiar por WhatsApp** — recrea la sensación de "grupo" sin grupos. _Origen: spec._
- [ ] **Conciliación contra import de Excel** — evitar duplicar un gasto que venga por factura y por extracto. _Origen: spec CUFE._

### Multi-usuario / familia
- [ ] **Roles/permisos por persona** — concepto "household" real con RLS multi-miembro (hoy: varios números → un mismo `user_id`). _Origen: spec._
- [ ] **Soporte de grupos de WhatsApp** — atado a vía no oficial (Baileys); la oficial no expone grupos. _Origen: spec._

### Infra / operación
- [ ] **Sender propio de WhatsApp (aprobación de Meta)** para producción real, en vez del sandbox de Twilio (requiere `join …` y es flaky para internacional a Colombia). _Operacional._
- [ ] **Migración de transporte** a Meta Cloud API o Baileys — el `WhatsAppTransport`/`sendWhatsAppMessage` ya aísla esto. _Origen: spec._
- [ ] **Cola durable (Vercel Queues)** si el volumen o los rate-limits de MiniMax molestan. _Origen: spec._
- [ ] **API key oficial de MiniMax** — hoy se usa una key del Coding Plan (rate-limited). _Origen: addendum CUFE._
- [ ] **Guardar imagen/PDF original en Supabase Storage** (auditoría/recibo). _Origen: spec + Plan 4._

### UI / pulido
- [ ] **UI para configurar `default_account_name` por número** en `/settings` (hoy: columna existe, default 'Efectivo'). _Origen: Plan 3/4._
- [ ] **Supabase Realtime en la bandeja** de facturas (hoy: polling 1.5s). _Origen: spec/Plan 1._
- [ ] **Desvincular número** desde `/settings` (hoy solo se listan; la RLS DELETE ya existe). _Detectado._

### Verificación pendiente del usuario
- [ ] **Pruebas E2E de visión** (transferencia + factura foto) — en curso por el usuario (2026-06-13).
- [ ] Afinar el prompt de visión si la cuenta deducida o algún monto sale impreciso.

---

## Notas de decisiones ya tomadas (no rehacer sin querer)
- **Web CUFE = "best of both":** muestra progreso si te quedas, sigue en background si cierras (no se quitó la barra). _Decisión del usuario, Plan 1._
- **Visión sin estado de conversación (v1):** receipt→revisar en app, transfer→editar en app, baja confianza→reenviar. _Plan 4._
- **Host del webhook:** `presupuesto-app-beta.vercel.app` (los otros `*.vercel.app` dan 401 por Deployment Protection; `-beta` está exento). No requiere dominio propio.
- **Tope de monto 100M COP** en texto y visión (anti-typo/OCR). _Plan 3/4._
