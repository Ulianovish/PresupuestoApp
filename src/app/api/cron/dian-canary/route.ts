/**
 * Canario del CUFE: corre una factura conocida por cada motor y avisa si alguno
 * dejó de funcionar. Existe porque la DIAN rompe el scraper en silencio (el
 * campo NIT que agregó en jun-2026 tardó ~6 semanas en detectarse).
 *
 * ⏸️ SIN PROGRAMAR (`crons: []` en vercel.json). Funciona a demanda; el cron
 * quedó apagado a propósito hasta resolver el canal de aviso.
 *
 * El aviso NO va por WhatsApp: la ventana de 24h de WhatsApp Business bloquea el
 * texto libre justo en el caso que importa (llevás días sin escribirle al bot).
 * El canal elegido es **Telegram**, vía el agente que ya corre en el VPS —
 * pendiente de conectar. Mientras tanto un cron diario solo quemaría saldo de
 * 2captcha (~5 captchas por corrida) sin que nadie lea el resultado, y ese saldo
 * hace falta para las facturas de verdad.
 *
 * La ruta está protegida: sin el secreto correcto devuelve 401 y no ejecuta nada.
 */
import { NextRequest, NextResponse } from 'next/server';

import { correrCanario } from '@/lib/dian/canary';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Dos motores en serie a ~50-150s cada uno.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  // Vercel Cron manda `Authorization: Bearer $CRON_SECRET`. Sin CRON_SECRET
  // configurado la ruta queda cerrada: es preferible un canario mudo a un
  // endpoint público que cualquiera puede disparar para quemar 2captcha.
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const destino = process.env.DIAN_CANARY_ALERT_TO;

  // ?test=alerta — probar el CANAL de aviso sin esperar a que algo se rompa ni
  // gastar 2captcha. Importante porque el modo de falla real de WhatsApp es la
  // ventana de 24h: fuera de ella Twilio rechaza el texto libre (error 63016) y
  // el canario quedaría gritando al vacío justo cuando hace falta.
  if (req.nextUrl.searchParams.get('test') === 'alerta') {
    if (!destino) {
      return NextResponse.json({ error: 'falta DIAN_CANARY_ALERT_TO' }, { status: 400 });
    }
    const envio = await sendWhatsAppMessage(
      destino,
      '🐤 Prueba del canario del CUFE. Si te llegó esto, el canal de aviso funciona. (No pasa nada, no se rompió nada.)',
    );
    return NextResponse.json({ prueba: true, destino, envio });
  }

  const resultado = await correrCanario();
  console.log('[canario-dian]', JSON.stringify(resultado.motores));

  let avisado = false;
  if (resultado.alerta && destino) {
    const envio = await sendWhatsAppMessage(destino, resultado.alerta);
    avisado = envio.ok;
    if (!envio.ok) {
      console.error('[canario-dian] no se pudo avisar:', envio.error ?? envio.status);
    }
  } else if (resultado.alerta) {
    // Falló algo pero no hay a quién avisarle: que quede en los logs, no en silencio.
    console.error('[canario-dian] SIN DESTINO (DIAN_CANARY_ALERT_TO):', resultado.alerta);
  }

  return NextResponse.json({
    ok: !resultado.alerta,
    cufe: resultado.cufe.slice(0, 16),
    motores: resultado.motores,
    avisado,
  });
}
