# S01 — Blindar funciones que solo existen en remoto · Implementation Plan

> **Alineado con contratos v2 (§5).** Revisado contra §5.0 (test en `src/lib/supabase/migrations/`, grants "solo X" revocan también lo que no toca) y §5.1 (§1.4: `copy_budget_items_from_template` con guard + ambas plantillas de `p_user_id`; `get_previous_month_overspend` solo `service_role`; `get_budget_by_month` con guard, `search_path` fijo, sin `PUBLIC`/`anon`, EXECUTE a `authenticated, service_role`; las otras 4 del grupo B con el cuerpo intacto; `copy_budget_items_from_template`, también del grupo B, es la única que cambia el cuerpo porque no validaba dueño). Sin cambios de fondo respecto a la versión anterior del plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Traer al repo, en la migración `20260930100000_blindar_funciones_remotas.sql`, la definición real de producción de 7 funciones SQL, cerrar la que está abierta a `anon` (`get_previous_month_overspend`), corregir la que no filtra por usuario (`copy_budget_items_from_template`) y poner el guard en `get_budget_by_month`.

**Architecture:** Una sola migración idempotente hecha solo de `CREATE OR REPLACE FUNCTION` (firmas idénticas a producción, así no nacen overloads) más `REVOKE`/`GRANT`, y un bloque comentado de verificación manual. Como no hay Postgres local, la migración se valida con un test de texto en vitest que lee el `.sql` y verifica firmas, guard, `search_path`, grants y que fuera de las funciones solo haya `REVOKE`/`GRANT`. La migración **no se aplica** a producción en esta historia (tarea humana H8).

**Tech Stack:** PostgreSQL (Supabase, plpgsql), vitest 4 (`bun run test`), TypeScript estricto (`bun run type-check`), bun.

## Global Constraints

- Contratos: `docs/agile/contracts.md` (§0, §1.4 y las enmiendas v2 de §5.0/§5.1, que prevalecen) es la fuente de verdad.
- Archivo de migración: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` (timestamp reservado para S01).
- Guard literal de contratos §0:
  ```sql
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;
  ```
- Toda SECURITY DEFINER lleva `SET search_path = public, pg_temp`, `REVOKE EXECUTE … FROM PUBLIC, anon` y `GRANT EXECUTE` solo a quien la llama.
- Migraciones idempotentes (`CREATE OR REPLACE`, sin `DROP`). **Ninguna migración se aplica a producción** durante la implementación. No uses las herramientas MCP de Supabase ni el CLI contra la base remota.
- Ningún test toca una base real. Ningún dato personal (correos, teléfonos, nombres, uuids reales) en SQL, tests ni comentarios: en la verificación manual se usan `<uuid propio>` y uuids inventados (`1111…`, `2222…`).
- Verificación del proyecto: `bun run test && bun run type-check`.
- Commits en español con la línea `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Estos commits incluyen un `.ts` bajo `src/`, así que van **con** el hook (lint-staged formatea el test). Si un commit quedara solo con SQL/docs, usa `git commit --no-verify` (husky puede revertir cambios en commits sin archivos de `src/`).
- Ejecuta los comandos desde la raíz: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && …` (el `cd` del shell está envuelto).
- Las líneas `ERROR: Invalid or corrupt Go version` / `command not found: _encode` que imprime el hook RTK son ruido: juzga por la salida real y el código de salida.

---

## Contexto: lo que hay en producción (leído el 2026-09-30, solo SELECT)

El implementador **no** tiene acceso a la base. Todo lo necesario está aquí.

### Estado de las 7 funciones antes de la migración

| Función (firma) | SECURITY | search_path | EXECUTE para | Llamadores en `src/` |
|---|---|---|---|---|
| `get_previous_month_overspend(uuid, character varying)` | DEFINER | **ninguno** | **PUBLIC, anon, authenticated**, postgres, service_role | ninguno |
| `copy_budget_items_from_template(uuid, uuid, uuid)` | DEFINER | public, pg_temp | postgres, service_role | ninguno (la llaman `upsert_monthly_budget` y `fix_templates_without_items` desde SQL) |
| `fix_templates_without_items(uuid)` | DEFINER | public, pg_temp | postgres, service_role | ninguno |
| `check_cufe_exists(uuid, character varying)` | DEFINER | public, pg_temp | postgres, service_role | ninguno |
| `get_electronic_invoices_by_date_range(uuid, date, date)` | DEFINER | public, pg_temp | postgres, service_role | ninguno |
| `get_invoice_stats_by_supplier(uuid, date, date)` | DEFINER | public, pg_temp | postgres, service_role | ninguno |
| `get_budget_by_month(uuid, character varying)` | INVOKER | ninguno | PUBLIC, anon, authenticated, postgres, service_role | `src/lib/services/budget.ts:81` y `src/scripts/migrate-july-data.ts:1127` (navegador, con sesión, `p_user_id: user.id`) |

Las 5 del grupo B de `20260929000000_asegurar_funciones_security_definer.sql` ya tienen grants y `search_path` correctos en producción; lo que faltaba era su cuerpo en el repo. Funciones de `public` que llaman a alguna de estas 7: solo `upsert_monthly_budget` y `fix_templates_without_items` (ambas llaman `copy_budget_items_from_template`).

Tablas de `public` sin RLS el 2026-09-30: **ninguna** (las 24 tienen `relrowsecurity = true`). El bloque de auditoría debe devolver 0 filas.

### ¿Filtra cada función por el usuario?

1. `get_previous_month_overspend` — **Sí** filtra (`bt.user_id = p_user_id` en el mes anterior y en el actual). El problema es otro: SECURITY DEFINER sin guard, sin `search_path` y ejecutable por `anon`, así que cualquiera con la anon key leía presupuestado y gastado de otra persona pasando su uuid. → guard + `search_path` + solo `service_role` (no tiene llamadores).
2. `copy_budget_items_from_template` — **No** filtra. Copia los rubros de *cualquier* plantilla fuente (`WHERE template_id = p_source_template_id`, sin mirar el dueño) hacia *cualquier* plantilla destino, poniéndoles `user_id = p_user_id`. Hoy solo la ejecutan `service_role` y las llamadas anidadas (que pasan plantillas propias), pero se corrige: guard + verificación de que ambas plantillas son de `p_user_id`.
3. `fix_templates_without_items` — Sí (`bt.user_id` y `bt2.user_id`). Cuerpo sin cambios.
4. `check_cufe_exists` — Sí (`user_id = p_user_id`). Cuerpo sin cambios.
5. `get_electronic_invoices_by_date_range` — Sí (`ei.user_id = p_user_id`); el `EXISTS` sobre `transactions` solo devuelve un booleano de facturas propias. Cuerpo sin cambios.
6. `get_invoice_stats_by_supplier` — Sí (`ei.user_id = p_user_id`). Cuerpo sin cambios.
7. `get_budget_by_month` — INVOKER: RLS ya limita a lo propio. El guard convierte un uid ajeno en error explícito. Sigue siendo INVOKER.

**Guard y llamadas anidadas:** `auth.uid()` y `auth.role()` leen `request.jwt.claims` de la sesión, así que dentro de `upsert_monthly_budget` (que ya tiene guard) la llamada a `copy_budget_items_from_template` ve al mismo usuario y pasa; `fix_templates_without_items` solo la ejecuta `service_role`, que pasa. Una conexión SQL directa sin JWT (SQL editor como `postgres`) ya no puede llamar las funciones con guard: hay que simular el JWT (ver bloque de verificación).

### Definiciones de producción (`pg_get_functiondef`, texto literal)

Diferencias de forma permitidas al copiarlas: CRLF → LF (cuatro funciones venían con `\r\n`), espacios al final de línea eliminados, `SET search_path TO 'public', 'pg_temp'` escrito como `SET search_path = public, pg_temp` (mismo valor). Las firmas (nombres de parámetros, tipos, `DEFAULT` y `RETURNS`) se copian **idénticas**: Postgres rechaza un `CREATE OR REPLACE` que cambie el tipo de retorno o quite un `DEFAULT`, y crea un overload si cambian los tipos de los parámetros.

<details><summary>get_previous_month_overspend</summary>

```sql
CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(item_id uuid, previous_month character varying, budgeted numeric, spent numeric, excess numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_prev character varying;
BEGIN
  v_prev := to_char(
    (to_date(p_month_year, 'YYYY-MM') - interval '1 month'), 'YYYY-MM'
  );

  RETURN QUERY
  WITH anterior AS (
    SELECT
      bi.category_id,
      lower(trim(bi.name)) AS nombre,
      SUM(bi.budgeted_amount) AS presupuestado,
      SUM(
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           JOIN transaction_types tt ON tt.id = t.type_id
           WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
          bi.real_amount
        )
      ) AS gastado
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = v_prev
      AND bt.is_active = true
      AND bi.is_active = true
    GROUP BY bi.category_id, lower(trim(bi.name))
  )
  SELECT
    actual.id,
    v_prev,
    anterior.presupuestado,
    anterior.gastado,
    anterior.gastado - anterior.presupuestado
  FROM budget_items actual
  JOIN budget_templates bt ON bt.id = actual.template_id
  JOIN anterior
    ON anterior.category_id = actual.category_id
   AND anterior.nombre = lower(trim(actual.name))
  WHERE bt.user_id = p_user_id
    AND bt.month_year = p_month_year
    AND bt.is_active = true
    AND actual.is_active = true
    AND anterior.gastado > anterior.presupuestado;
END;
$function$
```
</details>

<details><summary>copy_budget_items_from_template</summary>

```sql
CREATE OR REPLACE FUNCTION public.copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    items_copied INTEGER := 0;
BEGIN
    -- Verificar que el template destino no tenga items ya
    IF EXISTS (
        SELECT 1 FROM budget_items
        WHERE template_id = p_target_template_id
        AND is_active = true
    ) THEN
        RAISE NOTICE 'Template destino ya tiene items, saltando copia';
        RETURN 0;
    END IF;

    -- Copiar items del template fuente al destino
    INSERT INTO budget_items (
        user_id,
        template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        spent_amount,
        real_amount,
        due_date,
        is_active
    )
    SELECT
        p_user_id,
        p_target_template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        0.00 as spent_amount,  -- Resetear gastos
        0.00 as real_amount,   -- Resetear montos reales
        due_date,
        true as is_active
    FROM budget_items
    WHERE template_id = p_source_template_id
    AND is_active = true;

    -- Obtener cantidad de items copiados
    GET DIAGNOSTICS items_copied = ROW_COUNT;

    RAISE NOTICE 'Copiados % items del template % al template %', items_copied, p_source_template_id, p_target_template_id;

    RETURN items_copied;
END;
$function$
```
</details>

<details><summary>fix_templates_without_items</summary>

```sql
CREATE OR REPLACE FUNCTION public.fix_templates_without_items(p_user_id uuid)
 RETURNS TABLE(template_id uuid, month_year character varying, items_copied integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    template_record RECORD;
    previous_template_id UUID;
    items_copied_count INTEGER;
BEGIN
    -- Iterar sobre todos los templates del usuario que no tienen items
    FOR template_record IN
        SELECT bt.id, bt.month_year, bt.name
        FROM budget_templates bt
        LEFT JOIN budget_items bi ON bt.id = bi.template_id AND bi.is_active = true
        WHERE bt.user_id = p_user_id
        AND bt.is_active = true
        AND bi.id IS NULL
        ORDER BY bt.month_year
    LOOP
        -- Buscar el template anterior más reciente
        SELECT bt2.id INTO previous_template_id
        FROM budget_templates bt2
        WHERE bt2.user_id = p_user_id
        AND bt2.month_year < template_record.month_year
        AND bt2.is_active = true
        ORDER BY bt2.month_year DESC
        LIMIT 1;

        -- Si hay template anterior, copiar items
        IF previous_template_id IS NOT NULL THEN
            -- Llamar función de copia
            SELECT copy_budget_items_from_template(
                p_user_id,
                previous_template_id,
                template_record.id
            ) INTO items_copied_count;

            -- Retornar resultado
            template_id := template_record.id;
            month_year := template_record.month_year;
            items_copied := items_copied_count;

            RETURN NEXT;
        END IF;
    END LOOP;

    RETURN;
END;
$function$
```
</details>

<details><summary>check_cufe_exists</summary>

```sql
CREATE OR REPLACE FUNCTION public.check_cufe_exists(p_user_id uuid, p_cufe_code character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM electronic_invoices
    WHERE user_id = p_user_id
    AND cufe_code = p_cufe_code
  );
END;
$function$
```
</details>

<details><summary>get_electronic_invoices_by_date_range</summary>

```sql
CREATE OR REPLACE FUNCTION public.get_electronic_invoices_by_date_range(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, cufe_code character varying, supplier_name character varying, supplier_nit character varying, invoice_date date, total_amount numeric, processed_at timestamp with time zone, has_expenses boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.id,
    ei.cufe_code,
    ei.supplier_name,
    ei.supplier_nit,
    ei.invoice_date,
    ei.total_amount,
    ei.processed_at,
    EXISTS(
      SELECT 1
      FROM transactions t
      WHERE t.electronic_invoice_id = ei.id
    ) as has_expenses
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  ORDER BY ei.invoice_date DESC, ei.created_at DESC;
END;
$function$
```
</details>

<details><summary>get_invoice_stats_by_supplier</summary>

```sql
CREATE OR REPLACE FUNCTION public.get_invoice_stats_by_supplier(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(supplier_name character varying, supplier_nit character varying, invoice_count bigint, total_amount numeric, avg_amount numeric, last_invoice_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.supplier_name,
    ei.supplier_nit,
    COUNT(*) as invoice_count,
    SUM(ei.total_amount) as total_amount,
    AVG(ei.total_amount) as avg_amount,
    MAX(ei.invoice_date) as last_invoice_date
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  GROUP BY ei.supplier_name, ei.supplier_nit
  ORDER BY total_amount DESC;
END;
$function$
```
</details>

<details><summary>get_budget_by_month</summary>

```sql
CREATE OR REPLACE FUNCTION public.get_budget_by_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(template_id uuid, template_name character varying, category_id uuid, category_name character varying, category_color character varying, category_icon character varying, item_id uuid, item_name character varying, item_description text, due_date character varying, classification_name character varying, classification_color character varying, control_name character varying, control_color character varying, budgeted_amount numeric, real_amount numeric, spent_amount numeric, deuda_id uuid, alerts_enabled boolean)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        bt.id, bt.name, c.id, c.name, c.color, c.icon,
        bi.id, bi.name, bi.description, bi.due_date,
        cl.name, cl.color, co.name, co.color,
        bi.budgeted_amount,
        -- Real híbrido: si hay gastos asignados, su suma; si no, el manual
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             JOIN transaction_types tt ON t.type_id = tt.id
             WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
            bi.real_amount
        ) AS real_amount,
        bi.spent_amount,
        bi.deuda_id,
        bi.alerts_enabled
    FROM budget_templates bt
    LEFT JOIN budget_items bi ON bt.id = bi.template_id
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN classifications cl ON bi.classification_id = cl.id
    LEFT JOIN controls co ON bi.control_id = co.id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND (bi.is_active = true OR bi.id IS NULL)
    ORDER BY c.name, bi.name;
END;
$function$
```
</details>

---

## Archivos

- Crear: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` — la migración (se escribe por secciones, una por tarea, siempre agregando al final).
- Crear (test): `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` — test de texto (vitest solo recoge `src/**/*.test.{ts,tsx}`, por eso vive bajo `src/`).
- No se modifica ningún otro archivo. En particular **no** se toca `src/types/*`, ni migraciones anteriores, ni se ejecuta `bun run db:types`.

## Criterios de aceptación

- [ ] La migración `20260930100000_blindar_funciones_remotas.sql` contiene la definición real de producción de `get_previous_month_overspend`, `copy_budget_items_from_template`, `fix_templates_without_items`, `check_cufe_exists`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier` y `get_budget_by_month`, con la misma firma (sin overloads, sin `DROP`).
- [ ] `get_previous_month_overspend` tiene el guard como primera sentencia, `SET search_path = public, pg_temp`, y EXECUTE solo para `service_role` (revocado a `PUBLIC`, `anon` y `authenticated`: no tiene llamadores en `src/`).
- [ ] Toda función que recibe `p_user_id` filtra por él. `copy_budget_items_from_template` no lo hacía: ahora tiene guard y verifica que la plantilla fuente y la destino sean de `p_user_id` antes de copiar; queda documentado en el encabezado de la migración.
- [ ] `check_cufe_exists`, `fix_templates_without_items`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier` quedan con el cuerpo sin cambios, `search_path` fijo y EXECUTE solo para `service_role`.
- [ ] `get_budget_by_month` tiene el guard, sigue siendo INVOKER, `search_path` fijo; EXECUTE revocado a `PUBLIC`/`anon` y concedido a `authenticated`, `service_role`.
- [ ] Bloque comentado de verificación al final: overloads, grants/`search_path` de las 7, tablas `public` con `relrowsecurity = false`, y pruebas manuales del guard con `ROLLBACK`.
- [ ] Test de texto que verifica guard, `search_path`, revokes/grants, que ninguna firma crea un overload nuevo y que fuera de las funciones solo hay `REVOKE`/`GRANT`.
- [ ] `bun run test && bun run type-check` en verde.

---

### Task 1: `get_previous_month_overspend` con guard y solo `service_role`

**Files:**
- Create: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql`
- Create: `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (helpers del test que usan las tareas 2–5, en el mismo archivo): `readMigration(): string`, `codeOnly(sql: string): string`, `functionBlock(sql: string, name: string): string`, `expectSignature(block: string, header: string, returns: string): void`, `expectGuardFirst(block: string): void`, `grantedRoles(code: string, name: string): string[]`, constantes `SEARCH_PATH`, `GUARD_LINES`. En el `.sql`: encabezado + sección 1. Cada tarea siguiente agrega su sección **al final** del `.sql` y su `describe` **al final** del test.

- [ ] **Step 1: Write the failing test**

Crea `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` con este contenido completo:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, it, expect } from 'vitest';

// Test de texto de la migración S01 (no hay Postgres local, contratos §0):
// lee el .sql y verifica firmas, guard, search_path y grants.
const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260930100000_blindar_funciones_remotas.sql',
);

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf8');
}

/** El SQL sin líneas de comentario: lo que Postgres ejecuta. */
function codeOnly(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

const FUNCTION_END = '$function$;';

/** Bloque `CREATE OR REPLACE FUNCTION public.<name>(` … `$function$;` (sin comentarios). */
function functionBlock(sql: string, name: string): string {
  const code = codeOnly(sql);
  const start = code.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  if (start === -1) throw new Error(`Falta CREATE OR REPLACE de ${name}`);
  const end = code.indexOf(FUNCTION_END, start);
  if (end === -1) throw new Error(`${name} no cierra con ${FUNCTION_END}`);
  return code.slice(start, end + FUNCTION_END.length);
}

/**
 * Primera línea (nombre + parámetros) y segunda (RETURNS) idénticas a
 * pg_get_functiondef de producción: así CREATE OR REPLACE reemplaza y no crea
 * un overload.
 */
function expectSignature(block: string, header: string, returns: string) {
  const [first, second] = block.split('\n');
  expect(first).toBe(header);
  expect(second).toBe(returns);
}

const GUARD_LINES = [
  "IF auth.role() IS DISTINCT FROM 'service_role'",
  'AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN',
  "RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';",
];

/** El guard de contratos §0 como primera sentencia después de BEGIN. */
function expectGuardFirst(block: string) {
  for (const line of GUARD_LINES) expect(block).toContain(line);
  expect(block).toMatch(
    /\nBEGIN\n\s*IF auth\.role\(\) IS DISTINCT FROM 'service_role'\n/,
  );
}

const SEARCH_PATH = '\n SET search_path = public, pg_temp\n';

/** Roles que reciben EXECUTE sobre public.<name> en los GRANT de la migración. */
function grantedRoles(code: string, name: string): string[] {
  const re = new RegExp(
    `GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO ([^;]+);`,
    'g',
  );
  return [...code.matchAll(re)]
    .flatMap((m) => m[1].split(','))
    .map((role) => role.trim())
    .sort();
}

describe('get_previous_month_overspend', () => {
  const NAME = 'get_previous_month_overspend';

  it('conserva la firma de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(p_user_id uuid, p_month_year character varying)',
      ' RETURNS TABLE(item_id uuid, previous_month character varying, budgeted numeric, spent numeric, excess numeric)',
    );
  });

  it('es SECURITY DEFINER con search_path fijo', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('\n SECURITY DEFINER\n');
    expect(block).toContain(SEARCH_PATH);
  });

  it('valida al usuario antes de todo', () => {
    expectGuardFirst(functionBlock(readMigration(), NAME));
  });

  it('sigue filtrando por el usuario en el mes anterior y en el actual', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block.match(/WHERE bt\.user_id = p_user_id/g)).toHaveLength(2);
  });

  it('solo service_role la ejecuta (no tiene llamadores en src/)', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon, authenticated;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['service_role']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: FAIL, los 5 tests con `ENOENT: no such file or directory, open '…/supabase/migrations/20260930100000_blindar_funciones_remotas.sql'`.

- [ ] **Step 3: Write minimal implementation**

Crea `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` con este contenido completo:

```sql
-- S01 — Blindar funciones que solo existían en remoto (contratos §1.4).
--
-- Estas 7 funciones viven en producción, pero su definición vigente no estaba
-- en el repo. Los cuerpos se copiaron de pg_get_functiondef en producción el
-- 2026-09-30 (solo lectura). Las firmas (nombres de parámetros, tipos, DEFAULT
-- y RETURNS) son IDÉNTICAS a producción para que CREATE OR REPLACE reemplace y
-- NO cree overloads. Diferencias de forma, sin efecto: CRLF -> LF, espacios al
-- final de línea eliminados y `SET search_path TO 'public', 'pg_temp'` escrito
-- como `SET search_path = public, pg_temp` (mismo valor).
--
-- Estado en producción ANTES de esta migración:
--   get_previous_month_overspend          DEFINER, sin search_path, EXECUTE para
--                                         PUBLIC/anon/authenticated, sin guard  <- abierta
--   copy_budget_items_from_template       DEFINER, search_path fijo, solo service_role
--   fix_templates_without_items           DEFINER, search_path fijo, solo service_role
--   check_cufe_exists                     DEFINER, search_path fijo, solo service_role
--   get_electronic_invoices_by_date_range DEFINER, search_path fijo, solo service_role
--   get_invoice_stats_by_supplier         DEFINER, search_path fijo, solo service_role
--   get_budget_by_month                   INVOKER (RLS), EXECUTE para PUBLIC/anon, sin guard
--
-- ¿Filtra cada una por el usuario?
--   1. get_previous_month_overspend: SÍ (bt.user_id = p_user_id en ambos meses),
--      pero era SECURITY DEFINER abierta a anon: cualquiera con la anon key leía
--      presupuestado/gastado de otra persona pasando su uuid.
--      -> guard + search_path + solo service_role (no tiene llamadores en src/).
--   2. copy_budget_items_from_template: NO. Copiaba los rubros de CUALQUIER
--      plantilla fuente (no verificaba el dueño) hacia cualquier plantilla
--      destino. Solo la ejecutaban service_role y las llamadas anidadas desde
--      upsert_monthly_budget / fix_templates_without_items (que pasan
--      plantillas propias). -> guard + ambas plantillas deben ser de p_user_id.
--   3. fix_templates_without_items: SÍ (bt.user_id / bt2.user_id). Sin cambios.
--   4. check_cufe_exists: SÍ (user_id = p_user_id). Sin cambios.
--   5. get_electronic_invoices_by_date_range: SÍ (ei.user_id). El EXISTS sobre
--      transactions solo da un booleano de facturas propias. Sin cambios.
--   6. get_invoice_stats_by_supplier: SÍ (ei.user_id). Sin cambios.
--   7. get_budget_by_month: INVOKER, RLS ya limita a lo propio; el guard vuelve
--      error explícito la consulta de un uid ajeno. Sigue siendo INVOKER.
--
-- Guard y llamadas anidadas: auth.uid()/auth.role() leen request.jwt.claims de
-- la sesión. Dentro de upsert_monthly_budget (con guard propio) la llamada a
-- copy_budget_items_from_template ve al mismo usuario y pasa;
-- fix_templates_without_items solo la ejecuta service_role, que pasa.
-- OJO: una conexión SQL directa sin JWT (SQL editor / MCP como postgres) ya no
-- puede llamar las funciones con guard tal cual: simular el JWT con
-- set_config('request.jwt.claims', ...) (ver VERIFICACIÓN al final).


-- ============================================================================
-- 1. get_previous_month_overspend: guard + search_path + solo service_role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_previous_month_overspend(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(item_id uuid, previous_month character varying, budgeted numeric, spent numeric, excess numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
  v_prev character varying;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
      RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
  END IF;

  v_prev := to_char(
    (to_date(p_month_year, 'YYYY-MM') - interval '1 month'), 'YYYY-MM'
  );

  RETURN QUERY
  WITH anterior AS (
    SELECT
      bi.category_id,
      lower(trim(bi.name)) AS nombre,
      SUM(bi.budgeted_amount) AS presupuestado,
      SUM(
        COALESCE(
          (SELECT SUM(t.amount)
           FROM transactions t
           JOIN transaction_types tt ON tt.id = t.type_id
           WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
          bi.real_amount
        )
      ) AS gastado
    FROM budget_items bi
    JOIN budget_templates bt ON bt.id = bi.template_id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = v_prev
      AND bt.is_active = true
      AND bi.is_active = true
    GROUP BY bi.category_id, lower(trim(bi.name))
  )
  SELECT
    actual.id,
    v_prev,
    anterior.presupuestado,
    anterior.gastado,
    anterior.gastado - anterior.presupuestado
  FROM budget_items actual
  JOIN budget_templates bt ON bt.id = actual.template_id
  JOIN anterior
    ON anterior.category_id = actual.category_id
   AND anterior.nombre = lower(trim(actual.name))
  WHERE bt.user_id = p_user_id
    AND bt.month_year = p_month_year
    AND bt.is_active = true
    AND actual.is_active = true
    AND anterior.gastado > anterior.presupuestado;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_previous_month_overspend(uuid, character varying) TO service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930100000_blindar_funciones_remotas.sql src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts && git commit -m "$(cat <<'EOF'
fix(seguridad): get_previous_month_overspend con guard y solo service_role

Era SECURITY DEFINER sin search_path y ejecutable por anon: con la anon key
se leía el presupuesto de otra persona. Definición traída de producción.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `copy_budget_items_from_template` filtra por el dueño de las plantillas

**Files:**
- Modify: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` (agregar la sección 2 al final)
- Modify: `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` (agregar el `describe` al final)

**Interfaces:**
- Consumes: helpers de la Task 1 (`readMigration`, `codeOnly`, `functionBlock`, `expectSignature`, `expectGuardFirst`, `grantedRoles`, `SEARCH_PATH`).
- Produces: sección 2 del `.sql`. Firma sin cambios: `copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid) RETURNS integer`, que sigue llamando `upsert_monthly_budget` y `fix_templates_without_items`.

- [ ] **Step 1: Write the failing test**

Agrega al final del archivo de test:

```ts
describe('copy_budget_items_from_template', () => {
  const NAME = 'copy_budget_items_from_template';

  it('conserva la firma de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid)',
      ' RETURNS integer',
    );
  });

  it('es SECURITY DEFINER con search_path fijo', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('\n SECURITY DEFINER\n');
    expect(block).toContain(SEARCH_PATH);
  });

  it('valida al usuario antes de todo', () => {
    expectGuardFirst(functionBlock(readMigration(), NAME));
  });

  it('exige que la plantilla fuente y la destino sean del usuario antes de copiar', () => {
    const block = functionBlock(readMigration(), NAME);
    const source = block.search(
      /bt\.id = p_source_template_id\s+AND bt\.user_id = p_user_id/,
    );
    const target = block.search(
      /bt\.id = p_target_template_id\s+AND bt\.user_id = p_user_id/,
    );
    const insert = block.indexOf('INSERT INTO budget_items');
    expect(source).toBeGreaterThan(-1);
    expect(target).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(-1);
    expect(source).toBeLessThan(insert);
    expect(target).toBeLessThan(insert);
  });

  it('conserva el resto del cuerpo de producción', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('RETURN 0;');
    expect(block).toContain('0.00 as spent_amount,');
    expect(block).toContain('0.00 as real_amount,');
    expect(block).toMatch(
      /FROM budget_items\s+WHERE template_id = p_source_template_id\s+AND is_active = true;/,
    );
    expect(block).toContain('GET DIAGNOSTICS items_copied = ROW_COUNT;');
    expect(block).toContain('RETURN items_copied;');
  });

  it('solo service_role la ejecuta', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['service_role']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: FAIL en los 6 tests nuevos (5 con `Falta CREATE OR REPLACE de copy_budget_items_from_template`, el de grants con `expected [] to deeply equal [ 'service_role' ]` o con el `toContain` del REVOKE); los 5 de la Task 1 siguen en PASS.

- [ ] **Step 3: Write minimal implementation**

Agrega al final de `supabase/migrations/20260930100000_blindar_funciones_remotas.sql`:

```sql


-- ============================================================================
-- 2. copy_budget_items_from_template: guard + ambas plantillas del usuario.
--    El resto del cuerpo es el de producción.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.copy_budget_items_from_template(p_user_id uuid, p_source_template_id uuid, p_target_template_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    items_copied INTEGER := 0;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    -- S01: la plantilla fuente y la destino deben ser de p_user_id
    -- (antes se copiaban rubros de cualquier plantilla).
    IF NOT EXISTS (
        SELECT 1 FROM budget_templates bt
        WHERE bt.id = p_source_template_id
        AND bt.user_id = p_user_id
    ) OR NOT EXISTS (
        SELECT 1 FROM budget_templates bt
        WHERE bt.id = p_target_template_id
        AND bt.user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    -- Verificar que el template destino no tenga items ya
    IF EXISTS (
        SELECT 1 FROM budget_items
        WHERE template_id = p_target_template_id
        AND is_active = true
    ) THEN
        RAISE NOTICE 'Template destino ya tiene items, saltando copia';
        RETURN 0;
    END IF;

    -- Copiar items del template fuente al destino
    INSERT INTO budget_items (
        user_id,
        template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        spent_amount,
        real_amount,
        due_date,
        is_active
    )
    SELECT
        p_user_id,
        p_target_template_id,
        category_id,
        classification_id,
        control_id,
        status_id,
        name,
        description,
        budgeted_amount,
        0.00 as spent_amount,  -- Resetear gastos
        0.00 as real_amount,   -- Resetear montos reales
        due_date,
        true as is_active
    FROM budget_items
    WHERE template_id = p_source_template_id
    AND is_active = true;

    -- Obtener cantidad de items copiados
    GET DIAGNOSTICS items_copied = ROW_COUNT;

    RAISE NOTICE 'Copiados % items del template % al template %', items_copied, p_source_template_id, p_target_template_id;

    RETURN items_copied;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_budget_items_from_template(uuid, uuid, uuid) TO service_role;
```

Nota: las líneas `0.00 as spent_amount,  -- Resetear gastos` tienen un comentario al final pero **no empiezan** con `--`, así que `codeOnly` las conserva y el test las encuentra.

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930100000_blindar_funciones_remotas.sql src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts && git commit -m "$(cat <<'EOF'
fix(seguridad): copy_budget_items_from_template solo copia plantillas del usuario

Copiaba rubros de cualquier plantilla fuente sin verificar el dueño. Ahora
tiene guard y exige que la fuente y la destino sean de p_user_id.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Las cuatro que ya filtraban, al repo sin cambiar el cuerpo

**Files:**
- Modify: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` (agregar la sección 3 al final)
- Modify: `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` (agregar el `describe.each` al final)

**Interfaces:**
- Consumes: helpers de la Task 1.
- Produces: sección 3 del `.sql` con `fix_templates_without_items`, `check_cufe_exists`, `get_electronic_invoices_by_date_range`, `get_invoice_stats_by_supplier`, firmas idénticas a producción.

- [ ] **Step 1: Write the failing test**

Agrega al final del archivo de test:

```ts
const UNCHANGED_FUNCTIONS = [
  {
    name: 'fix_templates_without_items',
    argTypes: 'uuid',
    header:
      'CREATE OR REPLACE FUNCTION public.fix_templates_without_items(p_user_id uuid)',
    returns:
      ' RETURNS TABLE(template_id uuid, month_year character varying, items_copied integer)',
    bodyMarkers: [
      'WHERE bt.user_id = p_user_id',
      'WHERE bt2.user_id = p_user_id',
      'SELECT copy_budget_items_from_template(',
      'RETURN NEXT;',
    ],
  },
  {
    name: 'check_cufe_exists',
    argTypes: 'uuid, character varying',
    header:
      'CREATE OR REPLACE FUNCTION public.check_cufe_exists(p_user_id uuid, p_cufe_code character varying)',
    returns: ' RETURNS boolean',
    bodyMarkers: [
      'FROM electronic_invoices',
      'WHERE user_id = p_user_id',
      'AND cufe_code = p_cufe_code',
    ],
  },
  {
    name: 'get_electronic_invoices_by_date_range',
    argTypes: 'uuid, date, date',
    header:
      'CREATE OR REPLACE FUNCTION public.get_electronic_invoices_by_date_range(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)',
    returns:
      ' RETURNS TABLE(id uuid, cufe_code character varying, supplier_name character varying, supplier_nit character varying, invoice_date date, total_amount numeric, processed_at timestamp with time zone, has_expenses boolean)',
    bodyMarkers: [
      'WHERE ei.user_id = p_user_id',
      'WHERE t.electronic_invoice_id = ei.id',
      'ORDER BY ei.invoice_date DESC, ei.created_at DESC;',
    ],
  },
  {
    name: 'get_invoice_stats_by_supplier',
    argTypes: 'uuid, date, date',
    header:
      'CREATE OR REPLACE FUNCTION public.get_invoice_stats_by_supplier(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)',
    returns:
      ' RETURNS TABLE(supplier_name character varying, supplier_nit character varying, invoice_count bigint, total_amount numeric, avg_amount numeric, last_invoice_date date)',
    bodyMarkers: [
      'WHERE ei.user_id = p_user_id',
      'GROUP BY ei.supplier_name, ei.supplier_nit',
      'ORDER BY total_amount DESC;',
    ],
  },
];

describe.each(UNCHANGED_FUNCTIONS)(
  '$name (ya filtraba: cuerpo sin cambios)',
  ({ name, argTypes, header, returns, bodyMarkers }) => {
    it('conserva la firma de producción (no crea overload)', () => {
      expectSignature(functionBlock(readMigration(), name), header, returns);
    });

    it('es SECURITY DEFINER con search_path fijo', () => {
      const block = functionBlock(readMigration(), name);
      expect(block).toContain('\n SECURITY DEFINER\n');
      expect(block).toContain(SEARCH_PATH);
    });

    it('filtra por el usuario con el cuerpo de producción y sin guard nuevo', () => {
      const block = functionBlock(readMigration(), name);
      for (const marker of bodyMarkers) expect(block).toContain(marker);
      expect(block).not.toContain('auth.uid()');
    });

    it('solo service_role la ejecuta', () => {
      const code = codeOnly(readMigration());
      expect(code).toContain(
        `REVOKE EXECUTE ON FUNCTION public.${name}(${argTypes}) FROM PUBLIC, anon, authenticated;`,
      );
      expect(grantedRoles(code, name)).toEqual(['service_role']);
    });
  },
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: FAIL en los 16 tests nuevos (`Falta CREATE OR REPLACE de fix_templates_without_items`, etc.); los 11 anteriores en PASS.

- [ ] **Step 3: Write minimal implementation**

Agrega al final de `supabase/migrations/20260930100000_blindar_funciones_remotas.sql`:

```sql


-- ============================================================================
-- 3. Ya filtraban por p_user_id: cuerpo de producción SIN cambios, solo se
--    traen al repo. Grants y search_path iguales a los de 20260929000000.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fix_templates_without_items(p_user_id uuid)
 RETURNS TABLE(template_id uuid, month_year character varying, items_copied integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
DECLARE
    template_record RECORD;
    previous_template_id UUID;
    items_copied_count INTEGER;
BEGIN
    -- Iterar sobre todos los templates del usuario que no tienen items
    FOR template_record IN
        SELECT bt.id, bt.month_year, bt.name
        FROM budget_templates bt
        LEFT JOIN budget_items bi ON bt.id = bi.template_id AND bi.is_active = true
        WHERE bt.user_id = p_user_id
        AND bt.is_active = true
        AND bi.id IS NULL
        ORDER BY bt.month_year
    LOOP
        -- Buscar el template anterior más reciente
        SELECT bt2.id INTO previous_template_id
        FROM budget_templates bt2
        WHERE bt2.user_id = p_user_id
        AND bt2.month_year < template_record.month_year
        AND bt2.is_active = true
        ORDER BY bt2.month_year DESC
        LIMIT 1;

        -- Si hay template anterior, copiar items
        IF previous_template_id IS NOT NULL THEN
            -- Llamar función de copia
            SELECT copy_budget_items_from_template(
                p_user_id,
                previous_template_id,
                template_record.id
            ) INTO items_copied_count;

            -- Retornar resultado
            template_id := template_record.id;
            month_year := template_record.month_year;
            items_copied := items_copied_count;

            RETURN NEXT;
        END IF;
    END LOOP;

    RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_cufe_exists(p_user_id uuid, p_cufe_code character varying)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM electronic_invoices
    WHERE user_id = p_user_id
    AND cufe_code = p_cufe_code
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_electronic_invoices_by_date_range(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, cufe_code character varying, supplier_name character varying, supplier_nit character varying, invoice_date date, total_amount numeric, processed_at timestamp with time zone, has_expenses boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.id,
    ei.cufe_code,
    ei.supplier_name,
    ei.supplier_nit,
    ei.invoice_date,
    ei.total_amount,
    ei.processed_at,
    EXISTS(
      SELECT 1
      FROM transactions t
      WHERE t.electronic_invoice_id = ei.id
    ) as has_expenses
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  ORDER BY ei.invoice_date DESC, ei.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_invoice_stats_by_supplier(p_user_id uuid, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date)
 RETURNS TABLE(supplier_name character varying, supplier_nit character varying, invoice_count bigint, total_amount numeric, avg_amount numeric, last_invoice_date date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, pg_temp
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ei.supplier_name,
    ei.supplier_nit,
    COUNT(*) as invoice_count,
    SUM(ei.total_amount) as total_amount,
    AVG(ei.total_amount) as avg_amount,
    MAX(ei.invoice_date) as last_invoice_date
  FROM electronic_invoices ei
  WHERE ei.user_id = p_user_id
    AND (p_start_date IS NULL OR ei.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR ei.invoice_date <= p_end_date)
  GROUP BY ei.supplier_name, ei.supplier_nit
  ORDER BY total_amount DESC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fix_templates_without_items(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_cufe_exists(uuid, character varying) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_electronic_invoices_by_date_range(uuid, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_invoice_stats_by_supplier(uuid, date, date) TO service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930100000_blindar_funciones_remotas.sql src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts && git commit -m "$(cat <<'EOF'
chore(db): traer al repo cuatro funciones remotas que ya filtraban por usuario

fix_templates_without_items, check_cufe_exists,
get_electronic_invoices_by_date_range y get_invoice_stats_by_supplier, con el
cuerpo de producción sin cambios y solo service_role.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `get_budget_by_month` con guard (sigue INVOKER)

**Files:**
- Modify: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` (agregar la sección 4 al final)
- Modify: `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` (agregar el `describe` al final)

**Interfaces:**
- Consumes: helpers de la Task 1. Llamadores que no deben romperse: `src/lib/services/budget.ts:81` y `src/scripts/migrate-july-data.ts:1127` (cliente del navegador con sesión; pasan `p_user_id: user.id`, así que el guard pasa). No se cambia TypeScript.
- Produces: sección 4 del `.sql`. Firma y `RETURNS TABLE` (19 columnas) sin cambios.

- [ ] **Step 1: Write the failing test**

Agrega al final del archivo de test:

```ts
describe('get_budget_by_month', () => {
  const NAME = 'get_budget_by_month';

  it('conserva la firma y el RETURNS TABLE de producción (no crea overload)', () => {
    expectSignature(
      functionBlock(readMigration(), NAME),
      'CREATE OR REPLACE FUNCTION public.get_budget_by_month(p_user_id uuid, p_month_year character varying)',
      ' RETURNS TABLE(template_id uuid, template_name character varying, category_id uuid, category_name character varying, category_color character varying, category_icon character varying, item_id uuid, item_name character varying, item_description text, due_date character varying, classification_name character varying, classification_color character varying, control_name character varying, control_color character varying, budgeted_amount numeric, real_amount numeric, spent_amount numeric, deuda_id uuid, alerts_enabled boolean)',
    );
  });

  it('sigue siendo INVOKER, con search_path fijo', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('\n LANGUAGE plpgsql\n');
    expect(block).not.toContain('SECURITY DEFINER');
    expect(block).toContain(SEARCH_PATH);
  });

  it('valida al usuario antes de todo', () => {
    expectGuardFirst(functionBlock(readMigration(), NAME));
  });

  it('conserva la consulta de producción', () => {
    const block = functionBlock(readMigration(), NAME);
    expect(block).toContain('WHERE bt.user_id = p_user_id');
    expect(block).toContain('AND (bi.is_active = true OR bi.id IS NULL)');
    expect(block).toContain('bi.alerts_enabled');
    expect(block).toContain('ORDER BY c.name, bi.name;');
  });

  it('solo authenticated y service_role la ejecutan', () => {
    const code = codeOnly(readMigration());
    expect(code).toContain(
      'REVOKE EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) FROM PUBLIC, anon;',
    );
    expect(grantedRoles(code, NAME)).toEqual(['authenticated', 'service_role']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: FAIL en los 5 tests nuevos (`Falta CREATE OR REPLACE de get_budget_by_month` y el de grants); los 27 anteriores en PASS.

- [ ] **Step 3: Write minimal implementation**

Agrega al final de `supabase/migrations/20260930100000_blindar_funciones_remotas.sql`:

```sql


-- ============================================================================
-- 4. get_budget_by_month: guard. Sigue INVOKER (RLS sigue aplicando).
--    Llamadores: src/lib/services/budget.ts y src/scripts/migrate-july-data.ts
--    (navegador con sesión, p_user_id = su propio id).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_budget_by_month(p_user_id uuid, p_month_year character varying)
 RETURNS TABLE(template_id uuid, template_name character varying, category_id uuid, category_name character varying, category_color character varying, category_icon character varying, item_id uuid, item_name character varying, item_description text, due_date character varying, classification_name character varying, classification_color character varying, control_name character varying, control_color character varying, budgeted_amount numeric, real_amount numeric, spent_amount numeric, deuda_id uuid, alerts_enabled boolean)
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role'
       AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
        RAISE EXCEPTION 'no autorizado' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        bt.id, bt.name, c.id, c.name, c.color, c.icon,
        bi.id, bi.name, bi.description, bi.due_date,
        cl.name, cl.color, co.name, co.color,
        bi.budgeted_amount,
        -- Real híbrido: si hay gastos asignados, su suma; si no, el manual
        COALESCE(
            (SELECT SUM(t.amount)
             FROM transactions t
             JOIN transaction_types tt ON t.type_id = tt.id
             WHERE t.budget_item_id = bi.id AND tt.name = 'Gasto'),
            bi.real_amount
        ) AS real_amount,
        bi.spent_amount,
        bi.deuda_id,
        bi.alerts_enabled
    FROM budget_templates bt
    LEFT JOIN budget_items bi ON bt.id = bi.template_id
    LEFT JOIN categories c ON bi.category_id = c.id
    LEFT JOIN classifications cl ON bi.classification_id = cl.id
    LEFT JOIN controls co ON bi.control_id = co.id
    WHERE bt.user_id = p_user_id
      AND bt.month_year = p_month_year
      AND bt.is_active = true
      AND (bi.is_active = true OR bi.id IS NULL)
    ORDER BY c.name, bi.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_budget_by_month(uuid, character varying) TO authenticated, service_role;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: PASS, 32 tests.

- [ ] **Step 5: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930100000_blindar_funciones_remotas.sql src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts && git commit -m "$(cat <<'EOF'
fix(seguridad): get_budget_by_month valida al usuario y deja de ser ejecutable por anon

Sigue siendo INVOKER; el guard vuelve error explícito pedir el presupuesto
de otro uid. search_path fijo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Chequeos globales y bloque de verificación manual

**Files:**
- Modify: `supabase/migrations/20260930100000_blindar_funciones_remotas.sql` (agregar el bloque VERIFICACIÓN al final)
- Modify: `src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts` (agregar el `describe` al final)

**Interfaces:**
- Consumes: helpers de la Task 1; las 7 secciones de las tareas 1–4.
- Produces: la migración completa y el test final.

- [ ] **Step 1: Write the failing test**

Agrega al final del archivo de test:

```ts
const ALL_FUNCTIONS = [
  'check_cufe_exists',
  'copy_budget_items_from_template',
  'fix_templates_without_items',
  'get_budget_by_month',
  'get_electronic_invoices_by_date_range',
  'get_invoice_stats_by_supplier',
  'get_previous_month_overspend',
];

describe('migración 20260930100000 completa', () => {
  it('reemplaza exactamente las 7 funciones, sin DROP ni CREATE sin OR REPLACE', () => {
    const code = codeOnly(readMigration());
    const created = [
      ...code.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(/g),
    ]
      .map((m) => m[1])
      .sort();
    expect(created).toEqual(ALL_FUNCTIONS);
    expect(code).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(code).not.toMatch(/\bCREATE\s+FUNCTION\b/i);
  });

  it('fuera de las funciones solo hay REVOKE y GRANT de EXECUTE', () => {
    const sql = readMigration();
    let rest = codeOnly(sql);
    for (const name of ALL_FUNCTIONS) {
      rest = rest.replace(functionBlock(sql, name), '');
    }
    const stray = rest
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .filter(
        (line) => !/^(REVOKE|GRANT) EXECUTE ON FUNCTION public\.\w+\(/.test(line),
      );
    expect(stray).toEqual([]);
  });

  it('ningún GRANT le da EXECUTE a anon ni a PUBLIC', () => {
    const code = codeOnly(readMigration());
    for (const name of ALL_FUNCTIONS) {
      const roles = grantedRoles(code, name);
      expect(roles).not.toContain('anon');
      expect(roles).not.toContain('PUBLIC');
    }
  });

  it('deja comentado el bloque de verificación (overloads, grants y tablas sin RLS)', () => {
    const sql = readMigration();
    expect(sql).toContain('-- VERIFICACIÓN');
    expect(sql).toMatch(/^-- .*HAVING count\(\*\) > 1/m);
    expect(sql).toMatch(/^-- .*aclexplode/m);
    expect(sql).toMatch(/^-- .*c\.relrowsecurity = false/m);
    const code = codeOnly(sql);
    expect(code).not.toContain('aclexplode');
    expect(code).not.toContain('relrowsecurity');
    expect(code).not.toContain('ROLLBACK');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: FAIL solo en `deja comentado el bloque de verificación…` (`expected '…' to contain '-- VERIFICACIÓN'`). Los otros 3 nuevos pasan desde ya (son candados de regresión sobre lo hecho en las tareas 1–4); los 32 anteriores en PASS.

- [ ] **Step 3: Write minimal implementation**

Agrega al final de `supabase/migrations/20260930100000_blindar_funciones_remotas.sql`:

```sql


-- ============================================================================
-- VERIFICACIÓN (correr a mano DESPUÉS de aplicar, en H8; todo con ROLLBACK)
-- Reemplazar <uuid propio> por el id de la cuenta de quien verifica.
-- ============================================================================
--
-- 1) Sin overloads de las 7 (esperado: 0 filas):
-- SELECT proname, count(*) FROM pg_proc
-- WHERE pronamespace = 'public'::regnamespace
--   AND proname IN ('get_previous_month_overspend', 'copy_budget_items_from_template',
--                   'fix_templates_without_items', 'check_cufe_exists',
--                   'get_electronic_invoices_by_date_range', 'get_invoice_stats_by_supplier',
--                   'get_budget_by_month')
-- GROUP BY 1 HAVING count(*) > 1;
--
-- 2) SECURITY, search_path y grants de las 7:
-- SELECT p.oid::regprocedure AS fn, p.prosecdef, p.proconfig,
--        (SELECT string_agg(CASE WHEN g.grantee = 0 THEN 'PUBLIC' ELSE g.grantee::regrole::text END, ',')
--           FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) g
--          WHERE g.privilege_type = 'EXECUTE') AS execute_para
-- FROM pg_proc p
-- WHERE p.pronamespace = 'public'::regnamespace
--   AND p.proname IN ('get_previous_month_overspend', 'copy_budget_items_from_template',
--                     'fix_templates_without_items', 'check_cufe_exists',
--                     'get_electronic_invoices_by_date_range', 'get_invoice_stats_by_supplier',
--                     'get_budget_by_month')
-- ORDER BY 1;
-- -- esperado: get_budget_by_month -> prosecdef = f, execute_para = postgres,authenticated,service_role
-- --           las otras 6         -> prosecdef = t, execute_para = postgres,service_role
-- --           las 7 con proconfig = {"search_path=public, pg_temp"}
--
-- 3) Tablas de public sin RLS (esperado: 0 filas; el 2026-09-30 las 24 tenían RLS):
-- SELECT c.relname
-- FROM pg_class c
-- WHERE c.relnamespace = 'public'::regnamespace
--   AND c.relkind IN ('r', 'p')
--   AND c.relrowsecurity = false
-- ORDER BY 1;
--
-- 4) anon ya no ejecuta get_previous_month_overspend (esperado: ERROR 42501 permission denied):
-- BEGIN;
--   SET LOCAL ROLE anon;
--   SET LOCAL request.jwt.claims = '{"role":"anon"}';
--   SELECT * FROM public.get_previous_month_overspend('00000000-0000-0000-0000-000000000000', '2026-09');
-- ROLLBACK;
--
-- 5) get_budget_by_month con un uid AJENO (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"11111111-1111-1111-1111-111111111111"}';
--   SELECT count(*) FROM public.get_budget_by_month('22222222-2222-2222-2222-222222222222', '2026-09');
-- ROLLBACK;
--
-- 6) get_budget_by_month con SU propio uid (esperado: un número, sin error):
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uuid propio>"}';
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) FROM public.get_budget_by_month('<uuid propio>', to_char(now() AT TIME ZONE 'America/Bogota', 'YYYY-MM'));
-- ROLLBACK;
--
-- 7) copy_budget_items_from_template con plantillas que no son del usuario
--    (esperado: ERROR 42501 'no autorizado'):
-- BEGIN;
--   SET LOCAL ROLE service_role;
--   SET LOCAL request.jwt.claims = '{"role":"service_role"}';
--   SELECT public.copy_budget_items_from_template('<uuid propio>', gen_random_uuid(), gen_random_uuid());
-- ROLLBACK;
--
-- 8) upsert_monthly_budget sigue copiando rubros al crear un mes nuevo
--    (esperado: devuelve un uuid y el conteo es > 0):
-- BEGIN;
--   SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"<uuid propio>"}';
--   SET LOCAL ROLE authenticated;
--   SELECT public.upsert_monthly_budget('<uuid propio>', '2099-01');
--   SELECT count(*) FROM budget_items bi
--     JOIN budget_templates bt ON bt.id = bi.template_id
--    WHERE bt.user_id = '<uuid propio>' AND bt.month_year = '2099-01';
-- ROLLBACK;
--
-- 9) Advisors: get_advisors(security) ya no lista anon_security_definer_function_executable
--    ni function_search_path_mutable para get_previous_month_overspend ni get_budget_by_month.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts`
Expected: PASS, 36 tests.

- [ ] **Step 5: Run the project verification**

Run: `builtin cd /Users/migue/Repos/personal/PresupuestoApp && bun run test && bun run type-check`
Expected: toda la suite de vitest en PASS (los tests existentes más los 36 nuevos) y `tsc --noEmit` sin errores.

- [ ] **Step 6: Commit**

```bash
builtin cd /Users/migue/Repos/personal/PresupuestoApp && git add supabase/migrations/20260930100000_blindar_funciones_remotas.sql src/lib/supabase/migrations/20260930100000_blindar_funciones_remotas.test.ts && git commit -m "$(cat <<'EOF'
test(seguridad): candados globales y verificación manual de la migración S01

Sin overloads ni DROP, fuera de las funciones solo REVOKE/GRANT, ningún
GRANT a anon/PUBLIC, y bloque comentado para H8 (overloads, grants, tablas
sin RLS y pruebas del guard con ROLLBACK).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Autorrevisión

- **Cobertura de criterios:** definiciones reales de las 7 (Tasks 1–4, copiadas arriba de `pg_get_functiondef`); guard + sin `anon`/`PUBLIC` en `get_previous_month_overspend` (Task 1); filtro por usuario corregido y documentado en `copy_budget_items_from_template` (Task 2 + encabezado); cuatro sin cambios (Task 3); guard en `get_budget_by_month` (Task 4); bloque de verificación con tablas sin RLS y grants (Task 5); test de texto de guard, `search_path`, revokes y firmas (Tasks 1–5). Verificación del proyecto en la Task 5, Step 5.
- **Marcadores:** ninguno. `<uuid propio>` solo aparece dentro de comentarios SQL de verificación manual, a propósito (no se ponen uuids reales).
- **Consistencia:** los helpers (`readMigration`, `codeOnly`, `functionBlock`, `expectSignature`, `expectGuardFirst`, `grantedRoles`, `SEARCH_PATH`) se definen en la Task 1 y se usan con esos nombres en las 2–5. Los argumentos de `REVOKE/GRANT` (`uuid, character varying`, `uuid, uuid, uuid`, `uuid`, `uuid, date, date`) coinciden con los de `20260929000000`. Ninguna historia anterior (S01 es la primera).
- **Riesgo conocido y aceptado:** con el guard, una conexión SQL sin JWT (SQL editor como `postgres`) ya no puede llamar `copy_budget_items_from_template`, `get_previous_month_overspend` ni `get_budget_by_month` directamente; la verificación simula el JWT. `upsert_monthly_budget` y `fix_templates_without_items` siguen funcionando porque las llamadas anidadas ven el mismo JWT.
