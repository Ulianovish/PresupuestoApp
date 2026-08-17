// Definiciones de herramientas + validación. El modelo propone; acá se decide
// si se puede. Una cuenta inventada o un monto absurdo mueren en esta capa.

import type { ToolOutcome } from './run';

/** Un gasto por texto de más de 100 millones es casi siempre un typo ("999999k"). */
const MAX_AMOUNT = 100_000_000;

export interface GastoInput {
  monto: number;
  descripcion: string;
  cuenta?: string;
  fecha?: string;
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Compara nombres de cuenta ignorando mayúsculas, tildes y espacios de más. */
function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .trim();
}

export type ResolucionCuenta =
  | { kind: 'ok'; cuenta: string }
  | { kind: 'ambigua'; candidatas: string[] }
  | { kind: 'no-existe' };

/**
 * Resuelve el texto de cuenta que propone el modelo contra las cuentas reales del usuario.
 *
 * 1. Coincidencia exacta primero: si el texto coincide carácter por carácter con una
 *    cuenta, esa gana sin ambigüedad posible (el caso común, porque el prompt le pasa
 *    los nombres exactos).
 * 2. Si no hay exacta, coincidencia normalizada (ignora mayúsculas, tildes y espacios).
 * 3. Si la normalización coincide con más de una cuenta (p. ej. "Davivienda" y
 *    "DAVIVIENDA" normalizan igual), no se elige ninguna: es ambigua y hay que
 *    preguntarle al usuario.
 */
export function resolverCuenta(
  texto: string,
  accounts: string[],
): ResolucionCuenta {
  const exacta = accounts.find(a => a === texto);
  if (exacta) return { kind: 'ok', cuenta: exacta };

  const norm = normalizar(texto);
  const candidatas = accounts.filter(a => normalizar(a) === norm);
  if (candidatas.length === 1) return { kind: 'ok', cuenta: candidatas[0] };
  if (candidatas.length > 1) return { kind: 'ambigua', candidatas };
  return { kind: 'no-existe' };
}

export function validateGasto(
  input: GastoInput,
  accounts: string[],
): Validation<
  Required<Pick<GastoInput, 'monto' | 'descripcion'>> & {
    cuenta?: string;
    fecha?: string;
  }
> {
  if (!Number.isFinite(input.monto) || input.monto <= 0) {
    return {
      ok: false,
      error: 'El monto tiene que ser un número mayor que cero.',
    };
  }
  if (input.monto > MAX_AMOUNT) {
    return {
      ok: false,
      error: `El monto ${input.monto} supera el tope de ${MAX_AMOUNT}. Confirmá el valor con el usuario.`,
    };
  }
  const descripcion = (input.descripcion || '').trim();
  if (!descripcion) {
    return { ok: false, error: 'Falta la descripción del gasto.' };
  }
  if (input.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    return { ok: false, error: 'La fecha debe venir en formato YYYY-MM-DD.' };
  }

  let cuenta: string | undefined;
  if (input.cuenta) {
    const resolucion = resolverCuenta(input.cuenta, accounts);
    if (resolucion.kind === 'no-existe') {
      return {
        ok: false,
        error: `La cuenta "${input.cuenta}" no existe. Las cuentas del usuario son: ${accounts.join(', ')}. Preguntale cuál usó.`,
      };
    }
    if (resolucion.kind === 'ambigua') {
      return {
        ok: false,
        error: `La cuenta "${input.cuenta}" es ambigua: puede ser ${resolucion.candidatas.join(' o ')}. Preguntale al usuario cuál.`,
      };
    }
    cuenta = resolucion.cuenta;
  }

  return {
    ok: true,
    value: { monto: input.monto, descripcion, cuenta, fecha: input.fecha },
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'registrar_gasto',
    description:
      'Registra un gasto. Llamala una vez por cada gasto si el mensaje trae varios.',
    input_schema: {
      type: 'object',
      properties: {
        monto: {
          type: 'number',
          description: 'Monto en COP. "20k" son 20000.',
        },
        descripcion: {
          type: 'string',
          description: 'Qué se compró, sin el monto.',
        },
        cuenta: {
          type: 'string',
          description: 'Cuenta usada. Omitir si el usuario no la mencionó.',
        },
        fecha: { type: 'string', description: 'YYYY-MM-DD. Omitir si es hoy.' },
      },
      required: ['monto', 'descripcion'],
    },
  },
  {
    name: 'registrar_factura',
    description:
      'Confirma la factura que está esperando cuenta. Solo requiere la cuenta: los ítems ya están guardados.',
    input_schema: {
      type: 'object',
      properties: {
        cuenta: {
          type: 'string',
          description: 'Cuenta con la que se pagó la factura.',
        },
      },
      required: ['cuenta'],
    },
  },
  {
    name: 'corregir_ultimo',
    description: 'Corrige un campo del último gasto registrado.',
    input_schema: {
      type: 'object',
      properties: {
        campo: {
          type: 'string',
          enum: ['monto', 'descripcion', 'cuenta', 'categoria', 'fecha'],
        },
        valor: { type: 'string', description: 'El valor nuevo, como texto.' },
      },
      required: ['campo', 'valor'],
    },
  },
  {
    name: 'consultar_gastos',
    description: 'Consulta cuánto se gastó. Solo lectura.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Categoría a consultar. Omitir para el total.',
        },
        desde: { type: 'string', description: 'YYYY-MM-DD' },
        hasta: { type: 'string', description: 'YYYY-MM-DD' },
      },
    },
  },
];

export interface ToolDeps {
  accounts: string[];
  defaultAccount: string;
  today: () => string;
  createExpense: (input: {
    amount: number;
    description: string;
    accountName: string;
    date: string;
  }) => Promise<{
    ok: boolean;
    category: string;
    transactionId?: string;
    error?: string;
  }>;
  registerInvoice: (
    accountName: string,
  ) => Promise<{ ok: boolean; itemsFound: number; error?: string }>;
  correctLast: (
    campo: string,
    valor: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  queryExpenses: (q: {
    categoria?: string;
    desde?: string;
    hasta?: string;
  }) => Promise<{ total: number; categoria?: string }>;
  /** Se llama tras cada gasto creado. Enganche para las alertas de presupuesto. */
  onExpenseCreated: (categoria: string) => Promise<void>;
}

/**
 * Mensaje para cuando el texto de cuenta que mandó el modelo no resuelve a una
 * única cuenta real: cubre tanto "no existe" como "ambigua" (p. ej. `Davivienda`
 * y `DAVIVIENDA` conviven en las cuentas del usuario), para que el modelo le
 * pregunte al usuario en vez de adivinar.
 */
function mensajeCuentaNoResuelta(texto: string, deps: ToolDeps): string {
  const resolucion = resolverCuenta(texto, deps.accounts);
  if (resolucion.kind === 'ambigua') {
    return `La cuenta "${texto}" es ambigua: puede ser ${resolucion.candidatas.join(' o ')}. Preguntale al usuario cuál.`;
  }
  return `La cuenta "${texto}" no existe. Son: ${deps.accounts.join(', ')}. Preguntale cuál usó.`;
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolDeps,
): Promise<ToolOutcome> {
  try {
    if (name === 'registrar_gasto') {
      const v = validateGasto(input as unknown as GastoInput, deps.accounts);
      if (!v.ok) return { ok: false, summary: v.error };

      const res = await deps.createExpense({
        amount: v.value.monto,
        description: v.value.descripcion,
        accountName: v.value.cuenta ?? deps.defaultAccount,
        date: v.value.fecha ?? deps.today(),
      });
      if (!res.ok)
        return {
          ok: false,
          summary: `No se pudo guardar: ${res.error ?? 'error desconocido'}`,
        };

      await deps.onExpenseCreated(res.category);
      return {
        ok: true,
        summary: `Guardado: ${v.value.monto} "${v.value.descripcion}" en ${res.category} (${v.value.cuenta ?? deps.defaultAccount}).`,
      };
    }

    if (name === 'registrar_factura') {
      const cuenta = String(input.cuenta ?? '');
      const resolucion = resolverCuenta(cuenta, deps.accounts);
      if (resolucion.kind !== 'ok') {
        return { ok: false, summary: mensajeCuentaNoResuelta(cuenta, deps) };
      }
      const res = await deps.registerInvoice(resolucion.cuenta);
      if (!res.ok)
        return {
          ok: false,
          summary: `No se pudo guardar la factura: ${res.error ?? 'error'}`,
        };
      return {
        ok: true,
        summary: `Factura guardada con ${res.itemsFound} ítems en ${resolucion.cuenta}.`,
      };
    }

    if (name === 'corregir_ultimo') {
      const campo = String(input.campo ?? '');
      const valor = String(input.valor ?? '');
      if (campo === 'cuenta') {
        const resolucion = resolverCuenta(valor, deps.accounts);
        if (resolucion.kind !== 'ok') {
          return { ok: false, summary: mensajeCuentaNoResuelta(valor, deps) };
        }
        const res = await deps.correctLast(campo, resolucion.cuenta);
        // `||` y no `??`: un `error: ''` no puede colar un summary vacío.
        return res.ok
          ? { ok: true, summary: `Corregido: cuenta = ${resolucion.cuenta}.` }
          : {
              ok: false,
              summary: res.error || 'No se pudo corregir la cuenta.',
            };
      }
      const res = await deps.correctLast(campo, valor);
      return res.ok
        ? { ok: true, summary: `Corregido: ${campo} = ${valor}.` }
        : { ok: false, summary: res.error || `No se pudo corregir ${campo}.` };
    }

    if (name === 'consultar_gastos') {
      const r = await deps.queryExpenses({
        categoria: input.categoria as string | undefined,
        desde: input.desde as string | undefined,
        hasta: input.hasta as string | undefined,
      });
      return {
        ok: true,
        summary: r.categoria
          ? `Total en ${r.categoria}: ${r.total}.`
          : `Total: ${r.total}.`,
      };
    }

    return { ok: false, summary: `No existe la herramienta "${name}".` };
  } catch (err) {
    console.error(`executeTool(${name}) falló:`, err);
    return {
      ok: false,
      summary: 'Hubo un error interno ejecutando esa acción.',
    };
  }
}
