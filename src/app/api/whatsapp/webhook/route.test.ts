import { beforeEach, describe, expect, it, vi } from 'vitest';

// Lo que se agenda con after() se junta acá para esperarlo en el test.
const enSegundoPlano: Array<Promise<unknown>> = [];

vi.mock('next/server', async importOriginal => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (fn: () => Promise<unknown>) => {
    enSegundoPlano.push(fn());
  },
}));
vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('@/lib/whatsapp/twilio-signature', () => ({
  isValidTwilioSignature: vi.fn(() => true),
}));
vi.mock('@/lib/services/whatsapp-links', () => ({
  getLinkByPhone: vi.fn(),
  redeemLinkCode: vi.fn(),
}));
vi.mock('@/lib/whatsapp/classify', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/whatsapp/classify')>();
  return { ...real, classifyText: vi.fn(real.classifyText) };
});
vi.mock('@/lib/whatsapp/account-prompt', () => ({
  manejarEleccionCuenta: vi.fn(),
  intentarCuentaEscrita: vi.fn(),
  preguntarCuenta: vi.fn(),
}));
vi.mock('@/lib/whatsapp/account-prompt-deps', () => ({
  depsEleccionCuenta: vi.fn(() => ({ fake: 'eleccion' })),
  depsPreguntaCuenta: vi.fn(() => ({ fake: 'pregunta' })),
}));
vi.mock('@/lib/whatsapp/agent/turn', () => ({
  handleAgentTurn: vi.fn(),
  listarCuentas: vi.fn(),
}));
vi.mock('@/lib/whatsapp/transport', () => ({
  sendWhatsAppMessage: vi.fn(),
  sendWhatsAppContent: vi.fn(),
  downloadTwilioMedia: vi.fn(),
}));

import { getLinkByPhone } from '@/lib/services/whatsapp-links';
import {
  intentarCuentaEscrita,
  manejarEleccionCuenta,
} from '@/lib/whatsapp/account-prompt';
import { handleAgentTurn } from '@/lib/whatsapp/agent/turn';
import { classifyText } from '@/lib/whatsapp/classify';

import { POST } from './route';

const PROMPT = '11111111-2222-4333-8444-555555555555';
const CUENTA = '93b01c7a-5e70-43b6-8d1e-c7eb9122bb07';
const TEL = '+573001111111';

function post(params: Record<string, string>) {
  const req = new Request('https://app.test/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'firma',
    },
    body: new URLSearchParams(params).toString(),
  });
  return POST(req as unknown as Parameters<typeof POST>[0]);
}

async function terminar() {
  await Promise.all(enSegundoPlano.splice(0));
}

describe('webhook de WhatsApp: lista de cuentas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enSegundoPlano.length = 0;
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok');
    vi.stubEnv('WHATSAPP_WEBHOOK_URL', 'https://app.test/api/whatsapp/webhook');
    vi.mocked(getLinkByPhone).mockResolvedValue({
      userId: 'u1',
    } as unknown as Awaited<ReturnType<typeof getLinkByPhone>>);
    vi.mocked(intentarCuentaEscrita).mockResolvedValue(false);
  });

  it('un toque en la lista se maneja ANTES de clasificar el texto (el Body es el título, no un gasto)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await post({
      From: `whatsapp:${TEL}`,
      Body: 'TC Davivienda',
      ListId: `cta:${PROMPT}:${CUENTA}`,
      ListTitle: 'TC Davivienda',
      NumMedia: '0',
    });
    await terminar();

    expect(res.status).toBe(200);
    expect(classifyText).not.toHaveBeenCalled();
    expect(handleAgentTurn).not.toHaveBeenCalled();
    expect(manejarEleccionCuenta).toHaveBeenCalledWith(
      { fake: 'eleccion' },
      { userId: 'u1', phone: TEL, promptId: PROMPT, accountId: CUENTA },
    );
    // Se loguean los NOMBRES de los parámetros (para confirmar en producción
    // qué manda Twilio con un list-picker), nunca los valores.
    const logueado = info.mock.calls.map(c => c.join(' ')).join('\n');
    expect(logueado).toContain('ListId');
    expect(logueado).toContain('ListTitle');
    expect(logueado).not.toContain(PROMPT);
    expect(logueado).not.toContain(TEL);
    info.mockRestore();
  });

  it('un ListId que no es nuestro no toca nada y tampoco va al agente', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const res = await post({
      From: `whatsapp:${TEL}`,
      Body: 'TC Davivienda',
      ListId: 'cualquier-cosa',
      NumMedia: '0',
    });
    await terminar();

    expect(manejarEleccionCuenta).not.toHaveBeenCalled();
    expect(classifyText).not.toHaveBeenCalled();
    expect(handleAgentTurn).not.toHaveBeenCalled();
    expect(await res.text()).toMatch(/no reconoc/i);
  });

  it('texto normal: primero prueba si es el nombre de una cuenta; si lo es, no pasa al agente', async () => {
    vi.mocked(intentarCuentaEscrita).mockResolvedValue(true);
    await post({ From: `whatsapp:${TEL}`, Body: 'Nequi Coco', NumMedia: '0' });
    await terminar();

    expect(intentarCuentaEscrita).toHaveBeenCalledWith(
      { fake: 'eleccion' },
      { userId: 'u1', phone: TEL, body: 'Nequi Coco' },
    );
    expect(handleAgentTurn).not.toHaveBeenCalled();
  });

  it('texto normal que no es una cuenta sigue yendo al agente', async () => {
    await post({ From: `whatsapp:${TEL}`, Body: '40k huevos', NumMedia: '0' });
    await terminar();

    expect(handleAgentTurn).toHaveBeenCalledWith({
      userId: 'u1',
      phone: TEL,
      body: '40k huevos',
    });
  });
});
