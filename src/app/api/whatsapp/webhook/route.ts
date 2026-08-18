// POST /api/whatsapp/webhook
// Webhook público de Twilio. Valida la firma, resuelve identidad y:
//  - número NO vinculado → flujo de vinculación síncrono (TwiML).
//  - vinculado → clasifica el texto, responde un ACK síncrono y, si hay trabajo
//    lento (CUFE / gasto), lo corre en after() respondiendo por la REST API.

import { after, NextRequest } from 'next/server';

import { createInvoiceDirect } from '@/lib/services/invoices';
import {
  createDirectExpense,
  createVisionReceiptDraft,
  resolveDefaultAccount,
} from '@/lib/services/whatsapp-expenses';
import {
  getLinkByPhone,
  redeemLinkCode,
} from '@/lib/services/whatsapp-links';
import { readState, writeState } from '@/lib/whatsapp/agent/state';
import { handleAgentTurn, listarCuentas } from '@/lib/whatsapp/agent/turn';
import { ackMessage, classifyText, simpleReply } from '@/lib/whatsapp/classify';
import { todayBogota } from '@/lib/whatsapp/format';
import { handleAgentMessage } from '@/lib/whatsapp/handle-agent';
import { handleImageMessage } from '@/lib/whatsapp/handle-image';
import { handleLinkingMessage } from '@/lib/whatsapp/handle-linking';
import { normalizeWhatsappFrom } from '@/lib/whatsapp/message';
import { processCufeForWhatsApp } from '@/lib/whatsapp/process-cufe';
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
    if (!mediaUrl) {
      return xml(twimlMessage(simpleReply('help')));
    }
    const userId = link.userId;
    after(async () => {
      try {
        const [accounts, estado] = await Promise.all([
          listarCuentas(userId),
          readState(phone),
        ]);
        await handleImageMessage(
          {
            userId,
            phone,
            mediaUrl,
            body,
            existingPendingId: estado.pending?.invoiceId ?? null,
          },
          {
            sendMessage: sendWhatsAppMessage,
            downloadMedia: downloadTwilioMedia,
            analyzeImage,
            createDirectExpense,
            resolveDefaultAccount,
            today: todayBogota,
            accounts,
            createReceiptDraft: createVisionReceiptDraft,
            savePending: invoiceId =>
              writeState(phone, userId, {
                pending: { kind: 'invoice_account', invoiceId },
              }),
            registerInvoice: (invoiceId, accountName) =>
              createInvoiceDirect(userId, invoiceId, accountName),
          },
        );
      } catch (err) {
        // No se puede saber en qué punto reventó: puede haber sido antes de
        // leer la foto o después de registrar la mitad de sus ítems. Una foto
        // NO tiene dedup (a diferencia del CUFE, que se reconoce por su
        // código), así que invitar a reenviarla duplicaría la factura entera.
        console.error('Error en handleImageMessage (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema leyendo tu imagen. Puede que algo se haya alcanzado a registrar: revisá en la app antes de reenviarla, para no duplicarla.',
        );
      }
    });
    return xml(twimlMessage('📷 Recibí tu imagen, la estoy leyendo (~30s)...'));
  }

  if (decision === 'cufe') {
    const userId = link.userId;
    after(async () => {
      try {
        const [accounts, estado] = await Promise.all([
          listarCuentas(userId),
          readState(phone),
        ]);
        await handleAgentMessage(
          decision,
          {
            userId,
            phone,
            body,
            existingPendingId: estado.pending?.invoiceId ?? null,
          },
          {
            sendMessage: sendWhatsAppMessage,
            processCufe: processCufeForWhatsApp,
            accounts,
            savePending: invoiceId =>
              writeState(phone, userId, {
                pending: { kind: 'invoice_account', invoiceId },
              }),
            registerInvoice: (invoiceId, accountName) =>
              createInvoiceDirect(userId, invoiceId, accountName),
          },
        );
      } catch (err) {
        // Red de seguridad: si algo lanza en background (DB/red), el usuario ya
        // recibió el ACK; sin esto se quedaría sin respuesta final.
        //
        // El CUFE sí tiene dedup por código, pero el registro de sus ítems no:
        // si reventó DESPUÉS de leer la factura, reenviarlo puede duplicar lo
        // ya escrito. Por eso el reintento se condiciona a lo que el usuario
        // vio, en vez de ofrecerse a ciegas.
        console.error('Error en handleAgentMessage (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema interno procesando tu factura. Si ya te había dicho que la leí, revisala en la app antes de reenviar el CUFE.',
        );
      }
    });
    return xml(twimlMessage(ackMessage()));
  }

  if (decision === 'agent') {
    const userId = link.userId;
    after(async () => {
      try {
        await handleAgentTurn({ userId, phone, body });
      } catch (err) {
        // Mismo criterio que la imagen: acá adentro corren las herramientas
        // que escriben gastos, y desde afuera no hay forma de saber si alguna
        // alcanzó a hacerlo. "Inténtalo de nuevo" invitaba a registrar el
        // mismo gasto dos veces.
        console.error('Error en handleAgentTurn (background):', err);
        await sendWhatsAppMessage(
          phone,
          '❌ Tuve un problema procesando tu mensaje. Puede que algo se haya alcanzado a registrar: revisá en la app antes de reenviarlo, para no duplicarlo.',
        );
      }
    });
    return xml(twimlMessage('✍️ Un momento...'));
  }

  // help → respuesta completa síncrona (image/cufe/agent se manejan arriba).
  return xml(twimlMessage(simpleReply(decision)));
}
