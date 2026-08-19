'use client';

import React, { useCallback, useEffect, useState } from 'react';

import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import { formatCurrency, getUserAccounts } from '@/lib/services/expenses';
import type { ElectronicInvoice } from '@/types/invoices';

interface PendingInvoicesPanelProps {
  refreshToken: number; // cambia para forzar recarga
  onCompleted: () => void; // refrescar la tabla de gastos
}

/**
 * Vista de rescate: ya no hay un trámite de aprobación (el bot de WhatsApp
 * pregunta la cuenta y registra directo). Este panel solo lista facturas que
 * quedaron sin completar — `pending_review` (esperando que el usuario diga
 * la cuenta) o `error` — para que no se pierdan si el usuario nunca contestó
 * por WhatsApp o si el registro falló.
 */
export default function PendingInvoicesPanel({
  refreshToken,
  onCompleted,
}: PendingInvoicesPanelProps) {
  const [invoices, setInvoices] = useState<ElectronicInvoice[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [accountNames, setAccountNames] = useState<string[]>([]);
  const [account, setAccount] = useState<string>('');
  const [completing, setCompleting] = useState(false);

  // Cuentas reales del usuario (tabla `accounts`), no la lista fija de
  // ACCOUNT_TYPES: con esa, rescatar una factura la registraría con una
  // cuenta que puede no existir para el usuario.
  useEffect(() => {
    let active = true;
    getUserAccounts()
      .then(accts => {
        if (active) setAccountNames(accts.map(a => a.name));
      })
      .catch(() => {
        if (active) setAccountNames([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Mantener la cuenta seleccionada en sincronía con las cuentas cargadas: si
  // la factura se abre antes de que terminen de cargar, `account` quedaba vacío
  // (el select se veía con un nombre pero el botón de registrar seguía inactivo).
  useEffect(() => {
    if (accountNames.length === 0) return;
    setAccount(prev =>
      prev && accountNames.includes(prev) ? prev : accountNames[0],
    );
  }, [accountNames]);

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

  const hasProcessing = invoices.some(inv => inv.status === 'processing');
  useEffect(() => {
    if (!hasProcessing) return;
    // Depende del booleano (no del array) para mantener una cadencia limpia de
    // 1.5s: el intervalo solo se reinicia cuando deja de haber facturas en curso.
    const id = setInterval(load, 1500);
    return () => clearInterval(id);
  }, [hasProcessing, load]);

  const openInvoice = (inv: ElectronicInvoice) => {
    setOpenId(inv.id);
    setAccount(prev =>
      prev && accountNames.includes(prev) ? prev : (accountNames[0] ?? ''),
    );
  };

  const complete = async (inv: ElectronicInvoice) => {
    if (!account) {
      toast.error('No hay cuentas disponibles para registrar la factura');
      return;
    }
    setCompleting(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: account }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || 'Error registrando la factura');
      toast.success(`${data.itemsFound} gastos registrados`);
      setOpenId(null);
      await load();
      onCompleted();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Error registrando la factura',
      );
    } finally {
      setCompleting(false);
    }
  };

  if (invoices.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-600/40 bg-amber-950/20 p-4">
      <h3 className="mb-3 font-medium text-amber-300">
        Facturas sin completar ({invoices.length})
      </h3>

      <div className="space-y-2">
        {invoices.map(inv => (
          <div key={inv.id} className="rounded-md bg-slate-800 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">
                  {inv.supplier_name || 'Proveedor desconocido'}
                </p>
                {inv.status === 'processing' ? (
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{inv.progress_message || 'Procesando...'}</span>
                      <span>{inv.progress_percent ?? 0}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-700">
                      <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${inv.progress_percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
              {inv.status === 'pending_review' && (
                <Button
                  size="sm"
                  onClick={() =>
                    openId === inv.id ? setOpenId(null) : openInvoice(inv)
                  }
                >
                  {openId === inv.id ? 'Cerrar' : 'Completar'}
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
                    {accountNames.length === 0 && (
                      <option value="">Sin cuentas disponibles</option>
                    )}
                    {accountNames.map(a => (
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
                        {formatCurrency(it.total_with_tax ?? it.total_price)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {it.category}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={() => complete(inv)}
                  disabled={completing || !account}
                >
                  {completing ? 'Registrando...' : 'Registrar factura'}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
