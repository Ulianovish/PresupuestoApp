# Alertas en facturas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que registrar una factura (o una foto de comprobante) también dispare las alertas de presupuesto, no solo los gastos escritos a mano.

**Architecture:** El motor de alertas ya existe y funciona; lo único que falta es que el camino de facturas le entregue los rubros que tocó. Se ensancha el enganche `onExpenseCreated` de un rubro a una lista, se hace que la clasificación de facturas devuelva los ids que asignó, y se cablean los dos caminos que hoy no avisan.

**Tech Stack:** Next.js 15, TypeScript, Supabase, vitest.

## El hueco que cierra

La feature de alertas (mergeada en `12c202b`) solo avisa desde `registrar_gasto`. Los otros dos caminos por los que entra un gasto no llaman a `onExpenseCreated`:

- `registrar_factura` → `registerInvoice` → `createInvoiceDirect`
- La foto de un comprobante de transferencia → `handle-image.ts` → `createDirectExpense`

Con los datos reales de agosto 2026, eso significa que el aviso por chat cubre **42 de 264 movimientos**. Las otras 222 entraron por factura.

Volumen medido, para dimensionar: 32 facturas en agosto, 6,6 ítems promedio (máx 27), **2,7 rubros por factura (máx 7)**. Como el dedupe impide repetir un umbral ya avisado, una factura dispara pocas alertas y después se calla.

## Global Constraints

- **Package manager: `bun`.** Nunca npm ni yarn.
- **Tests: `bun run test`.** La base es **309** y no debe bajar.
- **Commits: `git commit --no-verify`.** El hook de husky revierte cambios.
- **NO correr `bun run db:types`.** Trunca los tipos.
- Rama: `feat/alertas-en-facturas`, salida de `main` en `12c202b`.
- Comentarios y mensajes de usuario en español.
- **No se toca SQL ni migraciones.** Todo el cambio es TypeScript.
- El `try/catch` best-effort que envuelve el enganche se mantiene: el gasto ya está guardado y una alerta que falla no puede convertirlo en "no se pudo guardar".

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `src/lib/services/invoices.ts` | `classifyApprovedExpenses` y `createInvoiceDirect` devuelven los rubros asignados |
| `src/lib/whatsapp/agent/tools.ts` | El enganche pasa a recibir una lista; se cablea `registrar_factura` |
| `src/lib/whatsapp/agent/turn.ts` | Adapta el enganche real a la lista |
| `src/lib/whatsapp/handle-image.ts` | Cablea el camino de la foto de transferencia |
| Sus `.test.ts` | Cobertura de cada paso |

**Por qué el enganche pasa a lista y no se lo llama N veces:** una factura toca 2,7 rubros en promedio. Llamar `onExpenseCreated` una vez por rubro haría un `cargarEstado` (round trip a Supabase) por cada uno, y produciría grupos de mensajes separados en vez del mensaje único que pide el spec. Con una lista, es una llamada y un `dispararAlertas`, que ya sabe juntar las alertas de varios rubros.

---

### Task 1: La clasificación de facturas devuelve los rubros que asignó

**Files:**
- Modify: `src/lib/services/invoices.ts` (`classifyApprovedExpenses` ~línea 415, `createInvoiceDirect` ~línea 259, y las dos llamadas a `clasificar` en ~336 y ~379)
- Test: `src/lib/services/invoices.test.ts` (si no existe, crearlo)

**Interfaces:**
- Consumes: nada de tareas anteriores.
- Produces:
  - `classifyApprovedExpenses(supabase, userId, expenses): Promise<string[]>` — los `budget_item_id` que efectivamente asignó, sin duplicados.
  - `createInvoiceDirect(...)` suma `budgetItemIds: string[]` a su objeto de retorno.

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/services/invoices.test.ts`, siguiendo el estilo de mocks que ya use el archivo (o `src/lib/whatsapp/agent/tools.test.ts` si no existe):

```ts
it('devuelve los rubros que asignó, sin repetir', async () => {
  // Dos gastos de MERCADO que caen en el mismo rubro y uno de TRANSPORTE:
  // el llamador necesita 2 ids, no 3, porque las alertas son por rubro.
  const ids = await classifyApprovedExpenses(supabaseFake, 'u1', [
    { id: 't1', description: 'Chocolatina', categoryName: 'MERCADO', monthYear: '2026-09' },
    { id: 't2', description: 'Gomitas', categoryName: 'MERCADO', monthYear: '2026-09' },
    { id: 't3', description: 'Gasolina', categoryName: 'TRANSPORTE', monthYear: '2026-09' },
  ]);
  expect(ids.sort()).toEqual(['item-dulces', 'item-gasolina']);
});

it('no incluye los gastos que no se pudieron clasificar', async () => {
  const ids = await classifyApprovedExpenses(supabaseFake, 'u1', [
    { id: 't1', description: 'Algo rarísimo', categoryName: 'SIN_RUBROS', monthYear: '2026-09' },
  ]);
  expect(ids).toEqual([]);
});

it('si el RPC de asignación falla, ese rubro no se reporta como asignado', async () => {
  // Reportarlo dispararía una alerta por un gasto que no quedó en el rubro.
  const ids = await classifyApprovedExpenses(supabaseFakeQueFalla, 'u1', [
    { id: 't1', description: 'Chocolatina', categoryName: 'MERCADO', monthYear: '2026-09' },
  ]);
  expect(ids).toEqual([]);
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/services/invoices.test.ts
```

Esperado: FAIL — la función devuelve `void`.

- [ ] **Step 3: Implementar**

En `classifyApprovedExpenses`, acumular los ids asignados y devolverlos:

```ts
): Promise<string[]> {
  const asignados = new Set<string>();
  try {
    if (expenses.length === 0) return [];
    // ... (el cuerpo existente, sin cambios) ...
        for (let i = 0; i < catExpenses.length; i++) {
          const itemId = resolveItemNameToId(names[i], inCategory);
          if (itemId) {
            const { error: assignError } = await supabase.rpc(
              'assign_expense_budget_item',
              {
                p_user_id: userId,
                p_transaction_id: catExpenses[i].id,
                p_budget_item_id: itemId,
                p_source: 'ai',
              },
            );
            // Solo cuenta como asignado si el RPC confirmó: avisar por un
            // rubro que no quedó escrito sería una alerta sobre un gasto que
            // no está ahí.
            if (!assignError) asignados.add(itemId);
          }
        }
    // ...
  } catch (error) {
    console.error('Error clasificando gastos de factura aprobada:', error);
    // best-effort: no relanzar
  }
  return [...asignados];
}
```

⚠️ **El `return [...asignados]` va afuera del `catch`**, para que una falla parcial devuelva igual lo que sí se asignó — mismo criterio que `dispararAlertas`, que no tira los avisos ya ganados cuando un rubro falla.

En `createInvoiceDirect`, capturar el resultado de las dos llamadas a `clasificar` (líneas ~336 y ~379) y sumar `budgetItemIds: string[]` al objeto de retorno. Las dos llamadas están en caminos distintos: asegurate de que **las dos** propaguen, y que el retorno de error temprano devuelva `budgetItemIds: []`.

- [ ] **Step 4: Correr el test y ver que pasa**

```bash
bun run test src/lib/services/invoices.test.ts
```

- [ ] **Step 5: Correr la suite completa**

```bash
bun run test
```

Esperado: 309 + los nuevos, sin regresiones.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/invoices.ts src/lib/services/invoices.test.ts
git commit --no-verify -m "feat(alertas): la clasificación de facturas devuelve los rubros que asignó"
```

---

### Task 2: El enganche recibe una lista y las facturas lo llaman

**Files:**
- Modify: `src/lib/whatsapp/agent/tools.ts` (tipo de `onExpenseCreated` ~línea 280, llamada de `registrar_gasto` ~línea 340, tipo de `registerInvoice` ~línea 255, rama de `registrar_factura` ~línea 365)
- Modify: `src/lib/whatsapp/agent/tools.test.ts`
- Modify: `src/lib/whatsapp/agent/turn.ts` (el enganche real ~línea 250, `registerInvoice` ~línea 196)
- Modify: `src/lib/whatsapp/agent/turn.test.ts`

**Interfaces:**
- Consumes: `createInvoiceDirect(...)` con `budgetItemIds: string[]` (Task 1).
- Produces:
  - `onExpenseCreated: (e: { categoria: string; budgetItemIds: string[] }) => Promise<string[]>` — **devuelve los mensajes de alerta**, no `void`.
  - `ToolDeps.registerInvoice` suma `budgetItemIds?: string[]` a su retorno.

**Por qué el enganche ahora devuelve los mensajes:** `handle-image.ts` (Task 3) no
tiene el acumulador `alertasPendientes` — arma y manda su propio mensaje con
`deps.sendMessage`. Devolviendo los avisos, las dos superficies los pegan a su
propia respuesta con el mismo enganche, sin duplicar la lógica ni inventar un
segundo canal. `executeTool` ignora el retorno: en el camino del agente, el
closure de `turn.ts` sigue acumulando.

- [ ] **Step 1: Escribir los tests que fallan**

En `tools.test.ts`:

```ts
it('le pasa al enganche todos los rubros que tocó la factura', async () => {
  let recibido: { categoria: string; budgetItemIds: string[] } | null = null;
  const deps = {
    ...depsBase,
    registerInvoice: async () => ({
      ok: true as const,
      itemsFound: 6,
      totalItems: 6,
      totalAmount: 84000,
      budgetItemIds: ['item-dulces', 'item-carnes'],
    }),
    onExpenseCreated: async (e: { categoria: string; budgetItemIds: string[] }) => {
      recibido = e;
    },
  };
  await executeTool('registrar_factura', { cuenta: 'Davivienda' }, deps);
  expect(recibido?.budgetItemIds).toEqual(['item-dulces', 'item-carnes']);
});

it('una factura que no clasificó nada no llama al enganche con basura', async () => {
  let llamado = false;
  const deps = {
    ...depsBase,
    registerInvoice: async () => ({
      ok: true as const, itemsFound: 3, totalItems: 3, totalAmount: 1000,
      budgetItemIds: [],
    }),
    onExpenseCreated: async () => { llamado = true; },
  };
  await executeTool('registrar_factura', { cuenta: 'Davivienda' }, deps);
  expect(llamado).toBe(false);
});

it('si el enganche lanza en una factura, la factura igual queda registrada', async () => {
  // Mismo criterio que en registrar_gasto: los gastos YA están escritos.
  const deps = {
    ...depsBase,
    registerInvoice: async () => ({
      ok: true as const, itemsFound: 3, totalItems: 3, totalAmount: 1000,
      budgetItemIds: ['item-dulces'],
    }),
    onExpenseCreated: async () => { throw new Error('Supabase caído'); },
  };
  const r = await executeTool('registrar_factura', { cuenta: 'Davivienda' }, deps);
  expect(r.ok).toBe(true);
});
```

En `turn.test.ts`, un test de que una factura produce la alerta pegada a la respuesta, siguiendo el patrón del test que ya existe para `registrar_gasto` (mockea `@/lib/budget/alerts` y `@/lib/budget/alerts-supabase`).

- [ ] **Step 2: Correr los tests y ver que fallan**

```bash
bun run test src/lib/whatsapp/agent/
```

- [ ] **Step 3: Ensanchar el enganche**

En `tools.ts`:

```ts
  /**
   * Se llama tras cada gasto creado, con los rubros que tocó. Es una LISTA
   * porque una factura toca varios (2,7 en promedio): llamar una vez por rubro
   * haría un round trip a Supabase por cada uno y partiría el aviso en varios
   * mensajes, en vez del único que junta todo.
   */
  onExpenseCreated: (e: {
    categoria: string;
    budgetItemIds: string[];
  }) => Promise<string[]>;
```

Y en la llamada de `registrar_gasto`:

```ts
        await deps.onExpenseCreated({
          categoria: res.category,
          budgetItemIds: res.budgetItemId ? [res.budgetItemId] : [],
        });
```

**No toques el `try/catch` ni su comentario.**

- [ ] **Step 4: Cablear `registrar_factura`**

En el tipo de `ToolDeps.registerInvoice`, sumar `budgetItemIds?: string[]`.

En la rama de `registrar_factura` de `executeTool`, dentro del `if (res.ok)`, replicar el mismo patrón best-effort de `registrar_gasto`:

```ts
        // Best-effort, igual que en registrar_gasto: los gastos de la factura
        // YA están escritos. Si la alerta falla, no puede convertir esto en un
        // "no se pudo guardar" que empuje al modelo a registrarla de nuevo.
        const rubros = res.budgetItemIds ?? [];
        if (rubros.length > 0) {
          try {
            await deps.onExpenseCreated({
              categoria: 'FACTURA',
              budgetItemIds: rubros,
            });
          } catch (errAlerta) {
            console.error(
              'executeTool(registrar_factura): onExpenseCreated falló:',
              errAlerta,
            );
          }
        }
```

- [ ] **Step 5: Adaptar `turn.ts`**

El enganche real pasa a usar la lista:

```ts
    onExpenseCreated: async e => {
      if (e.budgetItemIds.length === 0) return []; // sin rubro no hay qué comparar
      const msgs = await dispararAlertas(alertDepsSupabase(), {
        userId: ctx.userId,
        monthYear: todayBogota().slice(0, 7),
        budgetItemIds: e.budgetItemIds,
        hoy: hoyBogotaDate(),
      });
      alertasPendientes.push(...msgs);
      return msgs;
    },
```

Y en `registerInvoice` (~línea 196), propagar `budgetItemIds` desde `createInvoiceDirect`, incluyendo el retorno temprano de error (ahí va `budgetItemIds: []`).

- [ ] **Step 6: Correr los tests**

```bash
bun run test
```

Esperado: 309 + los nuevos, sin regresiones.

- [ ] **Step 7: Commit**

```bash
git add src/lib/whatsapp/agent/
git commit --no-verify -m "feat(alertas): las facturas también disparan alertas de presupuesto"
```

---

### Task 3: La foto de comprobante también avisa

**Files:**
- Modify: `src/lib/whatsapp/handle-image.ts` (la rama `transfer`, ~línea 135-150)
- Modify: `src/lib/whatsapp/handle-image.test.ts`

**Interfaces:**
- Consumes: el enganche con lista (Task 2).
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Escribir el test que falla**

En `handle-image.test.ts`, siguiendo el estilo del archivo:

```ts
it('la foto de una transferencia también dispara la alerta del rubro', async () => {
  let recibido: string[] | null = null;
  const deps = {
    ...depsBase,
    createDirectExpense: async () => ({
      ok: true as const,
      category: 'MERCADO',
      transactionId: 't1',
      budgetItemId: 'item-dulces',
    }),
    onExpenseCreated: async (e: { budgetItemIds: string[] }) => {
      recibido = e.budgetItemIds;
    },
  };
  await handleImage(ctxTransferencia, deps);
  expect(recibido).toEqual(['item-dulces']);
});
```

- [ ] **Step 2: Correr el test y ver que falla**

```bash
bun run test src/lib/whatsapp/handle-image.test.ts
```

- [ ] **Step 3: Implementar**

Sumar `onExpenseCreated` a las deps de `handle-image.ts`, con la misma firma que en `tools.ts` (recibe la lista, devuelve los mensajes).

Esta rama **no** usa `alertasPendientes`: arma su propio texto y lo manda con `deps.sendMessage`. Así que el aviso se pega a ese mismo mensaje, antes de enviarlo:

```ts
    if (res.ok) {
      // Best-effort: el gasto YA está guardado (mismo criterio que executeTool).
      // La alerta se pega al mismo mensaje, no va como uno aparte: acá no hay
      // acumulador porque esta rama responde por su cuenta.
      let alertas: string[] = [];
      try {
        alertas = await deps.onExpenseCreated({
          categoria: res.category,
          budgetItemIds: res.budgetItemId ? [res.budgetItemId] : [],
        });
      } catch (errAlerta) {
        console.error('handleImage(transfer): onExpenseCreated falló:', errAlerta);
      }
      const base = `✅ Registré ${formatCOP(result.amount)} en ${res.category} (${accountName}). Si algo está mal, edítalo en la app.`;
      await deps.sendMessage(
        ctx.phone,
        alertas.length > 0 ? `${base}\n\n${alertas.join('\n\n')}` : base,
      );
    } else {
```

Cablear la dependencia real en el llamador (el webhook que arma las deps de `handleImage`), con la misma construcción que usa `turn.ts`: `dispararAlertas(alertDepsSupabase(), { userId, monthYear: todayBogota().slice(0,7), budgetItemIds, hoy: hoyBogotaDate() })`.

⚠️ **No inventes un canal nuevo ni mandes un mensaje aparte.** Si la construcción de las deps del webhook te queda duplicada respecto de `turn.ts`, extraé un helper compartido en vez de copiarla — el repo ya sufrió esa duplicación con `hoyBogota`/`todayYmd`.

- [ ] **Step 4: Correr los tests**

```bash
bun run test
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/whatsapp/handle-image.ts src/lib/whatsapp/handle-image.test.ts
git commit --no-verify -m "feat(alertas): la foto de comprobante también dispara alertas"
```

---

## Verificación final

- [ ] `bun run test` — verde, sin bajar de 309
- [ ] `bun run type-check` y `bun run build` — verdes
- [ ] Ningún camino de entrada de gasto quedó sin enganche: `grep -rn "createDirectExpense\|createInvoiceDirect" src/ --include="*.ts" | grep -v test` y confirmar que cada llamador o bien llama a `onExpenseCreated`, o bien está documentado por qué no
- [ ] El `try/catch` best-effort está en los tres call sites, y el comentario que lo explica sigue en cada uno
