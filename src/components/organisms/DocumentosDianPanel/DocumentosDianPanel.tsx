'use client';

/**
 * DocumentosDianPanel - Organism Level
 *
 * Cédula/NIT de cada número vinculado, para buscar facturas por CUFE en la
 * DIAN. El portal exige el documento del emisor o del comprador, y muchos QR
 * traen solo el link: con esto el bot (y la carga web) prueban el documento
 * de quien compró, que casi siempre es una de las personas de la cuenta.
 *
 * El número se muestra enmascarado (el completo no llega al navegador).
 */

import React, { useCallback, useEffect, useState } from 'react';

import { Check } from 'lucide-react';
import { toast } from 'sonner';

import Button from '@/components/atoms/Button/Button';
import {
  guardarDocumentoDianAction,
  listarDocumentosDianAction,
  type DocumentoDianLink,
} from '@/lib/actions/whatsapp';
import { validarDocumento } from '@/lib/dian/nits-busqueda';

export default function DocumentosDianPanel() {
  const [links, setLinks] = useState<DocumentoDianLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Borradores por link (lo que está escrito en cada input) y sus errores.
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string | null>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listarDocumentosDianAction();
      if (!res.ok) {
        setLoadError(res.error);
        return;
      }
      setLoadError(null);
      setLinks(res.links);
      setBorradores(
        Object.fromEntries(res.links.map(l => [l.id, l.documento ?? ''])),
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (id: string, value: string) => {
    setBorradores(prev => ({ ...prev, [id]: value }));
    setErrores(prev => ({ ...prev, [id]: null }));
  };

  const handleSave = async (link: DocumentoDianLink) => {
    if (savingId) return;
    const valor = borradores[link.id] ?? '';
    const validacion = validarDocumento(valor);
    if (!validacion.ok) {
      setErrores(prev => ({ ...prev, [link.id]: validacion.error }));
      return;
    }
    setSavingId(link.id);
    try {
      const res = await guardarDocumentoDianAction({
        linkId: link.id,
        documento: valor,
      });
      if (!res.ok) {
        setErrores(prev => ({ ...prev, [link.id]: res.error }));
        return;
      }
      setLinks(prev =>
        prev.map(l =>
          l.id === link.id ? { ...l, documento: res.documento } : l,
        ),
      );
      setBorradores(prev => ({ ...prev, [link.id]: res.documento ?? '' }));
      toast.success(res.documento ? 'Documento guardado' : 'Documento borrado');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/60 p-5">
      <h3 className="mb-1 text-lg font-medium text-white">
        Documento para buscar facturas en la DIAN
      </h3>
      <p className="mb-4 text-sm text-slate-400">
        La DIAN pide el documento del comprador para encontrar la factura; lo
        usamos solo para eso.
      </p>

      {isLoading ? (
        <p className="text-sm text-slate-400">Cargando números...</p>
      ) : loadError ? (
        <p className="text-sm text-red-400">{loadError}</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-slate-400">
          Vinculá un número de WhatsApp arriba para poder cargar su documento.
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map(l => {
            const valor = borradores[l.id] ?? '';
            const sinCambios = valor === (l.documento ?? '');
            const error = errores[l.id];
            const inputId = `documento-dian-${l.id}`;
            return (
              <li key={l.id} className="rounded-lg bg-white/5 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    htmlFor={inputId}
                    className="min-w-[140px] font-mono text-sm text-slate-200"
                  >
                    {l.telefono}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={valor}
                    onChange={e => handleChange(l.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSave(l);
                      }
                    }}
                    placeholder="Cédula o NIT, solo números"
                    aria-invalid={!!error}
                    aria-describedby={error ? `${inputId}-error` : undefined}
                    className="min-w-[160px] flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  />
                  <Button
                    size="sm"
                    variant="gradient"
                    onClick={() => void handleSave(l)}
                    disabled={savingId !== null || sinCambios}
                    className="flex items-center gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Guardar
                  </Button>
                </div>
                {error && (
                  <p
                    id={`${inputId}-error`}
                    className="mt-1 text-xs text-red-400"
                  >
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
