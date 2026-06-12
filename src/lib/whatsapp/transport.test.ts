import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendWhatsAppMessage } from './transport';

describe('sendWhatsAppMessage', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'tok456');
    vi.stubEnv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886');
  });

  it('hace POST a la API de Twilio con auth básica y form body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'Hola 👋');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('AC123:tok456').toString('base64')}`);
    const body = init.body as URLSearchParams;
    expect(body.get('From')).toBe('whatsapp:+14155238886');
    expect(body.get('To')).toBe('whatsapp:+573001234567');
    expect(body.get('Body')).toBe('Hola 👋');
  });

  it('normaliza el To: no duplica el prefijo whatsapp:', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);

    await sendWhatsAppMessage('whatsapp:+573001234567', 'x');

    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get('To')).toBe('whatsapp:+573001234567');
  });

  it('devuelve ok:false si faltan credenciales (no lanza)', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'x');

    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('devuelve ok:false si Twilio responde error (no lanza)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' });
    vi.stubGlobal('fetch', fetchMock);

    const res = await sendWhatsAppMessage('+573001234567', 'x');

    expect(res.ok).toBe(false);
  });
});
