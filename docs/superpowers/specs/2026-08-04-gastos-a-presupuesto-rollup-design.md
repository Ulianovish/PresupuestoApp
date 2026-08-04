# Roll-up de Gastos → Presupuesto (con IA)

Fecha: 2026-08-04

## Objetivo

Que los gastos registrados en la sección **Gastos** se reflejen automáticamente
en la sección **Presupuesto**: cada gasto se asigna al ítem del presupuesto que
le corresponde y los valores se acumulan por ítem para el mes seleccionado. El
Presupuesto muestra solo el **total acumulado por ítem** (columna "Real"), no el
detalle de cada factura. Los totales se actualizan solos al agregar, editar o
eliminar un gasto.

### Ejemplo

Gastos del mes:
- Pernil: $45.000
- Carne molida: $28.000
- Banano: $12.000
- Bolsa: $3.000
- Bolsa: $2.000

Presupuesto → categoría Mercado:
- Carnes: $73.000 (Pernil + Carne molida)
- Frutas: $12.000 (Banano)
- Bolsas: $5.000 (Bolsa + Bolsa)

## Contexto actual (lo que ya existe)

- Los gastos son filas en la tabla `transactions` (`type = Gasto`), con:
  `description` (ej. "Pernil"), `amount`, `transaction_date`, `month_year`
  (derivado), y `category_name` (texto de la **categoría general**: MERCADO,
  VIVIENDA, OTROS…). Fuente: `src/lib/services/expenses.ts`.
- `transactions.budget_item_id` es una FK a `budget_items` **ya existente y
  nullable, hoy sin usar** por los gastos. Es el punto de enganche.
- Los ítems del presupuesto viven en `budget_items` (`name` = "Carnes", "Aseo",
  "Bolsa"…), cada uno bajo una categoría (`categories`, ej. MERCADO) y son
  **por mes** (un template por `month_year`).
- La columna "Real" de cada ítem hoy siempre muestra "—".
- Ya existe un clasificador de texto por IA: `categorizeInvoiceItems`
  (`src/lib/dian/categorizer.ts`) que usa el AI Gateway
  (`AI_GATEWAY_API_KEY`, `CATEGORIZE_MODEL`, endpoint Anthropic-compatible).
  Hoy clasifica descripciones en **categorías generales**.

## Decisiones (brainstorming)

1. **Mapeo por IA de texto**, reutilizando la infraestructura del clasificador
   existente. La IA clasifica la **descripción** del gasto en un **ítem** del
   presupuesto.
2. **Corrección manual**: un desplegable permite reasignar el ítem de un gasto.
   La corrección manual se respeta y **la IA no la vuelve a sobrescribir**.
3. **Gastos sin asignar**: se muestran en un **panel "Sin clasificar"** dentro de
   la página Presupuesto, en rojo, con desplegable para ubicarlos.
4. **Columna "Real" = suma automática** de los gastos asignados a ese ítem en el
   mes. Se **quita** el campo manual "Real" del modal de ítem.
5. **Alcance de la IA acotado a la categoría del gasto**: la IA solo elige entre
   los ítems de la **misma categoría general** del gasto (ej. gasto MERCADO →
   escoge entre Carnes/Aseo/Bolsa…). Si el gasto no tiene categoría clara o es
   OTROS, **no se adivina**: queda sin clasificar (panel rojo / OTROS).
6. **Vínculo por mes**: un gasto solo se enlaza a ítems del presupuesto de **su
   propio mes/año** (según `transaction_date`).

## Arquitectura

### Datos

- Usar `transactions.budget_item_id` como el vínculo gasto→ítem.
- Nueva columna `transactions.budget_item_source VARCHAR(10)` con valores
  `'ai'` | `'manual'` (NULL si no clasificado). Sirve para que la
  reclasificación por IA **no pise** las asignaciones manuales.
- Un gasto solo puede enlazarse a un `budget_item` cuyo template sea del mismo
  `month_year` del gasto (se valida al asignar).

### Clasificación (servicio IA)

`classifyExpenseToBudgetItem(description, monthYear, categoryName)`:

1. Carga los `budget_items` del `monthYear` cuya categoría == `categoryName`
   del gasto (nombre + id).
2. Si `categoryName` es OTROS/vacío o no hay ítems en esa categoría → devuelve
   `null` (queda sin clasificar; no se adivina).
3. Llama al AI Gateway (mismo patrón que `categorizeInvoiceItems`) con la
   descripción y la lista de nombres de ítems; la IA responde el **nombre del
   ítem** o `"NINGUNO"`.
4. Resuelve nombre → `budget_item_id`. Si `"NINGUNO"` o nombre inválido →
   `null`.

Se puede clasificar en lote (varias descripciones en una llamada), igual que hoy.

**Cuándo corre:**
- Al **crear** un gasto manual (Gastos).
- Al **aprobar factura** (cada línea que se vuelve gasto).
- En **importación** de gastos.
- Al **editar la descripción** de un gasto, si `budget_item_source != 'manual'`.
- Botón **"Clasificar con IA"** en el panel, para procesar los pendientes del mes
  (incluye gastos ya existentes previos a esta función).

Cambiar monto, fecha o borrar un gasto **no** requiere IA.

### Totales (columna "Real") — en vivo

- Modificar el RPC `get_budget_by_month` para que el `real` de cada ítem sea
  `SUM(t.amount)` de las `transactions` con `t.budget_item_id = bi.id`
  (`type = Gasto`). Como el vínculo ya es por mes, la suma queda acotada al mes.
- Es SQL puro que se recalcula al cargar el presupuesto → se actualiza solo al
  agregar/editar/eliminar gastos (cumple la regla de actualización automática).
- El front ya renderiza `item.real`; cambio mínimo.
- Quitar el campo manual "Real" del modal de ítem
  (`BudgetFormFields`) y del flujo de guardado.

### UI: panel "Sin clasificar" + corrección

- Nuevo organismo `UnclassifiedExpensesPanel` en la página Presupuesto:
  lista los gastos del mes con `budget_item_id IS NULL` (rojo): descripción,
  monto, categoría, y un **desplegable** con los ítems del mes para asignarlos.
  Asignar → marca `'manual'` y refresca.
- Botón **"Clasificar con IA"** en el panel para procesar los pendientes del mes.
- Desplegable de reasignación también disponible por gasto (para corregir
  cuando la IA se equivoque).

## Componentes y archivos

- **Migración** (`supabase/migrations`): agregar `budget_item_source` a
  `transactions`; actualizar la función `get_budget_by_month` para calcular
  `real` desde `transactions`.
- **Servicios**:
  - `classifyExpenseToBudgetItem` (IA) — nuevo, en `src/lib/dian/` o
    `src/lib/services/`.
  - `assignExpenseToBudgetItem(expenseId, budgetItemId)` — set manual + lock.
  - `getUnclassifiedExpenses(monthYear)`.
  - Enganchar la clasificación en: crear gasto (`expenses.ts` /
    `upsert_monthly_expense` flow), aprobar factura (`invoices.ts` →
    `approveInvoice`/`invoice-mapper`), importar.
- **UI**: `UnclassifiedExpensesPanel` (organismo) en `src/app/presupuesto`;
  ajuste en `BudgetItemModal`/`BudgetFormFields` (quitar Real manual); el panel
  usa el desplegable de ítems del mes.

## Pruebas (bun test)

- `classifyExpenseToBudgetItem`: nombre válido → id correcto; `"NINGUNO"` → null;
  categoría OTROS/vacía → null (sin adivinar); parseo de respuesta IA (reusar
  helpers de `categorizer.ts`).
- Suma por ítem (RPC): varios gastos al mismo ítem se acumulan; gasto sin
  `budget_item_id` no suma a ningún ítem.
- Respeto de `'manual'`: reclasificar no pisa un gasto marcado manual.
- Vínculo por mes: un gasto de abril no se enlaza a un ítem de marzo.

## Fuera de alcance (YAGNI)

- Reglas por palabra clave / edición de un diccionario de sinónimos.
- Arrastrar-y-soltar gastos entre ítems.
- Reflejar el acumulado en otras vistas (Dashboard) — se puede hacer después.
- Sub-detalle de facturas dentro del presupuesto (solo se muestra el total).
