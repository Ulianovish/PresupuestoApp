# S02 — Vinculación de WhatsApp segura con varios usuarios — Implementation Plan

> **Alineado con contratos v2 (§5).** §5.0: el test de texto de la migración vive en `src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts` (helpers dentro del archivo; lee el `.sql` con `process.cwd()`). §5.1 (§1.5): revincular se decide por `whatsapp_conversations.user_id <> <nuevo>`, límite fail-open, `RedeemResult` con `'link_failed'` (no cuenta como intento; el usuario ve `MSG_CODE_INVALID`) y la migración limpia pendientes vencidos y duplicados antes del índice: el plan ya lo hacía así.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que con varios usuarios un `VINCULAR <código>` nunca pueda canjear el código de otra persona, que adivinar códigos por fuerza bruta quede bloqueado por número, y que un número que cambia de dueño no arrastre la conversación del dueño anterior.

**Architecture:** Una migración (`20260930110000`) agrega un índice único parcial sobre los códigos pendientes y la tabla `whatsapp_link_attempts` (solo service-role). El servicio `src/lib/services/whatsapp-links.ts` genera códigos con limpieza de vencidos propios y reintento ante `23505`, canjea con reloj inyectado, borra la conversación ajena antes de vincular y expone el límite de intentos (5 fallos / 15 min, reloj inyectado). `handleLinkingMessage` consulta el límite antes de canjear y registra solo los fallos por código inexistente o vencido; el webhook le pasa las dos funciones nuevas.

**Tech Stack:** Next.js 15 (route handler), Supabase (Postgres, supabase-js con service-role), TypeScript, vitest 4, bun.

## Global Constraints

- Contratos: `docs/agile/contracts.md` §1.5 y §2.8 (`MSG_TOO_MANY_ATTEMPTS`), con las enmiendas v2 de §5.0/§5.1 (prevalecen). Nombres exactos: índice `whatsapp_link_codes_code_pending_uq`, tabla `whatsapp_link_attempts`, índice `whatsapp_link_attempts_phone_created_idx`.
- Migración: `supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql`, idempotente (`IF NOT EXISTS`, sin `DROP TABLE`/`TRUNCATE`), con bloque comentado de verificación manual al final. **No se aplica a ninguna base** (tarea humana H8). No hay Postgres local: se valida con un test de texto.
- Límite: **5 intentos fallidos por número en 15 minutos**. Intento fallido = `VINCULAR <n>` cuyo código no existe o venció (resultado `invalid_or_expired`). Con el límite alcanzado no se consulta el código y se responde `MSG_TOO_MANY_ATTEMPTS`.
- `MSG_TOO_MANY_ATTEMPTS` = `Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.` (literal, sin emoji).
- **No tocar `MSG_LINKED_OK`** (lo cambia S13).
- Generar código: borrar antes los códigos **vencidos y no usados del propio usuario**; ante `23505` reintentar con otro código, **máximo 5 intentos**, luego error.
- Revincular: si el número pasa de un `user_id` a otro, se borra su fila de `whatsapp_conversations`.
- Reloj inyectado (`now: () => Date`) en la lógica del límite, en la generación y en el canje; ningún assert depende de la hora real.
- Tests: el cliente Supabase siempre mockeado (`vi.mock('@/lib/supabase/server', …)`), ninguno toca una base real. Datos de prueba: teléfono `+573000000000`, ids `user-1`/`otro`. Nunca loguear el número ni el código: solo `error.code`.
- Textos para el usuario en español colombiano con tuteo.
- Verificación: `bun run test <archivo>` por tarea; al final `bun run test && bun run type-check`.
- Commits en español terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Todos los commits van **con** `--no-verify` (regla del orquestador: husky/lint-staged puede descartar cambios); antes de cada commit que toca `src/` se corren `bunx eslint` y `bunx prettier --check` sobre los archivos tocados.
- No se toca `src/lib/actions/whatsapp.ts` (es de S13): `createLinkCode(user.id)` sigue funcionando con la firma nueva porque el segundo parámetro es opcional.

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Crear | `supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql` | Índice único parcial de códigos pendientes (con limpieza previa) y tabla `whatsapp_link_attempts` |
| Crear (test) | `src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts` | Test de texto de la migración |
| Modificar | `src/lib/services/whatsapp-links.ts` | `createLinkCode` con limpieza + reintento; `redeemLinkCode` con reloj, `link_failed` y borrado de conversación ajena; límite de intentos |
| Modificar (test) | `src/lib/services/whatsapp-links.test.ts` | Tests de generación, canje, revinculación y límite |
| Modificar | `src/lib/whatsapp/handle-linking.ts` | Consulta el límite antes de canjear; registra fallos; `MSG_TOO_MANY_ATTEMPTS` |
| Modificar (test) | `src/lib/whatsapp/handle-linking.test.ts` | Tests del flujo con límite |
| Modificar | `src/app/api/whatsapp/webhook/route.ts` | Pasa `reserveLinkAttempt` y `releaseLinkAttempt` al flujo de vinculación (antes `isLinkAttemptLimitReached` y `recordFailedLinkAttempt`; ver «Ronda de corrección 1») |
| Modificar (test) | `src/app/api/whatsapp/webhook/route.test.ts` | Test del cableado para números sin vincular |

## Criterios de aceptación

- [x] Índice único parcial `whatsapp_link_codes_code_pending_uq` sobre `code` con `WHERE used_at IS NULL`; la migración limpia antes los pendientes vencidos y los pendientes repetidos para que el índice se pueda crear.
- [x] `createLinkCode` borra los códigos vencidos y sin usar del propio usuario antes de insertar; ante `23505` reintenta con otro código hasta 5 veces y luego lanza error; cualquier otro error lanza sin reintentar.
- [x] `redeemLinkCode` hace un único UPDATE condicional por `code` (sin usar y vigente según el reloj inyectado); gracias al índice afecta como mucho una fila.
- [x] Tabla `whatsapp_link_attempts` con RLS activo, sin políticas, sin privilegios para `PUBLIC`/`anon`/`authenticated`.
- [x] 5 fallos por número en 15 min → `MSG_TOO_MANY_ATTEMPTS` sin llamar a `redeemLinkCode`. Solo `invalid_or_expired` cuenta como fallo; los errores de base (`link_failed`) no.
- [x] Revincular a otro usuario borra la fila de `whatsapp_conversations` del número (la de otro `user_id`) antes de crear el vínculo; si ese borrado falla, no se vincula.
- [x] Tests unitarios de generación, canje, límite y revinculación con cliente mockeado y reloj inyectado; test de texto de la migración.
- [x] `MSG_LINKED_OK` sin cambios.
- [x] `bun run test && bun run type-check` en verde.

## Notas de diseño (leer antes de empezar)

- **Por qué la revinculación se decide con `whatsapp_conversations.user_id`.** En el webhook, un número ya vinculado nunca entra al flujo de vinculación (sus mensajes van al agente). Un número solo cambia de dueño después de desvincularse (S13 agrega el botón), y en ese momento la fila de `whatsapp_links` del dueño anterior ya no existe. Por eso el borrado es `DELETE FROM whatsapp_conversations WHERE phone_e164 = <n> AND user_id <> <nuevo>`: cubre ese caso y el de un upsert directo, y conserva la conversación si el dueño es el mismo.
- **Por qué el límite deja pasar si la base falla.** El código puede llegar a producción antes de que se aplique la migración (H8). Si `whatsapp_link_attempts` no existe, bloquear dejaría a todos sin poder vincular. Por eso `reserveLinkAttempt` deja pasar ante un error y `releaseLinkAttempt` nunca lanza; ambos loguean solo `error.code`.
- **Ronda de corrección 1 (revisión).** El límite pasó de «contar y luego registrar el fallo» (dos pasos: una ráfaga en paralelo de `VINCULAR` desde el mismo número pasaba el conteo N veces) a **reservar antes de canjear**: `reserveLinkAttempt` purga las filas anteriores a la ventana (en S03 pasó a borrar las de **todos** los números, no solo las del que escribe, para que la tabla no crezca con números que no vuelven), inserta el intento y cuenta la ventana con él incluido; con más de 5 borra su reserva y responde `MSG_TOO_MANY_ATTEMPTS`. Si el canje sale bien o falla por la base (`link_failed`), `handleLinkingMessage` libera la reserva con `releaseLinkAttempt`; con `invalid_or_expired` la fila queda como el fallo. Además, si `redeemLinkCode` falla después de consumir el código (conversación o upsert), lo devuelve a pendiente (best-effort) para que el mismo `VINCULAR` se pueda reintentar. Las secciones de tareas de abajo conservan el diseño original como historia.
- **Por qué `link_failed`.** Antes cualquier error del canje devolvía `invalid_or_expired`. Ahora ese resultado suma un intento fallido al número, así que un error de base (que no es culpa de quien escribe) se separa en `link_failed`. El mensaje al usuario sigue siendo `MSG_CODE_INVALID` en ambos casos.
- **Los intentos bloqueados no se registran.** Así, quien espera 15 minutos vuelve a poder intentar, como dice el mensaje.

---

### Task 1: Migración `20260930110000` y su test de texto

**Files:**
- Create: `supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql`
- Test: `src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts`

**Interfaces:**
- Consumes: tablas existentes `public.whatsapp_link_codes` (columnas `id uuid PK`, `code`, `user_id`, `expires_at`, `used_at`, `created_at`; migraciones `20260611000000` y `20260611000001`).
- Produces: índice `whatsapp_link_codes_code_pending_uq`; tabla `public.whatsapp_link_attempts(id bigserial PK, phone_e164 text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())` que usan las tareas 4 y 5.

- [x] **Step 1: Escribir el test de texto que falla**

Crear `src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ARCHIVO = '20260930110000_whatsapp_vinculacion_segura.sql';
const crudo = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', ARCHIVO),
  'utf8',
);
/** SQL sin comentarios de línea: el bloque de verificación no cuenta como código. */
const sql = crudo.replace(/--[^\n]*/g, '');

describe(`migración ${ARCHIVO}`, () => {
  it('crea el índice único parcial de códigos pendientes', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq\s+ON public\.whatsapp_link_codes \(code\)\s+WHERE used_at IS NULL;/,
    );
  });

  it('limpia vencidos y repetidos ANTES de crear el índice único (si no, CREATE UNIQUE INDEX falla)', () => {
    const vencidos = sql.search(
      /DELETE FROM public\.whatsapp_link_codes\s+WHERE used_at IS NULL\s+AND expires_at <= now\(\);/,
    );
    const repetidos = sql.search(
      /DELETE FROM public\.whatsapp_link_codes c\s+WHERE c\.used_at IS NULL\s+AND EXISTS/,
    );
    const indice = sql.indexOf(
      'CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq',
    );
    expect(vencidos).toBeGreaterThanOrEqual(0);
    expect(repetidos).toBeGreaterThan(vencidos);
    expect(indice).toBeGreaterThan(repetidos);
  });

  it('solo borra códigos SIN usar (los canjeados son el historial de vínculos)', () => {
    const deletes = sql.match(/DELETE FROM[^;]+;/g) ?? [];
    expect(deletes).toHaveLength(2);
    for (const d of deletes) {
      expect(d).toMatch(/used_at IS NULL/);
    }
  });

  it('crea whatsapp_link_attempts con las columnas y el índice del contrato', () => {
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.whatsapp_link_attempts \(\s*id bigserial PRIMARY KEY,\s*phone_e164 text NOT NULL,\s*created_at timestamptz NOT NULL DEFAULT now\(\)\s*\);/,
    );
    expect(sql).toMatch(
      /CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_phone_created_idx\s+ON public\.whatsapp_link_attempts \(phone_e164, created_at DESC\);/,
    );
  });

  it('whatsapp_link_attempts: RLS activo, sin políticas y sin acceso para PUBLIC/anon/authenticated', () => {
    expect(sql).toMatch(
      /ALTER TABLE public\.whatsapp_link_attempts ENABLE ROW LEVEL SECURITY;/,
    );
    expect(sql).not.toMatch(/CREATE POLICY/i);
    expect(sql).toMatch(
      /REVOKE ALL ON public\.whatsapp_link_attempts FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON SEQUENCE public\.whatsapp_link_attempts_id_seq FROM PUBLIC, anon, authenticated;/,
    );
    expect(sql).not.toMatch(/GRANT[^;]*\bTO\b[^;]*\b(anon|authenticated|PUBLIC)\b/i);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, DELETE ON public\.whatsapp_link_attempts TO service_role;/,
    );
    expect(sql).toMatch(
      /GRANT USAGE, SELECT ON SEQUENCE public\.whatsapp_link_attempts_id_seq TO service_role;/,
    );
  });

  it('es idempotente: todo CREATE TABLE/INDEX lleva IF NOT EXISTS y no hay DROP TABLE ni TRUNCATE', () => {
    expect(sql).not.toMatch(
      /CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+(?!\s|IF NOT EXISTS)/i,
    );
    expect(sql).not.toMatch(/\b(DROP\s+TABLE|TRUNCATE)\b/i);
  });

  it('deja un bloque comentado de verificación manual', () => {
    expect(crudo).toMatch(/-- Verificación manual/);
    expect(crudo).toMatch(/-- SELECT code, count\(\*\)/);
  });
});
```

- [x] **Step 2: Correr el test y verificar que falla**

Run: `bun run test src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts`
Expected: FAIL con `ENOENT: no such file or directory, open '…/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql'`.

- [x] **Step 3: Escribir la migración**

Crear `supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql`:

```sql
-- S02 — Vinculación de WhatsApp segura con varios usuarios.
--
-- 1. Códigos pendientes únicos. Con un solo usuario daba igual que dos filas
--    tuvieran el mismo código; con varios, `VINCULAR 123456` podría canjear el
--    código de otra persona. El índice único parcial garantiza que entre los
--    códigos sin usar no haya repetidos: el canje (UPDATE … WHERE code = …
--    AND used_at IS NULL) afecta como mucho una fila, y la app reintenta con
--    otro código si el INSERT choca (23505).
-- 2. Intentos fallidos de vinculación por número (whatsapp_link_attempts):
--    5 fallos en 15 minutos bloquean el número (adivinar un código de 6
--    dígitos). Solo el webhook (service-role) la toca.
--
-- Idempotente. NO se aplica a producción durante la implementación (H8).

-- 1a. Limpieza previa para que el índice único se pueda crear.
--     Códigos vencidos y sin usar: ya no sirven para nada.
DELETE FROM public.whatsapp_link_codes
WHERE used_at IS NULL
  AND expires_at <= now();

--     Si aún quedaran códigos vigentes repetidos, se conserva solo el más
--     nuevo de cada uno (quien tenía el más viejo genera otro en Ajustes).
DELETE FROM public.whatsapp_link_codes c
WHERE c.used_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.whatsapp_link_codes d
    WHERE d.code = c.code
      AND d.used_at IS NULL
      AND (d.created_at, d.id) > (c.created_at, c.id)
  );

-- 1b. Un código pendiente no se repite.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_link_codes_code_pending_uq
  ON public.whatsapp_link_codes (code)
  WHERE used_at IS NULL;

-- 2. Intentos fallidos de VINCULAR por número.
CREATE TABLE IF NOT EXISTS public.whatsapp_link_attempts (
  id bigserial PRIMARY KEY,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_link_attempts_phone_created_idx
  ON public.whatsapp_link_attempts (phone_e164, created_at DESC);

-- RLS activo SIN políticas: nadie salvo service_role/postgres entra.
ALTER TABLE public.whatsapp_link_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_link_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.whatsapp_link_attempts_id_seq FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, DELETE ON public.whatsapp_link_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.whatsapp_link_attempts_id_seq TO service_role;

-- ============================================================================
-- Verificación manual (después de aplicar, H8; todo de solo lectura)
-- ============================================================================
-- Índices creados:
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename IN ('whatsapp_link_codes', 'whatsapp_link_attempts');
--
-- RLS activo en la tabla de intentos (espera true):
-- SELECT relrowsecurity FROM pg_class
--  WHERE oid = 'public.whatsapp_link_attempts'::regclass;
--
-- Sin políticas (espera 0 filas):
-- SELECT policyname FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'whatsapp_link_attempts';
--
-- Privilegios (espera solo postgres y service_role):
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema = 'public' AND table_name = 'whatsapp_link_attempts';
--
-- Ningún código pendiente repetido (espera 0 filas):
-- SELECT code, count(*) FROM public.whatsapp_link_codes
--  WHERE used_at IS NULL GROUP BY code HAVING count(*) > 1;
```

- [x] **Step 4: Correr el test y verificar que pasa**

Run: `bun run test src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add supabase/migrations/20260930110000_whatsapp_vinculacion_segura.sql src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts
git commit -m "$(cat <<'EOF'
feat(whatsapp): códigos de vinculación pendientes únicos y tabla de intentos fallidos

Migración 20260930110000 (sin aplicar, H8): índice único parcial sobre los
códigos sin usar, con limpieza previa de vencidos y repetidos, y la tabla
whatsapp_link_attempts solo para service-role. Test de texto de la migración.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `createLinkCode` con limpieza de vencidos propios y reintento ante `23505`

**Files:**
- Modify: `src/lib/services/whatsapp-links.ts:10-31`
- Test: `src/lib/services/whatsapp-links.test.ts`

**Interfaces:**
- Consumes: índice `whatsapp_link_codes_code_pending_uq` (Task 1) que hace que un INSERT repetido devuelva `error.code === '23505'`.
- Produces:
  - `export const MAX_CODE_ATTEMPTS = 5`
  - `export interface CreateLinkCodeOptions { now?: () => Date; generateCode?: () => string }`
  - `export async function createLinkCode(userId: string, options?: CreateLinkCodeOptions): Promise<string>`
  - En el test: constantes `NOW`, `NOW_ISO`, `now`, `TEL` que usan las tareas 3 y 4.

- [x] **Step 1: Escribir los tests que fallan**

En `src/lib/services/whatsapp-links.test.ts`:

1. Reemplazar el bloque de import de `./whatsapp-links` (líneas 9-14) por:

```ts
import {
  createLinkCode,
  generateSixDigitCode,
  getLinkByPhone,
  listarDocumentosDeUsuario,
  MAX_CODE_ATTEMPTS,
  redeemLinkCode,
} from './whatsapp-links';
```

2. Justo debajo de `const mockedAdmin = createAdminClient as unknown as ReturnType<typeof vi.fn>;` agregar:

```ts
const NOW = new Date('2026-09-30T12:00:00.000Z');
const NOW_ISO = '2026-09-30T12:00:00.000Z';
const now = () => NOW;
const TEL = '+573000000000';
```

3. Justo después del cierre de `describe('generateSixDigitCode', …)` (antes del comentario `/** Tabla whatsapp_links: lectura del vínculo previo + upsert. */`) agregar:

```ts
/** Tabla whatsapp_link_codes para createLinkCode: limpieza (delete) + inserts. */
function tablaCodigosNuevos(
  inserts: Array<{ error: unknown }>,
  limpieza: { error: unknown } = { error: null },
) {
  const insert = vi.fn();
  for (const r of inserts) insert.mockResolvedValueOnce(r);
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue(limpieza),
    insert,
  };
}

const CHOQUE = {
  error: {
    code: '23505',
    message: 'duplicate key value violates unique constraint',
  },
};

describe('createLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('antes de insertar borra los códigos vencidos y sin usar del propio usuario', async () => {
    const tabla = tablaCodigosNuevos([{ error: null }]);
    const from = vi.fn(() => tabla);
    mockedAdmin.mockReturnValue({ from });

    await createLinkCode('user-1', { now, generateCode: () => '111111' });

    expect(from).toHaveBeenCalledWith('whatsapp_link_codes');
    expect(tabla.delete).toHaveBeenCalled();
    expect(tabla.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(tabla.is).toHaveBeenCalledWith('used_at', null);
    expect(tabla.lte).toHaveBeenCalledWith('expires_at', NOW_ISO);
    expect(tabla.delete.mock.invocationCallOrder[0]).toBeLessThan(
      tabla.insert.mock.invocationCallOrder[0],
    );
  });

  it('inserta el código con vencimiento a 10 minutos del reloj inyectado', async () => {
    const tabla = tablaCodigosNuevos([{ error: null }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    const code = await createLinkCode('user-1', {
      now,
      generateCode: () => '111111',
    });

    expect(code).toBe('111111');
    expect(tabla.insert).toHaveBeenCalledWith({
      code: '111111',
      user_id: 'user-1',
      expires_at: '2026-09-30T12:10:00.000Z',
    });
  });

  it('si el código choca con otro pendiente (23505) reintenta con uno nuevo', async () => {
    const tabla = tablaCodigosNuevos([CHOQUE, { error: null }]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });
    const generateCode = vi
      .fn()
      .mockReturnValueOnce('111111')
      .mockReturnValueOnce('222222');

    const code = await createLinkCode('user-1', { now, generateCode });

    expect(code).toBe('222222');
    expect(tabla.insert).toHaveBeenCalledTimes(2);
    expect(tabla.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: '222222' }),
    );
  });

  it('tras 5 choques seguidos lanza error', async () => {
    expect(MAX_CODE_ATTEMPTS).toBe(5);
    const tabla = tablaCodigosNuevos([CHOQUE, CHOQUE, CHOQUE, CHOQUE, CHOQUE]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    await expect(
      createLinkCode('user-1', { now, generateCode: () => '111111' }),
    ).rejects.toThrow('No se pudo crear el código');
    expect(tabla.insert).toHaveBeenCalledTimes(5);
  });

  it('un error que no es de código repetido lanza sin reintentar', async () => {
    const tabla = tablaCodigosNuevos([
      { error: { code: '42501', message: 'permission denied' } },
    ]);
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    await expect(
      createLinkCode('user-1', { now, generateCode: () => '111111' }),
    ).rejects.toThrow('No se pudo crear el código');
    expect(tabla.insert).toHaveBeenCalledTimes(1);
  });

  it('si la limpieza falla igual crea el código y loguea solo el código de error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tabla = tablaCodigosNuevos([{ error: null }], {
      error: { code: 'XX000', message: 'boom' },
    });
    mockedAdmin.mockReturnValue({ from: vi.fn(() => tabla) });

    const code = await createLinkCode('user-1', {
      now,
      generateCode: () => '111111',
    });

    expect(code).toBe('111111');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('createLinkCode'),
      'XX000',
    );
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: FAIL en `describe('createLinkCode')` (p. ej. `expected "spy" to be called at least once` para `tabla.delete`, y `expected undefined to be 5` para `MAX_CODE_ATTEMPTS`). Los tests de `redeemLinkCode`, `getLinkByPhone` y `listarDocumentosDeUsuario` siguen pasando.

- [x] **Step 3: Implementar**

En `src/lib/services/whatsapp-links.ts`, reemplazar desde `const CODE_TTL_MINUTES = 10;` (línea 10) hasta el cierre de `createLinkCode` (línea 31) por:

```ts
const CODE_TTL_MINUTES = 10;

/** Intentos de INSERT cuando el código choca con otro pendiente (23505). */
export const MAX_CODE_ATTEMPTS = 5;

/** Código aleatorio de 6 dígitos (con ceros a la izquierda). */
export function generateSixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export interface CreateLinkCodeOptions {
  /** Reloj inyectable (tests). */
  now?: () => Date;
  /** Generador inyectable (tests). */
  generateCode?: () => string;
}

/**
 * Crea un código de vinculación para el usuario y lo persiste. Devuelve el código.
 *
 * Con varios usuarios, dos códigos pendientes iguales harían que `VINCULAR n`
 * canjeara el de otra persona: el índice único parcial
 * `whatsapp_link_codes_code_pending_uq` lo impide y aquí, si el INSERT choca
 * (23505), se prueba con otro código (máximo MAX_CODE_ATTEMPTS). Antes se
 * borran los códigos vencidos y sin usar del propio usuario: ya no sirven y
 * ocupan lugar en el índice.
 */
export async function createLinkCode(
  userId: string,
  options: CreateLinkCodeOptions = {},
): Promise<string> {
  const now = options.now ?? (() => new Date());
  const generateCode = options.generateCode ?? generateSixDigitCode;
  const supabase = createAdminClient();
  const ahora = now();

  const { error: limpiezaError } = await supabase
    .from('whatsapp_link_codes')
    .delete()
    .eq('user_id', userId)
    .is('used_at', null)
    .lte('expires_at', ahora.toISOString());
  if (limpiezaError) {
    // No bloquea: un código vencido de más no impide crear uno nuevo.
    console.error(
      'createLinkCode: no se pudieron limpiar códigos vencidos:',
      limpiezaError.code,
    );
  }

  const expiresAt = new Date(
    ahora.getTime() + CODE_TTL_MINUTES * 60_000,
  ).toISOString();

  for (let intento = 1; intento <= MAX_CODE_ATTEMPTS; intento++) {
    const code = generateCode();
    const { error } = await supabase
      .from('whatsapp_link_codes')
      .insert({ code, user_id: userId, expires_at: expiresAt });
    if (!error) {
      return code;
    }
    if (error.code !== '23505') {
      throw new Error(`No se pudo crear el código: ${error.message}`);
    }
  }
  throw new Error(
    `No se pudo crear el código: ${MAX_CODE_ATTEMPTS} choques seguidos con otros códigos pendientes`,
  );
}
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: PASS (todos, incluidos los 6 nuevos de `createLinkCode`).

Run: `bun run type-check`
Expected: sin errores (`src/lib/actions/whatsapp.ts` sigue llamando `createLinkCode(user.id)`).

- [x] **Step 5: Commit**

```bash
git add src/lib/services/whatsapp-links.ts src/lib/services/whatsapp-links.test.ts
git commit -m "$(cat <<'EOF'
feat(whatsapp): generar código de vinculación limpia vencidos y reintenta si choca

createLinkCode borra los códigos vencidos y sin usar del propio usuario antes
de insertar y, si el código ya está pendiente para otra persona (23505),
prueba con otro hasta 5 veces. Reloj y generador inyectables.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `redeemLinkCode` con reloj inyectado, `link_failed` y borrado de la conversación ajena

**Files:**
- Modify: `src/lib/services/whatsapp-links.ts` (tipo `RedeemResult` y función `redeemLinkCode`)
- Test: `src/lib/services/whatsapp-links.test.ts`

**Interfaces:**
- Consumes: constantes de test `NOW`, `NOW_ISO`, `now`, `TEL` (Task 2).
- Produces:
  - `export type RedeemResult = { ok: true; userId: string } | { ok: false; reason: 'invalid_or_expired' | 'link_failed' }`
  - `export async function redeemLinkCode(code: string, phoneE164: string, now?: () => Date): Promise<RedeemResult>`
  - Solo `reason: 'invalid_or_expired'` significa "código inexistente, usado o vencido" (lo usa Task 5 para contar fallos).

- [x] **Step 1: Escribir los tests que fallan**

En `src/lib/services/whatsapp-links.test.ts`, reemplazar todo lo que va desde el comentario `/** Tabla whatsapp_links: lectura del vínculo previo + upsert. */` hasta el cierre de `describe('redeemLinkCode', …)` (justo antes de `describe('getLinkByPhone', …)`) por:

```ts
/** Tabla whatsapp_links: lectura del vínculo previo + upsert. */
function tablaLinks(
  previo: { data: unknown; error: unknown },
  upsertResult: { error: unknown } = { error: null },
) {
  return {
    upsert: vi.fn().mockResolvedValue(upsertResult),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(previo),
  };
}

/** Tabla whatsapp_link_codes para el canje: update().eq().is().gt().select(). */
function tablaCanje(resultado: { data: unknown; error: unknown }) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(resultado),
  };
}

function codigoValido(userId = 'user-1') {
  return tablaCanje({ data: [{ user_id: userId }], error: null });
}

/** Tabla whatsapp_conversations: delete().eq().neq(). */
function tablaConversaciones(resultado: { error: unknown } = { error: null }) {
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockResolvedValue(resultado),
  };
}

/** Cliente con solo las tablas dadas; pedir cualquier otra hace fallar el test. */
function clienteCanje(tablas: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    if (table in tablas) return tablas[table];
    throw new Error(`tabla inesperada ${table}`);
  });
  mockedAdmin.mockReturnValue({ from });
  return from;
}

describe('redeemLinkCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('canjea con UPDATE atómico condicional según el reloj inyectado y devuelve userId', async () => {
    const codigos = codigoValido();
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigos,
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: true, userId: 'user-1' });
    // Un solo statement: marca usado SOLO si está sin usar y vigente.
    expect(codigos.update).toHaveBeenCalledWith({ used_at: NOW_ISO });
    expect(codigos.eq).toHaveBeenCalledWith('code', '482913');
    expect(codigos.is).toHaveBeenCalledWith('used_at', null);
    expect(codigos.gt).toHaveBeenCalledWith('expires_at', NOW_ISO);
    // Número nuevo: el documento arranca vacío.
    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1', documento: null },
      { onConflict: 'phone_e164' },
    );
  });

  it('re-vincular el número a OTRO usuario borra el documento del dueño anterior', async () => {
    const links = tablaLinks({ data: { user_id: 'otro' }, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1', documento: null },
      { onConflict: 'phone_e164' },
    );
  });

  it('re-vincular al MISMO usuario conserva el documento', async () => {
    const links = tablaLinks({ data: { user_id: 'user-1' }, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      { phone_e164: TEL, user_id: 'user-1' },
      { onConflict: 'phone_e164' },
    );
  });

  it('si no se puede leer el vínculo previo, borra el documento (ante la duda, no se hereda)', async () => {
    const links = tablaLinks({ data: null, error: { message: 'boom' } });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    await redeemLinkCode('482913', TEL, now);

    expect(links.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ documento: null }),
      { onConflict: 'phone_e164' },
    );
  });

  it('borra la conversación del número que era de OTRO usuario, antes de vincular', async () => {
    const conversaciones = tablaConversaciones();
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: conversaciones,
    });

    await redeemLinkCode('482913', TEL, now);

    expect(conversaciones.delete).toHaveBeenCalled();
    expect(conversaciones.eq).toHaveBeenCalledWith('phone_e164', TEL);
    // Solo la de otro dueño: si el dueño es el mismo, la conversación sigue.
    expect(conversaciones.neq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(conversaciones.delete.mock.invocationCallOrder[0]).toBeLessThan(
      links.upsert.mock.invocationCallOrder[0],
    );
  });

  it('si no se puede borrar la conversación ajena, no vincula (link_failed) y no loguea el número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const links = tablaLinks({ data: null, error: null });
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones({
        error: { code: 'XX000', message: 'boom' },
      }),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
    expect(links.upsert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('redeemLinkCode'),
      'XX000',
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(TEL);
    errorSpy.mockRestore();
  });

  it('rechaza un código inexistente/vencido (UPDATE sin filas) sin tocar vínculos ni conversaciones', async () => {
    clienteCanje({
      whatsapp_link_codes: tablaCanje({ data: [], error: null }),
    });

    const res = await redeemLinkCode('000000', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'invalid_or_expired' });
  });

  it('un error de base en el UPDATE es link_failed (no es culpa del número)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    clienteCanje({
      whatsapp_link_codes: tablaCanje({
        data: null,
        error: { code: '57014', message: 'canceling statement due to timeout' },
      }),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('482913');
    errorSpy.mockRestore();
  });

  it('si el upsert del vínculo falla devuelve link_failed', async () => {
    const links = tablaLinks(
      { data: null, error: null },
      { error: { code: 'XX000', message: 'boom' } },
    );
    clienteCanje({
      whatsapp_link_codes: codigoValido(),
      whatsapp_links: links,
      whatsapp_conversations: tablaConversaciones(),
    });

    const res = await redeemLinkCode('482913', TEL, now);

    expect(res).toEqual({ ok: false, reason: 'link_failed' });
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: FAIL en `redeemLinkCode`: el primer test (`update` llamado con la hora real, no con `NOW_ISO`), los de conversación (`expected "spy" to be called`), y los de `link_failed` (devuelve `invalid_or_expired`).

- [x] **Step 3: Implementar**

En `src/lib/services/whatsapp-links.ts`, reemplazar desde `export type RedeemResult =` hasta el cierre de `redeemLinkCode` (la llave que sigue a `return { ok: true, userId };`) por:

```ts
export type RedeemResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' | 'link_failed' };

/**
 * Canjea un código y vincula el número.
 *
 * - `invalid_or_expired`: el código no existe, ya se usó o venció. Es lo único
 *   que cuenta como intento fallido para el límite por número.
 * - `link_failed`: falló la base (el UPDATE, borrar la conversación ajena o el
 *   upsert). No es culpa de quien escribe, así que no suma al límite.
 *
 * El canje es un UPDATE condicional (sin usar y vigente) en un único
 * statement: un código se canjea una sola vez aunque lleguen dos peticiones a
 * la vez, y el índice único parcial de códigos pendientes garantiza que afecte
 * como mucho una fila. El upsert por `phone_e164` mueve el número de
 * presupuesto al re-vincular.
 *
 * Si el número tenía conversación con OTRO usuario, esa fila se borra ANTES de
 * vincular: trae turnos y pendientes del dueño anterior que el agente leería
 * como propios. Si no se puede borrar, no se vincula.
 */
export async function redeemLinkCode(
  code: string,
  phoneE164: string,
  now: () => Date = () => new Date(),
): Promise<RedeemResult> {
  const supabase = createAdminClient();
  const nowIso = now().toISOString();

  const { data: rows, error } = await supabase
    .from('whatsapp_link_codes')
    .update({ used_at: nowIso })
    .eq('code', code)
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('user_id');
  if (error) {
    console.error('redeemLinkCode: error canjeando el código:', error.code);
    return { ok: false, reason: 'link_failed' };
  }

  const row = rows?.[0];
  if (!row) {
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const userId = (row as { user_id: string }).user_id;

  // El documento (cédula/NIT para la DIAN) es de la persona del número en SU
  // presupuesto: si el número pasa a otro usuario, no se hereda el del dueño
  // anterior. Solo se conserva si se sabe que el dueño es el mismo; ante la
  // duda (número nuevo o lectura fallida) arranca vacío.
  const { data: previo } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();
  const mismoDueno = (previo as { user_id: string } | null)?.user_id === userId;

  // La conversación se decide por SU user_id y no por el vínculo previo: un
  // número vinculado no llega a este flujo, así que cambia de dueño después de
  // desvincularse, cuando la fila de whatsapp_links del anterior ya no existe.
  const { error: conversacionError } = await supabase
    .from('whatsapp_conversations')
    .delete()
    .eq('phone_e164', phoneE164)
    .neq('user_id', userId);
  if (conversacionError) {
    console.error(
      'redeemLinkCode: no se pudo borrar la conversación del dueño anterior:',
      conversacionError.code,
    );
    return { ok: false, reason: 'link_failed' };
  }

  const { error: upsertError } = await supabase.from('whatsapp_links').upsert(
    {
      phone_e164: phoneE164,
      user_id: userId,
      ...(!mismoDueno && { documento: null }),
    },
    { onConflict: 'phone_e164' },
  );
  if (upsertError) {
    // El código ya quedó consumido; reportamos fallo para que el usuario
    // reintente con uno nuevo en vez de creer que quedó vinculado.
    console.error(
      'redeemLinkCode: no se pudo guardar el vínculo:',
      upsertError.code,
    );
    return { ok: false, reason: 'link_failed' };
  }

  return { ok: true, userId };
}
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts src/lib/whatsapp/handle-linking.test.ts`
Expected: PASS (el test de `handle-linking` "VINCULAR con código inválido" sigue pasando porque `link_failed` y `invalid_or_expired` responden el mismo mensaje).

Run: `bun run type-check`
Expected: sin errores.

- [x] **Step 5: Commit**

```bash
git add src/lib/services/whatsapp-links.ts src/lib/services/whatsapp-links.test.ts
git commit -m "$(cat <<'EOF'
fix(whatsapp): un número que cambia de dueño no arrastra la conversación anterior

redeemLinkCode borra la fila de whatsapp_conversations del número si era de
otro usuario antes de vincularlo (si no puede, no vincula). Los errores de
base se reportan como link_failed para no contarlos como intentos fallidos.
Reloj inyectable en el canje.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Límite de intentos fallidos por número en el servicio

> **Reemplazada en la ronda de corrección 1.** `isLinkAttemptLimitReached` y `recordFailedLinkAttempt` ya no existen: se reemplazaron por `reserveLinkAttempt` (reserva el intento antes de canjear, cuenta la ventana con él incluido y rechaza con más de 5) y `releaseLinkAttempt` (borra la reserva si el canje salió bien o falló por la base). El texto de abajo conserva el diseño original como historia; ver «Notas de diseño → Ronda de corrección 1».

**Files:**
- Modify: `src/lib/services/whatsapp-links.ts` (comentario de cabecera y funciones nuevas al final)
- Test: `src/lib/services/whatsapp-links.test.ts`

**Interfaces:**
- Consumes: tabla `whatsapp_link_attempts` (Task 1); constantes de test `NOW`, `NOW_ISO`, `now`, `TEL` (Task 2).
- Produces:
  - `export const LINK_MAX_FAILED_ATTEMPTS = 5`
  - `export const LINK_ATTEMPTS_WINDOW_MINUTES = 15`
  - `export function linkAttemptsWindowStart(now: Date): string`
  - `export function isOverLinkAttemptLimit(failedAttempts: number): boolean`
  - `export async function isLinkAttemptLimitReached(phoneE164: string, now?: () => Date): Promise<boolean>` — nunca lanza; ante error devuelve `false`.
  - `export async function recordFailedLinkAttempt(phoneE164: string, now?: () => Date): Promise<void>` — nunca lanza.

- [x] **Step 1: Escribir los tests que fallan**

En `src/lib/services/whatsapp-links.test.ts`:

1. Reemplazar el bloque de import de `./whatsapp-links` por:

```ts
import {
  createLinkCode,
  generateSixDigitCode,
  getLinkByPhone,
  isLinkAttemptLimitReached,
  isOverLinkAttemptLimit,
  LINK_ATTEMPTS_WINDOW_MINUTES,
  LINK_MAX_FAILED_ATTEMPTS,
  linkAttemptsWindowStart,
  listarDocumentosDeUsuario,
  MAX_CODE_ATTEMPTS,
  recordFailedLinkAttempt,
  redeemLinkCode,
} from './whatsapp-links';
```

2. Agregar al final del archivo:

```ts
describe('límite de intentos de vinculación (lógica pura)', () => {
  it('la ventana empieza 15 minutos antes de ahora', () => {
    expect(LINK_ATTEMPTS_WINDOW_MINUTES).toBe(15);
    expect(linkAttemptsWindowStart(NOW)).toBe('2026-09-30T11:45:00.000Z');
  });

  it('con 4 fallos todavía se puede intentar; con 5 ya no', () => {
    expect(LINK_MAX_FAILED_ATTEMPTS).toBe(5);
    expect(isOverLinkAttemptLimit(0)).toBe(false);
    expect(isOverLinkAttemptLimit(4)).toBe(false);
    expect(isOverLinkAttemptLimit(5)).toBe(true);
    expect(isOverLinkAttemptLimit(9)).toBe(true);
  });
});

/** Tabla whatsapp_link_attempts: conteo select().eq().gte() + insert. */
function tablaIntentos(
  conteo: { count: number | null; error: unknown },
  insertResult: { error: unknown } = { error: null },
) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(conteo),
    insert: vi.fn().mockResolvedValue(insertResult),
  };
}

describe('isLinkAttemptLimitReached', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cuenta los fallos del número desde hace 15 minutos (reloj inyectado)', async () => {
    const tabla = tablaIntentos({ count: 5, error: null });
    const from = vi.fn(() => tabla);
    mockedAdmin.mockReturnValue({ from });

    expect(await isLinkAttemptLimitReached(TEL, now)).toBe(true);
    expect(from).toHaveBeenCalledWith('whatsapp_link_attempts');
    expect(tabla.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(tabla.eq).toHaveBeenCalledWith('phone_e164', TEL);
    expect(tabla.gte).toHaveBeenCalledWith(
      'created_at',
      '2026-09-30T11:45:00.000Z',
    );
  });

  it('con 4 fallos en la ventana no bloquea', async () => {
    mockedAdmin.mockReturnValue({
      from: vi.fn(() => tablaIntentos({ count: 4, error: null })),
    });

    expect(await isLinkAttemptLimitReached(TEL, now)).toBe(false);
  });

  it('sin conteo (null) no bloquea', async () => {
    mockedAdmin.mockReturnValue({
      from: vi.fn(() => tablaIntentos({ count: null, error: null })),
    });

    expect(await isLinkAttemptLimitReached(TEL, now)).toBe(false);
  });

  it('si la consulta falla (p. ej. la migración sin aplicar) no bloquea y no loguea el número', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockReturnValue({
      from: vi.fn(() =>
        tablaIntentos({
          count: null,
          error: {
            code: '42P01',
            message: 'relation "whatsapp_link_attempts" does not exist',
          },
        }),
      ),
    });

    expect(await isLinkAttemptLimitReached(TEL, now)).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('isLinkAttemptLimitReached'),
      '42P01',
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(TEL);
    errorSpy.mockRestore();
  });

  it('si el cliente lanza, no bloquea', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockImplementationOnce(() => {
      throw new Error('sin variables de entorno');
    });

    expect(await isLinkAttemptLimitReached(TEL, now)).toBe(false);
    errorSpy.mockRestore();
  });
});

describe('recordFailedLinkAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserta el intento del número con la hora del reloj inyectado', async () => {
    const tabla = tablaIntentos({ count: 0, error: null });
    const from = vi.fn(() => tabla);
    mockedAdmin.mockReturnValue({ from });

    await recordFailedLinkAttempt(TEL, now);

    expect(from).toHaveBeenCalledWith('whatsapp_link_attempts');
    expect(tabla.insert).toHaveBeenCalledWith({
      phone_e164: TEL,
      created_at: NOW_ISO,
    });
  });

  it('si el insert falla no lanza y loguea solo el código de error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockReturnValue({
      from: vi.fn(() =>
        tablaIntentos(
          { count: 0, error: null },
          { error: { code: '42P01', message: 'no existe' } },
        ),
      ),
    });

    await expect(recordFailedLinkAttempt(TEL, now)).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('recordFailedLinkAttempt'),
      '42P01',
    );
    expect(errorSpy.mock.calls.flat().join(' ')).not.toContain(TEL);
    errorSpy.mockRestore();
  });

  it('si el cliente lanza, no lanza', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAdmin.mockImplementationOnce(() => {
      throw new Error('sin variables de entorno');
    });

    await expect(recordFailedLinkAttempt(TEL, now)).resolves.toBeUndefined();
    errorSpy.mockRestore();
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: FAIL en los describe nuevos con `TypeError: linkAttemptsWindowStart is not a function` (y equivalentes para `isOverLinkAttemptLimit`, `isLinkAttemptLimitReached`, `recordFailedLinkAttempt`).

- [x] **Step 3: Implementar**

En `src/lib/services/whatsapp-links.ts`:

1. Reemplazar las líneas 1-3 (comentario de cabecera) por:

```ts
// Servicio de vinculación número↔usuario. Usa el cliente service-role porque el
// webhook corre sin sesión; la seguridad la dan el código de un solo uso (único
// entre los pendientes), el límite de intentos fallidos por número y la firma
// de Twilio validada antes de llegar aquí.
```

2. Agregar al final del archivo:

```ts
/** VINCULAR fallidos permitidos por número dentro de la ventana. */
export const LINK_MAX_FAILED_ATTEMPTS = 5;
/** Ventana del límite de intentos, en minutos. */
export const LINK_ATTEMPTS_WINDOW_MINUTES = 15;

/** Inicio (ISO) de la ventana del límite: `now` menos 15 minutos. */
export function linkAttemptsWindowStart(now: Date): string {
  return new Date(
    now.getTime() - LINK_ATTEMPTS_WINDOW_MINUTES * 60_000,
  ).toISOString();
}

/** Con 5 fallos en la ventana el número ya no puede intentar. */
export function isOverLinkAttemptLimit(failedAttempts: number): boolean {
  return failedAttempts >= LINK_MAX_FAILED_ATTEMPTS;
}

/**
 * ¿El número agotó sus intentos de VINCULAR? Cuenta sus fallos de los últimos
 * 15 minutos en `whatsapp_link_attempts`.
 *
 * Ante cualquier error devuelve false (deja intentar): el código puede llegar
 * a producción antes de que se aplique la migración (H8) y un error de base no
 * debe dejar a nadie sin poder vincular. Solo se loguea el código del error,
 * nunca el número.
 */
export async function isLinkAttemptLimitReached(
  phoneE164: string,
  now: () => Date = () => new Date(),
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from('whatsapp_link_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('phone_e164', phoneE164)
      .gte('created_at', linkAttemptsWindowStart(now()));
    if (error) {
      console.error(
        'isLinkAttemptLimitReached: no se pudieron contar los intentos:',
        error.code,
      );
      return false;
    }
    return isOverLinkAttemptLimit(count ?? 0);
  } catch (err) {
    console.error(
      'isLinkAttemptLimitReached: no se pudieron contar los intentos:',
      err instanceof Error ? err.name : 'error desconocido',
    );
    return false;
  }
}

/**
 * Registra un VINCULAR fallido (código inexistente o vencido) del número.
 * Nunca lanza: si no se puede guardar, la respuesta al usuario sigue igual.
 */
export async function recordFailedLinkAttempt(
  phoneE164: string,
  now: () => Date = () => new Date(),
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('whatsapp_link_attempts')
      .insert({ phone_e164: phoneE164, created_at: now().toISOString() });
    if (error) {
      console.error(
        'recordFailedLinkAttempt: no se pudo registrar el intento:',
        error.code,
      );
    }
  } catch (err) {
    console.error(
      'recordFailedLinkAttempt: no se pudo registrar el intento:',
      err instanceof Error ? err.name : 'error desconocido',
    );
  }
}
```

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `bun run test src/lib/services/whatsapp-links.test.ts`
Expected: PASS (todos).

Run: `bun run type-check`
Expected: sin errores.

- [x] **Step 5: Commit**

```bash
git add src/lib/services/whatsapp-links.ts src/lib/services/whatsapp-links.test.ts
git commit -m "$(cat <<'EOF'
feat(whatsapp): contar y registrar intentos fallidos de vinculación por número

isLinkAttemptLimitReached cuenta los fallos del número en los últimos 15
minutos (5 bloquean) y recordFailedLinkAttempt los guarda en
whatsapp_link_attempts. Reloj inyectable; ante un error de base dejan
intentar y nunca loguean el número.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `handleLinkingMessage` aplica el límite y el webhook lo cablea

**Files:**
- Modify: `src/lib/whatsapp/handle-linking.ts`
- Modify: `src/app/api/whatsapp/webhook/route.ts:18` y `:91-94`
- Test: `src/lib/whatsapp/handle-linking.test.ts` (reescritura completa)
- Test: `src/app/api/whatsapp/webhook/route.test.ts`

**Interfaces:**
- Consumes: `RedeemResult` con `reason: 'invalid_or_expired' | 'link_failed'` (Task 3); `isLinkAttemptLimitReached(phoneE164, now?)` y `recordFailedLinkAttempt(phoneE164, now?)` (Task 4).
- Produces:
  - `export interface LinkingDeps { redeemLinkCode; getLinkByPhone; isLinkAttemptLimitReached: (phoneE164: string) => Promise<boolean>; recordFailedLinkAttempt: (phoneE164: string) => Promise<void> }`
  - `export const MSG_TOO_MANY_ATTEMPTS = 'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.'`
  - `MSG_LINKED_OK` queda idéntico y sin exportar (S13 lo cambia).

- [x] **Step 1: Escribir los tests que fallan**

Reemplazar todo `src/lib/whatsapp/handle-linking.test.ts` por:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  handleLinkingMessage,
  type LinkingDeps,
  MSG_TOO_MANY_ATTEMPTS,
} from './handle-linking';

const TEL = '+573000000000';

function deps(over: Partial<LinkingDeps> = {}): LinkingDeps {
  return {
    redeemLinkCode: vi.fn().mockResolvedValue({ ok: true, userId: 'u1' }),
    getLinkByPhone: vi.fn().mockResolvedValue(null),
    isLinkAttemptLimitReached: vi.fn().mockResolvedValue(false),
    recordFailedLinkAttempt: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('handleLinkingMessage', () => {
  it('VINCULAR con código válido → confirma y canjea, sin registrar fallo', async () => {
    const d = deps();
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(d.redeemLinkCode).toHaveBeenCalledWith('482913', TEL);
    expect(reply).toContain('vinculado');
    expect(d.getLinkByPhone).not.toHaveBeenCalled();
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('VINCULAR con código inválido → mensaje de error y registra el intento fallido', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'invalid_or_expired' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 000000', d);
    expect(reply.toLowerCase()).toContain('código');
    expect(reply).toMatch(/válido|expir/i);
    expect(d.recordFailedLinkAttempt).toHaveBeenCalledWith(TEL);
  });

  it('un error de base (link_failed) responde igual pero NO cuenta como intento fallido', async () => {
    const d = deps({
      redeemLinkCode: vi
        .fn()
        .mockResolvedValue({ ok: false, reason: 'link_failed' }),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toMatch(/válido|expir/i);
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('con el límite alcanzado responde MSG_TOO_MANY_ATTEMPTS sin consultar el código', async () => {
    const d = deps({
      isLinkAttemptLimitReached: vi.fn().mockResolvedValue(true),
    });
    const reply = await handleLinkingMessage(TEL, 'VINCULAR 482913', d);
    expect(reply).toBe(MSG_TOO_MANY_ATTEMPTS);
    expect(d.isLinkAttemptLimitReached).toHaveBeenCalledWith(TEL);
    expect(d.redeemLinkCode).not.toHaveBeenCalled();
    // Los intentos bloqueados no se registran: quien espera 15 min vuelve a poder.
    expect(d.recordFailedLinkAttempt).not.toHaveBeenCalled();
  });

  it('MSG_TOO_MANY_ATTEMPTS es el texto del contrato', () => {
    expect(MSG_TOO_MANY_ATTEMPTS).toBe(
      'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.',
    );
  });

  it('un mensaje que no es VINCULAR no consulta el límite', async () => {
    const d = deps({
      isLinkAttemptLimitReached: vi.fn().mockResolvedValue(true),
    });
    const reply = await handleLinkingMessage(TEL, 'hola', d);
    expect(d.isLinkAttemptLimitReached).not.toHaveBeenCalled();
    expect(reply).toContain('VINCULAR');
  });

  it('número ya vinculado y mensaje cualquiera → avisa que ya está vinculado', async () => {
    const d = deps({
      getLinkByPhone: vi.fn().mockResolvedValue({ userId: 'u1' }),
    });
    const reply = await handleLinkingMessage(TEL, 'hola', d);
    expect(reply.toLowerCase()).toContain('vinculado');
  });

  it('número NO vinculado y mensaje cualquiera → instrucciones de vinculación', async () => {
    const reply = await handleLinkingMessage(TEL, 'hola', deps());
    expect(reply).toContain('VINCULAR');
    expect(reply.toLowerCase()).toContain('ajustes');
  });
});
```

En `src/app/api/whatsapp/webhook/route.test.ts`:

1. Reemplazar el mock de `@/lib/services/whatsapp-links` (líneas 19-22) por:

```ts
vi.mock('@/lib/services/whatsapp-links', () => ({
  getLinkByPhone: vi.fn(),
  redeemLinkCode: vi.fn(),
  isLinkAttemptLimitReached: vi.fn(),
  recordFailedLinkAttempt: vi.fn(),
}));
```

2. Reemplazar `import { getLinkByPhone } from '@/lib/services/whatsapp-links';` (línea 46) por:

```ts
import {
  getLinkByPhone,
  isLinkAttemptLimitReached,
  recordFailedLinkAttempt,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
```

3. Agregar al final del archivo:

```ts
describe('webhook de WhatsApp: número sin vincular', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enSegundoPlano.length = 0;
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok');
    vi.stubEnv('WHATSAPP_WEBHOOK_URL', 'https://app.test/api/whatsapp/webhook');
    vi.mocked(getLinkByPhone).mockResolvedValue(null);
    vi.mocked(isLinkAttemptLimitReached).mockResolvedValue(false);
    vi.mocked(recordFailedLinkAttempt).mockResolvedValue(undefined);
  });

  it('con el límite de intentos alcanzado responde que espere y no canjea el código', async () => {
    vi.mocked(isLinkAttemptLimitReached).mockResolvedValue(true);

    const res = await post({
      From: `whatsapp:${TEL}`,
      Body: 'VINCULAR 123456',
      NumMedia: '0',
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Hiciste demasiados intentos');
    expect(isLinkAttemptLimitReached).toHaveBeenCalledWith(TEL);
    expect(redeemLinkCode).not.toHaveBeenCalled();
  });

  it('un código inválido registra el intento fallido del número', async () => {
    vi.mocked(redeemLinkCode).mockResolvedValue({
      ok: false,
      reason: 'invalid_or_expired',
    });

    await post({
      From: `whatsapp:${TEL}`,
      Body: 'VINCULAR 123456',
      NumMedia: '0',
    });

    expect(redeemLinkCode).toHaveBeenCalledWith('123456', TEL);
    expect(recordFailedLinkAttempt).toHaveBeenCalledWith(TEL);
  });
});
```

- [x] **Step 2: Correr los tests y verificar que fallan**

Run: `bun run test src/lib/whatsapp/handle-linking.test.ts src/app/api/whatsapp/webhook/route.test.ts`
Expected: FAIL. En `handle-linking`: `MSG_TOO_MANY_ATTEMPTS es el texto del contrato` (`expected undefined to be 'Hiciste demasiados intentos…'`), el de límite alcanzado (`redeemLinkCode` sí fue llamado) y el de registro de fallo (`recordFailedLinkAttempt` no fue llamado). En `route.test`: los dos tests de "número sin vincular" (`isLinkAttemptLimitReached` nunca llamado). Los 4 tests de "lista de cuentas" siguen pasando.

- [x] **Step 3: Implementar**

En `src/lib/whatsapp/handle-linking.ts`:

1. Reemplazar la interfaz `LinkingDeps` por:

```ts
export interface LinkingDeps {
  redeemLinkCode: (code: string, phoneE164: string) => Promise<RedeemResult>;
  getLinkByPhone: (phoneE164: string) => Promise<{ userId: string } | null>;
  /** true si el número ya tiene 5 VINCULAR fallidos en los últimos 15 min. */
  isLinkAttemptLimitReached: (phoneE164: string) => Promise<boolean>;
  /** Suma un VINCULAR fallido (código inexistente o vencido) al número. */
  recordFailedLinkAttempt: (phoneE164: string) => Promise<void>;
}
```

2. Justo después de la constante `MSG_NEEDS_LINK` (antes de `export async function handleLinkingMessage`) agregar:

```ts
export const MSG_TOO_MANY_ATTEMPTS =
  'Hiciste demasiados intentos. Espera 15 minutos y genera un código nuevo en Ajustes.';
```

3. Reemplazar el bloque

```ts
  if (cmd.kind === 'link') {
    const res = await deps.redeemLinkCode(cmd.code, phoneE164);
    return res.ok ? MSG_LINKED_OK : MSG_CODE_INVALID;
  }
```

por:

```ts
  if (cmd.kind === 'link') {
    // Con el límite alcanzado ni se mira el código: adivinar los 6 dígitos a
    // fuerza de intentos deja de ser posible. Estos intentos no se registran,
    // así que al pasar 15 minutos el número vuelve a poder.
    if (await deps.isLinkAttemptLimitReached(phoneE164)) {
      return MSG_TOO_MANY_ATTEMPTS;
    }
    const res = await deps.redeemLinkCode(cmd.code, phoneE164);
    if (res.ok) {
      return MSG_LINKED_OK;
    }
    // Solo un código inexistente o vencido cuenta; un error de base no es
    // culpa de quien escribe.
    if (res.reason === 'invalid_or_expired') {
      await deps.recordFailedLinkAttempt(phoneE164);
    }
    return MSG_CODE_INVALID;
  }
```

No tocar `MSG_LINKED_OK`.

En `src/app/api/whatsapp/webhook/route.ts`:

1. Reemplazar la línea 18 `import { getLinkByPhone, redeemLinkCode } from '@/lib/services/whatsapp-links';` por:

```ts
import {
  getLinkByPhone,
  isLinkAttemptLimitReached,
  recordFailedLinkAttempt,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
```

2. Reemplazar

```ts
    const reply = await handleLinkingMessage(phone, body, {
      redeemLinkCode,
      getLinkByPhone,
    });
```

por:

```ts
    const reply = await handleLinkingMessage(phone, body, {
      redeemLinkCode,
      getLinkByPhone,
      isLinkAttemptLimitReached,
      recordFailedLinkAttempt,
    });
```

(Las funciones del servicio se pasan tal cual: se llaman con un solo argumento y usan el reloj real por defecto.)

- [x] **Step 4: Correr los tests y verificar que pasan**

Run: `bun run test src/lib/whatsapp/handle-linking.test.ts src/app/api/whatsapp/webhook/route.test.ts`
Expected: PASS (8 tests de `handle-linking`, 6 de `route.test`).

Run: `bun run type-check`
Expected: sin errores.

Run: `grep -n "Tu WhatsApp quedó vinculado a tu presupuesto" src/lib/whatsapp/handle-linking.ts`
Expected: una coincidencia (`MSG_LINKED_OK` intacto).

- [x] **Step 5: Commit**

```bash
git add src/lib/whatsapp/handle-linking.ts src/lib/whatsapp/handle-linking.test.ts src/app/api/whatsapp/webhook/route.ts src/app/api/whatsapp/webhook/route.test.ts
git commit -m "$(cat <<'EOF'
feat(whatsapp): bloquear VINCULAR tras 5 fallos del mismo número en 15 minutos

handleLinkingMessage consulta el límite antes de canjear; con el límite
alcanzado responde MSG_TOO_MANY_ATTEMPTS sin mirar el código. Solo los
códigos inexistentes o vencidos suman un intento. El webhook pasa las dos
funciones nuevas del servicio.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Verificación completa

**Files:** ninguno nuevo.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia de suite y typecheck en verde.

- [x] **Step 1: Suite completa y typecheck**

Run: `bun run test && bun run type-check`
Expected: todos los tests en verde y `tsc --noEmit` sin errores.

- [x] **Step 2: Revisar datos personales y logs**

Run: `grep -nE "\+57[0-9]{10}" src/lib/services/whatsapp-links.test.ts src/lib/supabase/migrations/20260930110000_whatsapp_vinculacion_segura.test.ts src/lib/whatsapp/handle-linking.test.ts`
Expected: los tests nuevos solo usan `+573000000000` (la constante `TEL`). Los números que ya estaban antes de S02 (`+573001234567`/`+573009999999` en `getLinkByPhone` y `+573000000001`/`+573000000002` en `listarDocumentosDeUsuario`) son inventados y se dejan como están.

Run: `grep -n "console.error" src/lib/services/whatsapp-links.ts`
Expected: cada llamada nueva pasa `error.code` o `err.name`, nunca `phoneE164` ni `code`.

- [x] **Step 3: Confirmar que no se tocaron archivos ajenos a la historia**

Run: `git diff --stat main...HEAD -- src/lib/actions/whatsapp.ts src/lib/whatsapp/link-url.ts`
Expected: salida vacía.

Si algún paso falla, corregir en la tarea correspondiente y hacer un commit nuevo con `fix(whatsapp): …` terminado en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Si todo pasa, no hay commit en esta tarea.

---

### Task 7 (alcance adicional del orquestador): deuda de S01 en la misma zona

- [x] **Step 1:** Test: el guard de `20260930100000` usa `auth.uid() IS DISTINCT FROM p_user_id` (un `p_user_id` NULL es "no autorizado") y la verificación manual trae el caso 7b y la huella `md5(prosrc)`. Verificado que falla.
- [x] **Step 2:** Migración `20260930100000` (sin aplicar): guard con `IS DISTINCT FROM` en las 3 funciones; paso 0 `SELECT proname, md5(prosrc) …`; caso 7b (plantilla real de otro usuario como fuente y como destino, `BEGIN/ROLLBACK`, esperado 42501). Contratos §0 actualizados. Test en verde.
- [x] **Step 3:** Commit.

### Deuda cerrada en S03 (alcance adicional del orquestador)

- [x] La purga best-effort de `whatsapp_link_attempts` borra todas las filas anteriores a la ventana (`delete().lt('created_at', desde)`, sin filtro por número).
- [x] Si el canje da `invalid_or_expired` pero el número ya está vinculado (`getLinkByPhone`; reintento de Twilio tras un timeout), `handleLinkingMessage` libera la reserva y responde `MSG_LINKED_OK`. Si esa consulta falla, responde `MSG_CODE_INVALID` y el intento cuenta.

## Riesgos aceptados

- **Sin límite global multi-número.** El límite de 5 intentos en 15 minutos es por número. Alguien con muchos números (o que falsifique el remitente, cosa que la firma de Twilio impide) podría probar más códigos en total. Con códigos de 6 dígitos que vencen en 10 minutos el riesgo es bajo; queda en el backlog.

---

## Autorrevisión

- **Cobertura de criterios:** índice único + limpieza (Task 1); generación con limpieza de vencidos propios y reintento `23505` máx. 5 (Task 2); canje atómico con reloj inyectado (Task 3); tabla de intentos con RLS y sin privilegios de cliente (Task 1); límite 5/15 min con reloj inyectado (Task 4) aplicado antes de consultar el código (Task 5); revinculación borra la conversación ajena (Task 3); `MSG_TOO_MANY_ATTEMPTS` literal (Task 5); `MSG_LINKED_OK` intacto (Task 5 Step 4); verificación completa (Task 6).
- **Marcadores:** ninguno; todo el código está escrito.
- **Consistencia de nombres:** `isLinkAttemptLimitReached` y `recordFailedLinkAttempt` se llaman igual en el servicio (Task 4), en `LinkingDeps` (Task 5) y en el mock del webhook (Task 5). `RedeemResult.reason` = `'invalid_or_expired' | 'link_failed'` en Task 3 y en los tests de Task 5. Constantes de test `NOW`/`NOW_ISO`/`now`/`TEL` definidas en Task 2 y usadas en 3 y 4.
- **Dependencias con otras historias:** S13 cambia `MSG_LINKED_OK` en el mismo archivo después de S02 (contratos §4); S02 no lo toca. `src/lib/actions/whatsapp.ts` (S13) no cambia: `createLinkCode(user.id)` sigue válido.
