/**
 * Llamada al modelo que lee un extracto. Vive en el servidor porque la llave
 * del gateway no puede salir al navegador.
 */

import {
  buildExtractoPrompt,
  parseExtractoResponse,
  recortarTexto,
  type ContextoDeuda,
  type FilaExtracto,
} from './extracto';

export interface ResultadoExtracto {
  filas: FilaExtracto[];
  error?: string;
}

export async function leerExtractoConIA(
  texto: string,
  deuda: ContextoDeuda,
): Promise<ResultadoExtracto> {
  const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.error('leerExtractoConIA: falta AI_GATEWAY_API_KEY');
    return { filas: [], error: 'El lector de extractos no está configurado.' };
  }

  const baseUrl =
    process.env.AI_GATEWAY_BASE_URL ||
    process.env.MINIMAX_BASE_URL ||
    'https://ai-gateway.vercel.sh';
  const model =
    process.env.EXTRACTO_MODEL ||
    process.env.CATEGORIZE_MODEL ||
    'alibaba/qwen3.7-flash';

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
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: buildExtractoPrompt(recortarTexto(texto), deuda),
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`IA respondió ${res.status}`);

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const contenido = Array.isArray(data.content)
      ? data.content.map(c => c?.text ?? '').join('')
      : null;

    return { filas: parseExtractoResponse(contenido) };
  } catch (error) {
    console.error('Error leyendo el extracto con IA:', error);
    return { filas: [], error: 'No se pudo leer el extracto.' };
  }
}
