# Agente de WhatsApp + Alertas de presupuesto

Fecha: 2026-08-16

## Objetivo

Dos cosas que se sostienen entre sí:

**A. Convertir el bot de WhatsApp en un agente de verdad.** Hoy la conversación
son ~30 líneas de regex: acierta en lo simple y **acierta mal en silencio** en
todo lo demás. El agente entiende lenguaje libre, pregunta lo que le falta y
corrige lo último que hizo.

**B. Avisar cuando un presupuesto se está acabando**, por WhatsApp en el momento
y en el dashboard como estado.

Y una consecuencia buscada: **eliminar la aprobación de facturas en la app**. Su
función que pesaba era elegir la cuenta; si el agente la pregunta, el trámite
sobra.

## El problema, concreto

`parseQuickExpense` no falla ruidosamente — devuelve algo equivocado:

| Escribís | Hoy queda | Por qué |
|---|---|---|
| `2 empanadas 5000` | **$2** "empanadas 5000" | toma el primer token numérico como monto |
| `20k taxi y 15k almuerzo` | un gasto de 20k, desc. "taxi y 15k almuerzo" | no existe la idea de varios gastos |
| `ayer pagué 40k` | se anota **hoy** | `todayYmd()` fijo |
| `no, eran 30 mil` | *"No te entendí"* | sin estado de conversación |
| `ese fue con la Davivienda` | *"No te entendí"* | cuenta por defecto, sin elección |
| `¿cuánto llevo en mercado?` | *"No te entendí"* | los datos están, el bot no los alcanza |
| `le pagué al taxista 20k` | desc. "le al taxista" | lista de stopwords de 6 palabras |
| foto → `sí, esa` | *"No te entendí"* | sin contexto del mensaje anterior |

**Esto descarta el enfoque "LLM solo como respaldo".** La mayoría de estas nunca
llega a `unknown`, así que un LLM que actuara solo ahí jamás las vería.

## Contexto (lo que ya existe y se reusa)

- `src/lib/whatsapp/` — webhook, clasificación, visión, transporte Twilio. El
  patrón del repo es **dependencias inyectadas** (`handle-agent.ts`,
  `handle-image.ts`), que es justo la forma que necesita una capa de herramientas.
- `vision.ts` — ya devuelve datos estructurados (`transfer` | `receipt` |
  `unknown` | `service_error`). No cambia.
- Vercel AI Gateway — ya en producción para visión y categorización.
  `AI_GATEWAY_API_KEY`, superficie Anthropic-compatible.
- **Roll-up gastos→presupuesto** (spec del 2026-08-04, ya implementado):
  `transactions.budget_item_id` + `budget_item_source` (`'ai' | 'manual'`),
  `classifyExpensesToItems()`, RPC `assign_expense_budget_item`,
  `get_budget_by_month` con "Real" híbrido.
- `upsert_monthly_expense` — RPC que crea el gasto.
- `resolveDefaultAccount(phone)` — cuenta por defecto del número.

## Decisiones

1. **El LLM interpreta, el código ejecuta.** El modelo nunca escribe en la base:
   solo decide qué herramienta llamar. Las herramientas validan y escriben.
2. **El CUFE sigue por regex.** 96 hex es determinista, gratis y sin ambigüedad
   posible. Un LLM ahí solo agregaría formas de fallar.
3. **Registro directo, sin aprobación.** Se elimina la pantalla y
   `/api/invoices/[id]/approve`.
4. **Las cuentas y categorías van en el prompt**, no en una herramienta: son
   pocas y cambian poco. Evita una vuelta extra al modelo por mensaje.
5. **Toda imagen y todo CUFE resuelven la cuenta**; los gastos rápidos de texto
   usan la de por defecto. Sin esa distinción, cada *"20k taxi"* se volvería dos
   mensajes.

   Orden para resolverla, y se pregunta solo si los tres fallan:
   1. el **texto que acompaña** la imagen o el CUFE (*"con la Davivienda"*);
   2. lo que **detectó la visión** — en transferencias ya extrae la app/banco
      de origen (`VisionResult.account`);
   3. si ninguno resolvió → **preguntar**.

   Una transferencia con la cuenta detectada por visión **no pregunta nada**:
   ese caso ya funciona hoy y no hay que empeorarlo.
6. **Alertas en el momento, una vez por umbral** (80% y 100%) por categoría por
   mes.
7. **`NitFac`/`DocAdq` del QR primero** en la cascada del NIT del CUFE.

## Arquitectura

Todo mensaje se normaliza a lo mismo antes de llegar al agente:

```
mensaje de WhatsApp
  │
  ├─ ¿trae imagen?     → descargar + visión ──┐
  ├─ ¿es CUFE (regex)? → scraper ─────────────┤   texto acompañante
  └─ texto suelto ────────────────────────────┤   + datos extraídos
                                               ▼
                                       ┌───────────────┐
                                       │    AGENTE     │ ← cuentas y categorías
                                       │  (AI Gateway) │   en el prompt
                                       └───────────────┘
                                               │ tool calls
                                               ▼
                                       ┌───────────────┐
                                       │  HERRAMIENTAS │ valida → escribe
                                       └───────────────┘
                                               │
                                               ▼
                                       alertas de presupuesto
```

**Lo que hoy se pierde y hay que arreglar:** `classifyText` ve que hay media y
**descarta el `Body`**. Ese texto (*"con la Davivienda"*) es justamente el dato
que necesitamos.

### Módulos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/whatsapp/agent/run.ts` | El bucle: Gateway → ejecutar tool calls → repetir (tope 3) |
| `src/lib/whatsapp/agent/tools.ts` | Definición JSON + ejecutores con validación |
| `src/lib/whatsapp/agent/prompt.ts` | System prompt con cuentas y categorías reales |
| `src/lib/whatsapp/agent/state.ts` | Estado de conversación |
| `src/lib/budget/alerts.ts` | Cálculo y disparo de alertas |
| `src/components/organisms/BudgetAlertsPanel/` | El panel del dashboard |

## A. El agente

### Herramientas

```
registrar_gasto(monto, descripcion, cuenta?, fecha?)
    Gastos sueltos de texto. Sin cuenta → la de por defecto.
    Se puede llamar varias veces: "20k taxi y 15k almuerzo" = 2 llamadas.

registrar_factura(cuenta)
    Confirma una factura ya extraída (CUFE o foto) que está en `pending`.

corregir_ultimo(campo, valor)
    campo ∈ monto | descripcion | cuenta | categoria | item | fecha

consultar_gastos(categoria?, desde?, hasta?)
    Solo lectura.
```

**`registrar_factura` recibe solo la cuenta.** Los ítems de una factura **nunca
vuelven a pasar por el modelo**: quedan en `pending` y el agente solo aporta el
dato que falta. Tres cosas de una: el modelo no puede alterar un monto, no se
pagan tokens por reenviar 27 ítems, y no hay forma de que "se pierda" uno.

**Toda herramienta que crea un gasto clasifica su ítem de presupuesto.** Con el
roll-up ya implementado, un gasto sin `budget_item_id` cae en el panel "Sin
clasificar" y hay que arreglarlo a mano en la app — el trámite que estamos
eliminando. Las herramientas llaman `classifyExpensesToItems()` +
`assign_expense_budget_item` con `p_source: 'ai'`.

**`corregir_ultimo` marca `'manual'`.** Si corregís el ítem por chat y se
guardara como `'ai'`, la próxima reclasificación te lo revierte.

### Estado de conversación

```sql
create table whatsapp_conversations (
  phone_e164   text primary key,
  user_id      uuid not null references auth.users(id),
  turns        jsonb not null default '[]',  -- últimos 6 turnos
  pending      jsonb,                        -- qué se espera + los datos
  last_entity  jsonb,                        -- lo último creado
  updated_at   timestamptz not null default now()
);
```

`pending` es lo que hace posible preguntar. Entre *"[foto]"* y *"Davivienda"* hay
**dos invocaciones distintas de la función serverless** — no hay memoria
compartida. `pending` guarda la factura extraída completa y el segundo mensaje la
recupera. Sin esto, preguntar la cuenta es imposible.

**Vencimientos:** `turns` y `pending` a los 30 min — un *"sí, esa"* tres horas
después es otra conversación. `last_entity` no vence, se pisa con cada gasto.

### Cuándo se pregunta la cuenta de un CUFE

**Después de que el scrape funcionó, no antes.** Tienta preguntar al toque para
aprovechar los ~50 s del scrape, pero hoy ~2 de cada 5 facturas fallan cuando el
receptor no es consumidor final: preguntaríamos para nada y habría que descartar
una respuesta ya dada. El ACK ya avisa que está procesando.

La factura se guarda en `pending` **antes** de preguntar: si algo muere entre la
pregunta y la respuesta, el scrape no se pierde.

### Modelo

`google/gemini-3-flash` por defecto, configurable por env (`AGENT_MODEL`), igual
que se hizo con la visión. Soporta `tool-use` y caché de prompt.

Costo estimado con ~4.000 tokens de entrada y ~200 de salida por interacción:

| Modelo | in $/M | out $/M | USD/1000 msjs |
|---|---|---|---|
| `google/gemini-3-flash` | 0.50 | 3.00 | ~$2.60 |
| `anthropic/claude-haiku-4.5` | 1.00 | 5.00 | ~$5.00 |
| `openai/gpt-5-nano` | 0.05 | 0.40 | ~$0.28 |

Con caché de prompt (el system prompt y las herramientas son idénticos cada vez)
el costo real baja bastante. **Para uso personal: entre $1 y $3 al mes.** El
costo no es la restricción; la latencia y el determinismo sí.

## B. Alertas de presupuesto

### El agujero que hay que evitar

El roll-up hace que `real_amount` de un ítem sea la **suma de los gastos
asignados a ese ítem**. Los gastos sin clasificar (`budget_item_id IS NULL`)
**no suman a ningún ítem**.

Si la alerta se basara en `real_amount`, pasaría esto: gastás $400.000 en
MERCADO, nada se clasificó en ítems, `real_amount` sigue en cero y **la alerta
nunca dispara mientras te pasás del presupuesto**. Una falla muda.

**Por eso la alerta calcula el total de la categoría desde `transactions`**
(`SUM(amount)` por `category_name` del mes, tipo Gasto) contra la **suma de
`budgeted_amount` de los ítems de esa categoría**. Así no se escapa ningún gasto.

Esto **difiere a propósito** del "Real" por ítem que muestra el presupuesto:
son preguntas distintas. El "Real" responde *"¿cuánto llevo en Carnes?"*; la
alerta responde *"¿me estoy pasando de MERCADO?"*, y esa tiene que incluir todo.
Cuando hay gastos sin clasificar, el mensaje lo dice.

### WhatsApp: el evento

La alerta **se pega a la respuesta del bot**, no es un mensaje aparte. Además de
ser menos ruidoso, evita la ventana de 24 h de WhatsApp Business: no hay nada que
entregar fuera de una conversación ya abierta.

```
✅ Anotado $45.000 en MERCADO (Efectivo)

⚠️ Vas en $412.000 de $500.000 en MERCADO (82%).
   Te quedan $88.000 para los 12 días que faltan del mes.
   Incluye $45.000 sin clasificar en ítems.
```

Al 100%: `🔴 Te pasaste en MERCADO: $520.000 de $500.000 (104%).`

### App: el estado

`⚠️ Estás al 82% de MERCADO` es una verdad que sigue siendo cierta mañana, así
que **la UI no necesita tabla de notificaciones ni "marcar como leído"**:
calcula y muestra. Nada que sincronizar, imposible que se desfase.

`BudgetAlertsPanel` en el dashboard, siguiendo la estructura existente
(`DashboardSummaryCards`, `BudgetStatusPanels`):

```
┌─ Presupuestos en riesgo ──────────────────┐
│  🔴 RESTAURANTES   $310.000 / $250.000     │
│     ████████████████████████░ 124%         │
│     Te pasaste por $60.000                 │
│                                            │
│  ⚠️ MERCADO        $412.000 / $500.000     │
│     ████████████████░░░░░░░░  82%          │
│     Quedan $88.000 · 12 días del mes       │
└────────────────────────────────────────────┘
```

**Aparece solo cuando hay algo que decir** (≥80%). Un panel siempre presente deja
de leerse a las dos semanas.

Esto además tapa el hueco de los gastos cargados a mano en la app: no hay
conversación donde pegar el aviso, pero el dashboard lo refleja igual.

### Dedupe (solo para WhatsApp)

```sql
create table budget_alerts_sent (
  user_id       uuid not null,
  month_year    text not null,
  category_name text not null,
  threshold     int  not null,        -- 80 | 100
  sent_at       timestamptz not null default now(),
  primary key (user_id, month_year, category_name, threshold)
);
```

Se hace `INSERT ... ON CONFLICT DO NOTHING` y **se avisa solo si la fila entró**.
Como la decisión *es* la inserción, dos gastos simultáneos no pueden disparar la
misma alerta dos veces, sin trucos de concurrencia.

Esta tabla **no manda en la UI**: aunque ya te avisó por chat, si seguís al 82%
el dashboard lo sigue mostrando, porque sigue siendo verdad.

### Casos que hay que resolver

- **Una factura toca varias categorías:** se revisan todas las afectadas de una
  vez y las alertas se juntan en el mismo mensaje. Si no, tres mensajes seguidos
  por una sola factura.
- **Un gasto cruza 80% y 100% de golpe:** se manda **solo el del 100%** y se
  marcan los dos como enviados.
- **Categoría sin presupuesto ese mes:** no hay contra qué comparar → silencio,
  no un error.
- **Una corrección baja el gasto por debajo del umbral:** no se "des-avisa". El
  aviso ya ocurrió.

## C. NIT del QR para el CUFE

La DIAN exige un NIT que coincida con el **emisor o el receptor**. El bloque del
QR trae los dos:

| Campo | Qué es | Sirve como |
|---|---|---|
| `NitFac` | NIT del facturador | emisor |
| `DocAdq` | documento del adquiriente | receptor |

Cuando el QR trae `NitFac`, el acierto es **seguro al primer intento**: pasamos
de probabilístico a determinista y nos ahorramos el captcha del reintento. El
genérico solo acierta si el receptor era consumidor final.

**Cascada: `NitFac` → `DocAdq` → genéricos (`222222222222`, `2222222222`).**

Cambios, todos **compatibles hacia atrás** (sin parámetro, todo funciona como hoy):

| Repo | Cambio |
|---|---|
| `PresupuestoApp` | parsear `NitFac`/`DocAdq` (regex, junto a `extractCufe`) y pasarlos por `runInvoiceProcessing` |
| `dian-scraper` (VPS) | `/scrape` acepta `&nits=`; se inyecta como `DIAN_SEARCH_NIT` al proceso hijo |
| `factura-dian` (Vercel) | mismo parámetro; `NITS = nits \|\| process.env.DIAN_SEARCH_NIT \|\| genéricos` |

Los scrapers ya leen una lista separada por comas: la cascada existe, solo hay
que poder alimentarla por factura en vez de globalmente.

**Límite conocido:** esto ayuda solo cuando se pega el bloque del QR. Con el CUFE
pelado volvemos a los genéricos, y las facturas cuyo receptor no es consumidor
final siguen fallando. El arreglo completo necesita la cédula del usuario
(backlog).

## D. Eliminar la aprobación

- Se borra la pantalla y `/api/invoices/[id]/approve`.
- **`classifyApprovedExpenses()` (`invoices.ts:246`) no se borra: se muda.** Hoy
  clasifica el ítem de presupuesto de cada línea al aprobar; la ruta de registro
  directo tiene que llamarlo o cada factura entra entera sin clasificar.
- `approveInvoice()` (`invoices.ts:159`) se reusa como registro directo, ya sin
  ser un paso manual.
- **Antes de borrar:** revisar que no queden facturas en `pending_review`, o
  quedan inalcanzables. *(Al escribir este spec se limpiaron las 2 que había en
  `status='error'` con 0 ítems.)*
- El panel "Facturas por aprobar" incluye `status='error'` en su filtro —
  facturas que nunca se van a poder aprobar. Se va con la pantalla.

## Errores y degradación

| Falla | Qué pasa |
|---|---|
| Gateway caído / 429 | **Cae al parser viejo.** `parseQuickExpense` no se borra: pasa a ser el modo degradado. Con el LLM caído, *"20k taxi"* se sigue registrando. |
| El modelo inventa una cuenta | La herramienta valida contra las cuentas reales y devuelve el error **al agente**, que pregunta. No se escribe nada. |
| Monto absurdo | El tope de $100M se muda del parser a la herramienta. |
| Bucle de tool calls | Tope de 3 vueltas; después responde con lo que tenga. |
| La base falla | Se reporta con honestidad. |
| Vercel mata la función | Presupuesto de tiempo como en `process-invoice.ts`. Vercel mata **sin ejecutar el catch**: hay que cortar antes y alcanzar a avisar. |

## Pruebas

Siguiendo el patrón del repo — dependencias inyectadas, sin red ni base:

- **Herramientas:** las validaciones son lo que más importa (monto tope, cuenta
  inexistente, fecha absurda).
- **Bucle del agente:** con el Gateway mockeado; se le da una respuesta con
  `tool_call` armada a mano y se verifica que ejecute lo correcto. **Nunca contra
  el modelo real:** no es determinista y haría fallar el CI al azar.
- **Estado:** `pending` sobrevive entre mensajes, vence a los 30 min,
  `last_entity` se pisa.
- **Alertas:** cruce de umbral; dedupe (la segunda vez no manda); varias
  categorías juntas; 80 y 100 de un saque; **gastos sin clasificar sí cuentan**.
- **Clasificación de ítem:** un gasto creado por el agente queda con
  `budget_item_id`; una corrección queda `'manual'`.
- **Regresión:** los tests del CUFE que ya pasan deben seguir pasando.

**Lo que no se puede testear automáticamente** es si el modelo interpretó bien
*"2 empanadas 5000"*. Para eso, un archivo con ~15 mensajes reales y sus llamadas
esperadas, que se corre a mano contra el modelo antes de desplegar. No va al CI:
cuesta plata y sería inestable.

## Orden sugerido

El spec cubre cuatro frentes. No conviene atacarlos a la vez: el orden importa
porque hay dependencias reales y porque conviene tener algo usable pronto.

1. **Estado de conversación** (tabla + `state.ts`). Es el cimiento: sin `pending`
   no se puede preguntar nada, y sin eso ni el agente ni la eliminación de la
   aprobación se sostienen.
2. **Agente con `registrar_gasto` y `consultar_gastos`.** Se puede desplegar solo,
   conviviendo con el flujo actual: arregla las fallas de la tabla de arriba sin
   tocar facturas.
3. **`registrar_factura` + eliminar la aprobación.** Depende de 1 y 2, y es el
   paso que hay que verificar mejor (mudar `classifyApprovedExpenses`, limpiar
   `pending_review`).
4. **Alertas** (WhatsApp + panel). Independiente de las anteriores; se puede
   hacer en paralelo o al final.
5. **NIT del QR.** Independiente de todo lo demás, toca tres repos.

## Fuera de alcance (backlog)

- **Sección de cuentas y tarjetas** (cupos, fechas de corte, cuota de manejo,
  seguros y beneficios). Es el más grande de los tres: modelo de datos nuevo
  (`accounts` hoy tiene solo `name`, `type`, `is_active`) más una sección
  entera. Merece su propio spec.
- **Cédula/NIT del usuario en el perfil** (migración + onboarding + settings)
  para completar la cascada del NIT. Hoy `profiles` no lo tiene.
- **Canario del CUFE por Telegram** — construido y probado, con el cron apagado
  hasta tener canal de aviso.
- Alertas por cupo de tarjeta (depende de la sección de tarjetas).
- Umbrales configurables por categoría (hoy 80/100 fijos).
