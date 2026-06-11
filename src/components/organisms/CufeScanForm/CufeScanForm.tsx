'use client';

import React, { useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';

interface CufeScanFormProps {
  onSaved: () => void; // refrescar panel de pendientes al terminar
}

export default function CufeScanForm({ onSaved }: CufeScanFormProps) {
  const [cufe, setCufe] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleProcess = async () => {
    const value = cufe.trim();
    if (!value) {
      toast.error('Ingresa un código CUFE');
      return;
    }
    setProcessing(true);

    try {
      const res = await fetch('/api/invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cufe: value }),
      });

      if (res.status === 409) {
        toast.error('Esta factura ya fue procesada');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }

      toast.success(
        'Procesando factura. Puedes seguir el avance en la bandeja o cerrar; termina sola.',
      );
      setCufe('');
      onSaved();
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
        <p className="text-xs text-slate-500">
          Se procesa en segundo plano. Puedes cerrar esta ventana; la factura
          aparece en la bandeja con su avance y queda como borrador para aprobar.
        </p>
      </div>

      <Button onClick={handleProcess} disabled={processing || !cufe.trim()}>
        {processing ? 'Enviando...' : 'Procesar factura'}
      </Button>
    </div>
  );
}
