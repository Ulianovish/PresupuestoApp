// POST /api/whatsapp/webhook
// Webhook público de Twilio. Valida la firma, resuelve identidad y:
//  - número NO vinculado → flujo de vinculación síncrono (TwiML).
//  - vinculado → clasifica el texto, responde un ACK síncrono y, si hay trabajo
//    lento (CUFE / gasto), lo corre en after() respondiendo por la REST API.

import { after, NextRequest } from 'next/server';

import {
  prepareInvoiceProcessing,
  runInvoiceProcessing,
} from '@/lib/dian/process-invoice';
import { resolveUserCategoryNames } from '@/lib/services/invoices';
import {
  createDirectExpense,
  createVisionReceiptDraft,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import {
  getLinkByPhone,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
import { createAdminClient } from '@/lib/supabase/server';
import { ackMessage, classifyText, simpleReply } from '@/lib/whatsapp/classify';
import {
  handleAgentMessage,
  type CufeOutcome,
} from '@/lib/whatsapp/handle-agent';
import { handleImageMessage } from '@/lib/whatsapp/handle-image';
import { handleLinkingMessage } from '@/lib/whatsapp/handle-linking';
import { normalizeWhatsappFrom } from '@/lib/whatsapp/message';
import {
  downloadTwilioMedia,
  sendWhatsAppMessage,
} from '@/lib/whatsapp/transport';
import { isValidTwilioSignature } from '@/lib/whatsapp/twilio-signature';
import { twimlEmpty, twimlMessage } from '@/lib/whatsapp/twiml';
import { analyzeImage } from '@/lib/whatsapp/vision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function xml(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

/** Procesa un CUFE para WhatsApp con service-role; mapea el resultado a CufeOutcome. */
async function processCufeForWhatsApp(
  userId: string,
  cufe: string,
): Promise<CufeOutcome> {
  const admin = createAdminClient();
  const prep = await prepareInvoiceProcessing(userId, cufe, admin);
  if (prep.kind === 'duplicate') return { ok: false, reason: 'duplicate' };
  if (prep.kind === 'error') return { ok: false, reason: 'error', message: prep.message };

  const categoryNames = await resolveUserCategoryNames(admin, userId);
  const run = await runInvoiceProcessing(prep.invoiceId, cufe, {
    categoryNames,
    client: admin,
  });
  if (run.ok) return { ok: true, itemsFound: run.itemsFound };
  return { ok: false, reason: 'error', message: run.message };
}

function todayYmd(): string {
  // Fecha "hoy" en horario de Colombia (no UTC): en-CA formatea YYYY-MM-DD.
  // Evita adelantar el día para gastos enviados de noche (UTC-5).
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  if (!authToken || !webhookUrl) {
    return new Response('Webhook no configurado', { status: 500 });
  }

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

  const body = params.Body || '';
  const numMedia = Number.parseInt(params.NumMedia || '0', 10) || 0;

  // ¿Vinculado?
  const link = await getLinkByPhone(phone);
  if (!link) {
    // Flujo de vinculación (Plan 2): síncrono.
    const reply = await handleLinkingMessage(phone, body, {
      redeemLinkCode,
      getLinkByPhone,
    });
    return xml(twimlMessage(reply));
  }

  const decision = classifyText(body, numMedia);

  if (decision === 'image') {
    const mediaUrl = params.MediaUrl0 || '';
    const mediaType = params.MediaContentType0 || 'image/jpeg';
    if (!mediaUrl) {
      return xml(twimlMessage(simpleReply('unknown')));
    }
    const userId = link.userId;
    after(async () => {
      try {
        await handleImageMessage(
          { userId, phone, mediaUrl, mediaType },
          {
            sendMessage: sendWhatsAppMessage,
            downloadMedia: downloadTwilioMedia,
            analyzeImage,
            createDirectExpense,
            createVisionReceiptDraft,
            resolveDefaultAccount,
            today: todayYmd,
          },
        );
      } catch (err) {
        console.error('Error en handleImageMessage (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema leyendo tu imagen. Inténtalo de nuevo.',
        );
      }
    });
    return xml(twimlMessage('📷 Recibí tu imagen, la estoy leyendo (~30s)...'));
  }

  if (decision === 'cufe' || decision === 'quick_expense') {
    const userId = link.userId;
    after(async () => {
      try {
        await handleAgentMessage(
          decision,
          { userId, phone, body },
          {
            sendMessage: sendWhatsAppMessage,
            processCufe: processCufeForWhatsApp,
            createDirectExpense,
            resolveDefaultAccount,
            today: todayYmd,
          },
        );
      } catch (err) {
        // Red de seguridad: si algo lanza en background (DB/red), el usuario ya
        // recibió el ACK; sin esto se quedaría sin respuesta final.
        console.error('Error en handleAgentMessage (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema interno procesando tu mensaje. Inténtalo de nuevo en un momento.',
        );
      }
    });
    return xml(twimlMessage(ackMessage(decision)));
  }

  // image / help / unknown → respuesta completa síncrona.
  return xml(twimlMessage(simpleReply(decision)));
}
