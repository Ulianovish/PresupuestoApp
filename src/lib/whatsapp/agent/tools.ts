// Definiciones de herramientas + validación. El modelo propone; acá se decide
// si se puede. Una cuenta inventada o un monto absurdo mueren en esta capa.

import { formatCOP } from '@/lib/whatsapp/format';

import type { ToolOutcome } from './run';

/**
 * Un gasto por texto de más de 100 millones es casi siempre un typo
 * ("999999k"). Exportada: `applyCorrection` (whatsapp-queries.ts) aplica el
 * mismo tope al corregir el monto, para no dejar una puerta trasera que
 * acepte por corrección lo que el alta rechaza.
 */
export const MAX_AMOUNT = 100_000_000;

export interface GastoInput {
  monto: number;
  descripcion: string;
  cuenta?: string;
  fecha?: string;
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Compara nombres ignorando mayúsculas, tildes y espacios de más.
 *
 * Exportada: es la ÚNICA definición del repo. `handle-image.ts` tenía su propia
 * copia sin `.trim()`, con el riesgo de que las dos divergieran y un mismo
 * nombre resolviera distinto según por qué camino entró.
 */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .trim();
}

export type Resolucion =
  | { kind: 'ok'; valor: string }
  | { kind: 'ambigua'; candidatas: string[] }
  | { kind: 'no-existe' };

/**
 * Resuelve un texto libre del modelo contra los nombres reales del usuario
 * (cuentas, categorías).
 *
 * 1. Coincidencia exacta primero: si el texto coincide carácter por carácter con un
 *    nombre, ese gana sin ambigüedad posible (el caso común, porque el prompt le pasa
 *    los nombres exactos).
 * 2. Si no hay exacta, coincidencia normalizada (ignora mayúsculas, tildes y espacios).
 * 3. Si la normalización coincide con más de un nombre (p. ej. "Davivienda" y
 *    "DAVIVIENDA" normalizan igual), no se elige ninguno: es ambiguo y hay que
 *    preguntarle al usuario.
 */
export function resolverNombre(texto: string, nombres: string[]): Resolucion {
  const exacta = nombres.find(n => n === texto);
  if (exacta) return { kind: 'ok', valor: exacta };

  const norm = normalizar(texto);
  const candidatas = nombres.filter(n => normalizar(n) === norm);
  if (candidatas.length === 1) return { kind: 'ok', valor: candidatas[0] };
  if (candidatas.length > 1) return { kind: 'ambigua', candidatas };
  return { kind: 'no-existe' };
}

export type ResolucionCuenta =
  | { kind: 'ok'; cuenta: string }
  | { kind: 'ambigua'; candidatas: string[] }
  | { kind: 'no-existe' };

/**
 * `resolverNombre` para cuentas. Conserva el campo `cuenta` que ya leen los
 * llamadores en vez de obligarlos a hablar de "valor".
 */
export function resolverCuenta(
  texto: string,
  accounts: string[],
): ResolucionCuenta {
  const r = resolverNombre(texto, accounts);
  return r.kind === 'ok' ? { kind: 'ok', cuenta: r.valor } : r;
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
          // 'item' es el ítem del presupuesto al que se imputa el gasto (lo
          // asigna la IA al registrarlo y a veces se equivoca). Corregirlo por
          // chat lo marca como manual, para que la reclasificación no lo pise.
          enum: ['monto', 'descripcion', 'cuenta', 'categoria', 'item', 'fecha'],
        },
        valor: { type: 'string', description: 'El valor nuevo, como texto.' },
      },
      required: ['campo', 'valor'],
    },
  },
  {
    name: 'consultar_gastos',
    description:
      'Consulta cuánto se gastó. Solo lectura. Sin desde/hasta se responde por el MES EN CURSO, no por toda la historia.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          description: 'Categoría a consultar. Omitir para el total.',
        },
        desde: {
          type: 'string',
          description: 'YYYY-MM-DD. Omitir para el mes en curso.',
        },
        hasta: {
          type: 'string',
          description: 'YYYY-MM-DD. Omitir para el mes en curso.',
        },
      },
    },
  },
];

export interface ToolDeps {
  accounts: string[];
  /**
   * Categorías reales del usuario. Sin esto, una categoría inventada por el
   * modelo se escribía tal cual en `category_name` y el gasto quedaba fuera de
   * todo reporte, en silencio.
   */
  categories: string[];
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
  registerInvoice: (accountName: string) => Promise<{
    ok: boolean;
    itemsFound: number;
    totalItems: number;
    /** Suma de lo que EFECTIVAMENTE quedó en `transactions` (ver I3). */
    totalAmount?: number;
    error?: string;
  }>;
  correctLast: (
    campo: string,
    valor: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  queryExpenses: (q: {
    categoria?: string;
    desde?: string;
    hasta?: string;
  }) => Promise<{
    total: number;
    categoria?: string;
    desde: string;
    hasta: string;
    /** true si el período lo puso el default (mes en curso), no el modelo. */
    mesEnCurso: boolean;
  }>;
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

/**
 * Mensaje para cuando la categoría que mandó el modelo no es una de las reales
 * del usuario. Escribirla igual dejaría el gasto fuera de todo reporte sin que
 * nadie se entere: es preferible que el modelo pregunte.
 */
function mensajeCategoriaNoResuelta(texto: string, deps: ToolDeps): string {
  const resolucion = resolverNombre(texto, deps.categories);
  if (resolucion.kind === 'ambigua') {
    return `La categoría "${texto}" es ambigua: puede ser ${resolucion.candidatas.join(' o ')}. Preguntale al usuario cuál.`;
  }
  return `La categoría "${texto}" no existe. Son: ${deps.categories.join(', ')}. Preguntale cuál corresponde.`;
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

      // Best-effort: el gasto YA está guardado. Si el enganche de alertas
      // (futuro) lanza, no puede convertir un gasto real en un "no se pudo
      // guardar" que empuje al modelo a reintentar y duplicarlo (mismo
      // criterio que la asignación de ítem de presupuesto en createDirectExpense).
      try {
        await deps.onExpenseCreated(res.category);
      } catch (errAlerta) {
        console.error(
          'executeTool(registrar_gasto): onExpenseCreated falló:',
          errAlerta,
        );
      }
      const cuentaUsada = v.value.cuenta ?? deps.defaultAccount;
      return {
        ok: true,
        wrote: true,
        summary: `Guardado: ${v.value.monto} "${v.value.descripcion}" en ${res.category} (${cuentaUsada}).`,
        userSummary: `✅ Anotado ${formatCOP(v.value.monto)} en ${res.category} (${cuentaUsada}) · ${v.value.descripcion}.`,
      };
    }

    if (name === 'registrar_factura') {
      const cuenta = String(input.cuenta ?? '');
      const resolucion = resolverCuenta(cuenta, deps.accounts);
      if (resolucion.kind !== 'ok') {
        return { ok: false, summary: mensajeCuentaNoResuelta(cuenta, deps) };
      }
      const res = await deps.registerInvoice(resolucion.cuenta);
      if (res.ok) {
        // El total que se confirma es el que EFECTIVAMENTE se registró (suma
        // de los ítems), no el de la cabecera de la factura: con descuentos o
        // redondeos difieren y el usuario ve un número que no está en la app.
        const totalTexto =
          res.totalAmount != null ? ` por ${formatCOP(res.totalAmount)}` : '';
        return {
          ok: true,
          wrote: true,
          summary: `Factura guardada con ${res.itemsFound} ítems en ${resolucion.cuenta}${res.totalAmount != null ? ` (total registrado ${res.totalAmount})` : ''}.`,
          userSummary: `✅ Registré tu factura${totalTexto} (${res.itemsFound} ítems) en ${resolucion.cuenta}.`,
        };
      }
      // Fallo parcial: algunos ítems SÍ quedaron guardados (son transacciones
      // reales). Decirle al modelo "no se guardó nada" lo empujaría a
      // ofrecerle al usuario reenviar la foto, duplicando esos ítems.
      if (res.itemsFound > 0) {
        return {
          ok: false,
          wrote: true,
          summary: `Se registraron ${res.itemsFound} de ${res.totalItems} ítems en ${resolucion.cuenta} (esos ya son gastos reales). Decile al usuario que cargue a mano en Gastos los que faltan, NO le sugieras reenviar la factura ni el CUFE.`,
          userSummary: `⚠️ Registré ${res.itemsFound} de ${res.totalItems} ítems de tu factura en ${resolucion.cuenta} (esos ya están en tus gastos, no se perdieron). Los que faltan, cargalos a mano en Gastos; no la reenvíes, duplicaría los que ya quedaron.`,
        };
      }
      return {
        ok: false,
        summary: `No se pudo guardar la factura: ${res.error ?? 'error'}`,
      };
    }

    if (name === 'corregir_ultimo') {
      const campo = String(input.campo ?? '');
      const valor = String(input.valor ?? '');
      // Cuenta y categoría se canonicalizan contra lo que el usuario tiene de
      // verdad: un nombre inventado se escribía tal cual y el gasto quedaba
      // fuera de todo reporte (categoría) o apuntando a nada (cuenta).
      if (campo === 'cuenta' || campo === 'categoria') {
        const opciones = campo === 'cuenta' ? deps.accounts : deps.categories;
        const resolucion = resolverNombre(valor, opciones);
        if (resolucion.kind !== 'ok') {
          return {
            ok: false,
            summary:
              campo === 'cuenta'
                ? mensajeCuentaNoResuelta(valor, deps)
                : mensajeCategoriaNoResuelta(valor, deps),
          };
        }
        const res = await deps.correctLast(campo, resolucion.valor);
        // `||` y no `??`: un `error: ''` no puede colar un summary vacío.
        return res.ok
          ? {
              ok: true,
              wrote: true,
              summary: `Corregido: ${campo} = ${resolucion.valor}.`,
              userSummary: `✅ Corregido: ${campo} = ${resolucion.valor}.`,
            }
          : {
              ok: false,
              summary: res.error || `No se pudo corregir ${campo}.`,
            };
      }
      const res = await deps.correctLast(campo, valor);
      return res.ok
        ? {
            ok: true,
            wrote: true,
            summary: `Corregido: ${campo} = ${valor}.`,
            userSummary: `✅ Corregido: ${campo} = ${valor}.`,
          }
        : { ok: false, summary: res.error || `No se pudo corregir ${campo}.` };
    }

    if (name === 'consultar_gastos') {
      const pedida = input.categoria as string | undefined;
      let categoria: string | undefined;
      if (pedida) {
        const resolucion = resolverNombre(pedida, deps.categories);
        if (resolucion.kind !== 'ok') {
          return {
            ok: false,
            summary: mensajeCategoriaNoResuelta(pedida, deps),
          };
        }
        categoria = resolucion.valor;
      }
      const r = await deps.queryExpenses({
        categoria,
        desde: input.desde as string | undefined,
        hasta: input.hasta as string | undefined,
      });
      // El período SIEMPRE se dice: un total sin ventana temporal se lee como
      // "lo de este mes" y puede ser 10 veces más.
      const periodo = r.mesEnCurso
        ? 'este mes'
        : `entre ${r.desde} y ${r.hasta}`;
      return {
        ok: true,
        summary: r.categoria
          ? `Total en ${r.categoria} ${periodo}: ${r.total}.`
          : `Total ${periodo}: ${r.total}.`,
        userSummary: r.categoria
          ? `Total en ${r.categoria} ${periodo}: ${formatCOP(r.total)}.`
          : `Total ${periodo}: ${formatCOP(r.total)}.`,
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
