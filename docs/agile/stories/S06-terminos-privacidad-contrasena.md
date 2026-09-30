# S06 — Términos, privacidad y regla de contraseña — Implementation Plan

> **Alineado con contratos v2 (§5).** Donde §5 de `docs/agile/contracts.md` choca con §0–§4, gana §5. Flujo AUTH en serie: **S04 → S06 → S05** (esta historia va después de S04 y antes de S05, que consume `passwordSchema`). Sin cambios de fondo respecto a v1: se agrega la tarea humana **H9** (§5.4) y la verificación de que no se toca `vitest.config.ts` (§5.0).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar `/terms` y `/privacy` con textos breves y honestos sobre lo que la app guarda y con quién lo comparte, y unificar la regla de contraseña (8–72 caracteres, sin reglas de composición) entre Zod y la UI de registro.

**Architecture:** Un `passwordSchema` exportado desde `src/lib/validations/schemas.ts` (contratos §2.4) lo usan el registro (esta historia) y el reset (S05). Los textos legales viven como datos (`LegalSection[]`) en `content.ts` junto a cada página, para poder testearlos sin renderizar JSX; las páginas son server components que solo recorren esos datos. El correo de contacto sale de una constante `CONTACT_EMAIL` con valor de ejemplo que la persona debe cambiar.

**Tech Stack:** Next.js 15 App Router (server components), React 19, Zod 4, Vitest 4 (entorno `node`), Tailwind, bun.

## Global Constraints

- Fuente de verdad: `docs/agile/contracts.md` v2 (§2.4 y §5, que prevalece).
- Contrato §2.4, literal: `export const passwordSchema: z.ZodString // z.string().min(8, 'Usa al menos 8 caracteres').max(72, 'Usa como máximo 72 caracteres')`. Lo usan el registro y el reset. El texto de ayuda de la UI dice "Mínimo 8 caracteres." y nada más.
- Textos de UI en **español colombiano con tuteo** ("tú", nunca "vos", "podés", "tenés", "querés").
- Sin datos legales inventados: nada de razón social, NIT, dirección ni nombre de persona. Se dice "quien administra la app". El correo sale de `CONTACT_EMAIL = 'contacto@ejemplo.com'`, con un comentario para que la persona lo cambie.
- Datos personales: ningún correo, teléfono, cédula o nombre real en código, tests o fixtures (usar `usuario@ejemplo.com`).
- `middleware.ts` **no se toca** en esta historia: S04 (que va antes en el flujo AUTH) mueve la lógica de rutas a `src/lib/auth/route-access.ts` con `/terms` y `/privacy` en `PUBLIC_ROUTES` (contratos §5.2 y §5.3). Antes de S04 ya estaban en `publicRoutes` de `middleware.ts:45-46`. S04 es la única dueña de esos dos archivos.
- `loginSchema` **no se toca**: las cuentas existentes pueden tener contraseñas de 6 o 7 caracteres (el mínimo anterior) y tienen que poder seguir entrando.
- `src/lib/actions/auth.ts` **no se toca** (lo edita S04). `registerAction` ya valida con `registerSchema` y, desde S04, muestra el primer mensaje de Zod (§5.2), así que hereda la regla nueva y su texto ("Usa al menos 8 caracteres") sin cambios. Los tests de S04 usan claves de 19 caracteres: siguen en verde con la regla 8–72.
- Vitest corre en entorno `node` y el `tsconfig` tiene `"jsx": "preserve"`: hoy vitest **no puede transformar JSX** (probado: falla el parseo). Por eso los tests de páginas son de texto (leen el `.tsx` con `fs`) y el contenido se prueba como datos `.ts` (contratos §5.0: sin tests de render). **No se modifica `vitest.config.ts`** (§5.0); la Task 5 lo verifica.
- Contratos §5.0: **prohibido** `bun run dev` y `next build` contra `.env.local` (apunta a producción); nunca `bun run db:types`.
- Verificación: `bun run test <archivo>` por tarea; al final `bun run test && bun run type-check`.
- Commits en español, terminados en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. El pre-commit corre `lint-staged`; después de cada commit revisa `git show --stat HEAD` y `git status`: si lint-staged revirtió o dejó cambios sin commitear, vuelve a correr los tests y haz el commit con `--no-verify`.
- No se accede a la base de producción.

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Modificar | `src/lib/validations/schemas.ts` (bloque "ESQUEMAS DE AUTENTICACIÓN", `registerSchema`) | Agregar `passwordSchema` y usarlo en `registerSchema` |
| Crear (test) | `src/lib/validations/schemas.test.ts` | Límites 8–72, sin composición, registro |
| Modificar | `src/app/auth/register/page.tsx:118-150` | Texto de ayuda "Mínimo 8 caracteres." y `minLength`/`maxLength` en los inputs |
| Crear (test) | `src/app/auth/register/register-page.test.ts` | Test de texto del formulario |
| Crear | `src/lib/constants/legal.ts` | `CONTACT_EMAIL`, `LEGAL_UPDATED_AT`, tipo `LegalSection` |
| Crear | `src/app/privacy/content.ts` | `PRIVACY_SECTIONS: LegalSection[]` |
| Crear | `src/app/privacy/page.tsx` | Página `/privacy` (server component) |
| Crear (test) | `src/app/privacy/privacy.test.ts` | Contenido honesto + forma de la página |
| Crear | `src/app/terms/content.ts` | `TERMS_SECTIONS: LegalSection[]` |
| Crear | `src/app/terms/page.tsx` | Página `/terms` (server component) |
| Crear (test) | `src/app/terms/terms.test.ts` | Contenido + forma de la página |

`content.ts` y `*.test.ts` dentro de `src/app/<ruta>/` no son rutas para Next (solo `page.tsx`/`route.ts` lo son).

## Criterios de aceptación

- [x] `passwordSchema` exportado desde `src/lib/validations/schemas.ts`: rechaza 7 caracteres con "Usa al menos 8 caracteres", acepta 8 y 72, rechaza 73 con "Usa como máximo 72 caracteres", y no exige mayúsculas, números ni símbolos.
- [x] `registerSchema.password` usa `passwordSchema`; `confirmPassword` solo exige no estar vacío ("Confirma tu contraseña") y debe coincidir ("Las contraseñas no coinciden").
- [x] El registro muestra "Mínimo 8 caracteres." como único texto de ayuda de la contraseña; ya no menciona mayúsculas, minúsculas ni números. Los inputs tienen `minLength={8}` y `maxLength={72}` (desde la ronda 1 salen de `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH` y `PASSWORD_HINT` en `src/lib/validations/password-rules.ts`, que también usa `passwordSchema`).
- [x] `/privacy` existe, es una página pública sin sesión (está en `PUBLIC_ROUTES`; no se afirma protección por middleware, ver Riesgos y ADR-004) y dice, de forma breve: quién la administra (sin nombre), qué se guarda (cuenta, presupuesto, gastos, facturas con CUFE, números de WhatsApp, cédula/NIT, últimos mensajes con el bot), qué no se guarda (fotos, números de tarjeta, cookies de publicidad), para qué se usa, con quién se comparte (Supabase, Vercel, Twilio y Meta, Vercel AI Gateway y MiniMax, Resend, DIAN vía servicio propio), cuánto tiempo y cómo pedir copia, corrección o borrado escribiendo a `CONTACT_EMAIL`.
- [x] `/terms` existe y dice: acceso por invitación, responsabilidades de la cuenta, que los números vinculados ven y registran en el presupuesto, que la IA se equivoca, que la app solo maneja COP, que no es asesoría financiera, uso aceptable, cómo cerrar la cuenta, enlace a privacidad.
- [x] Ningún texto legal contiene correos distintos de `CONTACT_EMAIL`, números de teléfono ni secuencias de 7+ dígitos, ni voseo.
- [x] `middleware.ts`, `src/lib/auth/route-access.ts` y `vitest.config.ts` sin cambios de esta historia.
- [x] La tarea humana H9 (cambiar `CONTACT_EMAIL` por un buzón real antes de abrir el registro) queda anotada en el comentario de `legal.ts` y en la sección de tareas humanas.
- [x] `bun run test && bun run type-check` en verde.

---

### Task 1: `passwordSchema` y registro con la regla 8–72

**Files:**
- Modify: `src/lib/validations/schemas.ts` (sección `// ESQUEMAS DE AUTENTICACIÓN`, antes de `loginSchema`, y el `registerSchema`)
- Test: `src/lib/validations/schemas.test.ts` (nuevo)

**Interfaces:**
- Consumes: nada.
- Produces: `export const passwordSchema` (tipo inferido `z.ZodString`) en `src/lib/validations/schemas.ts`. S05 lo importa para el reset: `import { passwordSchema } from '@/lib/validations/schemas'`. `registerSchema` conserva su nombre, sus campos (`email`, `password`, `confirmPassword`, `fullName`) y el tipo `RegisterFormData`.

- [x] **Step 1: Write the failing test**

Crear `src/lib/validations/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { passwordSchema, registerSchema } from './schemas';

const REGISTRO_VALIDO = {
  email: 'usuario@ejemplo.com',
  password: 'clavesegura',
  confirmPassword: 'clavesegura',
  fullName: 'Usuario Prueba',
};

function mensajeEn(
  issues: { path: PropertyKey[]; message: string }[] | undefined,
  campo: string,
): string | undefined {
  return issues?.find(issue => issue.path[0] === campo)?.message;
}

describe('passwordSchema', () => {
  it('rechaza 7 caracteres con el mismo texto que muestra la UI', () => {
    const resultado = passwordSchema.safeParse('a'.repeat(7));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      'Usa al menos 8 caracteres',
    );
  });

  it('acepta exactamente 8 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(8)).success).toBe(true);
  });

  it('acepta exactamente 72 caracteres', () => {
    expect(passwordSchema.safeParse('a'.repeat(72)).success).toBe(true);
  });

  it('rechaza 73 caracteres', () => {
    const resultado = passwordSchema.safeParse('a'.repeat(73));
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe(
      'Usa como máximo 72 caracteres',
    );
  });

  it('no exige mayúsculas, números ni símbolos', () => {
    expect(passwordSchema.safeParse('solominusculas').success).toBe(true);
    expect(passwordSchema.safeParse('una frase con espacios').success).toBe(
      true,
    );
  });
});

describe('registerSchema', () => {
  it('acepta un registro válido', () => {
    expect(registerSchema.safeParse(REGISTRO_VALIDO).success).toBe(true);
  });

  it('rechaza 6 y 7 caracteres (el mínimo viejo era 6)', () => {
    for (const largo of [6, 7]) {
      const clave = 'a'.repeat(largo);
      const resultado = registerSchema.safeParse({
        ...REGISTRO_VALIDO,
        password: clave,
        confirmPassword: clave,
      });
      expect(resultado.success).toBe(false);
      expect(mensajeEn(resultado.error?.issues, 'password')).toBe(
        'Usa al menos 8 caracteres',
      );
    }
  });

  it('rechaza 73 caracteres', () => {
    const clave = 'a'.repeat(73);
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      password: clave,
      confirmPassword: clave,
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'password')).toBe(
      'Usa como máximo 72 caracteres',
    );
  });

  it('pide confirmar la contraseña si viene vacía', () => {
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      confirmPassword: '',
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'confirmPassword')).toBe(
      'Confirma tu contraseña',
    );
  });

  it('rechaza contraseñas que no coinciden', () => {
    const resultado = registerSchema.safeParse({
      ...REGISTRO_VALIDO,
      confirmPassword: 'otraclavedistinta',
    });
    expect(resultado.success).toBe(false);
    expect(mensajeEn(resultado.error?.issues, 'confirmPassword')).toBe(
      'Las contraseñas no coinciden',
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/validations/schemas.test.ts`
Expected: FAIL. Los tests de `passwordSchema` fallan con `Cannot read properties of undefined (reading 'safeParse')` (no existe el export) y "rechaza 6 y 7 caracteres" falla porque hoy el mínimo es 6 con otro mensaje.

- [x] **Step 3: Write minimal implementation**

En `src/lib/validations/schemas.ts`, justo debajo del comentario de bloque `// ESQUEMAS DE AUTENTICACIÓN` (antes de `// Esquema para login`), agregar:

```ts
// Regla única de contraseña (NIST 800-63B): solo largo, sin reglas de
// composición. 72 es el máximo que admite bcrypt, que usa Supabase Auth.
// La UI dice exactamente "Mínimo 8 caracteres." — si cambias el mínimo,
// cambia también ese texto. El login NO usa este esquema: hay cuentas
// creadas con el mínimo anterior (6) que tienen que poder entrar.
export const passwordSchema = z
  .string()
  .min(8, 'Usa al menos 8 caracteres')
  .max(72, 'Usa como máximo 72 caracteres');
```

Y reemplazar el `registerSchema` completo por:

```ts
// Esquema para registro
export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'El email es requerido')
      .email('Debe ser un email válido')
      .max(255, 'Máximo 255 caracteres'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
    fullName: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(255, 'Máximo 255 caracteres'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
```

`loginSchema` queda igual.

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd <raíz-del-repo> && bun run test src/lib/validations/schemas.test.ts && bun run type-check`
Expected: PASS (10 tests) y `tsc --noEmit` sin errores.

- [x] **Step 5: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/validations/schemas.ts src/lib/validations/schemas.test.ts && git commit -m "$(cat <<'EOF'
feat(auth): regla única de contraseña de 8 a 72 caracteres en el registro

passwordSchema queda exportado para que el reset (S05) use la misma regla.
El login conserva su validación para no dejar por fuera cuentas viejas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Texto de ayuda del registro igual a la validación

**Files:**
- Modify: `src/app/auth/register/page.tsx:118-150` (inputs `password` y `confirmPassword` y el `<p>` de ayuda de la línea 128-130)
- Test: `src/app/auth/register/register-page.test.ts` (nuevo)

**Interfaces:**
- Consumes: la regla de Task 1 (8–72); no importa código de ella.
- Produces: nada que otras tareas usen.

- [x] **Step 1: Write the failing test**

Crear `src/app/auth/register/register-page.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

// Vitest corre en entorno node sin transformar JSX (tsconfig "jsx": "preserve"),
// así que se revisa el código fuente de la página como texto.
const fuente = readFileSync(
  join(process.cwd(), 'src/app/auth/register/page.tsx'),
  'utf8',
);

describe('formulario de registro', () => {
  it('dice exactamente la regla de passwordSchema', () => {
    expect(fuente).toContain('Mínimo 8 caracteres.');
  });

  it('ya no pide reglas de composición que Zod no valida', () => {
    expect(fuente).not.toMatch(/mayúscula|minúscula|número/i);
    expect(fuente).not.toContain('Mínimo 6');
  });

  it('el navegador aplica los mismos límites que Zod', () => {
    expect(fuente).toContain('minLength={8}');
    expect(fuente).toContain('maxLength={72}');
  });

  it('pide al navegador sugerir una contraseña nueva', () => {
    expect(fuente).toContain('autoComplete="new-password"');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/auth/register/register-page.test.ts`
Expected: FAIL en los 4 tests (el archivo dice "Mínimo 6 caracteres, incluye mayúscula, minúscula y número" y no tiene `minLength`, `maxLength` ni `autoComplete`).

- [x] **Step 3: Write minimal implementation**

En `src/app/auth/register/page.tsx`, reemplazar el bloque del input de contraseña y su ayuda (líneas 118-130):

```tsx
                <Input
                  id="password"
                  name="password"
                  type="password"
                  variant="glass"
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">
                  Mínimo 6 caracteres, incluye mayúscula, minúscula y número
                </p>
```

por:

```tsx
                <Input
                  id="password"
                  name="password"
                  type="password"
                  variant="glass"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="w-full"
                />
                <p className="text-xs text-gray-400">Mínimo 8 caracteres.</p>
```

Y el input de confirmación (líneas 141-150):

```tsx
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  variant="glass"
                  placeholder="••••••••"
                  required
                  disabled={isSubmitting}
                  className="w-full"
                />
```

por:

```tsx
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  variant="glass"
                  placeholder="••••••••"
                  required
                  maxLength={72}
                  autoComplete="new-password"
                  disabled={isSubmitting}
                  className="w-full"
                />
```

`Input` extiende `React.InputHTMLAttributes<HTMLInputElement>` y reenvía `...props` (`src/components/atoms/Input/Input.tsx:6,31`), así que no hay que tocarlo. Nada más cambia en la página (el checkbox de términos ya enlaza a `/terms` y `/privacy`).

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/auth/register/register-page.test.ts && bun run type-check`
Expected: PASS (4 tests) y `tsc` sin errores.

- [x] **Step 5: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/app/auth/register/page.tsx src/app/auth/register/register-page.test.ts && git commit -m "$(cat <<'EOF'
fix(auth): el registro dice la misma regla de contraseña que valida

Antes pedía mayúscula, minúscula y número que nadie validaba.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Constantes legales y página `/privacy`

**Files:**
- Create: `src/lib/constants/legal.ts`
- Create: `src/app/privacy/content.ts`
- Create: `src/app/privacy/page.tsx`
- Test: `src/app/privacy/privacy.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (Task 4 los usa):
  - `src/lib/constants/legal.ts`:
    - `export const CONTACT_EMAIL: string` (valor `'contacto@ejemplo.com'`)
    - `export const LEGAL_UPDATED_AT: string` (valor `'30 de septiembre de 2026'`)
    - `export type LegalSection = { title: string; paragraphs: string[]; items?: string[] }`
  - `src/app/privacy/content.ts`: `export const PRIVACY_SECTIONS: LegalSection[]`
  - `src/app/privacy/page.tsx`: `export const metadata: Metadata`, `export default function PrivacyPage()`

- [x] **Step 1: Write the failing test**

Crear `src/app/privacy/privacy.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

import { CONTACT_EMAIL } from '@/lib/constants/legal';

import { PRIVACY_SECTIONS } from './content';

const texto = JSON.stringify(PRIVACY_SECTIONS);

describe('contenido de /privacy', () => {
  it('cada sección tiene título y al menos un párrafo', () => {
    expect(PRIVACY_SECTIONS.length).toBeGreaterThanOrEqual(6);
    for (const seccion of PRIVACY_SECTIONS) {
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.paragraphs.length).toBeGreaterThan(0);
      for (const parrafo of seccion.paragraphs) {
        expect(parrafo.trim()).not.toBe('');
      }
    }
  });

  it('nombra a todos los proveedores que reciben datos', () => {
    for (const proveedor of [
      'Supabase',
      'Vercel',
      'Twilio',
      'Meta',
      'Vercel AI Gateway',
      'MiniMax',
      'Resend',
      'DIAN',
    ]) {
      expect(texto).toContain(proveedor);
    }
  });

  it('dice qué datos guarda la app', () => {
    for (const dato of [
      'correo',
      'gastos',
      'CUFE',
      'número',
      'cédula',
      'últimos 6 mensajes',
    ]) {
      expect(texto).toContain(dato);
    }
  });

  it('dice qué no guarda', () => {
    expect(texto).toContain('fotos');
    expect(texto.toLowerCase()).toContain('números de tarjeta');
  });

  it('explica cómo pedir el borrado con el correo de contacto', () => {
    expect(texto).toContain('borr');
    expect(texto).toContain(CONTACT_EMAIL);
  });

  it('no inventa responsables ni trae datos personales', () => {
    expect(texto).toContain('quien administra la app');
    const correos = texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    expect(correos.length).toBeGreaterThan(0);
    for (const correo of correos) expect(correo).toBe(CONTACT_EMAIL);
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toMatch(/\+\d/);
  });

  it('usa tuteo, no voseo', () => {
    expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribí\b/i);
  });
});

describe('CONTACT_EMAIL', () => {
  it('es un correo válido', () => {
    expect(z.string().email().safeParse(CONTACT_EMAIL).success).toBe(true);
  });
});

describe('página /privacy', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/app/privacy/page.tsx'),
    'utf8',
  );

  it('es un server component que exporta la página por defecto', () => {
    expect(fuente).not.toContain("'use client'");
    expect(fuente).toMatch(/export default function PrivacyPage\(/);
    expect(fuente).toContain('export const metadata');
  });

  it('pinta el contenido y el correo de contacto desde las constantes', () => {
    expect(fuente).toContain('PRIVACY_SECTIONS.map');
    expect(fuente).toContain('mailto:${CONTACT_EMAIL}');
    expect(fuente).toContain('LEGAL_UPDATED_AT');
    expect(fuente).toContain('href="/terms"');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/privacy/privacy.test.ts`
Expected: FAIL con `Failed to resolve import "@/lib/constants/legal"` (ni las constantes ni el contenido existen).

- [x] **Step 3: Write minimal implementation**

Crear `src/lib/constants/legal.ts`:

```ts
/**
 * Constantes de las páginas /terms y /privacy.
 */

// CAMBIA ESTE CORREO antes de abrir el registro (tarea humana H9, contratos
// §5.4): es el que ve la gente en /terms y /privacy para pedir una copia,
// corrección o borrado de sus datos, o cerrar su cuenta. Tiene que ser un
// buzón que alguien lea.
export const CONTACT_EMAIL = 'contacto@ejemplo.com';

// Cambia esta fecha cada vez que cambies el texto de /terms o /privacy.
export const LEGAL_UPDATED_AT = '30 de septiembre de 2026';

export type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};
```

Crear `src/app/privacy/content.ts`:

```ts
import { CONTACT_EMAIL, type LegalSection } from '@/lib/constants/legal';

/**
 * Texto de /privacy. Debe describir lo que la app hace de verdad:
 * si agregas una tabla con datos personales o un proveedor nuevo, actualiza
 * esta lista y LEGAL_UPDATED_AT.
 */
export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: 'Quién administra la app',
    paragraphs: [
      'Esta app de presupuesto la administra una persona para un grupo pequeño de usuarios invitados. En este texto la llamamos «quien administra la app». Solo te puedes registrar si tu correo recibió una invitación.',
      `Para cualquier asunto sobre tus datos, escribe a ${CONTACT_EMAIL}.`,
    ],
  },
  {
    title: 'Qué datos guarda la app',
    paragraphs: ['Solo lo que hace falta para que funcione tu presupuesto:'],
    items: [
      'Tu cuenta: correo, nombre y contraseña. La contraseña se guarda cifrada; nadie puede leerla, ni siquiera quien administra la app.',
      'Tu presupuesto: categorías, rubros, montos, ingresos, deudas, pagos y el nombre de tus cuentas o tarjetas.',
      'Tus gastos: monto, fecha, descripción, rubro, la cuenta con la que pagaste y, si llegó por WhatsApp, desde qué número se registró.',
      'Facturas electrónicas: el código CUFE, el nombre y el NIT del comercio, la fecha, los totales y los productos de la factura.',
      'WhatsApp: el número de cada teléfono que vincules y, si la cargas, tu cédula o NIT para buscar facturas en la DIAN.',
      'Conversación con el bot: los últimos 6 mensajes, para que el bot entienda tus respuestas. Deja de tenerlos en cuenta a los 30 minutos y se reemplazan con la siguiente conversación.',
    ],
  },
  {
    title: 'Lo que la app no guarda',
    paragraphs: ['Hay cosas que la app nunca pide o no conserva:'],
    items: [
      'Las fotos de facturas que mandas por WhatsApp: se leen para sacar los datos y la app no las guarda. Twilio, que entrega los mensajes, conserva una copia según sus propias reglas.',
      'Números de tarjeta, claves bancarias ni acceso a tus bancos.',
      'Cookies de publicidad o de analítica. Solo se usan las cookies necesarias para mantener tu sesión abierta.',
    ],
  },
  {
    title: 'Para qué se usan tus datos',
    paragraphs: [
      'Para mostrarte tu presupuesto, registrar los gastos que mandas por la web o por WhatsApp, clasificarlos en tus rubros, leer tus facturas y avisarte por WhatsApp cuando un rubro se acerca a su tope o lo pasa, si tienes las alertas activas.',
      'Tus datos no se venden ni se usan para publicidad.',
    ],
  },
  {
    title: 'Con quién se comparten',
    paragraphs: [
      'La app usa estos proveedores para funcionar. Cada uno recibe solo lo que necesita para su parte:',
    ],
    items: [
      'Supabase: guarda la base de datos y maneja el inicio de sesión.',
      'Vercel: aloja la app y procesa cada visita y cada mensaje que llega.',
      'Twilio y Meta (WhatsApp): entregan los mensajes entre tú y el bot.',
      'Proveedores de inteligencia artificial, a través de Vercel AI Gateway o directamente MiniMax: reciben el texto de tus mensajes al bot, las fotos de facturas y las descripciones de gastos, para entenderlos y clasificarlos.',
      'Resend: envía los correos de confirmación de cuenta y de recuperación de contraseña.',
      'DIAN: para leer una factura electrónica, un servicio propio de la app consulta el portal de la DIAN con el CUFE y, si hace falta, con tu cédula o NIT.',
    ],
  },
  {
    title: 'Cuánto tiempo se guardan',
    paragraphs: [
      'Mientras tengas tu cuenta. Si pides el borrado, se eliminan tu cuenta y todo lo que depende de ella. Las copias de respaldo de los proveedores pueden conservar esos datos por un tiempo limitado, hasta que se reemplazan.',
    ],
  },
  {
    title: 'Tus derechos y cómo pedir el borrado',
    paragraphs: [
      `En cualquier momento puedes pedir una copia de tus datos, que se corrijan o que se borren, o cerrar tu cuenta. Escribe a ${CONTACT_EMAIL} desde el correo con el que te registraste y di qué necesitas.`,
    ],
  },
  {
    title: 'Cambios a esta política',
    paragraphs: ['Si esta política cambia, se actualiza la fecha de arriba.'],
  },
];
```

Crear `src/app/privacy/page.tsx`:

```tsx
import Link from 'next/link';

import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from '@/lib/constants/legal';

import { PRIVACY_SECTIONS } from './content';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-gray-200">
      <h1 className="text-3xl font-bold text-white">Política de privacidad</h1>
      <p className="mt-2 text-sm text-gray-400">
        Última actualización: {LEGAL_UPDATED_AT}
      </p>

      {PRIVACY_SECTIONS.map(section => (
        <section key={section.title} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-white">{section.title}</h2>
          {section.paragraphs.map(paragraph => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              {section.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="mt-10">
        ¿Tienes preguntas? Escribe a{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          href="/terms"
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          Términos y condiciones
        </Link>
        <Link
          href="/auth/register"
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Volver al registro
        </Link>
      </nav>
    </main>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/privacy/privacy.test.ts && bun run type-check`
Expected: PASS (10 tests) y `tsc` sin errores.

- [x] **Step 5: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/lib/constants/legal.ts src/app/privacy/content.ts src/app/privacy/page.tsx src/app/privacy/privacy.test.ts && git commit -m "$(cat <<'EOF'
feat(legal): página de privacidad con lo que la app guarda de verdad

Datos, proveedores y cómo pedir el borrado. El correo de contacto es un
placeholder en CONTACT_EMAIL que hay que cambiar antes de abrir el registro.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Página `/terms`

**Files:**
- Create: `src/app/terms/content.ts`
- Create: `src/app/terms/page.tsx`
- Test: `src/app/terms/terms.test.ts`

**Interfaces:**
- Consumes (de Task 3): `CONTACT_EMAIL`, `LEGAL_UPDATED_AT`, `type LegalSection` de `@/lib/constants/legal`.
- Produces: `src/app/terms/content.ts` → `export const TERMS_SECTIONS: LegalSection[]`; `src/app/terms/page.tsx` → `export const metadata: Metadata`, `export default function TermsPage()`.

- [x] **Step 1: Write the failing test**

Crear `src/app/terms/terms.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import { CONTACT_EMAIL } from '@/lib/constants/legal';

import { TERMS_SECTIONS } from './content';

const texto = JSON.stringify(TERMS_SECTIONS);

describe('contenido de /terms', () => {
  it('cada sección tiene título y al menos un párrafo', () => {
    expect(TERMS_SECTIONS.length).toBeGreaterThanOrEqual(6);
    for (const seccion of TERMS_SECTIONS) {
      expect(seccion.title.trim()).not.toBe('');
      expect(seccion.paragraphs.length).toBeGreaterThan(0);
      for (const parrafo of seccion.paragraphs) {
        expect(parrafo.trim()).not.toBe('');
      }
    }
  });

  it('cubre lo que una persona invitada necesita saber', () => {
    for (const tema of [
      'invitación',
      'al menos 8 caracteres',
      'número vinculado',
      'inteligencia artificial',
      'pesos colombianos (COP)',
      'asesoría financiera',
      'política de privacidad',
    ]) {
      expect(texto).toContain(tema);
    }
  });

  it('dice cómo cerrar la cuenta con el correo de contacto', () => {
    expect(texto).toContain('cierre tu cuenta');
    expect(texto).toContain(CONTACT_EMAIL);
  });

  it('no inventa responsables ni trae datos personales', () => {
    expect(texto).toContain('quien administra la app');
    const correos = texto.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
    for (const correo of correos) expect(correo).toBe(CONTACT_EMAIL);
    expect(texto).not.toMatch(/\d{7,}/);
    expect(texto).not.toMatch(/\+\d/);
  });

  it('usa tuteo, no voseo', () => {
    expect(texto).not.toMatch(/\bvos\b|podés|tenés|querés|escribí\b/i);
  });
});

describe('página /terms', () => {
  const fuente = readFileSync(
    join(process.cwd(), 'src/app/terms/page.tsx'),
    'utf8',
  );

  it('es un server component que exporta la página por defecto', () => {
    expect(fuente).not.toContain("'use client'");
    expect(fuente).toMatch(/export default function TermsPage\(/);
    expect(fuente).toContain('export const metadata');
  });

  it('pinta el contenido y el correo de contacto desde las constantes', () => {
    expect(fuente).toContain('TERMS_SECTIONS.map');
    expect(fuente).toContain('mailto:${CONTACT_EMAIL}');
    expect(fuente).toContain('LEGAL_UPDATED_AT');
    expect(fuente).toContain('href="/privacy"');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/terms/terms.test.ts`
Expected: FAIL con `Failed to resolve import "./content"`.

- [x] **Step 3: Write minimal implementation**

Crear `src/app/terms/content.ts`:

```ts
import { CONTACT_EMAIL, type LegalSection } from '@/lib/constants/legal';

/**
 * Texto de /terms. Si cambias algo, actualiza LEGAL_UPDATED_AT.
 */
export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Qué es esta app',
    paragraphs: [
      'Es una app para llevar tu presupuesto personal o el de tu hogar: registras ingresos, gastos, deudas y facturas por la web o por WhatsApp. La administra una persona, a la que aquí llamamos «quien administra la app», y el registro es solo por invitación.',
    ],
  },
  {
    title: 'Tu cuenta',
    paragraphs: ['Al crear tu cuenta aceptas lo siguiente:'],
    items: [
      'Usa un correo que sea tuyo y una contraseña de al menos 8 caracteres que no uses en otros sitios.',
      'Cuida tu contraseña: eres responsable de lo que se haga con tu cuenta.',
      'Una cuenta es un presupuesto. Puedes vincular varios números de WhatsApp, por ejemplo los de tu hogar. Quien escriba desde un número vinculado puede consultar tu presupuesto y registrar gastos en él.',
    ],
  },
  {
    title: 'El bot y la inteligencia artificial',
    paragraphs: ['Ten en cuenta cómo funciona el registro automático:'],
    items: [
      'El bot usa inteligencia artificial para leer tus mensajes y facturas y para elegir el rubro de cada gasto. Se puede equivocar: revisa tus gastos de vez en cuando y corrígelos en la app.',
      'La app solo maneja pesos colombianos (COP). No mandes facturas en otra moneda: sus montos se sumarían como si fueran pesos.',
      'Leer una factura por su CUFE depende del portal de la DIAN. Si el portal no responde, la factura puede tardar o no leerse.',
    ],
  },
  {
    title: 'Lo que la app no es',
    paragraphs: [
      'La app te ayuda a organizarte, pero no es asesoría financiera, contable ni tributaria. Las decisiones sobre tu dinero son tuyas.',
      'Se ofrece tal como está: puede tener fallas, cambiar o dejar de estar disponible. Si algo es importante para ti, guarda también tu propia copia.',
    ],
  },
  {
    title: 'Uso aceptable',
    paragraphs: ['Para que la app siga funcionando para todos:'],
    items: [
      'No intentes entrar a cuentas o datos de otras personas.',
      'No uses el bot para mandar mensajes masivos o automáticos: cada mensaje le cuesta a la app.',
      'No compartas tu cuenta con personas que no sean de tu hogar.',
    ],
  },
  {
    title: 'Cerrar tu cuenta',
    paragraphs: [
      `Puedes pedir que se cierre tu cuenta y se borren tus datos escribiendo a ${CONTACT_EMAIL}.`,
      'Quien administra la app puede retirar el acceso si no se cumplen estos términos o si la app deja de funcionar. En ese caso te avisará por correo para que puedas pedir una copia de tus datos.',
    ],
  },
  {
    title: 'Privacidad',
    paragraphs: [
      'Qué datos se guardan, con quién se comparten y cómo pedir el borrado está explicado en la política de privacidad.',
    ],
  },
  {
    title: 'Cambios a estos términos',
    paragraphs: [
      'Si estos términos cambian, se actualiza la fecha de arriba. Seguir usando la app después del cambio significa que lo aceptas.',
    ],
  },
];
```

Crear `src/app/terms/page.tsx`:

```tsx
import Link from 'next/link';

import { CONTACT_EMAIL, LEGAL_UPDATED_AT } from '@/lib/constants/legal';

import { TERMS_SECTIONS } from './content';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos y condiciones',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-gray-200">
      <h1 className="text-3xl font-bold text-white">Términos y condiciones</h1>
      <p className="mt-2 text-sm text-gray-400">
        Última actualización: {LEGAL_UPDATED_AT}
      </p>

      {TERMS_SECTIONS.map(section => (
        <section key={section.title} className="mt-8 space-y-3">
          <h2 className="text-xl font-semibold text-white">{section.title}</h2>
          {section.paragraphs.map(paragraph => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.items && (
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              {section.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="mt-10">
        ¿Tienes preguntas? Escribe a{' '}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        .
      </p>

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link
          href="/privacy"
          className="text-blue-400 hover:text-blue-300 hover:underline"
        >
          Política de privacidad
        </Link>
        <Link
          href="/auth/register"
          className="text-gray-400 hover:text-white transition-colors"
        >
          ← Volver al registro
        </Link>
      </nav>
    </main>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `builtin cd <raíz-del-repo> && bun run test src/app/terms/terms.test.ts && bun run type-check`
Expected: PASS (7 tests) y `tsc` sin errores.

- [x] **Step 5: Commit**

```bash
builtin cd <raíz-del-repo> && git add src/app/terms/content.ts src/app/terms/page.tsx src/app/terms/terms.test.ts && git commit -m "$(cat <<'EOF'
feat(legal): términos y condiciones breves para usuarios invitados

Incluye los límites reales de la app: la IA se equivoca, solo maneja COP y
los números vinculados ven el presupuesto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Verificación final (sin cambios de código)

**Files:** ninguno se modifica.

**Interfaces:** ninguna.

- [x] **Step 1: Confirmar que las páginas son públicas y que no se tocaron archivos ajenos**

Run: `builtin cd <raíz-del-repo> && grep -n "'/terms'\|'/privacy'" src/lib/auth/route-access.ts middleware.ts; git status --short -- middleware.ts src/lib/auth/route-access.ts vitest.config.ts; git log --oneline main..HEAD -- vitest.config.ts`
Expected: `/terms` y `/privacy` dentro de `PUBLIC_ROUTES` de `src/lib/auth/route-access.ts` (lo dejó S04; si S04 aún no está en la rama, en `publicRoutes` de `middleware.ts`), y **ninguna** salida de `git status` ni de `git log` para `vitest.config.ts` (contratos §5.0). Los commits de esta historia no tocan `middleware.ts` ni `route-access.ts`. Si alguna ruta faltara, **no** edites esos archivos: repórtalo a S04, que es su dueña.

- [x] **Step 2: Suite completa y tipos**

Run: `builtin cd <raíz-del-repo> && bun run test && bun run type-check`
Expected: todos los tests en verde (incluidos los 31 nuevos: 10 + 4 + 10 + 7) y `tsc --noEmit` sin errores.

- [x] **Step 3: Confirmar que no quedaron datos personales ni marcadores**

Run: `builtin cd <raíz-del-repo> && grep -rnE "TODO|TBD|@(gmail|hotmail|outlook)\.|\+57[0-9]" src/lib/constants/legal.ts src/app/terms src/app/privacy src/lib/validations/schemas.test.ts src/app/auth/register/register-page.test.ts; echo "salida: $?"`
Expected: sin coincidencias (`salida: 1`).

Sin revisión visual con `bun run dev`: contratos §5.0 lo prohíben (`.env.local` apunta a producción). La forma de las páginas queda cubierta por los tests de texto y `type-check`; la revisión visual la hace la persona al desplegar.

No hay commit en esta tarea.

### Alcance adicional: deuda de S04 (orquestador)

Tareas TDD aparte, una por commit, pedidas por el orquestador en la misma zona (flujo AUTH).

- [x] **A1:** `loginAction`: un `redirectTo` presente pero inseguro cuenta como ausente y decide `getPostLoginPath`.
- [x] **A2:** login: `?error=` y `?message=` llevan códigos; la página los resuelve con una función pura (lista cerrada) y nunca muestra texto libre de la URL.
- [x] **A3:** `translateAuthError`: subcadena solo para `signup_not_allowed`; lo demás, coincidencia exacta.
- [x] **A4:** `/auth/callback` redirige a `/auth/confirm` con los mismos parámetros (`code`, `type`; `redirectTo` → `next`).
- [x] **A5:** `getSiteUrl`: en `VERCEL_ENV=production` sin `NEXT_PUBLIC_SITE_URL`, usa `VERCEL_PROJECT_PRODUCTION_URL` antes que `VERCEL_URL`.
- [x] **A6:** `middleware.test.ts` con `createServerClient` simulado.

Ronda de corrección 1 (revisores):

- [x] **R1:** registro: `?error=` lleva códigos (`authErrorCode` para Supabase; `email_invalido`, `password_corta`, `password_larga`, `no_coinciden`, `nombre_invalido`, `datos_invalidos` para Zod). La página los resuelve con `resolveRegisterError` (`src/lib/auth/register-feedback.ts`, lista cerrada; lo desconocido cae en el genérico). El texto que ve la persona es el del campo que falló primero, no "Datos inválidos" (espíritu de §5.2), pero ya no es el literal de Zod.
- [x] **R2:** `assertContactEmailReady` en `legal.ts`: con `VERCEL_ENV=production` y `CONTACT_EMAIL` de un dominio de ejemplo, el módulo lanza y el build de producción falla hasta resolver H9. Preview y local lo toleran. Un test (`describe.skipIf`) se activa solo cuando H9 esté resuelta.
- [x] **R3:** `/auth/callback` registra `error_code` (sin datos personales) y reenvía `type` solo si está en `EMAIL_OTP_TYPES` (`src/lib/auth/email-otp-types.ts`, compartida con `/auth/confirm`). Decisión explícita: sin `code` termina en `?error=enlace_invalido` (antes iba al login sin error).
- [x] **R4:** `login-page.test.ts` exige además que `setError`/`setMessage` reciban `feedback.error`/`feedback.message`; `middleware.test.ts` remite a ADR-004/H10.

---

## Riesgos

- **Middleware posiblemente inactivo (depende de S04, no bloquea S06; ADR-004).** El proyecto usa `src/app/` y el único middleware es `middleware.ts` en la raíz; Next.js lo busca en `src/`, así que muy probablemente no corre. Esta historia no declara ninguna protección por middleware: `/terms` y `/privacy` son páginas públicas que funcionan igual con o sin él. `src/middleware.test.ts` (A6) prueba la función aislada y no demuestra que Next.js la cargue. Se resuelve con la tarea humana H10 y, si hace falta, con la historia de bug de S04 que mueve el archivo.

## Tareas humanas

- **H9** (contratos §5.4): antes de abrir el registro (junto con H1/H6), cambiar `CONTACT_EMAIL` en `src/lib/constants/legal.ts` por un buzón real que alguien lea. Ningún agente la hace: el valor de ejemplo `contacto@ejemplo.com` se queda en el código hasta entonces. **Ojo:** mientras siga el marcador, el build de producción de Vercel falla a propósito (R2); los previews no.
- **H10** (contratos §5.4, ADR-004): verificar en un preview de Vercel si `/gastos` y `/bienvenida` redirigen al login sin sesión y si el build muestra "ƒ Middleware". No la hace ningún agente.
- Si el proveedor de correo final no es Resend (decisión D2), actualizar el ítem "Resend" en `src/app/privacy/content.ts`, su test y `LEGAL_UPDATED_AT`.

## Autorrevisión

- **Cobertura de criterios (épica S06):** páginas `/terms` y `/privacy` mínimas y honestas → Tasks 3 y 4 (datos: gastos, facturas, número de WhatsApp, cédula; proveedores: Supabase, Vercel, Twilio, IA; borrado). `passwordSchema` 8–72 en registro → Task 1; en reset → lo consume S05 con el export de Task 1. UI "Mínimo 8 caracteres." → Task 2. Middleware y `route-access.ts` → verificados en Task 5, sin cambios. `vitest.config.ts` → verificado en Task 5, sin cambios (§5.0). H9 → sección Tareas humanas y comentario de `legal.ts`.
- **Honestidad del texto (revisado contra el código):** `transactions.registered_phone` (número que registró el gasto), `electronic_invoices` (CUFE, comercio, NIT, fecha, totales, `items`), `whatsapp_links.phone_e164` y `documento`, `whatsapp_conversations.turns` (`MAX_TURNS = 6`, TTL 30 min en `src/lib/whatsapp/agent/state.ts:68-69`), `accounts` guarda solo nombre y tipo, no hay Supabase Storage (las fotos no se guardan), no hay analítica en `package.json`. `whatsapp_links.display_name` existe pero ningún código lo llena: no se menciona. Proveedores: Supabase, Vercel, Twilio (`TWILIO_*`), AI Gateway/MiniMax (`AI_GATEWAY_*`, `MINIMAX_*`), servicio DIAN propio (`DIAN_VPS_URL`, `FACTURA_DIAN_URL`), Resend por D2.
- **Marcadores:** ninguno; todo el código está escrito.
- **Consistencia de nombres:** `passwordSchema`, `registerSchema`, `CONTACT_EMAIL`, `LEGAL_UPDATED_AT`, `LegalSection`, `PRIVACY_SECTIONS`, `TERMS_SECTIONS`, `PrivacyPage`, `TermsPage` se usan igual en tareas y tests. Mensajes de Zod iguales al contrato §2.4.
