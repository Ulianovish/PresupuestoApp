'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { generateWhatsAppLinkCodeAction } from '@/lib/actions/whatsapp';

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
      toast.error(err instanceof Error ? err.message : 'Error generando código');
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
          <p className="text-sm text-slate-300">
            Abre WhatsApp y envía al número del bot:
          </p>
          <p className="rounded bg-slate-800 px-3 py-2 font-mono text-sm text-white">
            VINCULAR {code}
          </p>
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
