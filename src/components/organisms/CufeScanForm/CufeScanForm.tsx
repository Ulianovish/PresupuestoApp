'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { parseSSEEventLine } from '@/lib/dian/sse';

interface CufeScanFormProps {
  onSaved: () => void; // refrescar panel de pendientes al terminar
}

export default function CufeScanForm({ onSaved }: CufeScanFormProps) {
  const [cufe, setCufe] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  const handleProcess = async () => {
    const value = cufe.trim();
    if (!value) {
      toast.error('Ingresa un código CUFE');
      return;
    }
    setProcessing(true);
    setProgress(0);
    setMessage('Iniciando...');

    try {
      const res = await fetch(
        `/api/invoices/process?cufe=${encodeURIComponent(value)}`,
      );

      if (res.status === 409) {
        toast.error('Esta factura ya fue procesada');
        setProcessing(false);
        return;
      }
      if (!res.ok || !res.body) {
        throw new Error(`Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let saved = false;

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const event = parseSSEEventLine(line);
          if (!event) continue;
          if (typeof event.progress === 'number') setProgress(event.progress);
          if (event.message) setMessage(event.message);
          if (event.step === 'saved') {
            saved = true;
            toast.success('Factura guardada como borrador para aprobar');
          }
          if (event.step === 'error') {
            throw new Error(event.error ?? 'Error procesando factura');
          }
        }
      }

      if (saved) {
        setCufe('');
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error procesando');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Código CUFE</label>
        <input
          value={cufe}
          onChange={e => setCufe(e.target.value)}
          disabled={processing}
          placeholder="Pega el código CUFE de la factura DIAN..."
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 font-mono text-sm text-white"
        />
      </div>

      {processing && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{message}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">
            El proceso puede tardar ~1 minuto. Quedará como borrador para aprobar.
          </p>
        </div>
      )}

      <Button onClick={handleProcess} disabled={processing || !cufe.trim()}>
        {processing ? 'Procesando...' : 'Procesar factura'}
      </Button>
    </div>
  );
}
