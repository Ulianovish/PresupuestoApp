'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import {
  ACCOUNT_TYPES,
  EXPENSE_CATEGORIES,
  formatCurrency,
} from '@/lib/services/expenses';
import type { ElectronicInvoice } from '@/types/invoices';

interface PendingInvoicesPanelProps {
  refreshToken: number; // cambia para forzar recarga
  onApproved: () => void; // refrescar la tabla de gastos
}

export default function PendingInvoicesPanel({
  refreshToken,
  onApproved,
}: PendingInvoicesPanelProps) {
  const [invoices, setInvoices] = useState<ElectronicInvoice[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [account, setAccount] = useState<string>([...ACCOUNT_TYPES][0]);
  const [cats, setCats] = useState<Record<number, string>>({});
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/invoices/pending');
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  const openInvoice = (inv: ElectronicInvoice) => {
    setOpenId(inv.id);
    setAccount([...ACCOUNT_TYPES][0]);
    const initial: Record<number, string> = {};
    inv.items.forEach((it, idx) => (initial[idx] = it.category));
    setCats(initial);
  };

  const approve = async (inv: ElectronicInvoice) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: account, categoryOverrides: cats }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error aprobando');
      toast.success(`${data.created} gastos creados`);
      setOpenId(null);
      await load();
      onApproved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error aprobando');
    } finally {
      setApproving(false);
    }
  };

  if (invoices.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/20 p-4">
      <h3 className="mb-3 font-medium text-amber-300">
        Facturas por aprobar ({invoices.length})
      </h3>

      <div className="space-y-2">
        {invoices.map(inv => (
          <div key={inv.id} className="rounded-md bg-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">
                  {inv.supplier_name || 'Proveedor desconocido'}
                </p>
                <p className="text-xs text-slate-400">
                  {inv.invoice_date} &middot;{' '}
                  {inv.total_amount != null
                    ? formatCurrency(inv.total_amount)
                    : '—'}{' '}
                  &middot; {inv.items.length} ítems
                  {inv.status === 'error' && (
                    <span className="text-red-400"> &middot; error</span>
                  )}
                </p>
              </div>
              {inv.status === 'pending_review' && (
                <Button
                  size="sm"
                  onClick={() =>
                    openId === inv.id ? setOpenId(null) : openInvoice(inv)
                  }
                >
                  {openId === inv.id ? 'Cerrar' : 'Revisar'}
                </Button>
              )}
            </div>

            {openId === inv.id && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-slate-400">
                    Cuenta (toda la factura)
                  </label>
                  <select
                    value={account}
                    onChange={e => setAccount(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-white"
                  >
                    {[...ACCOUNT_TYPES].map(a => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  {inv.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded bg-slate-900 px-2 py-1 text-sm"
                    >
                      <span className="flex-1 text-slate-200">
                        {it.description}
                      </span>
                      <span className="text-slate-400">
                        {formatCurrency(it.total_price)}
                      </span>
                      <select
                        value={cats[idx]}
                        onChange={e =>
                          setCats(prev => ({ ...prev, [idx]: e.target.value }))
                        }
                        className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-xs text-white"
                      >
                        {[...EXPENSE_CATEGORIES].map(c => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={() => approve(inv)}
                  disabled={approving}
                >
                  {approving ? 'Aprobando...' : 'Aprobar y crear gastos'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
