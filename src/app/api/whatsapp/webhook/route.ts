// POST /api/whatsapp/webhook
// Webhook público de Twilio (fuera del middleware de auth). Valida la firma,
// resuelve el comando de vinculación y responde con TwiML síncrono.

import { NextRequest } from 'next/server';

import {
  getLinkByPhone,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
import { handleLinkingMessage } from '@/lib/whatsapp/handle-linking';
import { normalizeWhatsappFrom } from '@/lib/whatsapp/message';
import { isValidTwilioSignature } from '@/lib/whatsapp/twilio-signature';
import { twimlEmpty, twimlMessage } from '@/lib/whatsapp/twiml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function xml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!authToken || !webhookUrl) {
    return new Response('Webhook no configurado', { status: 500 });
  }

  // Twilio envía application/x-www-form-urlencoded.
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = typeof value === 'string' ? value : '';
  }

  const signature = request.headers.get('x-twilio-signature') || '';
  if (!isValidTwilioSignature(authToken, signature, webhookUrl, params)) {
    return new Response('Firma inválida', { status: 403 });
  }

  const phone = normalizeWhatsappFrom(params.From || '');
  if (!phone) {
    return xml(twimlEmpty());
  }

  const reply = await handleLinkingMessage(phone, params.Body || '', {
    redeemLinkCode,
    getLinkByPhone,
  });

  return xml(twimlMessage(reply));
}
