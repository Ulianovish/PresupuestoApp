/**
 * Conjunto de prueba del agente de WhatsApp, contra el MODELO REAL.
 *
 * Lo que el spec pide y los tests unitarios no pueden dar: los tests mockean el
 * Gateway, así que verifican el bucle pero no el juicio del modelo. Acá pasa lo
 * contrario — el Gateway es real y las herramientas son falsas, así que NO se
 * escribe nada en la base y lo único que se mide es qué decide el modelo.
 *
 * No va al CI: cuesta plata y una respuesta de modelo no es determinista.
 * Se corre a mano antes de desplegar un cambio de prompt o de modelo.
 *
 * Necesita AI_GATEWAY_API_KEY (o MINIMAX_API_KEY) en el entorno:
 *
 *   set -a; . ./.env.vercel-tmp; set +a
 *   bunx tsx scripts/agente-golden.mjs
 *   AGENT_MODEL=anthropic/claude-haiku-4.5 bunx tsx scripts/agente-golden.mjs
 */
if (!process.env.AI_GATEWAY_API_KEY && !process.env.MINIMAX_API_KEY) {
  console.error('Falta AI_GATEWAY_API_KEY (o MINIMAX_API_KEY) en el entorno.');
  process.exit(1);
}

const CUENTAS = [
  'Nequi Migue',
  'TC Nu Bank',
  'Ahorros Nu',
  'Efectivo',
  'TC Davivienda',
  'Davivienda',
];
const CATEGORIAS = ['MERCADO', 'TRANSPORTE', 'RESTAURANTES', 'VIVIENDA', 'OTROS'];
const HOY = '2026-08-17';

/**
 * Cada caso dice qué se espera, no cómo. `verificar` recibe las llamadas que
 * hizo el modelo: [{name, input}, ...].
 */
const CASOS = [
  {
    msg: '20k taxi',
    espera: 'un registrar_gasto de 20000',
    verificar: c =>
      c.length === 1 && c[0].name === 'registrar_gasto' && c[0].input.monto === 20000,
  },
  {
    msg: '2 empanadas 5000',
    espera: 'monto 5000 (NO 2), descripción con empanadas',
    verificar: c =>
      c.length === 1 &&
      c[0].input.monto === 5000 &&
      /empanada/i.test(String(c[0].input.descripcion)),
  },
  {
    msg: '20k taxi y 15k almuerzo',
    espera: 'DOS registrar_gasto (20000 y 15000)',
    verificar: c => {
      const montos = c.filter(x => x.name === 'registrar_gasto').map(x => x.input.monto).sort();
      return montos.length === 2 && montos[0] === 15000 && montos[1] === 20000;
    },
  },
  {
    msg: 'ayer pagué 40k de gasolina',
    espera: 'fecha 2026-08-16, no hoy',
    verificar: c => c.length === 1 && c[0].input.fecha === '2026-08-16',
  },
  {
    msg: 'le pagué al taxista 20k',
    espera: 'descripción legible (menciona taxi/taxista)',
    verificar: c => c.length === 1 && /taxi/i.test(String(c[0].input.descripcion)),
  },
  {
    msg: 'gasté 35000 en mercado con la Nequi',
    espera: 'cuenta Nequi Migue resuelta del texto',
    verificar: c => c.length === 1 && c[0].input.cuenta === 'Nequi Migue',
  },
  {
    msg: '45k mercado',
    espera: 'sin cuenta (usa la de por defecto, no la inventa)',
    verificar: c =>
      c.length === 1 &&
      (c[0].input.cuenta === undefined || CUENTAS.includes(c[0].input.cuenta)),
  },
  {
    msg: 'pagué 80 mil de arriendo',
    espera: '"80 mil" = 80000',
    verificar: c => c.length === 1 && c[0].input.monto === 80000,
  },
  {
    msg: '1.5k café',
    espera: '"1.5k" = 1500',
    verificar: c => c.length === 1 && c[0].input.monto === 1500,
  },
  {
    msg: '¿cuánto llevo en mercado?',
    espera: 'consultar_gastos, sin escribir nada',
    verificar: c => c.length >= 1 && c.every(x => x.name === 'consultar_gastos'),
  },
  {
    msg: 'gasté 50k con la Bancolombia',
    espera: 'NO inventa la cuenta: o pregunta, o falla la validación',
    verificar: c =>
      c.length === 0 ||
      c.every(x => x.input.cuenta === undefined || CUENTAS.includes(x.input.cuenta)),
  },
  {
    msg: 'hola',
    espera: 'ninguna herramienta, solo texto',
    verificar: c => c.length === 0,
  },
  // Con último gasto en contexto
  {
    msg: 'no, eran 30 mil',
    ultimo: true,
    espera: 'corregir_ultimo monto=30000',
    verificar: c =>
      c.length === 1 &&
      c[0].name === 'corregir_ultimo' &&
      c[0].input.campo === 'monto' &&
      /30\s*mil|30000/i.test(String(c[0].input.valor)),
  },
  {
    msg: 'ese fue con la Nu',
    ultimo: true,
    espera: 'corregir_ultimo campo=cuenta',
    verificar: c => c.length === 1 && c[0].name === 'corregir_ultimo' && c[0].input.campo === 'cuenta',
  },
  // Con factura pendiente en contexto — el caso que el revisor marcó como riesgo
  {
    msg: 'Davivienda',
    factura: true,
    espera: 'registrar_factura con esa cuenta',
    verificar: c => c.length === 1 && c[0].name === 'registrar_factura',
  },
  {
    msg: '20k taxi',
    factura: true,
    espera: '⚠️ RIESGO: debe registrar el GASTO, no secuestrarlo con la factura',
    verificar: c => c.some(x => x.name === 'registrar_gasto' && x.input.monto === 20000),
  },
];

const ULTIMO = {
  kind: 'expense',
  transactionId: 'tx-demo',
  amount: 20000,
  description: 'taxi',
  accountName: 'Efectivo',
  category: 'TRANSPORTE',
  date: HOY,
};

const FACTURA = {
  source: 'vision_receipt',
  cufe: null,
  supplier: 'ÉXITO',
  date: HOY,
  total: 89400,
  items: [{ description: 'arroz', amount: 5000 }],
};

const { runAgent, callGatewayReal } = await import('../src/lib/whatsapp/agent/run.ts');

let ok = 0;
const fallidos = [];

// El plan gratuito del Gateway limita por ráfaga: sin pausa, a partir del 3er
// caso todo devuelve 429 y el conjunto se sabotea solo. `callGatewayReal` ya
// reintenta, pero espaciar acá evita gastar esos reintentos de entrada.
const PAUSA_MS = Number(process.env.GOLDEN_PAUSA_MS ?? 8000);
const dormir = ms => new Promise(r => setTimeout(r, ms));

for (const [i, caso] of CASOS.entries()) {
  if (i > 0) await dormir(PAUSA_MS);
  const llamadas = [];
  const ctx = {
    accounts: CUENTAS,
    categories: CATEGORIAS,
    defaultAccount: 'Efectivo',
    today: HOY,
    pendingInvoice: caso.factura ? FACTURA : null,
    lastEntity: caso.ultimo ? ULTIMO : null,
    turns: [],
  };

  let r;
  try {
    r = await runAgent(caso.msg, ctx, {
      callGateway: callGatewayReal,
      // Herramientas falsas: registran la intención del modelo y no escriben nada.
      executeTool: async (name, input) => {
        llamadas.push({ name, input });
        return { ok: true, summary: 'Listo (simulado).' };
      },
    });
  } catch (e) {
    r = { kind: 'error', detalle: e.message };
  }

  if ('kind' in r) {
    fallidos.push({ ...caso, motivo: `el Gateway falló: ${r.detalle ?? r.kind}`, llamadas });
    console.log(`✗ ${JSON.stringify(caso.msg)} — ${r.detalle ?? r.kind}`);
    continue;
  }

  const paso = caso.verificar(llamadas);
  const ctxTxt = caso.factura ? ' [factura pendiente]' : caso.ultimo ? ' [último gasto]' : '';
  if (paso) {
    ok++;
    console.log(`✓ ${JSON.stringify(caso.msg)}${ctxTxt}`);
  } else {
    fallidos.push({ ...caso, llamadas });
    console.log(`✗ ${JSON.stringify(caso.msg)}${ctxTxt}`);
    console.log(`    esperaba: ${caso.espera}`);
    console.log(`    llamó:    ${JSON.stringify(llamadas)}`);
    console.log(`    respondió: ${r.text.slice(0, 120)}`);
  }
}

console.log(`\n${ok}/${CASOS.length} — modelo: ${process.env.AGENT_MODEL || 'google/gemini-3-flash'}`);
if (fallidos.length) {
  console.log('\nRevisar:');
  for (const f of fallidos) console.log(`  · ${JSON.stringify(f.msg)} → ${f.espera}`);
}
