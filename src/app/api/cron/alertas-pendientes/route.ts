/**
 * Manda por WhatsApp las alertas de presupuesto que se cruzaron sin que nadie
 * avisara: las de un gasto cargado desde la web, un presupuesto que se bajó, o
 * las semanas en que las alertas no estaban desplegadas (sep-2026). Las alertas
 * normales siguen saliendo al registrar el gasto; esta ruta solo recupera lo que
 * quedó sin avisar, y comparte `budget_alerts_sent` para no repetir nada.
 *
 * ⏸️ SIN PROGRAMAR (`crons: []` en vercel.json): corre a demanda. Un cron diario
 * choca con la ventana de 24h de WhatsApp — fuera de ella Twilio rechaza el texto
 * libre (63016) justo cuando el aviso más hace falta; eso pide una plantilla
 * aprobada.
 *
 * GET /api/cron/alertas-pendientes?phone=+57...        → marca y envía
 * GET /api/cron/alertas-pendientes?phone=+57...&dry=1  → solo muestra el texto
 * Protegida con `Authorization: Bearer $CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server';

import { alertasPendientes, type AlertDeps } from '@/lib/budget/alerts';
import { alertDepsSupabase } from '@/lib/budget/alerts-supabase';
import { createAdminClient } from '@/lib/supabase/server';
import { pegarAlertas } from '@/lib/whatsapp/alerts';
import { hoyBogotaDate, todayBogota } from '@/lib/whatsapp/format';
import { sendWhatsAppMessage } from '@/lib/whatsapp/transport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  // El número es obligatorio a propósito: un usuario puede tener varios
  // vinculados, y no todos quieren (o pueden, por la ventana de 24h) recibirlo.
  const phone = req.nextUrl.searchParams.get('phone');
  if (!phone) {
    return NextResponse.json({ error: 'falta ?phone=' }, { status: 400 });
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1';

  const supabase = createAdminClient();
  const { data: link, error: linkError } = await supabase
    .from('whatsapp_links')
    .select('user_id')
    .eq('phone_e164', phone)
    .maybeSingle();
  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }
  if (!link) {
    return NextResponse.json({ error: 'número no vinculado' }, { status: 404 });
  }

  const monthYear = todayBogota().slice(0, 7);
  const real = alertDepsSupabase();
  // En dry NO se escribe: se lee el último umbral avisado y se responde lo mismo
  // que respondería el ON CONFLICT, así la vista previa es exacta.
  const deps: AlertDeps = dry
    ? {
        cargarEstado: real.cargarEstado,
        async marcarEnviado(userId, mes, budgetItemId, threshold) {
          const { data, error } = await supabase
            .from('budget_alerts_sent')
            .select('last_threshold')
            .eq('user_id', userId)
            .eq('month_year', mes)
            .eq('budget_item_id', budgetItemId)
            .maybeSingle();
          if (error) throw new Error(error.message);
          return (data?.last_threshold ?? 0) < threshold;
        },
      }
    : real;

  const alertas = await alertasPendientes(deps, {
    userId: link.user_id,
    monthYear,
    hoy: hoyBogotaDate(),
  });
  if (alertas.length === 0) {
    return NextResponse.json({ dry, monthYear, alertas: 0, enviado: false });
  }

  const texto = pegarAlertas('📊 Alertas de presupuesto pendientes:', alertas);
  if (dry) {
    return NextResponse.json({
      dry,
      monthYear,
      alertas: alertas.length,
      texto,
    });
  }

  const envio = await sendWhatsAppMessage(phone, texto);
  if (!envio.ok) {
    // Los umbrales YA quedaron marcados: si el envío falla, este log es el único
    // registro de lo que no llegó. Correr primero con ?dry=1.
    console.error(
      '[alertas-pendientes] no se pudo enviar:',
      envio.error,
      texto,
    );
  }
  return NextResponse.json({
    dry,
    monthYear,
    alertas: alertas.length,
    texto,
    envio,
  });
}
