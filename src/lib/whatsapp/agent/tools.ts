// Definiciones de herramientas + validación. El modelo propone; acá se decide
// si se puede. Una cuenta inventada o un monto absurdo mueren en esta capa.

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
