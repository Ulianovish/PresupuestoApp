# Diseño: Agente de WhatsApp para registro de gastos (v1)

**Fecha:** 2026-06-03
**Estado:** Aprobado para planificación
**Proyecto:** PresupuestoApp

## Objetivo

Permitir que el usuario (y su familia) registre gastos enviando mensajes de WhatsApp
a un bot. El agente acepta:

- **CUFE** (texto) y **QR** de factura electrónica DIAN.
- **Fotos de facturas/recibos sin CUFE** (tienda normal: Éxito, D1, etc.).
- **Screenshots de transferencias** (Nequi, Bancolombia, Daviplata…).
- **Texto libre** ("gasté 20k en taxi").

El agente clasifica la entrada, extrae los datos, y según la confianza guarda el gasto
directo o pregunta en el chat antes de guardar. Reusa el motor de gastos y facturas
existente; WhatsApp es un **nuevo canal de entrada**, no un sistema nuevo.

## Contexto: lo que ya existe y se reusa

- **Gastos**: RPC `upsert_monthly_expense(p_user_id, p_description, p_amount,
  p_transaction_date, p_category_name, p_account_name, p_place)`.
- **Facturas CUFE**: `/api/invoices/process` (SSE) hace proxy a
  `factura-dian.vercel.app`, categoriza ítems con MiniMax y guarda un borrador en
  `electronic_invoices` (`status='pending_review'`); el usuario aprueba en `/gastos`
  (panel "Facturas por aprobar") → `approveInvoice()` crea N gastos vía el RPC.
- **Categorización IA**: `categorizeInvoiceItems(items, EXPENSE_CATEGORIES)` con MiniMax
  (endpoint Anthropic-compatible, `fetch` directo, parsing JSON robusto). Categorías:
  `VIVIENDA, DEUDAS, TRANSPORTE, MERCADO, OTROS`. Fallback `OTROS`.
- **Auth**: por usuario (Supabase, RLS con `auth.uid()`). App en Vercel (serverless,
  Fluid Compute).

## Decisiones tomadas

1. **Transporte:** Twilio WhatsApp, conversación **1:1** (no grupos). La vía oficial no
   soporta grupos; los grupos atarían a una vía no oficial (Baileys) baneable y frágil.
2. **Núcleo agnóstico al transporte:** el cerebro del agente no conoce Twilio. Cada
   transporte es un adaptador delgado tras la interfaz `WhatsAppTransport`. Migrar a Meta
   Cloud API o Baileys = escribir otro adaptador.
3. **Modelo familiar:** cada persona escribe al bot en 1:1; varios números mapean al
   **mismo `user_id`** (el titular del presupuesto). Sin refactor multi-tenant. Roles por
   persona = backlog.
4. **Confirmación híbrida por confianza:** alta confianza → guarda y avisa; baja/ambigua
   → pregunta en el chat antes de guardar.
5. **Visión:** MiniMax (reusa key/base URL Anthropic-compatible), tras la interfaz
   `VisionExtractor`. **Riesgo a validar:** que el endpoint Anthropic-compatible de
   MiniMax acepte bloques de imagen; si no, se cambia de proveedor sin tocar el núcleo.
6. **Orquestación:** ACK rápido + procesamiento en background (`after()`/`waitUntil` con
   Fluid Compute) + respuesta saliente vía REST API de Twilio. Cola durable = backlog.
7. **Fire-and-forget también en web:** el flujo web del CUFE se refactoriza para no
   depender de la pestaña (ver más abajo).

## Principio de clasificación

La distinción real **no** es "tiene CUFE o no", sino **"¿es una factura con ítems o un
pago suelto?"**:

| Entrada | Qué hace el agente | Destino |
|---|---|---|
| **CUFE / QR** | Motor factura-dian → ítems estructurados → categoriza c/u | **Borrador** → aprobar en web |
| **Foto de factura SIN CUFE** | Visión extrae **ítems** (desc, cantidad, total) → categoriza c/u | **Borrador** → aprobar en web |
| **Screenshot de transferencia** | Visión extrae monto/fecha/origen (pago único) | **Gasto directo** |
| **Texto libre** ("20k taxi") | Parseo simple monto+desc | **Gasto directo** |

Todo lo que es factura/recibo (con o sin CUFE) → ítems → borrador → bandeja de
aprobación existente. Solo transferencias y notas sueltas son gasto directo.

## Arquitectura

```
WhatsApp (tú/familia)
      │  texto / imagen
      ▼
┌─────────────────────────────────────────┐
│ ADAPTADOR DE TRANSPORTE (Twilio)         │  ← delgado, reemplazable
│ POST /api/whatsapp/webhook               │
│  · valida firma Twilio (X-Twilio-Signature)
│  · resuelve número → user_id             │
│  · ACK rápido ("recibí, procesando…")    │
│  · after(() => handleMessage(...))       │  ← background, Fluid Compute
└─────────────────────────────────────────┘
      │  msg normalizado { userId, phone, text, media[] }
      ▼
┌─────────────────────────────────────────┐
│ NÚCLEO DEL AGENTE (agnóstico a Twilio)   │
│  1. ¿hay pending? → interpretar respuesta│
│  2. clasificar entrada                   │
│     ├─ CUFE / QR     → processCufeInvoice (reusado)
│     ├─ foto factura  → extractReceiptItems → categorizar → borrador
│     ├─ transferencia → extractTransfer → directo o preguntar
│     └─ texto libre   → parseQuickExpense
│  3. híbrido por confianza (alta→directo / baja→preguntar)
│  4. responder vía transport.sendMessage()│
└─────────────────────────────────────────┘
      │
      ▼
  Motor existente: processCufeInvoice() · upsert_monthly_expense() · electronic_invoices · approveInvoice()
```

### Piezas nuevas vs reusadas

| Pieza | Estado |
|---|---|
| Adaptador Twilio (webhook + envío saliente) | nuevo, delgado |
| Núcleo del agente (`handleMessage`, clasificar/extraer/decidir) | nuevo |
| Capa de visión (MiniMax, tras `VisionExtractor`) | nuevo |
| Decodificador de QR → CUFE | nuevo (lib pequeña) |
| `processCufeInvoice()` | **refactor** (extraído del route SSE) |
| `categorizeInvoiceItems()` | **reusado** tal cual |
| `upsert_monthly_expense` / `electronic_invoices` / `approveInvoice` | **reusado** |
| Mapeo número→usuario + estado de conversación | nuevo (3 tablas) |

### Interfaces clave (swappability)

```ts
interface WhatsAppTransport {        // Twilio hoy; Meta/Baileys mañana
  sendMessage(to: string, text: string): Promise<void>
  downloadMedia(url: string): Promise<{ buffer: Buffer; mime: string }>
}
interface VisionExtractor {          // MiniMax hoy; otro mañana
  extractReceiptItems(img): Promise<{ supplier; date; items[] }>
  extractTransfer(img): Promise<{ amount; date; source; confidence }>
}
```

## Identidad y vinculación

WhatsApp manda un número; los gastos viven bajo un `user_id` con RLS. Mapeo seguro vía
código de un solo uso:

```
1. App web (Ajustes) → "Conectar WhatsApp" → genera código de 6 dígitos (caduca 10 min)
2. Usuario manda al bot:  "VINCULAR 482913"
3. Webhook valida → guarda { phone, user_id } → "✅ Vinculado al presupuesto de Migue"
4. Ese número registra gastos en ese user_id
```

- **Familia:** cada integrante repite 1-3 con un código del **mismo titular** → varios
  números → mismo `user_id`.
- **Número no vinculado:** el bot responde instrucciones de vínculo y **no procesa nada**.

## Clasificación y flujo de confianza

```
¿Trae imagen?
 ├─ Sí → ¿el QR decodifica a CUFE/URL DIAN?
 │        ├─ Sí  → RUTA CUFE (motor factura-dian)              [ALTA → borrador]
 │        └─ No  → visión MiniMax:
 │                  factura/recibo → extrae ítems              [MEDIA → borrador]
 │                  transferencia  → extrae monto/fecha/origen [ALTA/MEDIA]
 └─ No (texto):
          CUFE válido (regex/longitud) → RUTA CUFE             [ALTA → borrador]
          comando (VINCULAR, AYUDA, SALDO) → maneja comando
          texto tipo gasto ("20k taxi") → parseQuickExpense    [MEDIA/BAJA]
          no entiende → mensaje de ayuda
```

| Señal | Confianza | Acción |
|---|---|---|
| CUFE válido (texto o QR) | **Alta** | Procesa fire-and-forget → borrador → "lista para revisar" |
| Transferencia con monto+fecha claros + cuenta detectada | **Alta** | Crea gasto directo + avisa |
| Factura por visión (ítems extraídos) | **Media** | Siempre va a **borrador** (revisión humana atrapa OCR) |
| Falta categoría o cuenta clara | **Media** | Pregunta SOLO lo que falta |
| Imagen borrosa / monto ilegible / no entiende | **Baja** | Pide reenviar o escribir manual |

### Cuenta y categoría

- **Categoría:** la pone la IA (`categorizeInvoiceItems`). Duda → `OTROS`, editable.
- **Cuenta:**
  - Cada número vinculado tiene **cuenta por defecto** configurable (ej. "Efectivo").
  - Transferencia → la visión intenta detectar la cuenta (Nequi/Bancolombia/Daviplata).
  - Si no se detecta ni hay default → el bot **pregunta una vez** y guarda la respuesta en
    `whatsapp_conversations`.

### Ejemplo de flujo media confianza (con estado)

```
Usuario: [foto recibo $32.000 panadería]
Bot:     "Leí: $32.000 · OTROS · Panadería · hoy. ¿A qué cuenta lo cargo?
          Efectivo / Nequi / Tarjeta"   (guarda pending en whatsapp_conversations)
Usuario: "Nequi"
Bot:     "✅ Registré $32.000 en OTROS (Nequi). Responde EDITAR si algo está mal."
```

El `pending` **caduca** (ej. 30 min); si el usuario responde tarde o manda otra cosa, se
descarta y empieza de nuevo.

## Orquestación técnica

```
POST /api/whatsapp/webhook   (runtime nodejs, maxDuration 300)
 1. Validar firma X-Twilio-Signature → si falla, 403
 2. Parsear (From, Body, MediaUrl0..N, MediaContentType)
 3. Resolver número → whatsapp_links → user_id
       · sin vínculo y no es "VINCULAR" → responde instrucciones, fin
 4. ACK inmediato (200)
 5. after(() => handleMessage({ userId, phone, text, media }))   ← background
```

- El paso 5 corre con `after()`; Fluid Compute mantiene la función viva hasta terminar
  (dentro de `maxDuration = 300`), independiente de cualquier cliente.
- Al terminar, la respuesta saliente se manda vía **REST API de Twilio** (`POST messages`
  con `TWILIO_ACCOUNT_SID`/`AUTH_TOKEN`), no TwiML (el ACK ya se fue).
- **Descarga de media:** las URLs de Twilio requieren auth Basic (SID/token); el adaptador
  las baja y pasa el buffer a `VisionExtractor`. (Meta sería distinto → vive en el adaptador.)

### Núcleo `handleMessage(msg)`

```
1. ¿hay pending en whatsapp_conversations para este phone?
      → sí: interpretar como respuesta (cuenta, sí/no) y completar
2. clasificar entrada
3. ejecutar ruta:
      CUFE/QR        → processCufeInvoice(userId, cufe)        [reusado]
      factura visión → extractReceiptItems → categorizar → guardar borrador
      transferencia  → extractTransfer → confianza → directo o preguntar
      texto          → parseQuickExpense
4. responder vía transport.sendMessage(phone, mensaje)
```

## Fire-and-forget en el flujo web del CUFE

Hoy `/api/invoices/process` corre el trabajo **dentro del stream SSE** que el navegador
sostiene; si se cierra la pestaña, la fila queda atascada en `processing`. Se refactoriza:

```
POST /api/invoices/process   (nuevo, no-SSE)
  1. crea borrador en 'processing'                    ← instantáneo
  2. after(() => processCufeInvoice(userId, cufe))    ← sigue en el server
  3. responde { invoiceId, status: 'processing' }     ← navegador libre
```

- La bandeja muestra la factura como "procesando" y cambia sola a "lista para revisar" vía
  **polling** (re-consulta cada X s). Cero infra extra.
- **Tradeoff:** se pierde la barra de progreso paso-a-paso en vivo (ya no hay SSE al
  cliente); a cambio el procesamiento no depende de la pestaña. La bandeja muestra
  "procesando…".
- `processCufeInvoice()` es el **mismo motor** que usa WhatsApp: un motor, tres
  disparadores (web, WhatsApp, reintento desde el panel).

## Modelo de datos

### Cambios a `electronic_invoices`

- `cufe_code` → **nullable** (las facturas por visión no tienen CUFE).
- Nueva columna **`source`** text: `'dian_cufe' | 'vision_receipt'` (extensible).
- El **dedup por CUFE** (índice UNIQUE) solo aplica cuando `source='dian_cufe'`; Postgres
  permite múltiples `NULL` en un UNIQUE, así que las facturas de visión no chocan.
- Reusa la bandeja "Facturas por aprobar" y `approveInvoice()` sin cambios.

### Tablas nuevas

```
whatsapp_links
  id            uuid PK default gen_random_uuid()
  phone_e164    text UNIQUE NOT NULL        -- +573001234567
  user_id       uuid NOT NULL FK auth.users
  display_name  text                        -- "Migue", "esposa" (opcional)
  default_account_name text                 -- cuenta por defecto del número (opcional)
  linked_at     timestamptz default now()
  -- RLS: el dueño (user_id) ve/borra sus números

whatsapp_link_codes
  code          text PK                     -- 6 dígitos
  user_id       uuid NOT NULL FK auth.users
  expires_at    timestamptz NOT NULL
  used_at       timestamptz
  -- RLS: generado solo desde sesión web autenticada (user_id = auth.uid())

whatsapp_conversations
  phone_e164    text PK
  pending       jsonb                       -- { type, draft, expires_at }
  updated_at    timestamptz default now()
```

## Seguridad

El webhook es **público** y corre **sin sesión de usuario**:

1. **Validar firma de Twilio** (`X-Twilio-Signature` + auth token) en cada request; sin
   firma válida → 403. Evita POSTs de gastos falsos.
2. **Service-role de Supabase:** el webhook no tiene cookie; usa la **service key** (solo
   server). Salta RLS, por eso **cada operación lleva el `user_id` resuelto del número** y
   filtra explícitamente. Nunca se confía en datos del mensaje para decidir el usuario.
3. **Resolución estricta de identidad:** número no vinculado = no procesa nada. Un número
   solo escribe al `user_id` con el que está vinculado.
4. **Códigos de vínculo:** 6 dígitos, caducan 10 min, un solo uso, generados solo desde
   sesión web autenticada.
5. **Secretos nuevos (env Vercel):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_WHATSAPP_FROM`, `SUPABASE_SERVICE_ROLE_KEY`. Reusa `MINIMAX_API_KEY`.
6. **Rate-limit básico** por número (N msgs/min) para no quemar la key de MiniMax ni abrir
   abuso.
7. **Privacidad de media:** imágenes procesadas en memoria, **no se persisten** en v1.

## Manejo de errores

- Firma Twilio inválida → 403, descarta.
- Número no vinculado → instrucciones de vínculo, no procesa.
- Error de visión / JSON inválido → fallback (`OTROS` / pedir reenvío), mismo patrón
  robusto del `categorizer` actual.
- Error de factura-dian → reusa el manejo existente (`status='error'`, reintento).
- `pending` caducado → se descarta, el bot trata el nuevo mensaje desde cero.
- Fallo al enviar saliente por Twilio → log; no rompe el procesamiento ya persistido.

## Estrategia de pruebas

**Unit (núcleo agnóstico):**
- Clasificador: CUFE / QR / imagen / texto / comando.
- `parseQuickExpense("20k taxi")` → 20000 + "taxi".
- Parseo de respuesta de visión (factura/ítems y transferencia) con fallback ante JSON
  inválido.
- Máquina de confianza: alta→directo, media→pregunta, caducidad de `pending`.
- Resolución de identidad: vinculado / no vinculado / código válido-caducado-usado.

**Integración (Twilio y MiniMax mockeados):**
- Webhook: firma inválida → 403; no vinculado → instrucciones; CUFE → ACK +
  `processCufeInvoice` llamado en background.
- Factura por visión → borrador en `electronic_invoices` con `source='vision_receipt'` e
  ítems categorizados.
- Transferencia alta confianza → `upsert_monthly_expense` una vez.
- Pregunta-respuesta: foto media confianza → pregunta cuenta → "Nequi" → gasto creado.

**Manual / E2E (sandbox de Twilio):**
- Vincular número real; mandar CUFE/QR/foto/transferencia; verificar en la app.
- **Validar que MiniMax acepta imágenes por el endpoint Anthropic-compatible** (riesgo
  marcado); si no, conectar otro proveedor tras `VisionExtractor`.

## Alcance (v1)

- Adaptador Twilio (webhook + envío saliente) con validación de firma.
- Núcleo agnóstico: clasificar, extraer, confianza híbrida, estado de conversación.
- Capa de visión MiniMax (`VisionExtractor`) para facturas sin CUFE y transferencias.
- Decodificador de QR → CUFE.
- Refactor `processCufeInvoice()` reusado por web y WhatsApp.
- Flujo web del CUFE a **fire-and-forget con polling**.
- Vinculación número→usuario con código; soporte familia (muchos números → un presupuesto).
- `electronic_invoices`: `cufe_code` nullable + `source`; reuso de bandeja y `approveInvoice`.
- 3 tablas nuevas (`whatsapp_links`, `whatsapp_link_codes`, `whatsapp_conversations`).

## Fuera de alcance (backlog)

- Cola durable (Vercel Queues) si el volumen / rate-limits de MiniMax molestan.
- Roles/permisos por persona (concepto "household" real con RLS multi-miembro).
- Migración a Meta Cloud API o Baileys (queda el `WhatsAppTransport` listo).
- Soporte de grupos (atado a vía no oficial).
- Guardar imagen/PDF en Supabase Storage.
- Resumen diario/semanal familiar por WhatsApp.
- Supabase Realtime en la bandeja (v1: polling).
- Barra de progreso en vivo del CUFE web (se cambió por fire-and-forget).
- Conciliación contra import de Excel (evitar duplicar gasto de factura y de extracto).

## Limitaciones conocidas (v1)

- Solo 1:1 (sin grupos) por la vía oficial.
- La barra de progreso detallada del CUFE web se reemplaza por estado "procesando" +
  polling.
- La calidad de extracción de facturas por visión depende de la foto; por eso siempre van
  a revisión humana antes de crear gastos.
- Depende de que MiniMax soporte imágenes por su endpoint Anthropic-compatible (a validar).
