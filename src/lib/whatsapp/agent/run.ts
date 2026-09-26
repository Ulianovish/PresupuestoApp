// El bucle del agente: manda el mensaje al Gateway, ejecuta las herramientas
// que pida y vuelve, hasta que responda texto o se agoten las vueltas.
// callGateway y executeTool se inyectan para poder testear sin red.

import { buildSystemPrompt, type PromptContext } from './prompt';
import { TOOL_DEFINITIONS } from './tools';

import type { Turn } from './state';

/** Tope de vueltas. Un modelo en bucle no puede colgar la función serverless. */
const MAX_ITERACIONES = 3;

/**
 * Status que vale la pena reintentar: saturación o fallo pasajero del
 * proveedor. Cualquier 5xx entra además por `esReintentable`.
 */
const STATUS_REINTENTABLES = new Set([408, 409, 429]);

function esReintentable(status: number): boolean {
  return STATUS_REINTENTABLES.has(status) || status >= 500;
}

/**
 * Esperas entre intentos (sin `Retry-After`). Tres reintentos en ~17 s: el
 * 429 del plan gratuito es por RÁFAGA, y con 1,5 s + 3 s el tercer intento
 * todavía caía dentro de la misma ventana — así se perdió la respuesta del
 * incidente "40k carne / 14k huevos".
 */
const ESPERAS_MS = [2_000, 5_000, 10_000];
const MAX_INTENTOS_GATEWAY = ESPERAS_MS.length + 1;
/** Jitter para que dos turnos simultáneos no reintenten en el mismo instante. */
const JITTER_MAX_MS = 500;
/** Tope por espera, aunque el Gateway pida más con `Retry-After`. */
const ESPERA_MAX_MS = 15_000;
const TIMEOUT_INTENTO_MS = 30_000;
/**
 * Presupuesto total de UNA llamada, reintentos incluidos. `runAgent` puede
 * llamar hasta MAX_ITERACIONES veces y la función vive 300 s (maxDuration del
 * webhook): 3 × 60 s deja margen para las herramientas. Pasado eso Vercel la
 * mata sin correr ningún catch y el usuario se queda sin respuesta.
 */
const PRESUPUESTO_TOTAL_MS = 60_000;
/** Un intento con menos margen que esto no tiene chance real: no se arranca. */
const INTENTO_MINIMO_MS = 5_000;

function dormirReal(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Falla del Gateway con lo necesario para diagnosticar el próximo incidente
 * (429 vs 5xx vs timeout vs red) sin loguear el contenido del mensaje.
 */
export class GatewayError extends Error {
  /** Status HTTP, o undefined si ni siquiera hubo respuesta (red/timeout). */
  readonly status?: number;

  constructor(message: string, status?: number, cause?: unknown) {
    super(message, { cause });
    this.name = 'GatewayError';
    this.status = status;
  }
}

/** `Retry-After` en segundos (o fecha HTTP) → ms. null si no vino o no se entiende. */
function leerRetryAfter(valor: string | null, ahora: number): number | null {
  if (!valor) return null;
  const segundos = Number(valor);
  if (Number.isFinite(segundos) && segundos >= 0) return segundos * 1000;
  const fecha = Date.parse(valor);
  return Number.isNaN(fecha) ? null : Math.max(0, fecha - ahora);
}

/** Opciones inyectables de `callGatewayReal`: los tests no esperan de verdad. */
export interface OpcionesGateway {
  dormir?: (ms: number) => Promise<void>;
  ahora?: () => number;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolOutcome {
  ok: boolean;
  /** Texto corto que se le devuelve al modelo como resultado. */
  summary: string;
  /**
   * Texto para el USUARIO (montos formateados, sin instrucciones al modelo).
   * Se usa cuando hay que responder sin que el modelo redacte: se agotaron las
   * vueltas o el Gateway se cayó a mitad del bucle.
   */
  userSummary?: string;
  /**
   * true si la herramienta escribió en la base — incluido el fallo parcial de
   * una factura, donde los ítems ya creados son transacciones reales.
   *
   * Es el dato que evita el gasto duplicado: sin él, un Gateway que falla
   * DESPUÉS de que una herramienta escribió se veía igual que un Gateway que
   * nunca respondió, y el modo degradado volvía a registrar lo mismo.
   */
  wrote?: boolean;
}

export type AgentReply =
  | { text: string; calls: ToolCall[] }
  | {
      kind: 'service_error';
      /** Si es true, NO se puede reintentar nada: ya hay escrituras hechas. */
      huboEscrituras: boolean;
      /**
       * Lo que SÍ quedó hecho antes del corte, en texto para el usuario (una
       * línea por herramienta). Solo viene si hubo escrituras: sin esto el
       * llamador solo podía mandar un aviso genérico y el usuario no sabía qué
       * gastos se habían guardado.
       */
      resumen?: string;
    };

type GatewayMessage = { role: 'user' | 'assistant'; content: unknown };

export interface AgentRunDeps {
  callGateway: (
    messages: GatewayMessage[],
    system: string,
  ) => Promise<{ stop_reason?: string; content?: unknown[] } | undefined>;
  executeTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<ToolOutcome>;
}

export type AgentContextForRun = PromptContext & { turns: Turn[] };

export async function runAgent(
  mensaje: string,
  ctx: AgentContextForRun,
  deps: AgentRunDeps,
): Promise<AgentReply> {
  const system = buildSystemPrompt(ctx);
  const messages: GatewayMessage[] = [
    ...ctx.turns.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: mensaje },
  ];

  const ejecutadas: ToolCall[] = [];
  const resultadosHerramientas: ToolOutcome[] = [];
  // Texto de la última vuelta, se pisa en cada iteración (a diferencia de
  // `textoFinal`, nunca queda "viejo" de una vuelta anterior).
  let ultimoTexto = '';
  // Solo es un cierre genuino si el modelo dejó de pedir herramientas. Si el
  // bucle termina porque se acabaron las vueltas, `ultimoTexto` pertenece a
  // una respuesta a mitad de camino y no se le puede mostrar al usuario.
  let terminoNaturalmente = false;

  try {
    for (let vuelta = 0; vuelta < MAX_ITERACIONES; vuelta++) {
      const data = await deps.callGateway(messages, system);
      const bloques = Array.isArray(data?.content) ? data.content : [];

      const texto = bloques
        .filter(
          (b): b is { type: string; text: string } =>
            (b as { type?: string })?.type === 'text',
        )
        .map(b => b.text)
        .join('')
        .trim();
      ultimoTexto = texto;

      const llamadas = bloques.filter(
        (
          b,
        ): b is {
          type: string;
          id: string;
          name: string;
          input: Record<string, unknown>;
        } => (b as { type?: string })?.type === 'tool_use',
      );

      if (llamadas.length === 0) {
        terminoNaturalmente = true;
        break;
      }

      messages.push({ role: 'assistant', content: bloques });

      const resultados: unknown[] = [];
      for (const ll of llamadas) {
        // Una excepción acá es un bug de la herramienta, no una falla del
        // Gateway: no puede caer en el catch grande ni reportarse como
        // service_error. El modelo recibe un tool_result de error y puede
        // reaccionar (reintentar, avisar, pedir otro dato).
        let out: ToolOutcome;
        try {
          out = await deps.executeTool(ll.name, ll.input ?? {});
        } catch (errHerramienta) {
          console.error(
            `runAgent: la herramienta "${ll.name}" lanzó una excepción:`,
            errHerramienta,
          );
          out = {
            ok: false,
            summary: 'Hubo un error interno ejecutando esa acción.',
          };
        }
        ejecutadas.push({ id: ll.id, name: ll.name, input: ll.input ?? {} });
        resultadosHerramientas.push(out);
        resultados.push({
          type: 'tool_result',
          tool_use_id: ll.id,
          content: out.summary,
          is_error: !out.ok,
        });
      }
      messages.push({ role: 'user', content: resultados });
    }
  } catch (err) {
    // No es culpa del usuario: el llamador debe decirlo así y no pedirle que
    // reformule el mensaje.
    //
    // El try envuelve TODO el bucle, así que esto también cubre el caso feo:
    // la vuelta 0 anduvo, una herramienta ESCRIBIÓ el gasto, y la vuelta 1
    // falló. Por eso se reporta si hubo escrituras: sin ese dato el llamador
    // corría el modo degradado con el mismo mensaje y registraba el gasto por
    // segunda vez. Y se manda el resumen de lo escrito, para que el usuario
    // sepa QUÉ quedó guardado en vez de un "revisá en la app" a ciegas.
    const huboEscrituras = resultadosHerramientas.some(r => r.wrote);
    // Status y clase del error, nunca el contenido del mensaje: es lo que
    // separa un 429 de un 5xx o un timeout en el próximo incidente.
    const status = err instanceof GatewayError ? err.status : undefined;
    const clase = err instanceof Error ? err.name : typeof err;
    const detalle = err instanceof Error ? err.message.slice(0, 300) : '';
    console.error(
      `runAgent: falló el Gateway status=${status ?? 'sin respuesta'} error=${clase} huboEscrituras=${huboEscrituras} herramientas=${resultadosHerramientas.length}: ${detalle}`,
    );
    return huboEscrituras
      ? {
          kind: 'service_error',
          huboEscrituras,
          resumen: resumirEfectos(resultadosHerramientas),
        }
      : { kind: 'service_error', huboEscrituras };
  }

  // Si el cierre fue genuino y trajo texto, ese es el mensaje. Si no (se
  // agotaron las vueltas a mitad de una tanda de herramientas, o el modelo
  // cerró sin texto), componemos la respuesta con lo que sí se ejecutó: nunca
  // devolvemos el comentario viejo de una vuelta anterior ni una cadena vacía
  // que le haga creer al usuario que no pasó nada.
  let textoFinal = terminoNaturalmente ? ultimoTexto : '';
  if (!textoFinal) {
    textoFinal =
      resumirEfectos(resultadosHerramientas) ??
      'No pude completar la acción. Probá de nuevo.';
  }

  return { text: textoFinal, calls: ejecutadas };
}

/**
 * Lo que tuvo efecto, en texto para el usuario (una línea por herramienta), o
 * undefined si nada lo tuvo. Se usa cuando hay que responder sin que el modelo
 * redacte: se agotaron las vueltas o el Gateway se cortó a mitad del bucle.
 */
function resumirEfectos(resultados: ToolOutcome[]): string | undefined {
  // Se incluye TODO lo que escribió, no solo lo que salió `ok`: un
  // `registrar_factura` parcial es `ok:false` y aun así dejó transacciones
  // reales. Dejarlo afuera hacía que el fallback dijera "No pude completar la
  // acción. Probá de nuevo" — exactamente lo que empuja a duplicar la
  // factura, y lo contrario de lo que el summary de esa herramienta se
  // esfuerza en explicar.
  const conEfecto = resultados.filter(r => r.ok || r.wrote);
  if (conEfecto.length === 0) return undefined;
  // `userSummary` y no `summary`: el segundo está escrito PARA EL MODELO
  // (montos crudos, instrucciones tipo "decile al usuario que...").
  return conEfecto.map(r => r.userSummary ?? r.summary).join('\n');
}

/** Llamada real al Gateway. Se inyecta en producción; los tests la reemplazan. */
export async function callGatewayReal(
  messages: GatewayMessage[],
  system: string,
  { dormir = dormirReal, ahora = Date.now }: OpcionesGateway = {},
): Promise<{ stop_reason?: string; content?: unknown[] } | undefined> {
  // Mismo encadenado que vision.ts y categorizer.ts: en producción la variable
  // todavía se llama MINIMAX_API_KEY (quedó del proveedor anterior). Leer solo
  // AI_GATEWAY_API_KEY haría que el agente lance SIEMPRE, cayera al parser viejo
  // y pareciera que funciona — el bot respondería igual que antes y nadie se
  // enteraría de que el agente nunca se ejecutó.
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error(
      'falta AI_GATEWAY_API_KEY (ni MINIMAX_API_KEY como respaldo)',
    );
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  // El default NO puede ser gemini-3-flash: está limitado en el plan gratuito
  // del Gateway y devuelve 429 siempre, mientras que los qwen de Alibaba pasan.
  // Verificado contra la cuenta real: visión (qwen3-vl) y categorizador
  // (qwen3.7-flash) funcionan; el agente con gemini fallaba en cada mensaje.
  const model = process.env.AGENT_MODEL || 'alibaba/qwen3.7-flash';

  // El plan gratuito limita por ráfaga: 2-3 mensajes seguidos alcanzan para
  // que empiece a devolver 429. `vision.ts` ya reintenta ante esos status y por
  // eso sobrevive; sin esto, el agente moría al primer tropiezo y el usuario
  // veía "mi asistente está fallando" por un límite pasajero.
  //
  // También se reintenta cuando fetch LANZA (red caída, timeout del intento):
  // es tan pasajero como un 503. Lo que acota todo es el presupuesto total de
  // tiempo, no la cantidad de intentos.
  const inicio = ahora();
  for (let intento = 1; ; intento++) {
    const transcurrido = ahora() - inicio;
    let error: GatewayError;
    let retryAfterMs: number | null = null;
    try {
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 2048,
          system,
          tools: TOOL_DEFINITIONS,
          messages,
        }),
        // Presupuesto de tiempo: un Gateway colgado no puede llevarse la
        // función. Vercel la mata SIN ejecutar ningún catch, y ahí el usuario
        // se queda sin respuesta — la misma falla muda que tuvo el CUFE. El
        // timeout de cada intento se recorta a lo que queda del presupuesto
        // total, para que un reintento no lo estire.
        signal: AbortSignal.timeout(
          Math.min(TIMEOUT_INTENTO_MS, PRESUPUESTO_TOTAL_MS - transcurrido),
        ),
      });

      if (res.ok) return res.json();

      const detalle = await res.text().catch(() => '');
      console.error(
        `callGatewayReal HTTP ${res.status} (intento ${intento}) modelo=${model} body=${detalle.slice(0, 300)}`,
      );
      error = new GatewayError(
        `Gateway ${res.status}: ${detalle.slice(0, 300)}`,
        res.status,
      );
      if (!esReintentable(res.status)) throw error;
      retryAfterMs = leerRetryAfter(res.headers.get('retry-after'), ahora());
    } catch (err) {
      // El status no reintentable de arriba (400, 401...) sale tal cual.
      if (err instanceof GatewayError) throw err;
      // Sin respuesta HTTP: red, DNS o el timeout del intento (TimeoutError).
      const clase = err instanceof Error ? err.name : typeof err;
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error(
        `callGatewayReal sin respuesta (intento ${intento}) modelo=${model} error=${clase}: ${mensaje}`,
      );
      error = new GatewayError(
        `Gateway sin respuesta: ${clase}: ${mensaje}`,
        undefined,
        err,
      );
    }

    if (intento >= MAX_INTENTOS_GATEWAY) throw error;
    const jitter = Math.floor(Math.random() * JITTER_MAX_MS);
    const espera = Math.min(
      (retryAfterMs ?? ESPERAS_MS[intento - 1]) + jitter,
      ESPERA_MAX_MS,
    );
    // Si después de esperar ya no queda margen para un intento con chances,
    // mejor fallar ahora: el llamador todavía tiene tiempo de responderle al
    // usuario (modo degradado o resumen de lo escrito).
    if (ahora() - inicio + espera + INTENTO_MINIMO_MS > PRESUPUESTO_TOTAL_MS) {
      throw error;
    }
    await dormir(espera);
  }
}
