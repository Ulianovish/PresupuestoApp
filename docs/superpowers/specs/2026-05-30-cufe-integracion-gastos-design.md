# Diseño: Integración CUFE → Gastos (v1)

**Fecha:** 2026-05-30
**Estado:** Aprobado para planificación
**Proyecto:** PresupuestoApp

## Objetivo

Permitir que el usuario, dentro del flujo de "agregar gasto", pegue un código CUFE
de una factura electrónica DIAN; el sistema obtiene los datos estructurados de la
factura, los guarda como un **borrador** (factura por aprobar), y tras revisión del
usuario crea **un gasto por cada ítem** de la factura.

## Contexto: estado actual del código (a corregir)

La implementación CUFE existente en el repo es andamiaje no funcional:

| Pieza | Problema |
|---|---|
| `src/lib/dian/scraper.ts` | `extractInvoiceDataFromPdf()` devuelve datos mock. Usa `puppeteer` vanilla que no corre en Vercel serverless. |
| `src/app/api/invoices/cufe-to-data-stream/route.ts` | Llama al scraper local roto, no al endpoint de Vercel que sí funciona. |
| `src/lib/services/invoices.ts` | Inserta en tablas `electronic_invoices` y `transactions` con un esquema que no existe (la tabla `transactions` real tiene `budget_item_id NOT NULL` y le faltan columnas). Dead code que fallaría en runtime. |
| `src/app/gastos/escanear-factura/page.tsx` | Página standalone, no integrada en "agregar gasto". El handoff `createFromInvoice` nunca se lee en `/gastos`. |
| Flujo de gasto real | Usa el RPC `upsert_monthly_expense(description, amount, transaction_date, category_name, account_name, place)`, shape distinto al que asume `invoices.ts`. |

La pieza que **sí funciona** es el endpoint desplegado `factura-dian.vercel.app`.

## Decisiones tomadas

1. **Motor CUFE:** Proxy a `factura-dian.vercel.app/api/cufe-to-data-stream`.
   PresupuestoApp NO scrapea ni procesa PDFs; solo orquesta y persiste. Se borra el
   scraper local.
2. **Modelo de espera:** Draft persistido + revisar después. El procesamiento (~1 min)
   deja un borrador (`status='pending_review'`); el usuario lo aprueba cuando quiere.
3. **Granularidad de gastos:** Un gasto por ítem de la factura.
4. **Asignación en revisión:** Una **cuenta única** para toda la factura;
   **categoría por ítem asignada con IA** (editable por el usuario).
5. **Ubicación UI:** Dentro de `/gastos` (modo en `ExpenseModal` + lista "Facturas por
   aprobar" como panel/badge en la misma página, no ruta aparte).
6. **Método de extracción (`python` vs `openai`):** Decisión **diferida**. Ambos
   devuelven el mismo shape de JSON, así que es un parámetro configurable vía env
   `FACTURA_DIAN_METHOD` (default `python`). Cambiarlo no requiere cambios de código.

## Qué devuelve el endpoint factura-dian (verificado en código fuente)

El endpoint descarga el PDF de la DIAN y extrae datos **estructurados** internamente
(método `python` con pdfplumber+camelot, o `openai` con Vision). PresupuestoApp **nunca
toca un PDF**. El evento SSE `complete` trae:

```jsonc
{
  "step": "complete",
  "progress": 100,
  "result": {
    "success": true,
    "invoice_details": {
      "cufe", "storeName", "date", "currency", "nit", "subtotal", "total_amount"
    },
    "items": [
      { "description", "code", "item_number", "unit_measure", "quantity",
        "unit_price", "iva_amount", "iva_percent", "inc_amount", "inc_percent",
        "total_price", "idx" }
    ],
    "processing_info": { "total_time", "items_found", "extraction_method", ... },
    "pdf_download": { "filename", "content_type", "base64", "size_bytes", "size_kb" }
      // solo si download-pdf=true
  }
}
```

**Nota de mapeo:** el total de línea del ítem viene en `total_price` (no `total`).

## Arquitectura (3 fases)

```
[/gastos · ExpenseModal modo "Factura (CUFE)"]
        │  pega CUFE → Procesar
        ▼
[Fase A · Procesar]  POST /api/invoices/process
   1. auth + dedup (¿CUFE ya existe para el usuario? → 409 "ya procesada")
   2. inserta electronic_invoices (status='processing')
   3. proxy SSE → factura-dian.vercel.app (método configurable, ~1 min)
   4. IA categoriza cada item → una de EXPENSE_CATEGORIES
   5. update row → status='pending_review' (BORRADOR persistido)
        │
        ▼
[Fase B · Revisar]  panel "Facturas por aprobar" en /gastos (badge con conteo)
   - header factura (proveedor, fecha, total)
   - 1 selector de CUENTA (ACCOUNT_TYPES) para toda la factura
   - items con dropdown de categoría (prellenado por IA, editable)
        │  Aprobar
        ▼
[Fase C · Aprobar]  POST /api/invoices/[id]/approve
   - por cada item → upsert_monthly_expense(...)  → N gastos reales
   - status='approved'
```

## Modelo de datos: nueva tabla `electronic_invoices`

Migración nueva en `supabase/migrations/`. Los ítems van como `jsonb` en la fila
(no tabla aparte en v1).

| campo | tipo | nota |
|---|---|---|
| `id` | uuid PK default gen_random_uuid() | |
| `user_id` | uuid NOT NULL | FK a auth.users; RLS por dueño |
| `cufe_code` | text NOT NULL | **UNIQUE(user_id, cufe_code)** → guarda contra reprocesar |
| `supplier_name` | text | |
| `supplier_nit` | text | |
| `invoice_date` | date | |
| `currency` | text default 'COP' | |
| `subtotal` | numeric | |
| `total_amount` | numeric | |
| `items` | jsonb | `[{description, quantity, unit_price, total_price, suggested_category, category}]` |
| `status` | text NOT NULL | `processing` / `pending_review` / `approved` / `error` |
| `selected_account_name` | text | elegida al aprobar |
| `error_message` | text | si `status='error'` |
| `processing_time_ms` | int | |
| `created_at` | timestamptz default now() | |
| `processed_at` | timestamptz | |
| `approved_at` | timestamptz | |

- **RLS:** políticas SELECT/INSERT/UPDATE/DELETE restringidas a `auth.uid() = user_id`.
- **Índice único** `(user_id, cufe_code)` para dedup.
- Al aprobar, los gastos se crean con el **RPC existente `upsert_monthly_expense`**
  (no se modifica el modelo de gastos ni la tabla `transactions`).

### Mapeo item → gasto (en aprobación)

```
upsert_monthly_expense(
  p_description      = item.description,
  p_amount           = item.total_price,
  p_transaction_date = invoice_date,
  p_category_name    = item.category,           // categoría elegida/IA
  p_account_name     = selected_account_name,   // cuenta única de la factura
  p_place            = supplier_name
)
```

## Categorización con IA

- Vive en PresupuestoApp (ya tiene la dependencia `openai`).
- Función `categorizeInvoiceItems(items, EXPENSE_CATEGORIES)`: dado el array de
  descripciones, devuelve para cada ítem una categoría de
  `['VIVIENDA','DEUDAS','TRANSPORTE','MERCADO','OTROS']`.
- Se ejecuta en la Fase A (tras recibir los items, antes de persistir).
- **Fallback:** si la llamada a OpenAI falla, todos los ítems quedan con
  `suggested_category = 'OTROS'` y el draft igual pasa a `pending_review`.
- El usuario puede sobreescribir la categoría de cada ítem en la pantalla de revisión.

## Componentes / capas

### API routes (Next.js App Router)
- **`POST /api/invoices/process`** (reemplaza `cufe-to-data-stream/route.ts`):
  auth → dedup → insert `processing` → proxy SSE a factura-dian → categorizar →
  update `pending_review`. `export const maxDuration = 300`. Devuelve progreso vía
  SSE passthrough al cliente y persiste el resultado al completar.
- **`POST /api/invoices/[id]/approve`**: valida dueño y `status='pending_review'`,
  recibe `selected_account_name` y posibles overrides de categoría por ítem, crea N
  gastos vía `upsert_monthly_expense`, marca `approved`.

### Servicio
- **Reescribir `src/lib/services/invoices.ts`** para apuntar a `electronic_invoices`
  real: `createProcessingInvoice`, `getInvoiceByCufe` (dedup), `listPendingInvoices`,
  `markInvoiceError`, `approveInvoice`. Eliminar el dead code de `transactions` /
  `budget_item_id` / `linkInvoiceToTransaction`.
- **Nuevo `src/lib/services/invoice-categorizer.ts`**: `categorizeInvoiceItems(...)`.

### UI (dentro de `/gastos`)
- **`ExpenseModal`**: añadir toggle "Manual | Factura (CUFE)". Modo CUFE = input de
  CUFE + botón Procesar + barra de progreso SSE. Al completar, cierra y refresca el
  panel de pendientes.
- **Panel "Facturas por aprobar"**: badge con conteo en `/gastos`; al abrir muestra la
  lista de borradores (`pending_review`) y los `error` con opción de reintento.
- **Pantalla/seción de revisión**: header de factura + selector de cuenta única +
  tabla de ítems con dropdown de categoría editable + botón Aprobar.

### Limpieza
- Borrar `src/lib/dian/scraper.ts`.
- Eliminar la página standalone `src/app/gastos/escanear-factura/page.tsx` (su función
  se reubica en `ExpenseModal` + panel de revisión).
- Quitar el uso de `NEXT_PUBLIC_CAPTCHA_API_KEY` (exponía la API key en el cliente).
  factura-dian usa su propia key server-side; PresupuestoApp no la necesita.

## Configuración / env

- `FACTURA_DIAN_URL` = `https://factura-dian.vercel.app` (nueva).
- `FACTURA_DIAN_METHOD` = `python` (default; cambiar a `openai` para probar Vision).
- `OPENAI_API_KEY` (ya existe) — para categorización.
- `maxDuration = 300` en el route de proceso.

## Manejo de errores

- Error del endpoint factura-dian → `status='error'`, `error_message`; visible en el
  panel con opción de reintento.
- CUFE duplicado → 409 con referencia a la factura existente (no reprocesa).
- Fallo de categorización IA → fallback `OTROS`, el draft sigue a `pending_review`.

## Estrategia de pruebas

- **Unit:** `categorizeInvoiceItems` (mock OpenAI: respuesta válida, respuesta inválida
  → fallback OTROS); mapeo item→gasto (`total_price`→`amount`); dedup.
- **Integración:** route `process` con SSE de factura-dian mockeado (eventos
  init/fetching/complete y caso error); route `approve` → verifica N llamadas a
  `upsert_monthly_expense` con el mapeo correcto.
- **Manual / diferido:** comparar `method=python` vs `method=openai` con un CUFE real
  para decidir el default productivo.

## Fuera de alcance (backlog)

- **Archivar PDF en Supabase Storage** (`download-pdf=true` + bucket). v1 no lo guarda.
- **Consolidación con import de Excel**: evitar duplicar un gasto que venga tanto de
  factura como de extracto de tarjeta/cuenta. El guardar `cufe + supplier + items + date`
  ya deja base para hacer match futuro por monto+fecha+proveedor.
- **Job 100% en background** (Vercel Queues): true fire-and-forget. v1 persiste el draft
  al completar; si el usuario cierra la pestaña a mitad, la fila queda en `processing`
  (reconciliable/retry desde el panel).

## Limitación conocida (v1)

El draft se persiste al **completar** el procesamiento. Si el usuario cierra la pestaña
durante el ~1 min, la fila queda en `processing` y debe reintentarse desde el panel.
