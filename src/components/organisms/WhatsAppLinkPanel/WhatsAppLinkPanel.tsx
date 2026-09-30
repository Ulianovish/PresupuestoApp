'use client';

import React, { useState } from 'react';

import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';
import { buildWhatsAppLinkUrl } from '@/lib/whatsapp/link-url';

// Next.js reemplaza NEXT_PUBLIC_* en el build. Sin la variable, el panel
// muestra solo el código (sin botón), como antes.
const BOT_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER;

/**
 * Qué hacer con el código: con enlace, el botón "Abrir WhatsApp" (wa.me con
 * el mensaje ya escrito); sin enlace, solo el mensaje para copiar a mano.
 */
export function WhatsAppLinkInstructions({
  code,
  linkUrl,
}: {
  code: string;
  linkUrl: string | null;
}) {
  return (
    <>
      {linkUrl ? (
        <>
          <p className="text-sm text-slate-300">
            Toca el botón: WhatsApp se abre con el mensaje listo, solo tienes
            que enviarlo.
          </p>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Abrir WhatsApp
          </a>
          <p className="text-sm text-slate-400">
            ¿No se abrió? Envía este mensaje al número del bot:
          </p>
        </>
      ) : (
        <p className="text-sm text-slate-300">
          Abre WhatsApp y envía al número del bot:
        </p>
      )}

      <p className="rounded bg-slate-800 px-3 py-2 font-mono text-sm text-white">
        VINCULAR {code}
      </p>
    </>
  );
}

export default function WhatsAppLinkPanel() {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await generateWhatsAppLinkCodeAction();
      if (!res.ok) throw new Error(res.error);
      setCode(res.code);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error generando código',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">Conectar WhatsApp</h3>
      <p className="mb-4 text-sm text-slate-400">
        Vincula tu WhatsApp para registrar gastos enviando facturas o
        transferencias. Genera un código y envíalo al bot.
      </p>

      {code ? (
        <div className="space-y-3">
          <div className="rounded-md bg-slate-800 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Tu código (válido 10 minutos)
            </p>
            <p className="mt-1 font-mono text-3xl tracking-widest text-emerald-400">
              {code}
            </p>
          </div>
          <WhatsAppLinkInstructions
            code={code}
            linkUrl={buildWhatsAppLinkUrl(BOT_NUMBER, code)}
          />
          <Button variant="outline" onClick={generate} disabled={loading}>
            {loading ? 'Generando...' : 'Generar otro código'}
          </Button>
        </div>
      ) : (
        <Button onClick={generate} disabled={loading}>
          {loading ? 'Generando...' : 'Generar código de vinculación'}
        </Button>
      )}
    </div>
  );
}
