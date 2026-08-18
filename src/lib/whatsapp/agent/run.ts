// El bucle del agente: manda el mensaje al Gateway, ejecuta las herramientas
// que pida y vuelve, hasta que responda texto o se agoten las vueltas.
// callGateway y executeTool se inyectan para poder testear sin red.

import { buildSystemPrompt, type PromptContext } from './prompt';
import { TOOL_DEFINITIONS } from './tools';

import type { Turn } from './state';

/** Tope de vueltas. Un modelo en bucle no puede colgar la función serverless. */
const MAX_ITERACIONES = 3;

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
    // segunda vez.
    console.error('runAgent: falló el Gateway:', err);
    return {
      kind: 'service_error',
      huboEscrituras: resultadosHerramientas.some(r => r.wrote),
    };
  }

  // Si el cierre fue genuino y trajo texto, ese es el mensaje. Si no (se
  // agotaron las vueltas a mitad de una tanda de herramientas, o el modelo
  // cerró sin texto), componemos la respuesta con lo que sí se ejecutó: nunca
  // devolvemos el comentario viejo de una vuelta anterior ni una cadena vacía
  // que le haga creer al usuario que no pasó nada.
  let textoFinal = terminoNaturalmente ? ultimoTexto : '';
  if (!textoFinal) {
    // Se incluye TODO lo que escribió, no solo lo que salió `ok`: un
    // `registrar_factura` parcial es `ok:false` y aun así dejó transacciones
    // reales. Dejarlo afuera hacía que el fallback dijera "No pude completar la
    // acción. Probá de nuevo" — exactamente lo que empuja a duplicar la
    // factura, y lo contrario de lo que el summary de esa herramienta se
    // esfuerza en explicar.
    const conEfecto = resultadosHerramientas.filter(r => r.ok || r.wrote);
    // `userSummary` y no `summary`: el segundo está escrito PARA EL MODELO
    // (montos crudos, instrucciones tipo "decile al usuario que...").
    textoFinal =
      conEfecto.length > 0
        ? conEfecto.map(r => r.userSummary ?? r.summary).join('\n')
        : 'No pude completar la acción. Probá de nuevo.';
  }

  return { text: textoFinal, calls: ejecutadas };
}

/** Llamada real al Gateway. Se inyecta en producción; los tests la reemplazan. */
export async function callGatewayReal(
  messages: GatewayMessage[],
  system: string,
): Promise<{ stop_reason?: string; content?: unknown[] } | undefined> {
  // Mismo encadenado que vision.ts y categorizer.ts: en producción la variable
  // todavía se llama MINIMAX_API_KEY (quedó del proveedor anterior). Leer solo
  // AI_GATEWAY_API_KEY haría que el agente lance SIEMPRE, cayera al parser viejo
  // y pareciera que funciona — el bot respondería igual que antes y nadie se
  // enteraría de que el agente nunca se ejecutó.
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error('falta AI_GATEWAY_API_KEY (ni MINIMAX_API_KEY como respaldo)');
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  const model = process.env.AGENT_MODEL || 'google/gemini-3-flash';

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
    // Presupuesto de tiempo: un Gateway colgado no puede llevarse la función.
    // Vercel la mata SIN ejecutar ningún catch, y ahí el usuario se queda sin
    // respuesta — la misma falla muda que tuvo el CUFE.
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const detalle = await res.text().catch(() => '');
    throw new Error(`Gateway ${res.status}: ${detalle.slice(0, 300)}`);
  }
  return res.json();
}
