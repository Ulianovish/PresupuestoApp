# Alertas de presupuesto

Fecha: 2026-08-31

## Objetivo

Avisar cuando un rubro se está acabando su presupuesto: por WhatsApp en el
momento del gasto, y en el dashboard como estado permanente.

Esto **reemplaza la sección B** del spec
[2026-08-16-agente-whatsapp-y-alertas-design.md](./2026-08-16-agente-whatsapp-y-alertas-design.md),
que quedó diseñada pero nunca se implementó. El plan del agente la difirió a un
`2026-08-XX-alertas-presupuesto.md` que no se escribió. Lo único que sí quedó
construido de esa sección es el enganche `onExpenseCreated` en
`src/lib/whatsapp/agent/tools.ts`, hoy un no-op.

## Por qué el diseño anterior cambia

La auditoría de agosto 2026 (hecha el 2026-08-31 sobre datos reales) mostró tres
cosas que el diseño de agosto no contemplaba.

### 1. No todo rubro merece una alerta

El spec viejo vigilaba **todas** las categorías. Pero una alerta solo vale si
**puede cambiar la próxima decisión**. Un comparendo ya está causado cuando se
paga: avisar es ruido. Un antojo en la tienda todavía se puede frenar.

El corte natural ya vive en la base de datos, en `classifications`:

| Clasificación / Control | Rubros | Presupuesto sep-2026 | ¿Vigilar? |
|---|---|---|---|
| Fijo / Necesario | 14 | $18.203.200 | **No** — arriendo, pensiones, leasing, TCs |
| Variable / Discrecional | 14 | $3.430.000 | **Sí** — restaurantes, cine, dulces, compras |
| Variable / Necesario | 12 | $3.107.938 | **Sí** — mercado, gasolina, parking |
| Básico / Eliminar | 3 | $855.000 | Mixto — hormiga sí, Claude IA no |

La regla es `clasificación = Variable`, con override manual para los tres casos
que no acierta.

### 2. Después del 100% el diseño viejo se callaba

Con umbrales solo en 80% y 100%, un rubro que se dispara avisa dos veces al
principio del mes y luego nunca más. En agosto **Dulces llegó al 938%** de su
presupuesto: dos avisos y silencio mientras se multiplicaba por nueve.

La escalera sigue después del 100%: **80, 100, 150, 200, 250...**

### 3. La alerta va por rubro, no por categoría

El spec viejo calculaba por categoría para no perderse los gastos sin
clasificar. Ese riesgo bajó: en agosto solo **$475.091 (2,4%)** quedaron sin
rubro, porque el agente ya clasifica. Y los gastos sin clasificar **ya tienen
casa propia** en `UnclassifiedExpensesPanel`.

Por rubro la alerta es accionable: *"vas en 82% de Dulces"* dice qué dejar de
comprar. *"Vas en 82% de MERCADO"* —ocho rubros juntos— solo dice que algo pasa.

> **Dependencia conocida:** la alerta por rubro hereda la precisión del
> clasificador de IA, que hoy es mala (`PRESU-51`). En agosto, 11 de 18
> movimientos de `Aseo` eran comida y 9 de 10 de `Cine` no eran cine. Un rubro
> contaminado alerta cuando no debe y calla cuando debería. Los datos de agosto
> ya se corrigieron a mano; el clasificador es trabajo aparte.

## Contexto (lo que ya existe y se reusa)

| Pieza | Estado |
|---|---|
| `onExpenseCreated` en `agent/tools.ts:278` | Existe, testeado, hoy no-op en `turn.ts:243` |
| `budget_items.classification_id → classifications.name` | Poblado y confiable |
| `UnclassifiedExpensesPanel` | Ya cubre los gastos sin rubro |
| `DashboardSummaryCards`, `BudgetStatusPanels` | Patrón a seguir para el panel nuevo |

## Módulos nuevos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/budget/alerts.ts` | Umbrales (puro) + cálculo + disparo con dedupe |
| `src/lib/budget/alerts.test.ts` | Pruebas |
| `src/components/organisms/BudgetAlertsPanel/` | Panel del dashboard |
| Migración SQL | `budget_items.alerts_enabled` + tabla `budget_alerts_sent` |

## Datos

### Selección de rubros vigilados

```sql
alter table budget_items add column alerts_enabled boolean;  -- NULL = automático
```

Nullable a propósito. `NULL` significa *"decide por clasificación"*; `true` /
`false` es override explícito del usuario. Así el default sigue vivo: si un
rubro cambia a Variable, empieza a vigilarse solo — salvo que el usuario ya lo
haya tocado a mano, en cuyo caso su decisión manda.

```sql
where coalesce(bi.alerts_enabled, cl.name = 'Variable')
  and bi.budgeted_amount > 0
```

**Un rubro con presupuesto en $0 no alerta**: no hay contra qué comparar.
Silencio, no error.

### Dedupe

```sql
create table budget_alerts_sent (
  user_id        uuid not null references auth.users(id) on delete cascade,
  month_year     text not null,
  budget_item_id uuid not null references budget_items(id) on delete cascade,
  last_threshold int  not null,
  sent_at        timestamptz not null default now(),
  primary key (user_id, month_year, budget_item_id)
);
```

**Una fila por rubro por mes**, guardando el umbral más alto ya avisado. El spec
viejo guardaba una fila por umbral cruzado; con la escalera de +50% y un rubro al
938%, eso serían 19 filas. Así es una, y no hay escalera que explote.

El disparo es una sola sentencia atómica:

```sql
insert into budget_alerts_sent (user_id, month_year, budget_item_id, last_threshold)
values ($1, $2, $3, $4)
on conflict (user_id, month_year, budget_item_id)
do update set last_threshold = excluded.last_threshold, sent_at = now()
where budget_alerts_sent.last_threshold < excluded.last_threshold
returning last_threshold;
```

**Devuelve fila → avisa. No devuelve → silencio.** Como la decisión *es* la
escritura, dos gastos simultáneos no pueden disparar el mismo aviso dos veces,
sin locks ni trucos de concurrencia.

RLS: igual que el resto de tablas por usuario — política sobre `user_id = auth.uid()`.

## Cálculo

### La escalera (función pura)

```ts
/** 0 si va por debajo del 80%. Si no: 80, 100, 150, 200, 250... */
export function highestThreshold(pct: number): number {
  if (pct < 80) return 0
  if (pct < 100) return 80
  return Math.floor(pct / 50) * 50
}
```

| pct | umbral |
|---|---|
| 79 | 0 |
| 80 | 80 |
| 99 | 80 |
| 100 | 100 |
| 149 | 100 |
| 150 | 150 |
| 938 | 900 |

Devuelve **solo el umbral más alto alcanzado**. Un gasto que cruza 80% y 100% de
golpe manda un solo aviso, el del 100%.

### El gasto del rubro

`SUM(amount)` de `transactions` del mes con ese `budget_item_id`, contra
`budget_items.budgeted_amount`. Se calcula desde `transactions` y **no** desde
`real_amount`, por la misma razón que el spec viejo: `real_amount` depende del
roll-up y puede estar desfasado.

## WhatsApp

### El enganche

`onExpenseCreated` hoy recibe solo la categoría, que ya no alcanza:

```ts
// antes
onExpenseCreated: (categoria: string) => Promise<void>
// después
onExpenseCreated: (e: { categoria: string; budgetItemId: string | null }) => Promise<void>
```

`budgetItemId` en `null` (gasto sin clasificar) → no hay rubro que evaluar →
silencio.

### El mensaje

La alerta **se pega a la respuesta del bot**, no es un mensaje aparte. Además de
ser menos ruidoso, evita la ventana de 24 h de WhatsApp Business: no hay nada que
entregar fuera de una conversación ya abierta.

```
✅ Anotado $8.500 en Dulces

⚠️ Vas en $123.000 de $150.000 en Dulces (82%).
   Te quedan $27.000 para los 9 días que faltan del mes.
```

Al pasarse:

```
🔴 Dulces: $195.000 de $150.000 (130%). Te pasaste por $45.000.
```

Si una factura toca varios rubros vigilados, **las alertas van juntas en el mismo
mensaje**. Si no, una sola factura de mercado dispararía cinco mensajes seguidos.

## App: el panel

`BudgetAlertsPanel` en el dashboard, siguiendo el patrón de
`DashboardSummaryCards` y `BudgetStatusPanels`.

```
┌─ Presupuestos en riesgo ──────────────────┐
│  🔴 Dulces          $195.000 / $150.000    │
│     ████████████████████████░ 130%         │
│     Te pasaste por $45.000                 │
│                                            │
│  ⚠️ Verduras y frutas $287.000 / $350.000  │
│     ████████████████░░░░░░░░  82%          │
│     Quedan $63.000 · 9 días del mes        │
└────────────────────────────────────────────┘
```

**Se calcula en vivo, sin tabla de notificaciones ni "marcar como leído".**
*"Vas al 82% de Dulces"* sigue siendo verdad mañana: se calcula y se muestra.
Nada que sincronizar, imposible que se desfase.

`budget_alerts_sent` **no manda en la UI**: aunque el bot ya avisó por chat, si
seguís al 82% el panel lo sigue mostrando, porque sigue siendo cierto.

**Aparece solo cuando hay algo que decir** (≥80%). Un panel siempre presente deja
de leerse a las dos semanas.

El panel usa **la misma selección de rubros** que WhatsApp: `alerts_enabled` con
default por clasificación. Si un rubro no merece alerta en el chat, tampoco
merece un renglón rojo en el dashboard — si no, el interruptor solo apagaría la
mitad del ruido.

"Días que faltan del mes" son días de calendario hasta el último día del mes en
curso, contando el de hoy.

Esto además tapa el hueco de los gastos cargados desde la app: no hay
conversación donde pegar el aviso, pero el dashboard lo refleja igual.

## Casos que hay que resolver

- **Un gasto cruza 80% y 100% de golpe:** se manda solo el del 100%, y
  `last_threshold` queda en 100.
- **Un rubro sin presupuesto ese mes:** silencio, no error.
- **Un gasto sin clasificar (`budget_item_id IS NULL`):** silencio. Lo cubre
  `UnclassifiedExpensesPanel`.
- **Una corrección baja el gasto por debajo del umbral:** no se "des-avisa". El
  aviso ya ocurrió y `last_threshold` no baja.
- **Cambio de mes:** `month_year` es parte de la llave, así que el mes nuevo
  arranca limpio sin borrar nada.
- **Si el cálculo de alertas falla, el gasto igual se guarda.** Ya es el
  comportamiento probado de `onExpenseCreated` (`tools.test.ts:234`) y se
  mantiene.

## Pruebas

| Qué | Cómo |
|---|---|
| `highestThreshold` | Tabla de casos, incluyendo el 938% real de agosto |
| Dedupe | Dos llamadas seguidas al mismo umbral → un solo aviso |
| Escalón | 82% avisa; 85% no; 105% sí; 130% no; 155% sí |
| Selección | Default por clasificación; override `true` y `false` |
| Presupuesto en $0 | Silencio, sin excepción |
| `budgetItemId: null` | Silencio |
| Varios rubros a la vez | Un solo mensaje con las alertas juntas |
| Fallo del cálculo | El gasto queda guardado igual |

## Orden de implementación

1. **Migración SQL** — `alerts_enabled` + `budget_alerts_sent` + RLS.
2. **`src/lib/budget/alerts.ts`** — `highestThreshold` puro, luego cálculo y
   disparo. Testeable sin UI ni WhatsApp.
3. **Enganche de WhatsApp** — ampliar la firma de `onExpenseCreated` y armar el
   mensaje en `turn.ts`.
4. **`BudgetAlertsPanel`** — independiente de los pasos 2 y 3; se puede hacer en
   paralelo o al final.
5. **Interruptor por rubro** — checkbox en el formulario de rubro existente.

Los pasos 1-3 son la feature mínima útil. El 4 y el 5 la completan.

## Fuera de alcance

- Alertas por cupo de tarjeta (depende de la sección de cuentas, que no existe).
- Alertas de ritmo ("vas muy rápido para el día del mes"). Se evaluó y se
  descartó por ahora: con 26 rubros vigilados el riesgo de ruido es alto, y una
  alerta que se ignora no sirve.
- Notificaciones push o email. WhatsApp y el dashboard cubren el caso.
