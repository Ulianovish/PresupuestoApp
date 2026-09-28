/**
 * Crea en Twilio Content la plantilla de la lista "¿con qué cuenta fue?" del
 * bot de WhatsApp (tipo `twilio/list-picker`) e imprime su SID, que va en la
 * variable de entorno TWILIO_CONTENT_SID_CUENTAS.
 *
 * Se corre UNA vez, a mano (no va al CI ni al deploy):
 *
 *   bun scripts/crear-plantilla-cuentas.ts
 *
 * Necesita TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN en el entorno (bun lee el
 * .env / .env.local solo). Cada corrida crea una plantilla NUEVA: si ya existe
 * una `elegir_cuenta_6`, reusá su SID en vez de correrlo de nuevo.
 *
 * Una sola plantilla sirve para todos: todos los campos son variables. `{{1}}`
 * es el cuerpo y cada ítem i (0..5) usa `{{2+3i}}` id, `{{3+3i}}` título y
 * `{{4+3i}}` descripción — 19 variables, siempre 6 ítems (ver
 * `armarVariablesLista` en src/lib/whatsapp/account-picker.ts). El
 * list-picker va solo dentro de la ventana de 24 h y no necesita aprobación
 * de WhatsApp.
 */

/* eslint-disable no-console -- script de consola: imprimir es su trabajo */

const ITEMS = 6;

const EJEMPLOS: Array<[string, string]> = [
  ['TC Davivienda', 'Tarjeta de crédito'],
  ['Nequi Migue', 'Cuenta bancaria'],
  ['Nequi Milo', 'Cuenta bancaria'],
  ['Efectivo', 'Efectivo'],
  ['TC Falabella', 'Tarjeta de crédito'],
  ['Ahorros Nu', 'Cuenta bancaria'],
];

function armarPlantilla() {
  const variables: Record<string, string> = {
    '1': 'Lo anoté en Efectivo. ¿Con qué cuenta fue?',
  };
  const items: Array<{ id: string; item: string; description: string }> = [];
  for (let i = 0; i < ITEMS; i++) {
    const [id, titulo, descripcion] = [2 + 3 * i, 3 + 3 * i, 4 + 3 * i];
    items.push({
      id: `{{${id}}}`,
      item: `{{${titulo}}}`,
      description: `{{${descripcion}}}`,
    });
    // Valores de muestra (Twilio los pide para previsualizar); el id de
    // verdad es `cta:<pregunta>:<cuenta>`.
    variables[String(id)] =
      `cta:00000000-0000-4000-8000-00000000000${i}:00000000-0000-4000-8000-00000000000${i}`;
    variables[String(titulo)] = EJEMPLOS[i][0];
    variables[String(descripcion)] = EJEMPLOS[i][1];
  }
  return {
    friendly_name: 'elegir_cuenta_6',
    language: 'es',
    variables,
    types: {
      'twilio/list-picker': {
        body: '{{1}}',
        button: 'Elegir cuenta',
        items,
      },
    },
  };
}

async function main(): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error(
      'Faltan TWILIO_ACCOUNT_SID y/o TWILIO_AUTH_TOKEN en el entorno.',
    );
    process.exit(1);
  }

  const res = await fetch('https://content.twilio.com/v1/Content', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(armarPlantilla()),
  });
  const texto = await res.text();
  if (!res.ok) {
    console.error(`Twilio respondió ${res.status}: ${texto}`);
    process.exit(1);
  }
  const creada = JSON.parse(texto) as { sid?: string };
  console.log(`Plantilla creada. SID: ${creada.sid}`);
  console.log(
    `Poné TWILIO_CONTENT_SID_CUENTAS=${creada.sid} en Vercel (y en tu .env).`,
  );
}

void main();
